import { Request, Response } from 'express';
import prisma from '../../core/db/prisma';
import { saveBase64Image } from '../../core/utils/upload';
import { notifyOwners, notifyInquilino } from '../notificaciones/notification.service';

export const getTickets = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;
  const userId = req.userId!;

  try {
    let whereClause: any = { tenantId };

    if (userRole === 'INQUILINO') {
      const user = await prisma.usuario.findUnique({ where: { id: userId } });
      if (user) {
        const inquilino = await prisma.inquilino.findFirst({
          where: { email: { equals: user.email, mode: 'insensitive' }, tenantId }
        });
        if (inquilino) {
          whereClause.inquilinoId = inquilino.id;
        } else {
          res.json([]);
          return;
        }
      } else {
        res.status(404).json({ error: 'Usuario no encontrado.' });
        return;
      }
    }

    const list = await prisma.maintenanceTicket.findMany({
      where: whereClause,
      include: {
        inquilino: true,
        property: true,
        room: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(list.map((t: any) => ({
      id: t.id,
      tenantId: t.tenantId,
      inquilinoId: t.inquilinoId,
      inquilinoName: t.inquilino.name,
      propertyId: t.propertyId,
      propertyName: t.property.name,
      roomId: t.roomId || undefined,
      roomNumber: t.room?.roomNumber || undefined,
      title: t.title,
      description: t.description,
      imageUrl: t.imageUrl || undefined,
      priority: t.priority,
      status: t.status,
      comments: t.comments || undefined,
      cost: t.cost || undefined,
      createdAt: t.createdAt
    })));
  } catch (error) {
    console.error('Error en getTickets:', error);
    res.status(500).json({ error: 'Error al obtener tickets de mantenimiento.' });
  }
};

export const createTicket = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const { title, description, priority, propertyId, roomId, image } = req.body;

  if (!title || !description || !propertyId) {
    res.status(400).json({ error: 'Título, descripción y propiedad son requeridos.' });
    return;
  }

  try {
    // 1. Obtener inquilino
    const user = await prisma.usuario.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado.' });
      return;
    }

    const inquilino = await prisma.inquilino.findFirst({
      where: { email: { equals: user.email, mode: 'insensitive' }, tenantId }
    });

    if (!inquilino) {
      res.status(404).json({ error: 'Inquilino no encontrado o sin permisos.' });
      return;
    }

    // 2. Guardar imagen si se envía en base64
    let imageUrl: string | null = null;
    if (image) {
      imageUrl = saveBase64Image(image, 'tickets');
    }

    const ticket = await prisma.maintenanceTicket.create({
      data: {
        tenantId,
        inquilinoId: inquilino.id,
        propertyId: parseInt(propertyId),
        roomId: roomId ? parseInt(roomId) : inquilino.roomId,
        title,
        description,
        imageUrl,
        priority: priority || 'MEDIA',
        status: 'PENDIENTE'
      }
    });

    await notifyOwners(
      tenantId,
      'TICKET_CREADO',
      'Nuevo ticket de mantenimiento',
      `Se reportó "${title}" con prioridad ${(priority || 'MEDIA').toLowerCase()}.`,
      '/mantenimiento'
    );

    res.status(201).json(ticket);
  } catch (error) {
    console.error('Error en createTicket:', error);
    res.status(500).json({ error: 'Error al reportar el ticket.' });
  }
};

export const updateTicketStatus = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;
  const { id } = req.params;
  const { status, priority, comments, cost } = req.body;

  if (userRole === 'INQUILINO') {
    res.status(403).json({ error: 'Acceso denegado. Solo propietarios pueden actualizar los tickets.' });
    return;
  }

  try {
    const ticketId = parseInt(id as string);
    const existing = await prisma.maintenanceTicket.findFirst({
      where: { id: ticketId, tenantId }
    });

    if (!existing) {
      res.status(404).json({ error: 'Ticket no encontrado.' });
      return;
    }

    const updated = await prisma.maintenanceTicket.update({
      where: { id: ticketId },
      data: {
        status: status || existing.status,
        priority: priority || existing.priority,
        comments: comments !== undefined ? comments : existing.comments,
        cost: cost !== undefined ? parseFloat(cost) : existing.cost
      }
    });

    if (status || comments !== undefined) {
      await notifyInquilino(
        tenantId,
        existing.inquilinoId,
        'TICKET_ACTUALIZADO',
        'Actualización de tu ticket de mantenimiento',
        comments ? `"${existing.title}": ${comments}` : `El estado de tu ticket "${existing.title}" cambió a ${(status || existing.status).replace('_', ' ').toLowerCase()}.`,
        '/mantenimiento'
      );
    }

    res.json(updated);
  } catch (error) {
    console.error('Error en updateTicketStatus:', error);
    res.status(500).json({ error: 'Error al actualizar el ticket.' });
  }
};
