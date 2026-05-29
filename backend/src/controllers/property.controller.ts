import { Request, Response } from 'express';
import prisma from '../prisma';

// ==========================================
// PROPERTIES CRUD
// ==========================================

export const getAllProperties = async (req: Request, res: Response): Promise<void> => {
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
        if (inquilino && inquilino.propertyId) {
          whereClause.id = inquilino.propertyId;
        } else {
          res.json([]);
          return;
        }
      } else {
        res.status(404).json({ error: 'Usuario no encontrado.' });
        return;
      }
    }

    const properties = await prisma.property.findMany({
      where: whereClause,
      include: {
        rooms: true,
        inquilinos: true
      }
    });

    res.json(properties);
  } catch (error) {
    console.error('Error en getAllProperties:', error);
    res.status(500).json({ error: 'Error al obtener propiedades.' });
  }
};

export const createProperty = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;

  if (userRole === 'INQUILINO') {
    res.status(403).json({ error: 'Acceso denegado. No tienes permisos para crear propiedades.' });
    return;
  }

  const { name, address, price } = req.body;

  if (!name || !address) {
    res.status(400).json({ error: 'El nombre y la dirección son requeridos.' });
    return;
  }

  try {
    const property = await prisma.property.create({
      data: {
        name,
        address,
        price: price ? parseFloat(price) : null,
        tenantId
      }
    });

    res.status(201).json(property);
  } catch (error) {
    console.error('Error en createProperty:', error);
    res.status(500).json({ error: 'Error al crear la propiedad.' });
  }
};

export const updateProperty = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;

  if (userRole === 'INQUILINO') {
    res.status(403).json({ error: 'Acceso denegado. No tienes permisos para actualizar propiedades.' });
    return;
  }

  const { id } = req.params;
  const { name, address, price } = req.body;

  try {
    const propertyId = parseInt(id as string);
    const existing = await prisma.property.findFirst({
      where: { id: propertyId, tenantId }
    });

    if (!existing) {
      res.status(404).json({ error: 'Propiedad no encontrada o sin permisos.' });
      return;
    }

    const updated = await prisma.property.update({
      where: { id: propertyId },
      data: {
        name,
        address,
        price: price !== undefined ? (price ? parseFloat(price) : null) : undefined
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error en updateProperty:', error);
    res.status(500).json({ error: 'Error al actualizar la propiedad.' });
  }
};

export const deleteProperty = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;

  if (userRole === 'INQUILINO') {
    res.status(403).json({ error: 'Acceso denegado. No tienes permisos para eliminar propiedades.' });
    return;
  }

  const { id } = req.params;

  try {
    const propertyId = parseInt(id as string);
    const existing = await prisma.property.findFirst({
      where: { id: propertyId, tenantId }
    });

    if (!existing) {
      res.status(404).json({ error: 'Propiedad no encontrada o sin permisos.' });
      return;
    }

    await prisma.property.delete({
      where: { id: propertyId }
    });

    res.json({ message: 'Propiedad eliminada con éxito.' });
  } catch (error) {
    console.error('Error en deleteProperty:', error);
    res.status(500).json({ error: 'Error al eliminar la propiedad.' });
  }
};

// ==========================================
// ROOMS CRUD
// ==========================================

export const getRoomsByProperty = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const { propertyId } = req.params;

  try {
    const pId = parseInt(propertyId as string);
    const userRole = req.userRole;
    const userId = req.userId!;

    if (userRole === 'INQUILINO') {
      const user = await prisma.usuario.findUnique({ where: { id: userId } });
      if (user) {
        const inquilino = await prisma.inquilino.findFirst({
          where: { email: { equals: user.email, mode: 'insensitive' }, tenantId }
        });
        if (!inquilino || inquilino.propertyId !== pId) {
          res.status(403).json({ error: 'Acceso denegado. No puedes ver habitaciones de esta propiedad.' });
          return;
        }
      } else {
        res.status(404).json({ error: 'Usuario no encontrado.' });
        return;
      }
    }
    
    // Validar primero que la propiedad pertenezca al tenant
    const property = await prisma.property.findFirst({
      where: { id: pId, tenantId }
    });
    if (!property) {
      res.status(404).json({ error: 'Propiedad no encontrada.' });
      return;
    }

    const rooms = await prisma.room.findMany({
      where: { propertyId: pId, tenantId }
    });

    res.json(rooms);
  } catch (error) {
    console.error('Error en getRoomsByProperty:', error);
    res.status(500).json({ error: 'Error al obtener las habitaciones.' });
  }
};

export const createRoom = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;

  if (userRole === 'INQUILINO') {
    res.status(403).json({ error: 'Acceso denegado. No tienes permisos para crear habitaciones.' });
    return;
  }

  const { propertyId, roomNumber, price, status } = req.body;

  if (!propertyId || !roomNumber || price === undefined) {
    res.status(400).json({ error: 'Propiedad, número de cuarto y precio son requeridos.' });
    return;
  }

  try {
    const pId = parseInt(propertyId);

    // Validar propiedad del tenant
    const property = await prisma.property.findFirst({
      where: { id: pId, tenantId }
    });
    if (!property) {
      res.status(404).json({ error: 'Propiedad no encontrada.' });
      return;
    }

    const room = await prisma.room.create({
      data: {
        roomNumber,
        price: parseFloat(price),
        status: status || 'Disponible',
        propertyId: pId,
        tenantId
      }
    });

    res.status(201).json(room);
  } catch (error) {
    console.error('Error en createRoom:', error);
    res.status(500).json({ error: 'Error al crear la habitación.' });
  }
};

export const updateRoom = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;

  if (userRole === 'INQUILINO') {
    res.status(403).json({ error: 'Acceso denegado. No tienes permisos para actualizar habitaciones.' });
    return;
  }

  const { id } = req.params;
  const { roomNumber, price, status } = req.body;

  try {
    const roomId = parseInt(id as string);
    const existing = await prisma.room.findFirst({
      where: { id: roomId, tenantId }
    });

    if (!existing) {
      res.status(404).json({ error: 'Habitación no encontrada o sin permisos.' });
      return;
    }

    const updated = await prisma.room.update({
      where: { id: roomId },
      data: {
        roomNumber,
        price: price !== undefined ? parseFloat(price) : undefined,
        status
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error en updateRoom:', error);
    res.status(500).json({ error: 'Error al actualizar la habitación.' });
  }
};

export const deleteRoom = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;

  if (userRole === 'INQUILINO') {
    res.status(403).json({ error: 'Acceso denegado. No tienes permisos para eliminar habitaciones.' });
    return;
  }

  const { id } = req.params;

  try {
    const roomId = parseInt(id as string);
    const existing = await prisma.room.findFirst({
      where: { id: roomId, tenantId }
    });

    if (!existing) {
      res.status(404).json({ error: 'Habitación no encontrada o sin permisos.' });
      return;
    }

    await prisma.room.delete({
      where: { id: roomId }
    });

    res.json({ message: 'Habitación eliminada con éxito.' });
  } catch (error) {
    console.error('Error en deleteRoom:', error);
    res.status(500).json({ error: 'Error al eliminar la habitación.' });
  }
};
