import { Request, Response } from 'express';
import prisma from '../../core/db/prisma';
import { saveBase64Image } from '../../core/utils/upload';
import { notifyOwners, notifyInquilino } from '../notificaciones/notification.service';
import { getPaginationParams, buildPaginatedResponse } from '../../core/utils/pagination';

// SLA por defecto según prioridad: plazo máximo para resolver el ticket desde que se reporta.
const SLA_DAYS_BY_PRIORITY: Record<string, number> = {
  ALTA: 1,
  MEDIA: 3,
  BAJA: 7
};

const computeDueDate = (priority: string, from: Date): Date => {
  const days = SLA_DAYS_BY_PRIORITY[priority] ?? SLA_DAYS_BY_PRIORITY.MEDIA;
  const due = new Date(from);
  due.setDate(due.getDate() + days);
  return due;
};

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
          const { page, limit, isPaginated } = getPaginationParams(req);
          res.json(isPaginated ? buildPaginatedResponse([], 0, page, limit) : []);
          return;
        }
      } else {
        res.status(404).json({ error: 'Usuario no encontrado.' });
        return;
      }
    }

    const { page, limit, skip, isPaginated } = getPaginationParams(req);

    const [list, total] = await Promise.all([
      prisma.maintenanceTicket.findMany({
        where: whereClause,
        include: {
          inquilino: true,
          property: true,
          room: true,
          proveedor: true
        },
        orderBy: { createdAt: 'desc' },
        ...(isPaginated ? { skip, take: limit } : {})
      }),
      isPaginated ? prisma.maintenanceTicket.count({ where: whereClause }) : Promise.resolve(0)
    ]);

    const dtos = list.map((t: any) => ({
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
      proveedorId: t.proveedorId || undefined,
      proveedorName: t.proveedor?.name || undefined,
      proveedorSpecialty: t.proveedor?.specialty || undefined,
      proveedorPhone: t.proveedor?.phone || undefined,
      dueDate: t.dueDate ? t.dueDate.toISOString() : undefined,
      isOverdue: t.status !== 'RESUELTO' && !!t.dueDate && new Date(t.dueDate).getTime() < Date.now(),
      createdAt: t.createdAt
    }));

    res.json(isPaginated ? buildPaginatedResponse(dtos, total, page, limit) : dtos);
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

    const finalPriority = priority || 'MEDIA';

    const ticket = await prisma.maintenanceTicket.create({
      data: {
        tenantId,
        inquilinoId: inquilino.id,
        propertyId: parseInt(propertyId),
        roomId: roomId ? parseInt(roomId) : inquilino.roomId,
        title,
        description,
        imageUrl,
        priority: finalPriority,
        status: 'PENDIENTE',
        dueDate: computeDueDate(finalPriority, new Date())
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
  const { status, priority, comments, cost, proveedorId } = req.body;

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

    if (proveedorId) {
      const proveedor = await prisma.proveedor.findFirst({ where: { id: parseInt(proveedorId), tenantId } });
      if (!proveedor) {
        res.status(400).json({ error: 'Proveedor no encontrado.' });
        return;
      }
    }

    const finalPriority = priority || existing.priority;

    const updated = await prisma.maintenanceTicket.update({
      where: { id: ticketId },
      data: {
        status: status || existing.status,
        priority: finalPriority,
        comments: comments !== undefined ? comments : existing.comments,
        cost: cost !== undefined ? parseFloat(cost) : existing.cost,
        proveedorId: proveedorId !== undefined ? (proveedorId ? parseInt(proveedorId) : null) : existing.proveedorId,
        // Recalcula el plazo SLA si cambia la prioridad, tomando como base la fecha original del reporte
        dueDate: finalPriority !== existing.priority ? computeDueDate(finalPriority, existing.createdAt) : existing.dueDate
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
