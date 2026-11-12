import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import { Router } from 'express';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler';
import { env } from '../lib/env';
import { buildAppointmentIcs } from '../lib/ics';
import { param } from '../lib/params';
import { prisma } from '../lib/prisma';
import { computeAvailableSlots } from '../lib/slots';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { validateBody } from '../middleware/validate';

const router = Router();

const createAppointmentSchema = z.object({
  providerId: z.string().min(1),
  serviceId: z.string().min(1),
  startUtc: z.string().datetime(),
  notes: z.string().trim().max(500).optional(),
});

const rescheduleSchema = z.object({
  startUtc: z.string().datetime(),
  note: z.string().trim().max(300).optional(),
});

const statusUpdateSchema = z.object({
  status: z.enum(['CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']),
  reason: z.string().trim().max(300).optional(),
});

function generateReferenceCode(): string {
  const token = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `APT-${token}`;
}

async function assertSlotBookableInTx(
  tx: Prisma.TransactionClient,
  params: {
    providerId: string;
    serviceId: string;
    startUtc: Date;
    excludeAppointmentId?: string;
  }
) {
  const { providerId, serviceId, startUtc, excludeAppointmentId } = params;

  if (startUtc.getTime() <= Date.now()) {
    throw new AppError('Appointment start time must be in the future', 400, 'PAST_SLOT');
  }

  const [provider, service] = await Promise.all([
    tx.providerProfile.findUnique({
      where: { id: providerId },
      include: {
        user: { select: { id: true, name: true, timezone: true } },
        availabilityRules: true,
        services: { where: { serviceId } },
      },
    }),
    tx.service.findUnique({ where: { id: serviceId } }),
  ]);

  if (!provider || !provider.isActive) {
    throw new AppError('Provider not found or inactive', 404, 'NOT_FOUND');
  }
  if (!service || !service.isActive) {
    throw new AppError('Service not found or inactive', 404, 'NOT_FOUND');
  }
  if (provider.services.length === 0) {
    throw new AppError('Provider does not offer this service', 400, 'SERVICE_NOT_OFFERED');
  }

  const endUtc = new Date(startUtc.getTime() + service.durationMinutes * 60_000);
  const providerZone = provider.user.timezone || 'UTC';
  const startInProviderZone = DateTime.fromJSDate(startUtc, { zone: providerZone });
  const dateStr = startInProviderZone.toISODate()!;

  const windowFromUtc = startInProviderZone.startOf('day').minus({ days: 1 }).toUTC().toJSDate();
  const windowToUtc = startInProviderZone.endOf('day').plus({ days: 1 }).toUTC().toJSDate();

  const [blockedSlots, activeAppointments] = await Promise.all([
    tx.blockedSlot.findMany({
      where: {
        providerId,
        startUtc: { lt: windowToUtc },
        endUtc: { gt: windowFromUtc },
      },
    }),
    tx.appointment.findMany({
      where: {
        providerId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
        startUtc: { lt: windowToUtc },
        endUtc: { gt: windowFromUtc },
      },
      include: { service: { select: { bufferMinutes: true } } },
    }),
  ]);

  // Step granularity = 5 mins when validating exact requested slot inside free windows
  const validSlots = computeAvailableSlots({
    dateStr,
    clientTimezone: providerZone,
    providerTimezone: providerZone,
    availabilityRules: provider.availabilityRules,
    blockedSlots,
    existingAppointments: activeAppointments.map((a) => ({
      startUtc: a.startUtc,
      endUtc: a.endUtc,
      bufferMinutes: a.service.bufferMinutes,
    })),
    durationMinutes: service.durationMinutes,
    bufferMinutes: service.bufferMinutes,
    stepMinutes: 5,
  });

  const targetIso = DateTime.fromJSDate(startUtc).toUTC().toISO();
  const matchesValidSlot = validSlots.some((slot) => slot.startUtc === targetIso);
  if (!matchesValidSlot) {
    throw new AppError(
      'Selected time slot is no longer available',
      409,
      'SLOT_CONFLICT'
    );
  }

  return { provider, service, endUtc };
}

const appointmentInclude = {
  client: { select: { id: true, name: true, email: true, phone: true, timezone: true } },
  provider: {
    include: {
      user: { select: { id: true, name: true, email: true, timezone: true } },
    },
  },
  service: true,
} satisfies Prisma.AppointmentInclude;

