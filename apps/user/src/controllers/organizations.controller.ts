import { Request, Response } from "express";
import organizationsService from "../services/organizations.service";
import { USERS_MESSAGES } from "../constants/messages";
import { InviteUserBody } from "../interfaces/dtos/organization.dto";

export const getOrgDetailController = async (req: Request, res: Response) => {
  const user = req.user!
  const result = await organizationsService.getOrgDetail(user.organization!.id)
  res.json({
    message: USERS_MESSAGES.GET_ORG_SUCCESS,
    ...result
  })
}

export const getOrgMembersDetailController = async (req: Request, res: Response) => {
  const user = req.user!
  
  // Get pagination parameters from query
  const limit = parseInt(req.query.limit as string) || 10
  const offset = parseInt(req.query.offset as string) || 0
  
  const result = await organizationsService.getOrgMembersDetail(user.organization!.id, limit, offset)
  res.json({
    message: USERS_MESSAGES.GET_ORG_SUCCESS,
    ...result
  })
}

export const inviteMemberController = async (req: Request<any, any, InviteUserBody>, res: Response) => {
  const user = req.user!
  const result = await organizationsService.inviteMember(user, req.body)
  res.json({
    message: USERS_MESSAGES.INVITE_SUCCESS,
    ...result
  })
}

export const getInvitationController = async (req: Request, res: Response) => {
  const user = req.user!
  // Get pagination parameters from query
  const status = req.query.status as string || undefined
  const limit = parseInt(req.query.limit as string) || 10
  const offset = parseInt(req.query.offset as string) || 0
  const result = await organizationsService.getInvitation(user.organization?.id!, limit, offset, status)
  res.json({
    message: USERS_MESSAGES.INVITE_SUCCESS,
    ...result
  })
}

export const revokeInvitationController = async (req: Request<{ inviteId: string }>, res: Response) => {
  // const user = req.user!
  const inviteId = req.params.inviteId
  await organizationsService.revokeInvitation(inviteId)
  res.json({
    message: USERS_MESSAGES.REVOKE_SUCCESS,
  })
}

export const removeMemberController = async (req: Request<{ memberId: string }>, res: Response) => {
  const user = req.user!
  const memberId = req.params.memberId
  await organizationsService.removeMember(user.organization?.id!, memberId)
  res.json({
    message: USERS_MESSAGES.REMOVE_SUCCESS,
  })
}

export const leaveOrgController = async (req: Request, res: Response) => {
  const user = req.user!
  await organizationsService.leaveOrg(user.id, user.organization?.id!, user.organization?.role!)
  res.json({
    message: USERS_MESSAGES.REMOVE_SUCCESS,
  })
}