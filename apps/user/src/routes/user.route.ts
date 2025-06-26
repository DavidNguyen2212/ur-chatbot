import { Router } from 'express'
import { wrapRequestHandler } from '../utils/handler'
import { validate } from '../utils/validation'
import { jwtAuthMiddleware } from '../middlewares/jwt.middleware'
import { getUserInfoController, updateUserInfoController } from '../controllers/users.controller'
import { updateUserValidator } from '../middlewares/users.middleware'
import { uploadAvatarMiddleware } from '../middlewares/uploadAvatar.middleware'

const usersRouter = Router()

// Route handler: route, [middleware], controller
usersRouter.get('/info', jwtAuthMiddleware, wrapRequestHandler(getUserInfoController))
usersRouter.put('/update', jwtAuthMiddleware, validate(updateUserValidator), uploadAvatarMiddleware, wrapRequestHandler(updateUserInfoController))

export default usersRouter
