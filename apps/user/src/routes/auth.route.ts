import { Router } from 'express'
import { changePasswordController, joinController, loginController, refreshTokenController, registerController, resetPasswordConfirmController, resetPasswordController, verifyEmailController } from '../controllers/auth.controller'
import { changePasswordValidator, joinOrgValidator, loginValidator, refreshTokenValidator, registerOrgValidator, resetPasswordConfirmValidator, resetPasswordValidator, verifyEmailValidator } from '../middlewares/auth.middleware'
import { wrapRequestHandler } from '../utils/handler'
import { validate } from '../utils/validation'
import { jwtAuthMiddleware } from '../middlewares/jwt.middleware'

const authRouter = Router()

// Route handler: route, [middleware], controller
authRouter.post('/register/new', validate(registerOrgValidator), wrapRequestHandler(registerController))
authRouter.post('/register/join', validate(joinOrgValidator), wrapRequestHandler(joinController))
authRouter.post('/verify-email', validate(verifyEmailValidator), wrapRequestHandler(verifyEmailController))
authRouter.post('/login', validate(loginValidator), wrapRequestHandler(loginController))
authRouter.post('/token/refresh', validate(refreshTokenValidator), wrapRequestHandler(refreshTokenController))
authRouter.post('/password/reset', validate(resetPasswordValidator), wrapRequestHandler(resetPasswordController))
authRouter.post('/password/reset/confirm', validate(resetPasswordConfirmValidator), wrapRequestHandler(resetPasswordConfirmController))
authRouter.post('/password/change', validate(changePasswordValidator), jwtAuthMiddleware, wrapRequestHandler(changePasswordController))

export default authRouter
