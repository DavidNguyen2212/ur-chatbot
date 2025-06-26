import { checkSchema } from "express-validator";

export const updateUserValidator = checkSchema({
  name: {
    in: ['body'],
    isString: true,
    optional: true,
    notEmpty: {
      errorMessage: 'Tên người dùng là bắt buộc'
    }
  },
  phone: {
    in: ['body'],
    isString: true,
    optional: true,
    notEmpty: {
      errorMessage: 'Số điện thoại là bắt buộc'
    }
  },
  // role: {
  //   in: ['body'],
  //   isString: true,
  //   optional: true,
  //   notEmpty: {
  //     errorMessage: 'Số điện thoại là bắt buộc'
  //   }
  // }
  // OPtional: is 8601 iso string date of birth
})