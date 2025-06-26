// src/types/express/index.d.ts
import { EmailVerificationTokens, PasswordResetTokens, User } from '@prisma/client'

export interface CurrentUserPayload {
  id: string;
  email: string;
  organization?: {
    id: string;
    name: string;
    role: string;
  };
  roles: string[];
}

declare global {
  namespace Express {
    interface Request {
      existingEmailToken?: EmailVerificationTokens,
      passwordResetEmailToken?: PasswordResetTokens,
      user?: CurrentUserPayload
    }
  }
}
