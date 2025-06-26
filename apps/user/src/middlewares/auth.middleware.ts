import { checkSchema } from 'express-validator'
import { prisma } from '../infra/prisma/prisma.client'
import { AUTH } from '../constants/auth.constant'
import { ErrorWithStatus } from '../interfaces/Errors'

export const registerOrgValidator = checkSchema({
  // Organization fields
  org_name: {
    in: ['body'],
    isString: true,
    notEmpty: {
      errorMessage: 'Tên tổ chức là bắt buộc'
    },
    isLength: {
      options: { max: 255 },
      errorMessage: 'Tên quá dài'
    }
  },
  description: {
    in: ['body'],
    optional: true,
    isString: true
  },
  contact_email: {
    in: ['body'],
    isEmail: true,
    errorMessage: 'Email liên hệ không hợp lệ'
  },
  contact_phone: {
    in: ['body'],
    optional: true,
    isString: true
  },

  // User fields
  user_email: {
    in: ['body'],
    isEmail: true,
    errorMessage: 'Email người dùng không hợp lệ'
    // custom: {
    //   options: async (value) => {
    //     const existing = await prisma.user.findUnique({ where: { email: value } })
    //     if (existing) {
    //       throw new Error('Email này đã tồn tại')
    //     }
    //   },
    // },
  },
  password: {
    in: ['body'],
    isLength: {
      options: { min: 6 },
      errorMessage: 'Mật khẩu tối thiểu 6 ký tự'
    },
    isStrongPassword: {
      options: {
        minLength: 6,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1
      },
      errorMessage: 'Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường, 1 số, 1 ký tự đặc biệt'
    }
  },
  confirm_password: {
    in: ['body'],
    custom: {
      options: (value, { req }) => {
        if (value !== req.body.password) {
          throw new ErrorWithStatus({
            message: 'Mật khẩu nhập lại không khớp',
            status: 401
          })
        }
        return true
      }
    }
  },
  user_name: {
    in: ['body'],
    isString: true,
    notEmpty: {
      errorMessage: 'Tên người dùng là bắt buộc'
    }
  },
  user_phone: {
    in: ['body'],
    isString: true,
    notEmpty: {
      errorMessage: 'Số điện thoại là bắt buộc'
    }
  }
})

export const joinOrgValidator = checkSchema({
  // Organization fields
  invite_code: {
    in: ['body'],
    isString: true,
    notEmpty: {
      errorMessage: 'Mã lời mời là bắt buộc'
    }
  },
  password: {
    in: ['body'],
    isLength: {
      options: { min: 6 },
      errorMessage: 'Mật khẩu tối thiểu 6 ký tự'
    },
    isStrongPassword: {
      options: {
        minLength: 6,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1
      },
      errorMessage: 'Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường, 1 số, 1 ký tự đặc biệt'
    }
  },
  confirm_password: {
    in: ['body'],
    custom: {
      options: (value, { req }) => {
        if (value !== req.body.password) {
          throw new ErrorWithStatus({
            message: 'Mật khẩu nhập lại không khớp',
            status: 401
          })
        }
        return true
      }
    }
  },
  name: {
    in: ['body'],
    isString: true,
    notEmpty: {
      errorMessage: 'Tên người dùng là bắt buộc'
    }
  },
  phone: {
    in: ['body'],
    isString: true,
    notEmpty: {
      errorMessage: 'Số điện thoại là bắt buộc'
    }
  }
  // OPtional: is 8601 iso string date of birth
})

export const verifyEmailValidator = checkSchema({
  token: {
    in: ['body'],
    isString: true,
    notEmpty: {
      errorMessage: 'Token is required'
    },
    isLength: {
      options: { min: 32, max: 32},
      errorMessage: 'Token chỉ có 32 ký tự'
    },
    custom: {
      options: async (value, { req }) => {
        const existingToken = await prisma.emailVerificationTokens.findUnique({
          where: { token: value }
        });
    
        if (!existingToken || existingToken.isUsed) {
          throw new ErrorWithStatus({
            message: 'Verification code invalid!',
            status: 400
          });
        }
    
        const expirationDate = new Date(
          existingToken.createdAt.getTime() + AUTH.EMAIL_VERIFICATION_TIMEOUT_DAYS * 24 * 60 * 60 * 1000
        );
    
        if (expirationDate < new Date()) {
          throw new Error('Verification code expired!');
        }

        req.existingEmailToken = existingToken;
      },
    }
  },
})

