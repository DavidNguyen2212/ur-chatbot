import { add } from 'date-fns/add'
import { isBefore } from 'date-fns/isBefore'
import { ChangePasswordBody, JoinOrgBody, LoginBody, RefreshBody, RegisterOrgBody, ResetPasswordBody, ResetPasswordReqBody } from '../interfaces/dtos/auth.dto'
import { prisma } from '../infra/prisma/prisma.client'
import * as bcrypt from 'bcryptjs'
import { ErrorWithStatus } from '../interfaces/Errors'
import { randomBytes, randomUUID } from 'crypto'
import { sendPasswordResetEmail, sendVerificationEmail } from '../utils/auth.util'
import { JwtPayload, sign, SignOptions, verify } from 'jsonwebtoken'
import { AUTH } from '../constants/auth.constant'
import redisClient from '../infra/redis/redis.client'
import { sendOrgRegisteredEvent } from '../infra/kafka/sendEmail'


class AuthService {
  async registerOrg(payload: RegisterOrgBody) {
    // Check email exists
    const existingOrg = await prisma.organization.findUnique({ where: { contactEmail: payload.contact_email } })
    if (existingOrg) {
      throw new ErrorWithStatus({
        message: 'This email already has an organization',
        status: 400
      })
    }

    // Now start transaction with tx (instead of prisma)
    const { newUser, newOrg, orgMember, token } = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: payload.user_name,
          email: payload.user_email,
          phone: payload.user_phone,
          password: await this.hashPassword(payload.password),
          isActive: false,
          avatar: process.env.DEFAULT_AVATAR_URL || ''
        }
      })

      const newOrg = await tx.organization.create({
        data: {
          name: payload.org_name,
          description: payload.description,
          contactEmail: payload.contact_email,
          contactPhone: payload.contact_phone
        }
      })

      const orgMember = await tx.organizationMember.create({
        data: {
          role: 'OWNER',
          // organization: newOrg, sai
          // user: newUser, sai luôn => dùng connect, chèn id. Đây là khác biệt của Prisma và Typeorm
          organization: { connect: { id: newOrg.id } },
          user: { connect: { id: newUser.id } }
        }
      })

      const token = this.createVerificationToken()
      await tx.emailVerificationTokens.create({
        data: {
          token,
          isUsed: false,
          user: { connect: { id: newUser.id } }
        }
      })

      return { newUser, newOrg, orgMember, token }
    })

    // Send email out of the box!
    // 'Cause in case of rollback, user will receive unreal email
    await sendVerificationEmail(newUser.name, newUser.email, token)
    await sendOrgRegisteredEvent({
      orgId: newOrg.id,
      orgName: newOrg.name,
      userId: newUser.id,
      userEmail: newUser.email
    })
    
    return orgMember
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt()
    return bcrypt.hash(password, salt)
  }

  private async comparePassword(plain: string, hashed: string): Promise<boolean> {
    return await bcrypt.compare(plain, hashed)
  }

  private generateRefreshToken(payload: object, jti: string, options?: SignOptions) {
    return sign({...payload, jti}, AUTH.JWT_SECRET, options)
  }

  private generateAccessToken(payload: object, options?: SignOptions) {
    return sign(payload, AUTH.JWT_SECRET, options)
  }

  private verifyJWT(token: string) {
    return verify(token, AUTH.JWT_SECRET)
  }

  private createVerificationToken() {
    const token = randomBytes(32).toString('hex') // tương đương secrets.token_urlsafe
    return token
  }

  async joinOrg(payload: JoinOrgBody) {
    const { invite_code, password, name, phone } = payload
    // Lấy invite trước ngoài transaction để kiểm tra
    const existingInvite = await prisma.organizationInvite.findUnique({ where: { inviteCode: invite_code } })
    if (!existingInvite) {
      throw new ErrorWithStatus({
        message: 'This user was not invited by any organization',
        status: 404
      })
    }
    if (existingInvite.isUsed || existingInvite.isRevoked || existingInvite.expiresAt < new Date()) {
      throw new ErrorWithStatus({
        message: 'Invitation is invalid or expired!',
        status: 400
      })
    }
    // Kiểm tra user đã tồn tại chưa
    const existingJoinedUser = await prisma.user.findFirst({ where: { email: existingInvite.email } })
    if (existingJoinedUser) {
      throw new ErrorWithStatus({
        message: 'Invitation has been used!',
        status: 400
      })
    }
    // Transaction: tạo user, member, update invite
    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: existingInvite.email,
          name,
          phone,
          password: await this.hashPassword(password),
          avatar: process.env.DEFAULT_AVATAR_URL || '',
          isActive: true
        }
      })
      const newMember = await tx.organizationMember.create({
        data: {
          role: existingInvite.role,
          user: { connect: { id: newUser.id } },
          organization: { connect: { id: existingInvite.organizationId } },
        }
      })
      await tx.organizationInvite.update({
        where: { id: existingInvite.id },
        data: { isUsed: true }
      })
      return { user: newUser, member: newMember }
    })

    return result
  }

  async verifyEmail(tokenData: any) {
    const { id, userId } = tokenData

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { isActive: true }
      })
  
      await tx.emailVerificationTokens.update({
        where: { id: id },
        data: { isUsed: true }
      })
    })
    
    return {
      status: 200,
      userId,
      emailVerified: true
    }
  }

  async login(payload: LoginBody) {
    const { email, password, org_contact_email } = payload
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        organizationMembers: {
          include: {
            organization: true
          }
        }
      }
    })
    if (!user) {
      throw new ErrorWithStatus({
        message: 'Không tìm thấy tài khoản với địa chỉ email này.',
        status: 404
      })
    }

    const isValidPassword = await this.comparePassword(password, user.password)
    if (!isValidPassword) {
      throw new ErrorWithStatus({
        message: 'Mật khẩu không chính xác.',
        status: 400
      })
    }

    const jwtPayload: any = {
      userId: user.id,
      email: user.email
    }

    if (user.organizationMembers && user.organizationMembers.length > 0) {
      let selectedOrgMember
      if (org_contact_email) {
        selectedOrgMember = user.organizationMembers.find(
          (member) => member.organization.contactEmail === org_contact_email
        )
        if (!selectedOrgMember) {
          throw new ErrorWithStatus({
            message: `Bạn không phải là thành viên của tổ chức này hoặc tổ chức không tồn tại.`,
            status: 403
          })
        }
      } else {
        // Lấy tổ chức đầu tiên nếu không có org_contact_email
        selectedOrgMember = user.organizationMembers[0]
      }
      jwtPayload.organization = {
        id: selectedOrgMember.organization.id,
        name: selectedOrgMember.organization.name,
        role: selectedOrgMember.role
      }
    }

    const jti = randomUUID()
    const accessToken = this.generateAccessToken(jwtPayload, { expiresIn: '15m' })
    const refreshToken = this.generateRefreshToken(jwtPayload, jti, { expiresIn: '7d' })
    await redisClient.set(`refresh_token:${jti}`, refreshToken, 'EX', 7 * 24 * 60 * 60)  // 7D

    return {
      accessToken,
      refreshToken
    }
  }

  async refreshToken(payload: RefreshBody) {
    const { refresh } = payload
    const decoded = this.verifyJWT(refresh) as JwtPayload
    const { userId, email, organization, jti } = decoded

    const tokenInRedis = await redisClient.get(`refresh_token:${jti}`)
    if (!tokenInRedis) {
      throw new ErrorWithStatus({
        message: "Refresh token expired. Required reLogin",
        status: 403
      })
    }

    const access = this.generateAccessToken({ userId, email, organization }, { expiresIn: '15m' })
    return { access }
  }

  async resetPassword(payload: ResetPasswordReqBody) {
    const { email } = payload
    const user = await prisma.user.findUnique({
      where: { email }
    })
    if (!user) {
      throw new ErrorWithStatus({
        message: `User with email: ${email} does not exists`,
        status: 404
      })
    }

    const resetToken = await prisma.$transaction(async (tx) => {
      const resetToken = await tx.passwordResetTokens.create({
        data: {
          token: this.createVerificationToken(),
          user: { connect: { id: user.id } }
        }
      })

      return resetToken
    })
    
    await sendPasswordResetEmail(user.name, user.email, resetToken.token)

    return { 
      status: 200,
      emailResetSend: true
    }
  }

  async resetPasswordConfirm(resetTokenData: any, payload: ResetPasswordBody) {
    const { userId, id } = resetTokenData
    const { password } = payload

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          password: await this.hashPassword(password)
        }
      })
  
      await tx.passwordResetTokens.update({
        where: { id },
        data: {
          isUsed: true
        }
      })
    })

    return {
      status: 200
    }
  }

  async changePassword(userId: string, payload: ChangePasswordBody) {
    const { current_password, new_password } = payload
    const thisUser = await prisma.user.findUnique({ where: { id: userId }})
    if (!thisUser) {
      throw new ErrorWithStatus({
        message: 'User not found',
        status: 404
      })
    }

    const correctPassword = await this.comparePassword(current_password, thisUser.password)
    if (!correctPassword) {
      throw new ErrorWithStatus({
        message: 'Old password incorrect',
        status: 403
      })
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          password: await this.hashPassword(new_password)
        }
      })
    })

    return {
      status: 200
    }
  }

  async logOut(payload: RefreshBody) {
    const { refresh } = payload
    const {jti} = this.verifyJWT(refresh) as JwtPayload
    await redisClient.del(`refresh_token:${jti}`)
  }
}

const authService = new AuthService()
export default authService
