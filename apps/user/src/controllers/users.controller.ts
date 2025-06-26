import { Request, Response } from "express"
import usersService from "../services/users.service"
import { USERS_MESSAGES } from "../constants/messages"
import { UpdateUserBody } from "../interfaces/dtos/user.dto"

export const getUserInfoController = async (req: Request, res: Response) => {
  const result = await usersService.getUserInfo(req.user!.id)
  res.json({
    message: USERS_MESSAGES.GET_PROFILE_SUCCESS,
    ...result
  })
}

export const updateUserInfoController = async (req: Request<any, any, UpdateUserBody>, res: Response) => {
  const userId = req.user!.id
  const { name, phone } = req.body
  const avatar = req.file

  const updatedUser = await usersService.updateUserInfo({ userId, name, phone, avatar })
  res.json({
    message: USERS_MESSAGES.UPDATE_ME_SUCCESS,
    ...updatedUser
  })
}