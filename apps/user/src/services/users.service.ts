import { ErrorWithStatus } from "../interfaces/Errors"
import { prisma } from "../infra/prisma/prisma.client"
import { uploadFileToS3 } from "../infra/s3/s3.upload"

interface UpdateUserInput {
  userId: string
  name?: string
  phone?: string
  avatar?: Express.Multer.File
}

class UsersService {
  async getUserInfo(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        organizationMembers: {
          include: { organization: true }
        }
        // Do not include emailVerificationTokens, organizationInvites
      }
    })

    if (!user) {
      throw new ErrorWithStatus({
        message: "User not found",
        status: 404
      })
    }

    return user
  }

  async updateUserInfo({ userId, name, phone, avatar }: UpdateUserInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      throw new Error('Người dùng không tồn tại')
    }

    let newAvatarKey = user.avatar ?? null
    if (avatar) {
      newAvatarKey = `avatar/${userId}`
      await uploadFileToS3({
        contentType: avatar.mimetype,
        filename: newAvatarKey,
        filestream: avatar.buffer
      })
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          name,
          phone,
          avatar: newAvatarKey
        }
      })
      return updatedUser
    })

    return {
      email: updatedUser.email,
      name: updatedUser.name,
      phone_number: updatedUser.phone,
      avatar: updatedUser.avatar
    }
  }
}

const usersService = new UsersService()
export default usersService