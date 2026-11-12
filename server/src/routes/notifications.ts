import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { param } from '../lib/params';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    const unreadCount = notifications.filter((n) => !n.isRead).length;
    res.json({ notifications, unreadCount });
  })
);

router.patch(
  '/:id/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    const existing = await prisma.notification.findFirst({
      where: { id: param(req.params.id), userId: req.user!.userId },
    });
    if (!existing) {
      throw new AppError('Notification not found', 404, 'NOT_FOUND');
    }

    const updated = await prisma.notification.update({
      where: { id: existing.id },
      data: { isRead: true },
    });
    res.json({ notification: updated });
  })
);

router.post(
  '/read-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user!.userId, isRead: false },
      data: { isRead: true },
    });
    res.json({ ok: true });
  })
);

export default router;

