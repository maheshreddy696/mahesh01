import { NextFunction, Request, Response } from 'express';
import { AUTH_COOKIE_NAME, JwtPayload, UserRole, verifyToken } from '../lib/auth';
import { AppError } from './errorHandler';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

function extractToken(req: Request): string | null {
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (typeof cookieToken === 'string' && cookieToken.length > 0) {
    return cookieToken;
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }

  return null;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    return;
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    next(new AppError('Invalid or expired session', 401, 'UNAUTHORIZED'));
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new AppError('You do not have permission to perform this action', 403, 'FORBIDDEN'));
      return;
    }
    next();
  };
}

