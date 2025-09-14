import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

/**
 * Extracts a JWT token from various possible locations in a WebSocket handshake.
 *
 * This function supports multiple token delivery methods:
 * - From cookies (key: `ef_ac_token`)
 * - From the `Authorization` header (Bearer token)
 * - From the `auth` object in the handshake
 * - From query parameters (`?token=...`)
 *
 * @param client The connected WebSocket client (from `socket.io`)
 * @returns The extracted JWT token as a string
 * @throws Error if no token is found in any supported source
 */
export function extractJwtFromSocket(client: Socket): string {
  const tokenSources = [
    // 1. From cookies: ef_ac_token=your_jwt_token
    client.handshake.headers?.cookie
      ?.split(';')
      ?.find(cookie => cookie.trim().startsWith('ef_ac_token='))
      ?.split('=')[1],

    // 2. From Authorization header: Bearer your_jwt_token
    client.handshake.headers?.authorization?.split(' ')[1],

    // 3. From socket handshake auth: { token: your_jwt_token }
    client.handshake.auth?.token,

    // 4. From query string: ?token=your_jwt_token
    client.handshake.query?.token as string,
  ];

  const token = tokenSources.find(t => t && typeof t === 'string');

  if (!token) {
    throw new WsException({
      message: 'Unauthorized',
      error: 'No JWT token found in WebSocket handshake',
      statusCode: 401
    }) 
  }

  return token;
}
