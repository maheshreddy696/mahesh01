import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.get(
  '/metrics',
  requireAuth,
  requireRole('ADMIN'),
  asyncHandler(async (_req, res) => {
    const [
      totalAppointments,
      statusGroups,
      totalClients,
      activeProviders,
      activeServices,
      appointmentsWithDetails,
    ] = await Promise.all([
      prisma.appointment.count(),
      prisma.appointment.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.user.count({ where: { role: 'CLIENT' } }),
      prisma.providerProfile.count({ where: { isActive: true } }),
      prisma.service.count({ where: { isActive: true } }),
      prisma.appointment.findMany({
        include: {
          service: { select: { id: true, name: true, priceCents: true } },
          provider: { include: { user: { select: { name: true } } } },
        },
      }),
    ]);

    const statusCounts: Record<string, number> = {
      PENDING: 0,
      CONFIRMED: 0,
      COMPLETED: 0,
      CANCELLED: 0,
      NO_SHOW: 0,
    };
    for (const row of statusGroups) {
      statusCounts[row.status] = row._count.status;
    }

    const providerCounts = new Map<string, { name: string; count: number }>();
    const serviceCounts = new Map<string, { name: string; count: number; revenueCents: number }>();

    let estimatedRevenueCents = 0;
    for (const appt of appointmentsWithDetails) {
      if (appt.status === 'CONFIRMED' || appt.status === 'COMPLETED') {
        estimatedRevenueCents += appt.service.priceCents;
      }

      const pKey = appt.providerId;
      const pEntry = providerCounts.get(pKey) ?? { name: appt.provider.user.name, count: 0 };
      pEntry.count += 1;
      providerCounts.set(pKey, pEntry);

      const sKey = appt.serviceId;
      const sEntry = serviceCounts.get(sKey) ?? {
        name: appt.service.name,
        count: 0,
        revenueCents: 0,
      };
      sEntry.count += 1;
      if (appt.status === 'CONFIRMED' || appt.status === 'COMPLETED') {
        sEntry.revenueCents += appt.service.priceCents;
      }
      serviceCounts.set(sKey, sEntry);
    }

    res.json({
      summary: {
        totalAppointments,
        totalClients,
        activeProviders,
        activeServices,
        estimatedRevenueCents,
        statusCounts,
      },
      topProviders: Array.from(providerCounts.values()).sort((a, b) => b.count - a.count),
      topServices: Array.from(serviceCounts.values()).sort((a, b) => b.count - a.count),
    });
  })
);

export default router;

