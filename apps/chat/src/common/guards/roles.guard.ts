import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
  } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator'; 

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const requireRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        // Không yêu cầu role
        if (!requireRoles) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest();
        if (!user || !user.roles) {
            throw new ForbiddenException('User has no roles');
        }
        const hasRole = requireRoles.some((role: string) =>
            user.roles.includes(role),
        );
        if (!hasRole) {
            throw new ForbiddenException('You do not have permission!');
        }

        return true;
    }
}