export const loginValidator = checkSchema({
  email: {
    in: ['body'],
    isEmail: true,
    errorMessage: 'Email liên hệ không hợp lệ'
  },
  password: {
    in: ['body'],
    isLength: {
      options: { min: 6 },
      errorMessage: 'Mật khẩu tối thiểu 6 ký tự'
    },
    isStrongPassword: {
      options: {
        minLength: 6,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1
      },
      errorMessage: 'Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường, 1 số, 1 ký tự đặc biệt'
    }
  },
  org_contact_email: {
    in: ['body'],
    isEmail: true,
    errorMessage: 'Email liên hệ của tổ chức không hợp lệ',
    optional: true
  },
})

export const refreshTokenValidator = checkSchema({
  refresh: {
    in: ['body'],
    isString: true,
    notEmpty: {
      errorMessage: 'Refresh Token is required'
    },
  }
})

export const resetPasswordValidator = checkSchema({
  email: {
    in: ['body'],
    isEmail: true,
    errorMessage: 'Email liên hệ không hợp lệ'
  },
})

export const resetPasswordConfirmValidator = checkSchema({
  token: {
    in: ['body'],
    isString: true,
    notEmpty: {
      errorMessage: 'Token is required'
    },
    isLength: {
      options: { min: 32, max: 32},
      errorMessage: 'Token chỉ có 32 ký tự'
    },
    custom: {
      options: async (value, { req }) => {
        const existingToken = await prisma.passwordResetTokens.findUnique({
          where: { token: value }
        });
    
        if (!existingToken || existingToken.isUsed) {
          throw new ErrorWithStatus({
            message: 'Reset code invalid!',
            status: 400
          });
        }
    
        const expirationDate = new Date(
          existingToken.createdAt.getTime() + AUTH.PASSWORD_RESET_TIMEOUT_HOURS * 60 * 60 * 1000
        );
    
        if (expirationDate < new Date()) {
          throw new Error('Reset code expired!');
        }

        req.passwordResetEmailToken = existingToken;
      },
    }
  },
  password: {
    in: ['body'],
    isLength: {
      options: { min: 6 },
      errorMessage: 'Mật khẩu tối thiểu 6 ký tự'
    },
    isStrongPassword: {
      options: {
        minLength: 6,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1
      },
      errorMessage: 'Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường, 1 số, 1 ký tự đặc biệt'
    }
  },
  confirm_password: {
    in: ['body'],
    custom: {
      options: (value, { req }) => {
        if (value !== req.body.password) {
          throw new ErrorWithStatus({
            message: 'Mật khẩu nhập lại không khớp',
            status: 401
          })
        }
        return true
      }
    }
  },
})

export const changePasswordValidator = checkSchema({
  current_password: {
    in: ['body'],
    isLength: {
      options: { min: 6 },
      errorMessage: 'Mật khẩu tối thiểu 6 ký tự'
    },
    isStrongPassword: {
      options: {
        minLength: 6,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1
      },
      errorMessage: 'Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường, 1 số, 1 ký tự đặc biệt'
    },
  },
  new_password: {
    in: ['body'],
    isLength: {
      options: { min: 6 },
      errorMessage: 'Mật khẩu tối thiểu 6 ký tự'
    },
    isStrongPassword: {
      options: {
        minLength: 6,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1
      },
      errorMessage: 'Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường, 1 số, 1 ký tự đặc biệt'
    }
  },
  confirm_new_password: {
    in: ['body'],
    custom: {
      options: (value, { req }) => {
        if (value !== req.body.new_password) {
          throw new ErrorWithStatus({
            message: 'Mật khẩu nhập lại không khớp',
            status: 401
          })
        }
        return true
      }
    }
  },
})