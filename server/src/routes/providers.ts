import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler';
import { hashPassword } from '../lib/auth';
import { param } from '../lib/params';
import { prisma } from '../lib/prisma';
import { isValidTimezone } from '../lib/slots';
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { validateBody } from '../middleware/validate';

const router = Router();

const hhmmRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const availabilitySchema = z.object({
  rules: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        startTime: z.string().regex(hhmmRegex, 'startTime must be HH:mm'),
        endTime: z.string().regex(hhmmRegex, 'endTime must be HH:mm'),
        isEnabled: z.boolean(),
      })
    )
    .min(1)
    .max(7),
});

const blockedSlotSchema = z.object({
  startUtc: z.string().datetime(),
  endUtc: z.string().datetime(),
  reason: z.string().trim().min(1).max(160).default('Unavailable'),
});

const createProviderSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8).max(128),
  timezone: z.string().trim().default('UTC'),
  title: z.string().trim().min(2).max(100),
  specialty: z.string().trim().min(2).max(100),
  bio: z.string().trim().max(500).default(''),
  serviceIds: z.array(z.string()).default([]),
});

async function assertProviderAccess(
  providerId: string,
  user: { userId: string; role: string }
) {
  const provider = await prisma.providerProfile.findUnique({
    where: { id: providerId },
    include: { user: { select: { id: true, timezone: true } } },
  });

  if (!provider) {
    throw new AppError('Provider not found', 404, 'NOT_FOUND');
  }

  if (user.role !== 'ADMIN' && provider.userId !== user.userId) {
    throw new AppError('You cannot modify another provider schedule', 403, 'FORBIDDEN');
  }

  return provider;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const serviceId = typeof req.query.serviceId === 'string' ? req.query.serviceId : undefined;

    const providers = await prisma.providerProfile.findMany({
      where: {
        isActive: true,
        ...(serviceId
          ? {
              services: {
                some: { serviceId },
              },
            }
          : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true, timezone: true } },
        services: {
          include: {
            service: true,
          },
        },
        availabilityRules: {
          orderBy: { dayOfWeek: 'asc' },
        },
      },
      orderBy: { user: { name: 'asc' } },
    });

    res.json({
      providers: providers.map((p) => ({
        id: p.id,
        userId: p.userId,
        name: p.user.name,
        email: p.user.email,
        timezone: p.user.timezone,
        title: p.title,
        specialty: p.specialty,
        bio: p.bio,
        isActive: p.isActive,
        services: p.services.map((ps) => ps.service),
        availabilityRules: p.availabilityRules,
      })),
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const provider = await prisma.providerProfile.findUnique({
      where: { id: param(req.params.id) },
      include: {
        user: { select: { id: true, name: true, email: true, timezone: true } },
        services: { include: { service: true } },
        availabilityRules: { orderBy: { dayOfWeek: 'asc' } },
        blockedSlots: {
          where: { endUtc: { gte: new Date() } },
          orderBy: { startUtc: 'asc' },
        },
      },
    });

    if (!provider) {
      throw new AppError('Provider not found', 404, 'NOT_FOUND');
    }

    res.json({
      provider: {
        id: provider.id,
        userId: provider.userId,
        name: provider.user.name,
        email: provider.user.email,
        timezone: provider.user.timezone,
        title: provider.title,
        specialty: provider.specialty,
        bio: provider.bio,
        isActive: provider.isActive,
        services: provider.services.map((ps) => ps.service),
        availabilityRules: provider.availabilityRules,
        blockedSlots: provider.blockedSlots,
      },
    });
  })
);

router.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validateBody(createProviderSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, timezone, title, specialty, bio, serviceIds } = req.body;
    if (!isValidTimezone(timezone)) {
      throw new AppError('Invalid timezone', 400, 'INVALID_TIMEZONE');
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError('A user with this email already exists', 409, 'EMAIL_EXISTS');
    }

    const passwordHash = await hashPassword(password);
    const defaultRules = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
      dayOfWeek,
      startTime: '09:00',
      endTime: '17:00',
      isEnabled: true,
    }));

    const created = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: 'PROVIDER',
        timezone,
        providerProfile: {
          create: {
            title,
            specialty,
            bio,
            availabilityRules: {
              create: [
                { dayOfWeek: 0, startTime: '09:00', endTime: '17:00', isEnabled: false },
                ...defaultRules,
                { dayOfWeek: 6, startTime: '09:00', endTime: '17:00', isEnabled: false },
              ],
            },
            ...(serviceIds.length > 0
              ? {
                  services: {
                    create: serviceIds.map((serviceId: string) => ({ serviceId })),
                  },
                }
              : {}),
          },
        },
      },
      include: {
        providerProfile: true,
      },
    });

    res.status(201).json({ provider: created.providerProfile });
  })
);

router.put(
  '/:id/availability',
  requireAuth,
  requireRole('PROVIDER', 'ADMIN'),
  validateBody(availabilitySchema),
  asyncHandler(async (req, res) => {
    const providerId = param(req.params.id);
    await assertProviderAccess(providerId, req.user!);

    const { rules } = req.body as z.infer<typeof availabilitySchema>;
    for (const rule of rules) {
      if (rule.isEnabled && rule.startTime >= rule.endTime) {
        throw new AppError(
          `End time must be after start time for day ${rule.dayOfWeek}`,
          400,
          'INVALID_TIME_RANGE'
        );
      }
    }

    await prisma.$transaction(
      rules.map((rule) =>
        prisma.availabilityRule.upsert({
          where: {
            providerId_dayOfWeek: {
              providerId,
              dayOfWeek: rule.dayOfWeek,
            },
          },
          update: {
            startTime: rule.startTime,
            endTime: rule.endTime,
            isEnabled: rule.isEnabled,
          },
          create: {
            providerId,
            dayOfWeek: rule.dayOfWeek,
            startTime: rule.startTime,
            endTime: rule.endTime,
            isEnabled: rule.isEnabled,
          },
        })
      )
    );

    const updatedRules = await prisma.availabilityRule.findMany({
      where: { providerId },
      orderBy: { dayOfWeek: 'asc' },
    });

    res.json({ availabilityRules: updatedRules });
  })
);

router.post(
  '/:id/blocked-slots',
  requireAuth,
  requireRole('PROVIDER', 'ADMIN'),
  validateBody(blockedSlotSchema),
  asyncHandler(async (req, res) => {
    const providerId = param(req.params.id);
    await assertProviderAccess(providerId, req.user!);

    const startUtc = new Date(req.body.startUtc);
    const endUtc = new Date(req.body.endUtc);
    if (endUtc <= startUtc) {
      throw new AppError('End time must be after start time', 400, 'INVALID_TIME_RANGE');
    }

    const blockedSlot = await prisma.blockedSlot.create({
      data: {
        providerId,
        startUtc,
        endUtc,
        reason: req.body.reason,
      },
    });

    res.status(201).json({ blockedSlot });
  })
);

router.delete(
  '/:id/blocked-slots/:slotId',
  requireAuth,
  requireRole('PROVIDER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const providerId = param(req.params.id);
    const slotId = param(req.params.slotId);
    await assertProviderAccess(providerId, req.user!);

    const existing = await prisma.blockedSlot.findFirst({
      where: { id: slotId, providerId },
    });
    if (!existing) {
      throw new AppError('Blocked slot not found', 404, 'NOT_FOUND');
    }

    await prisma.blockedSlot.delete({ where: { id: slotId } });
    res.json({ ok: true });
  })
);

export default router;

