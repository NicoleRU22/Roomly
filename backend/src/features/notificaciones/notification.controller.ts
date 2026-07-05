import { Request, Response } from 'express';
import prisma from '../../core/db/prisma';

export const getMyNotifications = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userId = req.userId!;

  try {
    const list = await prisma.notification.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: 'desc' },
      take: 30
    });

    res.json(list.map((n: any) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      link: n.link || undefined,
      isRead: n.isRead,
      createdAt: n.createdAt
    })));
  } catch (error) {
    console.error('Error en getMyNotifications:', error);
    res.status(500).json({ error: 'Error al obtener notificaciones.' });
  }
};

export const getUnreadCount = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userId = req.userId!;

  try {
    const count = await prisma.notification.count({
      where: { tenantId, userId, isRead: false }
    });
    res.json({ count });
  } catch (error) {
    console.error('Error en getUnreadCount:', error);
    res.status(500).json({ error: 'Error al obtener el conteo de notificaciones.' });
  }
};

export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const { id } = req.params;

  try {
    const notifId = parseInt(id as string);
    const existing = await prisma.notification.findFirst({ where: { id: notifId, tenantId, userId } });
    if (!existing) {
      res.status(404).json({ error: 'Notificación no encontrada.' });
      return;
    }

    const updated = await prisma.notification.update({
      where: { id: notifId },
      data: { isRead: true }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error en markAsRead:', error);
    res.status(500).json({ error: 'Error al marcar la notificación como leída.' });
  }
};

export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userId = req.userId!;

  try {
    await prisma.notification.updateMany({
      where: { tenantId, userId, isRead: false },
      data: { isRead: true }
    });

    res.json({ message: 'Notificaciones marcadas como leídas.' });
  } catch (error) {
    console.error('Error en markAllAsRead:', error);
    res.status(500).json({ error: 'Error al marcar las notificaciones como leídas.' });
  }
};
