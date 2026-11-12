import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler';
import { prisma } from '../lib/prisma';
import { isValidTimezone } from '../lib/slots';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { validateBody } from '../middleware/validate';

const router = Router();

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  timezone: z.string().trim().optional(),
});

router.patch(
  '/me',
  requireAuth,
  validateBody(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const { name, phone, timezone } = req.body;

    if (timezone !== undefined && !isValidTimezone(timezone)) {
      throw new AppError('Invalid IANA timezone identifier', 400, 'INVALID_TIMEZONE');
    }

    const updated = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(timezone !== undefined ? { timezone } : {}),
      },
      include: { providerProfile: { select: { id: true, title: true, specialty: true } } },
    });

    res.json({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        role: updated.role,
        timezone: updated.timezone,
        providerProfile: updated.providerProfile,
      },
    });
  })
);

export default router;

