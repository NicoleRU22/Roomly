import { Request, Response } from 'express';
import prisma from '../../core/db/prisma';

export const getAllServicios = async (req: Request, res: Response): Promise<void> => {
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
          whereClause.OR = [];
          if (inquilino.propertyId) {
            whereClause.OR.push({ propertyId: inquilino.propertyId });
          }
          if (inquilino.roomId) {
            whereClause.OR.push({ roomId: inquilino.roomId });
          }
          if (whereClause.OR.length === 0) {
            res.json([]);
            return;
          }
        } else {
          res.json([]);
          return;
        }
      } else {
        res.status(404).json({ error: 'Usuario no encontrado.' });
        return;
      }
    }

    const list = await prisma.servicio.findMany({
      where: whereClause,
      include: {
        property: true,
        room: true
      }
    });

    res.json(list.map((s: any) => ({
      id: s.id,
      name: s.name,
      description: s.description || undefined,
      cost: s.cost,
      tipo: s.tipo,
      propertyId: s.propertyId || undefined,
      propertyName: s.property?.name || undefined,
      roomId: s.roomId || undefined,
      roomNumber: s.room?.roomNumber || undefined
    })));
  } catch (error) {
    console.error('Error en getAllServicios:', error);
    res.status(500).json({ error: 'Error al obtener servicios.' });
  }
};

export const createServicio = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;

  if (userRole === 'INQUILINO') {
    res.status(403).json({ error: 'Acceso denegado. No tienes permisos para crear servicios.' });
    return;
  }

  const { name, description, cost, tipo, propertyId, roomId } = req.body;

  if (!name || cost === undefined || !tipo) {
    res.status(400).json({ error: 'Nombre, costo y tipo son requeridos.' });
    return;
  }

  try {
    // Validar propiedad del tenant
    let pId: number | null = null;
    if (propertyId) {
      const prop = await prisma.property.findFirst({ where: { id: parseInt(propertyId), tenantId } });
      if (prop) pId = prop.id;
    }

    // Validar cuarto del tenant
    let rId: number | null = null;
    if (roomId) {
      const room = await prisma.room.findFirst({ where: { id: parseInt(roomId), tenantId } });
      if (room) rId = room.id;
    }

    const duplicate = await prisma.servicio.findFirst({
      where: {
        tenantId,
        propertyId: pId,
        roomId: rId,
        name: { equals: name.trim(), mode: 'insensitive' }
      }
    });

    if (duplicate) {
      res.status(409).json({ error: 'Ya existe un servicio con ese nombre en el mismo alcance.' });
      return;
    }

    const service = await prisma.servicio.create({
      data: {
        name,
        description,
        cost: parseFloat(cost),
        tipo, // "INCLUIDO" o "ADICIONAL"
        propertyId: pId,
        roomId: rId,
        tenantId
      }
    });

    res.status(201).json(service);
  } catch (error) {
    console.error('Error en createServicio:', error);
    res.status(500).json({ error: 'Error al crear el servicio.' });
  }
};

export const updateServicio = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;

  if (userRole === 'INQUILINO') {
    res.status(403).json({ error: 'Acceso denegado. No tienes permisos para actualizar servicios.' });
    return;
  }

  const { id } = req.params;
  const { name, description, cost, tipo, propertyId, roomId } = req.body;

  try {
    const serviceId = parseInt(id as string);
    const existing = await prisma.servicio.findFirst({
      where: { id: serviceId, tenantId }
    });

    if (!existing) {
      res.status(404).json({ error: 'Servicio no encontrado o sin permisos.' });
      return;
    }

    let pId: number | null = existing.propertyId;
    if (propertyId !== undefined) {
      if (propertyId === null) {
        pId = null;
      } else {
        const prop = await prisma.property.findFirst({ where: { id: parseInt(propertyId), tenantId } });
        if (prop) pId = prop.id;
      }
    }

    let rId: number | null = existing.roomId;
    if (roomId !== undefined) {
      if (roomId === null) {
        rId = null;
      } else {
        const room = await prisma.room.findFirst({ where: { id: parseInt(roomId), tenantId } });
        if (room) rId = room.id;
      }
    }

    const finalName = name !== undefined ? name.trim() : existing.name;

    const duplicate = await prisma.servicio.findFirst({
      where: {
        tenantId,
        propertyId: pId,
        roomId: rId,
        name: { equals: finalName, mode: 'insensitive' },
        id: { not: serviceId }
      }
    });

    if (duplicate) {
      res.status(409).json({ error: 'Ya existe un servicio con ese nombre en el mismo alcance.' });
      return;
    }

    const updated = await prisma.servicio.update({
      where: { id: serviceId },
      data: {
        name,
        description,
        cost: cost !== undefined ? parseFloat(cost) : undefined,
        tipo,
        propertyId: pId,
        roomId: rId
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error en updateServicio:', error);
    res.status(500).json({ error: 'Error al actualizar el servicio.' });
  }
};

export const deleteServicio = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;

  if (userRole === 'INQUILINO') {
    res.status(403).json({ error: 'Acceso denegado. No tienes permisos para eliminar servicios.' });
    return;
  }

  const { id } = req.params;

  try {
    const serviceId = parseInt(id as string);
    const existing = await prisma.servicio.findFirst({
      where: { id: serviceId, tenantId }
    });

    if (!existing) {
      res.status(404).json({ error: 'Servicio no encontrado o sin permisos.' });
      return;
    }

    await prisma.servicio.delete({
      where: { id: serviceId }
    });

    res.json({ message: 'Servicio eliminado con éxito.' });
  } catch (error) {
    console.error('Error en deleteServicio:', error);
    res.status(500).json({ error: 'Error al eliminar el servicio.' });
  }
};
