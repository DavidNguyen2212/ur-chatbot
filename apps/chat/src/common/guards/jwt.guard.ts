// jwt-auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(private readonly configService: ConfigService) {}
    
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;

        if (!authHeader?.startsWith('Bearer ')) 
            throw new UnauthorizedException();

        const token = authHeader.split(' ')[1];

        try {
            const decoded = jwt.verify(token, this.configService.get('JWT_SECRET') || 'jwt_secret');
            request.user = decoded;
            return true;
        } catch {
            throw new UnauthorizedException();
        }
    }
}
