export interface CoolJwtPayload {
  userId: string;
  email: string;
  organization?: {
    id: string;
    name: string;
    role: string;
  };
  jti?: string;
}