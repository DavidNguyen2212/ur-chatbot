import { Request, Response, NextFunction } from 'express';
import { verify } from 'jsonwebtoken';
import { AUTH } from '../constants/auth.constant';
import { prisma } from '../infra/prisma/prisma.client';
import { ErrorWithStatus } from '../interfaces/Errors';

interface CoolJwtPayload {
  userId: string;
  email: string;
  organization?: {
    id: string;
    name: string;
    role: string;
  };
  jti?: string;
}

export const jwtAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract token from cookies or Authorization header
    const token = req.cookies?.coolchat__ac_token || 
                  req.headers.authorization?.replace('Bearer ', '') ||
                  req.headers.authorization;

    if (!token) {
      throw new ErrorWithStatus({
        message: 'Access token is required',
        status: 401
      });
    }

    // Verify JWT token
    const decoded = verify(token, AUTH.JWT_SECRET) as CoolJwtPayload;
    
    if (!decoded?.userId || !decoded?.email) {
      throw new ErrorWithStatus({
        message: 'Invalid token payload',
        status: 401
      });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        organizationMembers: {
          include: {
            organization: true
          }
        }
      }
    });

    if (!user) {
      throw new ErrorWithStatus({
        message: 'Invalid token: user not found',
        status: 401
      });
    }

    // Create user payload similar to NestJS JwtPayload
    const userPayload = {
      id: decoded.userId,
      email: decoded.email,
      organization: decoded.organization,
      roles: user.organizationMembers.map(member => member.role) || []
    };

    // Attach user to request
    req.user = userPayload;
    console.log(userPayload);
    
    next();
  } catch (error: any) {
    if (error instanceof ErrorWithStatus) {
      res.status(error.status).json({
        message: error.message
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        message: 'Token expired'
      });
    }

    res.status(500).json({
      message: 'Internal server error'
    });
  }
};

export function isMember() {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const userRoles = req.user?.roles || [];
      // Kiểm tra role trong organization hoặc roles chung
      const isMember = userRoles.length !== 0
      if (!isMember) {
        throw new ErrorWithStatus({
          message: 'Bạn không có quyền truy cập tài nguyên này',
          status: 403
        });
      }
      next();
    } catch (error) {
      if (error instanceof ErrorWithStatus) {
        res.status(error.status).json({ message: error.message });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  };
}

export function checkRole(roles: string | string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const allowRoles = Array.isArray(roles) ? roles : [roles];
      const userOrgRole = req.user?.organization?.role;
      const userRoles = req.user?.roles || [];
      // Kiểm tra role trong organization hoặc roles chung
      const hasRole = (userOrgRole && allowRoles.includes(userOrgRole)) || userRoles.some(r => allowRoles.includes(r));
      if (!hasRole) {
        throw new ErrorWithStatus({
          message: 'Bạn không có quyền truy cập tài nguyên này',
          status: 403
        });
      }
      next();
    } catch (error) {
      if (error instanceof ErrorWithStatus) {
        res.status(error.status).json({ message: error.message });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  };
} 

