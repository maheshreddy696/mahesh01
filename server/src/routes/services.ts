import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler';
import { param } from '../lib/params';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { validateBody } from '../middleware/validate';

const router = Router();

const serviceSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).default(''),
  durationMinutes: z.number().int().min(10).max(480),
  bufferMinutes: z.number().int().min(0).max(120).default(0),
  priceCents: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  providerIds: z.array(z.string()).optional(),
});

const updateServiceSchema = serviceSchema.partial();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const includeInactive = req.query.includeInactive === 'true';
    const services = await prisma.service.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        providers: {
          include: {
            provider: {
              include: { user: { select: { name: true } } },
            },
          },
        },
      },
    });

    res.json({
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        durationMinutes: s.durationMinutes,
        bufferMinutes: s.bufferMinutes,
        priceCents: s.priceCents,
        isActive: s.isActive,
        providers: s.providers.map((p) => ({
          id: p.provider.id,
          name: p.provider.user.name,
          title: p.provider.title,
        })),
      })),
    });
  })
);

router.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validateBody(serviceSchema),
  asyncHandler(async (req, res) => {
    const { providerIds, ...data } = req.body;

    const service = await prisma.service.create({
      data: {
        ...data,
        ...(providerIds?.length
          ? {
              providers: {
                create: providerIds.map((providerId: string) => ({ providerId })),
              },
            }
          : {}),
      },
    });

    res.status(201).json({ service });
  })
);

router.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  validateBody(updateServiceSchema),
  asyncHandler(async (req, res) => {
    const id = param(req.params.id);
    const { providerIds, ...data } = req.body;

    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Service not found', 404, 'NOT_FOUND');
    }

    const service = await prisma.$transaction(async (tx) => {
      if (providerIds !== undefined) {
        await tx.providerService.deleteMany({ where: { serviceId: id } });
        if (providerIds.length > 0) {
          await tx.providerService.createMany({
            data: providerIds.map((providerId: string) => ({ serviceId: id, providerId })),
          });
        }
      }

      return tx.service.update({
        where: { id },
        data,
      });
    });

    res.json({ service });
  })
);

export default router;

