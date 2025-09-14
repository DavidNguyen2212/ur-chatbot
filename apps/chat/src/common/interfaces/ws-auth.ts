import { CoolJwtPayload } from "./payload"; 

export interface WsAuthenticatedUser extends CoolJwtPayload {
  // Can add more fields for WebSocket
  socketId?: string;
  connectedAt?: Date;
}