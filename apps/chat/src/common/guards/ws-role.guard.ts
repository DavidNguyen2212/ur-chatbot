import { WsException } from "@nestjs/websockets";
import { WsAuthenticatedUser } from "../interfaces/ws-auth"; 
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator"; 

/**
 * WebSocket Role Guard.
 *
 * This guard is used to restrict access to WebSocket event handlers
 * based on user roles defined via the `@Roles(...)` decorator.
 *
 * If the endpoint does not specify any roles, it is considered public.
 * If the user is not authenticated or lacks the required roles,
 * a `WsException` will be thrown.
 */
@Injectable()
export class WsRoleGuard implements CanActivate {
  /**
   * Creates an instance of the WebSocket Role Guard.
   * 
   * @param reflector A utility used to read metadata from route handlers and classes
   */
  constructor(
    private readonly reflector: Reflector,
  ) {}

  /**
   * Determines whether the current WebSocket client is authorized to access the endpoint.
   * 
   * @param context Execution context that provides access to the WebSocket client
   * @returns `true` if the client has the required roles, otherwise throws a `WsException`
   * @throws {WsException} If the user is not authenticated or lacks the required roles
   */
  canActivate(context: ExecutionContext): boolean {
    const requireRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
    ]);
    // Allow if no roles are required
    if (!requireRoles) {
      return true;
    }

    const client = context.switchToWs().getClient();

    const user: WsAuthenticatedUser = client.data?.user;
    if (!user) {
      throw new WsException({
        error: 'Unauthorized',
        message: 'User not authenticated',
        statusCode: 401
      });
    }
    if (!user.organization?.role) {
      throw new WsException({
        error: 'Forbidden',
        message: 'User has no roles',
        statusCode: 403
      });
    }

    const hasRole = requireRoles.some((role: string) =>
      role === user.organization?.role,
    );
    if (!hasRole) {
      throw new WsException({
        error: 'Forbidden',
        message: 'Insufficient permissions',
        statusCode: 403,
        details: {
          userRoles: user.organization?.role,
          requireRoles
        }
      });
    }

    return true;
  }
}
