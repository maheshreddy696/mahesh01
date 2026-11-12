import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler';
import {
  AUTH_COOKIE_NAME,
  hashPassword,
  signToken,
  UserRole,
  verifyPassword,
} from '../lib/auth';
import { env } from '../lib/env';
import { prisma } from '../lib/prisma';
import { isValidTimezone } from '../lib/slots';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { validateBody } from '../middleware/validate';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().email('Valid email is required').toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  phone: z.string().trim().max(30).optional(),
  timezone: z.string().trim().optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email('Valid email is required').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

function setAuthCookie(res: import('express').Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: env.isProd && env.crossOriginCookies ? 'none' : 'lax',
    secure: env.isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function sanitizeUser(user: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  timezone: string;
  providerProfile?: { id: string; title: string; specialty: string } | null;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role as UserRole,
    timezone: user.timezone,
    providerProfile: user.providerProfile ?? null,
  };
}

router.post(
  '/register',
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, phone, timezone } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError('An account with this email already exists', 409, 'EMAIL_EXISTS');
    }

    const tz = timezone && isValidTimezone(timezone) ? timezone : 'UTC';
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        phone: phone ?? null,
        role: 'CLIENT',
        timezone: tz,
      },
      include: { providerProfile: { select: { id: true, title: true, specialty: true } } },
    });

    const token = signToken({ userId: user.id, email: user.email, role: 'CLIENT' });
    setAuthCookie(res, token);

    res.status(201).json({ user: sanitizeUser(user) });
  })
);

router.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email },
      include: { providerProfile: { select: { id: true, title: true, specialty: true } } },
    });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
    });
    setAuthCookie(res, token);

    res.json({ user: sanitizeUser(user) });
  })
);

router.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, {
    path: '/',
    sameSite: env.isProd && env.crossOriginCookies ? 'none' : 'lax',
    secure: env.isProd,
  });
  res.json({ ok: true });
});

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { providerProfile: { select: { id: true, title: true, specialty: true } } },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    res.json({ user: sanitizeUser(user) });
  })
);

export default router;

