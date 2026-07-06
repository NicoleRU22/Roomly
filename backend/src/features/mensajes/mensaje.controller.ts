import { Request, Response } from 'express';
import prisma from '../../core/db/prisma';

// Devuelve la lista de conversaciones del usuario logueado.
// Un PROPIETARIO ve una conversación por cada inquilino de su tenant.
// Un INQUILINO ve una única conversación con el/los propietario(s) de su tenant.
export const getConversaciones = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const userRole = req.userRole;

  try {
    const otherRole = userRole === 'INQUILINO' ? 'PROPIETARIO' : 'INQUILINO';
    const partners = await prisma.usuario.findMany({
      where: { tenantId, role: otherRole },
      orderBy: { firstName: 'asc' }
    });

    const conversaciones = await Promise.all(partners.map(async (partner: any) => {
      const [lastMessage, unreadCount] = await Promise.all([
        prisma.mensaje.findFirst({
          where: {
            tenantId,
            OR: [
              { senderId: userId, receiverId: partner.id },
              { senderId: partner.id, receiverId: userId }
            ]
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.mensaje.count({
          where: { tenantId, senderId: partner.id, receiverId: userId, isRead: false }
        })
      ]);

      return {
        userId: partner.id,
        name: `${partner.firstName}${partner.lastName ? ' ' + partner.lastName : ''}`,
        lastMessage: lastMessage?.content,
        lastMessageAt: lastMessage?.createdAt,
        unreadCount
      };
    }));

    conversaciones.sort((a, b) => {
      if (!a.lastMessageAt && !b.lastMessageAt) return a.name.localeCompare(b.name);
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    res.json(conversaciones);
  } catch (error) {
    console.error('Error en getConversaciones:', error);
    res.status(500).json({ error: 'Error al obtener las conversaciones.' });
  }
};

export const getUnreadCount = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userId = req.userId!;

  try {
    const count = await prisma.mensaje.count({
      where: { tenantId, receiverId: userId, isRead: false }
    });
    res.json({ count });
  } catch (error) {
    console.error('Error en getUnreadCount (mensajes):', error);
    res.status(500).json({ error: 'Error al obtener el conteo de mensajes.' });
  }
};

export const getConversacion = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const otherUserId = parseInt(req.params.userId as string);

  if (!Number.isFinite(otherUserId)) {
    res.status(400).json({ error: 'Identificador de usuario inválido.' });
    return;
  }

  try {
    const otherUser = await prisma.usuario.findFirst({ where: { id: otherUserId, tenantId } });
    if (!otherUser) {
      res.status(404).json({ error: 'Usuario no encontrado.' });
      return;
    }

    const mensajes = await prisma.mensaje.findMany({
      where: {
        tenantId,
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId }
        ]
      },
      orderBy: { createdAt: 'asc' },
      take: 200
    });

    res.json(mensajes.map((m: any) => ({
      id: m.id,
      senderId: m.senderId,
      receiverId: m.receiverId,
      content: m.content,
      isRead: m.isRead,
      createdAt: m.createdAt
    })));
  } catch (error) {
    console.error('Error en getConversacion:', error);
    res.status(500).json({ error: 'Error al obtener la conversación.' });
  }
};

export const sendMensaje = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const otherUserId = parseInt(req.params.userId as string);
  const { content } = req.body;

  if (!Number.isFinite(otherUserId)) {
    res.status(400).json({ error: 'Identificador de usuario inválido.' });
    return;
  }

  if (!content || typeof content !== 'string' || !content.trim()) {
    res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
    return;
  }

  try {
    const otherUser = await prisma.usuario.findFirst({ where: { id: otherUserId, tenantId } });
    if (!otherUser) {
      res.status(404).json({ error: 'Usuario no encontrado.' });
      return;
    }

    const mensaje = await prisma.mensaje.create({
      data: {
        tenantId,
        senderId: userId,
        receiverId: otherUserId,
        content: content.trim()
      }
    });

    res.status(201).json({
      id: mensaje.id,
      senderId: mensaje.senderId,
      receiverId: mensaje.receiverId,
      content: mensaje.content,
      isRead: mensaje.isRead,
      createdAt: mensaje.createdAt
    });
  } catch (error) {
    console.error('Error en sendMensaje:', error);
    res.status(500).json({ error: 'Error al enviar el mensaje.' });
  }
};

export const markConversacionAsRead = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const otherUserId = parseInt(req.params.userId as string);

  if (!Number.isFinite(otherUserId)) {
    res.status(400).json({ error: 'Identificador de usuario inválido.' });
    return;
  }

  try {
    await prisma.mensaje.updateMany({
      where: { tenantId, senderId: otherUserId, receiverId: userId, isRead: false },
      data: { isRead: true }
    });

    res.json({ message: 'Conversación marcada como leída.' });
  } catch (error) {
    console.error('Error en markConversacionAsRead:', error);
    res.status(500).json({ error: 'Error al marcar la conversación como leída.' });
  }
};
