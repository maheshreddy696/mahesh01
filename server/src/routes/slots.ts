import { Router } from 'express';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler';
import { prisma } from '../lib/prisma';
import { computeAvailableSlots, isValidTimezone } from '../lib/slots';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const slotQuerySchema = z.object({
  providerId: z.string().min(1),
  serviceId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  tz: z.string().optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = slotQuerySchema.parse(req.query);
    const clientTz = parsed.tz && isValidTimezone(parsed.tz) ? parsed.tz : 'UTC';

    const [provider, service] = await Promise.all([
      prisma.providerProfile.findUnique({
        where: { id: parsed.providerId },
        include: {
          user: { select: { timezone: true } },
          availabilityRules: true,
          services: { where: { serviceId: parsed.serviceId } },
        },
      }),
      prisma.service.findUnique({
        where: { id: parsed.serviceId },
      }),
    ]);

    if (!provider || !provider.isActive) {
      throw new AppError('Provider not found', 404, 'NOT_FOUND');
    }
    if (!service || !service.isActive) {
      throw new AppError('Service not found', 404, 'NOT_FOUND');
    }
    if (provider.services.length === 0) {
      throw new AppError('Provider does not offer the selected service', 400, 'SERVICE_NOT_OFFERED');
    }

    const dayStart = DateTime.fromISO(parsed.date, { zone: clientTz }).startOf('day');
    if (!dayStart.isValid) {
      throw new AppError('Invalid date provided', 400, 'INVALID_DATE');
    }

    // Pad +/- 1 day in UTC to capture provider timezone shifts & adjacent buffers
    const queryFromUtc = dayStart.minus({ days: 1 }).toUTC().toJSDate();
    const queryToUtc = dayStart.plus({ days: 2 }).toUTC().toJSDate();

    const [blockedSlots, activeAppointments] = await Promise.all([
      prisma.blockedSlot.findMany({
        where: {
          providerId: provider.id,
          startUtc: { lt: queryToUtc },
          endUtc: { gt: queryFromUtc },
        },
      }),
      prisma.appointment.findMany({
        where: {
          providerId: provider.id,
          status: { in: ['PENDING', 'CONFIRMED'] },
          startUtc: { lt: queryToUtc },
          endUtc: { gt: queryFromUtc },
        },
        include: {
          service: { select: { bufferMinutes: true } },
        },
      }),
    ]);

    const slots = computeAvailableSlots({
      dateStr: parsed.date,
      clientTimezone: clientTz,
      providerTimezone: provider.user.timezone,
      availabilityRules: provider.availabilityRules,
      blockedSlots,
      existingAppointments: activeAppointments.map((appt) => ({
        startUtc: appt.startUtc,
        endUtc: appt.endUtc,
        bufferMinutes: appt.service.bufferMinutes,
      })),
      durationMinutes: service.durationMinutes,
      bufferMinutes: service.bufferMinutes,
    });

    res.json({
      date: parsed.date,
      timezone: clientTz,
      providerTimezone: provider.user.timezone,
      durationMinutes: service.durationMinutes,
      slots,
    });
  })
);

export default router;

