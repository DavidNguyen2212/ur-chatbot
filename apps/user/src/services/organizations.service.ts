import { addDays } from "date-fns"
import { InviteUserBody } from "../interfaces/dtos/organization.dto"
import { ErrorWithStatus } from "../interfaces/Errors"
import { prisma } from "../infra/prisma/prisma.client"
import { ORG } from "../constants/org.constant"
import { randomInt } from "crypto"
import { sendOrgInvitationEmail } from "../utils/org.util"
import { CurrentUserPayload } from "../type"
import { MemberRole, Prisma } from "@prisma/client"

class OrganizationsService {
  async getOrgDetail(orgId: string) {
    const organization = await prisma.organization.findUnique({ where: { id: orgId } })

    return organization
  }

  async getOrgMembersDetail(orgId: string, limit: number = 10, offset: number = 0) {
    // const organization = await prisma.organization.findUnique({ where: { id: orgId } })
    const members = await prisma.organizationMember.findMany({
      where: { 
        organization: { id: orgId },
        
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            avatar: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            // password field is excluded
          }
        },
      },
      take: limit,
      skip: offset,
    })

    // Get total count for pagination info
    const totalCount = await prisma.organizationMember.count({
      where: { 
        organization: { id: orgId },
      },
    })

    return {
      members,
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + limit < totalCount
      }
    }
  }

  async inviteMember(user: CurrentUserPayload, payload: InviteUserBody) {
    const { email, role } = payload
    const existingUser = await prisma.user.findUnique({ 
      where: { email } 
    })
    if (existingUser) throw new ErrorWithStatus({
      message: 'Người dùng với email này đã tồn tại trong hệ thống.',
      status: 400
    })

    const existingInvite = await prisma.organizationInvite.findFirst({
      where: {
        email,
        organizationId: user.organization?.id,
        isUsed: false,
        isRevoked: false,
        expiresAt: { gt: new Date() }
      }
    })
    if (existingInvite) throw new ErrorWithStatus({
      message: 'Đã tồn tại lời mời đang hoạt động cho email này.',
      status: 400
    })
    
    if (role === 'AGENT') {
      const [activeAgents, pendingInvites, totalLimit] = await Promise.all([
        prisma.organizationMember.count({
          where: { organizationId: user.organization?.id, role: 'AGENT', user: { isActive: true } }
        }),
        prisma.organizationInvite.count({
          where: {
            organizationId: user.organization?.id,
            role: 'AGENT',
            isUsed: false,
            isRevoked: false,
            expiresAt: { gt: new Date() }
          }
        }),
        10
        // getAgentLimit(organizationId) // Hàm giả định
      ])

      console.log(activeAgents, pendingInvites, totalLimit);

      if (activeAgents + pendingInvites >= totalLimit) {
        throw new ErrorWithStatus({
          message: `Không thể mời thêm nhân viên. Đã sử dụng ${activeAgents} nhân viên và có ${pendingInvites} lời mời đang chờ xử lý. Giới hạn hiện tại là ${totalLimit}.`,
          status: 400
        })
      }
    }

    const inviteCode = await this.generateUniqueInviteCode()
    const invite = await prisma.$transaction(async (tx) => {
      const invite = await tx.organizationInvite.create({
        data: {
          email,
          role,
          inviteCode,
          invitedBy: { connect: { id: user.id }},
          organization: { connect: { id: user.organization?.id } },
          expiresAt: addDays(new Date(), 7)
        },
        include: {
          invitedBy: true
        }
      })

      return invite
    })

    await sendOrgInvitationEmail({
      organization_name: user.organization?.name!,
      inviter_name: invite.invitedBy!.name,
      email,
      role,
      invite_code: inviteCode,
      expires_at: invite.expiresAt,
    }, email)
    
    return {
      status: 200
    }
  }

  private generateRandomCode(length: number = ORG.INVITE_CODE_LENGTH, alphabet: string = ORG.INVITE_CODE_ALPHABET): string {
    let code = ''
    for (let i = 0; i < length; i++) {
      const index = randomInt(0, alphabet.length)
      code += alphabet[index]
    }
    return code
  }

  private async generateUniqueInviteCode() {
    for (let attempts = 0; attempts < 5; attempts++) {
      const code = this.generateRandomCode()
      const exists = await prisma.organizationInvite.findUnique({
        where: { inviteCode: code } // đảm bảo inviteCode là unique index trong Prisma schema
      })
  
      if (!exists) 
        return code
    }
  
    throw new ErrorWithStatus({
      message: 'Unable to generate unique invite code after multiple attempts',
      status: 400
    })
  }

  async getInvitation(orgId: string, limit: number, offset: number, status?: string) {
    const now = new Date()
    const statusFilters: Record<string, Prisma.OrganizationInviteWhereInput> = {
      [ORG.INVITE_STATUS.ACTIVE]: {
        isUsed: false,
        isRevoked: false,
        expiresAt: { gt: now }
      },
      [ORG.INVITE_STATUS.USED]: {
        isUsed: true
      },
      [ORG.INVITE_STATUS.EXPIRED]: {
        isUsed: false,
        isRevoked: false,
        expiresAt: { lte: now }
      },
      [ORG.INVITE_STATUS.REVOKED]: {
        isRevoked: true
      }
    }

    const filterConditions = status ? statusFilters[status] ?? {} : {}
    const [invitations, total] = await Promise.all([
      prisma.organizationInvite.findMany({
        where: {
          organizationId: orgId,
          ...filterConditions
        },
        take: limit,
        skip: offset,
        include: {
          invitedBy: { 
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              avatar: true,
              isActive: true,
              createdAt: true,
              updatedAt: true,
              // password field is excluded
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.organizationInvite.count({
        where: {
          organizationId: orgId,
          ...filterConditions
        }
      })
    ])

    return {
      invitations,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + invitations.length < total
      }
    }
  }

  async revokeInvitation(inviteId: string) {
    const invitation = await prisma.organizationInvite.findUnique({
      where: { id: inviteId }
    })
    if (!invitation) {
      throw new ErrorWithStatus({
        message: "Invitation not found",
        status: 404
      })
    }

    if (invitation.isRevoked) {
      throw new ErrorWithStatus({
        message: "Invitation was revoked",
        status: 403
      })
    } else if (invitation.isUsed) {
      throw new ErrorWithStatus({
        message: "Invitation was used",
        status: 403
      })
    }

    await prisma.$transaction(async (tx) => {
      await tx.organizationInvite.update(
        {
          where: { id: inviteId },
          data: { isRevoked: true }
        }
      )
    })
  }

  async removeMember(orgId: string, memberId: string) {
    const member = await prisma.organizationMember.findFirst({
      where: { userId: memberId, organizationId: orgId }
    })
    if (!member) {
      throw new ErrorWithStatus({
        message: "Member not found",
        status: 404
      })
    }
    if (member.role === MemberRole.OWNER) {
      throw new ErrorWithStatus({
        message: "Cannot remove owner!",
        status: 403
      })
    }

    await prisma.$transaction(async (tx) => {
      if (member.role === MemberRole.AGENT) {
        // TODO: Call chat service to delete agent data
        // For now, just log that we would call the chat service
        console.log(`Would call chat service to delete agent data for user ${memberId} in organization ${orgId}`)
      }

      // Remove the organization membership relationship
      await tx.organizationMember.deleteMany({
        where: { 
          userId: memberId,
          organizationId: orgId
        }
      })
    })
  }

  async leaveOrg(userId: string, orgId: string, role: string) {
    return await prisma.$transaction(async (tx) => {
      // Validate that user is actually a member of this organization
      if (role === MemberRole.OWNER) {
        // Count owners in this specific organization
        const ownerCount = await tx.organizationMember.count({
          where: {
            organizationId: orgId,
            role: MemberRole.OWNER
          }
        })

        if (ownerCount === 1) {
          // This is the last owner, delete the entire organization
          await tx.organizationMember.deleteMany({
            where: { organizationId: orgId }
          })
          await tx.organization.delete({
            where: { id: orgId }
          })
          return { detail: "Đã xóa tổ chức vì đây là chủ sở hữu cuối cùng" }
        } else {
          // There are other owners, just remove this owner's membership
          await tx.organizationMember.deleteMany({
            where: { userId, organizationId: orgId }
          })
          return { detail: "Đã rời tổ chức (vẫn còn chủ sở hữu khác)" }
        }
      }
      
      if (role === MemberRole.AGENT) {
        // TODO: Call chat service to delete agent data
        // For now, just log that we would call the chat service
        console.log(`Would call chat service to delete agent data for user ${userId} in organization ${orgId}`)
      }

      // For ADMIN and AGENT roles, just remove membership
      await tx.organizationMember.deleteMany({
        where: { userId, organizationId: orgId }
      })

      return { detail: "Đã rời tổ chức" }
    })
  }
}

const organizationsService = new OrganizationsService()
export default organizationsService