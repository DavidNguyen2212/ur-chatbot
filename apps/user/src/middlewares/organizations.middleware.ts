import { checkSchema } from 'express-validator'
import { prisma } from '../infra/prisma/prisma.client' 
import { MemberRole } from '@prisma/client'
import { ErrorWithStatus } from '../interfaces/Errors'

export const inviteMemberValidator = checkSchema({
  email: {
    in: ['body'],
    isEmail: true,
    notEmpty: true,
    errorMessage: 'Email người dùng không hợp lệ'
  },
  role: {
    in: ['body'],
    isString: true,
    notEmpty: true,
    custom: {
      options: (value) => {
        if (value === MemberRole.OWNER) throw new ErrorWithStatus({
          message: 'Không thể mời người dùng làm chủ sở hữu',
          status: 403
        })
        if (![MemberRole.AGENT, MemberRole.ADMIN].includes(value)) {
          throw new ErrorWithStatus({
            message: 'Invalid role!',
            status: 403
          })
        }
        return true
      }
    }
  }
})