function formatAppointment(
  appt: Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>
) {
  return {
    id: appt.id,
    referenceCode: appt.referenceCode,
    status: appt.status,
    startUtc: appt.startUtc.toISOString(),
    endUtc: appt.endUtc.toISOString(),
    notes: appt.notes,
    cancelReason: appt.cancelReason,
    createdAt: appt.createdAt.toISOString(),
    updatedAt: appt.updatedAt.toISOString(),
    client: appt.client,
    provider: {
      id: appt.provider.id,
      userId: appt.provider.userId,
      name: appt.provider.user.name,
      title: appt.provider.title,
      specialty: appt.provider.specialty,
      timezone: appt.provider.user.timezone,
    },
    service: {
      id: appt.service.id,
      name: appt.service.name,
      durationMinutes: appt.service.durationMinutes,
      bufferMinutes: appt.service.bufferMinutes,
      priceCents: appt.service.priceCents,
    },
  };
}

async function getAuthorizedAppointment(
  appointmentId: string,
  user: { userId: string; role: string }
) {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      ...appointmentInclude,
      events: {
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { id: true, name: true, role: true } } },
      },
    },
  });

  if (!appt) {
    throw new AppError('Appointment not found', 404, 'NOT_FOUND');
  }

  const isClientOwner = appt.clientId === user.userId;
  const isProviderOwner = appt.provider.userId === user.userId;
  if (user.role !== 'ADMIN' && !isClientOwner && !isProviderOwner) {
    throw new AppError('You do not have access to this appointment', 403, 'FORBIDDEN');
  }

  return appt;
}

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const scope = typeof req.query.scope === 'string' ? req.query.scope : 'all';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const where: Prisma.AppointmentWhereInput = {};

    if (req.user!.role === 'CLIENT') {
      where.clientId = req.user!.userId;
    } else if (req.user!.role === 'PROVIDER') {
      where.provider = { userId: req.user!.userId };
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    const now = new Date();
    if (scope === 'upcoming') {
      where.startUtc = { gte: now };
      if (!status || status === 'ALL') {
        where.status = { in: ['PENDING', 'CONFIRMED'] };
      }
    } else if (scope === 'past') {
      where.OR = [
        { startUtc: { lt: now } },
        { status: { in: ['COMPLETED', 'CANCELLED', 'NO_SHOW'] } },
      ];
    }

    if (search) {
      const searchFilter: Prisma.AppointmentWhereInput[] = [
        { referenceCode: { contains: search } },
        { client: { name: { contains: search } } },
        { service: { name: { contains: search } } },
        { provider: { user: { name: { contains: search } } } },
      ];
      where.AND = [...(Array.isArray(where.AND) ? where.AND : []), { OR: searchFilter }];
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: appointmentInclude,
      orderBy: { startUtc: scope === 'past' ? 'desc' : 'asc' },
    });

    res.json({ appointments: appointments.map(formatAppointment) });
  })
);

router.post(
  '/',
  requireAuth,
  validateBody(createAppointmentSchema),
  asyncHandler(async (req, res) => {
    const { providerId, serviceId, startUtc: startUtcStr, notes } = req.body;
    const startUtc = new Date(startUtcStr);

    const created = await prisma.$transaction(async (tx) => {
      const { provider, service, endUtc } = await assertSlotBookableInTx(tx, {
        providerId,
        serviceId,
        startUtc,
      });

      const referenceCode = generateReferenceCode();
      const appointment = await tx.appointment.create({
        data: {
          referenceCode,
          clientId: req.user!.userId,
          providerId,
          serviceId,
          startUtc,
          endUtc,
          status: 'CONFIRMED',
          notes: notes ?? '',
          events: {
            create: {
              actorId: req.user!.userId,
              fromStatus: null,
              toStatus: 'CONFIRMED',
              note: 'Appointment booked and confirmed',
            },
          },
        },
        include: appointmentInclude,
      });

      const formattedTime = DateTime.fromJSDate(startUtc, {
        zone: provider.user.timezone || 'UTC',
      }).toFormat('MMM d, yyyy h:mm a');

      await tx.notification.createMany({
        data: [
          {
            userId: req.user!.userId,
            appointmentId: appointment.id,
            type: 'BOOKING_CONFIRMED',
            message: `Booking ${referenceCode} confirmed for ${service.name} with ${provider.user.name}.`,
          },
          {
            userId: provider.userId,
            appointmentId: appointment.id,
            type: 'BOOKING_CONFIRMED',
            message: `New appointment ${referenceCode} for ${service.name} on ${formattedTime}.`,
          },
        ],
      });

      return appointment;
    });

    res.status(201).json({ appointment: formatAppointment(created) });
  })
);

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const appt = await getAuthorizedAppointment(param(req.params.id), req.user!);
    res.json({
      appointment: {
        ...formatAppointment(appt),
        events: appt.events.map((ev) => ({
          id: ev.id,
          fromStatus: ev.fromStatus,
          toStatus: ev.toStatus,
          note: ev.note,
          createdAt: ev.createdAt.toISOString(),
          actor: ev.actor,
        })),
      },
    });
  })
);

