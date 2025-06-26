import { MemberRole } from "@prisma/client"

export interface InviteUserBody {
  email: string
  role: MemberRole
}