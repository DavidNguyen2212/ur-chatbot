import { UUID } from "crypto";

export interface CoolJwtPayload {
  userId: UUID;
  email: string;
  organization?: {
    id: UUID;
    name: string;
    role: string;
  };
  jti?: string;
}