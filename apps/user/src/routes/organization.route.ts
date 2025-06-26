import { Router } from 'express'
import { wrapRequestHandler } from '../utils/handler'
import { validate } from '../utils/validation'
import { jwtAuthMiddleware, checkRole, isMember } from '../middlewares/jwt.middleware'
import { MemberRole } from '@prisma/client'
import { getOrgDetailController, getOrgMembersDetailController, inviteMemberController, getInvitationController, revokeInvitationController, leaveOrgController } from '../controllers/organizations.controller'
import { inviteMemberValidator } from '../middlewares/organizations.middleware'

const orgRouter = Router()

// Route handler: route, [middleware], controller
orgRouter.get('/detail', jwtAuthMiddleware, isMember(), wrapRequestHandler(getOrgDetailController))
orgRouter.get('/members', jwtAuthMiddleware, isMember(), wrapRequestHandler(getOrgMembersDetailController))
orgRouter.post('/invite', jwtAuthMiddleware, checkRole(MemberRole.OWNER), validate(inviteMemberValidator), wrapRequestHandler(inviteMemberController))
orgRouter.get('/invites', jwtAuthMiddleware, checkRole(MemberRole.OWNER), wrapRequestHandler(getInvitationController))
orgRouter.post('/invite/revoke/:inviteId', jwtAuthMiddleware, checkRole(MemberRole.OWNER), wrapRequestHandler(revokeInvitationController))
orgRouter.post('/member/remove/:memberId', jwtAuthMiddleware, checkRole(MemberRole.OWNER), wrapRequestHandler(revokeInvitationController))
orgRouter.post('/leave', jwtAuthMiddleware, isMember(), wrapRequestHandler(leaveOrgController))

export default orgRouter
