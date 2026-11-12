import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from './env';

export type UserRole = 'CLIENT' | 'PROVIDER' | 'ADMIN';

export interface JwtPayload {
  userId: string;
  role: UserRole;
  email: string;
}

export const AUTH_COOKIE_NAME = 'schedulr_token';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}