router.patch(
  '/:id/reschedule',
  requireAuth,
  validateBody(rescheduleSchema),
  asyncHandler(async (req, res) => {
    const appt = await getAuthorizedAppointment(param(req.params.id), req.user!);
    if (!['PENDING', 'CONFIRMED'].includes(appt.status)) {
      throw new AppError(
        `Cannot reschedule an appointment with status ${appt.status}`,
        400,
        'INVALID_STATUS'
      );
    }

    if (req.user!.role === 'CLIENT') {
      const hoursUntilStart = (appt.startUtc.getTime() - Date.now()) / 3_600_000;
      if (hoursUntilStart < env.cancellationMinHours) {
        throw new AppError(
          `Rescheduling requires at least ${env.cancellationMinHours} hours notice`,
          400,
          'POLICY_WINDOW'
        );
      }
    }

    const newStartUtc = new Date(req.body.startUtc);

    const updated = await prisma.$transaction(async (tx) => {
      const { endUtc } = await assertSlotBookableInTx(tx, {
        providerId: appt.providerId,
        serviceId: appt.serviceId,
        startUtc: newStartUtc,
        excludeAppointmentId: appt.id,
      });

      const saved = await tx.appointment.update({
        where: { id: appt.id },
        data: {
          startUtc: newStartUtc,
          endUtc,
          events: {
            create: {
              actorId: req.user!.userId,
              fromStatus: appt.status,
              toStatus: appt.status,
              note: req.body.note
                ? `Rescheduled: ${req.body.note}`
                : `Rescheduled to ${newStartUtc.toISOString()}`,
            },
          },
        },
        include: appointmentInclude,
      });

      const targetUserId =
        req.user!.userId === appt.clientId ? appt.provider.userId : appt.clientId;
      await tx.notification.create({
        data: {
          userId: targetUserId,
          appointmentId: appt.id,
          type: 'RESCHEDULED',
          message: `Appointment ${appt.referenceCode} (${appt.service.name}) was rescheduled.`,
        },
      });

      return saved;
    });

    res.json({ appointment: formatAppointment(updated) });
  })
);

router.patch(
  '/:id/status',
  requireAuth,
  validateBody(statusUpdateSchema),
  asyncHandler(async (req, res) => {
    const appt = await getAuthorizedAppointment(param(req.params.id), req.user!);
    const { status: nextStatus, reason } = req.body as z.infer<typeof statusUpdateSchema>;

    if (appt.status === nextStatus) {
      throw new AppError(`Appointment is already ${nextStatus}`, 400, 'INVALID_TRANSITION');
    }

    if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appt.status)) {
      throw new AppError(
        `Cannot transition from terminal status ${appt.status}`,
        400,
        'INVALID_TRANSITION'
      );
    }

    if (req.user!.role === 'CLIENT') {
      if (nextStatus !== 'CANCELLED') {
        throw new AppError('Clients can only cancel appointments', 403, 'FORBIDDEN');
      }
      const hoursUntilStart = (appt.startUtc.getTime() - Date.now()) / 3_600_000;
      if (hoursUntilStart < env.cancellationMinHours) {
        throw new AppError(
          `Cancellations require at least ${env.cancellationMinHours} hours notice`,
          400,
          'POLICY_WINDOW'
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.appointment.update({
        where: { id: appt.id },
        data: {
          status: nextStatus,
          ...(nextStatus === 'CANCELLED' ? { cancelReason: reason ?? 'Cancelled by user' } : {}),
          events: {
            create: {
              actorId: req.user!.userId,
              fromStatus: appt.status,
              toStatus: nextStatus,
              note: reason ?? `Status changed to ${nextStatus}`,
            },
          },
        },
        include: appointmentInclude,
      });

      const notifyUserIds = new Set<string>([appt.clientId, appt.provider.userId]);
      notifyUserIds.delete(req.user!.userId);

      if (notifyUserIds.size > 0) {
        await tx.notification.createMany({
          data: Array.from(notifyUserIds).map((userId) => ({
            userId,
            appointmentId: appt.id,
            type: nextStatus === 'CANCELLED' ? 'CANCELLED' : 'STATUS_UPDATED',
            message: `Appointment ${appt.referenceCode} is now ${nextStatus}.`,
          })),
        });
      }

      return saved;
    });

    res.json({ appointment: formatAppointment(updated) });
  })
);

router.get(
  '/:id/ics',
  requireAuth,
  asyncHandler(async (req, res) => {
    const appt = await getAuthorizedAppointment(param(req.params.id), req.user!);
    const ics = buildAppointmentIcs({
      referenceCode: appt.referenceCode,
      serviceName: appt.service.name,
      providerName: appt.provider.user.name,
      clientName: appt.client.name,
      startUtc: appt.startUtc,
      endUtc: appt.endUtc,
      notes: appt.notes,
    });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${appt.referenceCode}.ics"`
    );
    res.send(ics);
  })
);

export default router;

