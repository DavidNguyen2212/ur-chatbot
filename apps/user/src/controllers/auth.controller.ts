import { Request, Response } from 'express'
import { ChangePasswordBody, JoinOrgBody, LoginBody, RefreshBody, RegisterOrgBody, ResetPasswordBody, ResetPasswordReqBody, VerifyEmailBody } from '../interfaces/dtos/auth.dto'
import authService from '../services/auth.service'
import { USERS_MESSAGES } from '../constants/messages'

export const registerController = async (req: Request<any, any, RegisterOrgBody>, res: Response) => {
  const result = await authService.registerOrg(req.body)
  res.json({
    message: USERS_MESSAGES.REGISTER_SUCCESS,
    result
  })
}

export const joinController = async (req: Request<any, any, JoinOrgBody>, res: Response) => {
  const result = await authService.joinOrg(req.body)
  res.json({
    message: USERS_MESSAGES.LOGIN_SUCCESS,
    result
  })
}

export const verifyEmailController = async (req: Request<any, any, VerifyEmailBody>, res: Response) => {
  const tokenData = req.existingEmailToken;
  const result = await authService.verifyEmail(tokenData)
  res.json({
    message: USERS_MESSAGES.EMAIL_VERIFY_SUCCESS,
    ...result
  })
}

export const loginController = async (req: Request<any, any, LoginBody>, res: Response) => {
  const result = await authService.login(req.body)
  res.json({
    message: USERS_MESSAGES.LOGIN_SUCCESS,
    ...result
  })
}

export const refreshTokenController = async (req: Request<any, any, RefreshBody>, res: Response) => {
  const result = await authService.refreshToken(req.body)
  res.json({
    message: USERS_MESSAGES.REFRESH_TOKEN_SUCCESS,
    ...result
  })
}

export const resetPasswordController = async (req: Request<any, any, ResetPasswordReqBody>, res: Response) => {
  const result = await authService.resetPassword(req.body)
  res.json({
    message: USERS_MESSAGES.EMAIL_VERIFY_SUCCESS,
    ...result
  })
}

export const resetPasswordConfirmController = async (req: Request<any, any, ResetPasswordBody>, res: Response) => {
  const resetTokenData = req.passwordResetEmailToken;
  const result = await authService.resetPasswordConfirm(resetTokenData, req.body)
  res.json({
    message: USERS_MESSAGES.RESET_PASSWORD_SUCCESS,
    ...result
  })
}

export const changePasswordController = async (req: Request<any, any, ChangePasswordBody>, res: Response) => {
  const user = req.user!
  const result = await authService.changePassword(user.id, req.body)
  res.json({
    message: USERS_MESSAGES.CHANGE_PASSWORD_SUCCESS,
    ...result
  })
}



