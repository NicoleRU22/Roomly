import { Request, Response } from 'express';
import prisma from '../../core/db/prisma';

export const getProveedores = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  try {
    const proveedores = await prisma.proveedor.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' }
    });
    res.json(proveedores);
  } catch (error) {
    console.error('Error en getProveedores:', error);
    res.status(500).json({ error: 'Error al obtener los proveedores.' });
  }
};

export const createProveedor = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;
  const { name, specialty, phone, notes } = req.body;

  if (userRole === 'INQUILINO') {
    res.status(403).json({ error: 'Acceso denegado. Solo propietarios pueden gestionar proveedores.' });
    return;
  }

  if (!name || !specialty || !phone) {
    res.status(400).json({ error: 'Nombre, especialidad y teléfono son requeridos.' });
    return;
  }

  try {
    const proveedor = await prisma.proveedor.create({
      data: { tenantId, name: name.trim(), specialty: specialty.trim(), phone: phone.trim(), notes: notes?.trim() || null }
    });
    res.status(201).json(proveedor);
  } catch (error) {
    console.error('Error en createProveedor:', error);
    res.status(500).json({ error: 'Error al crear el proveedor.' });
  }
};

export const updateProveedor = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;
  const { id } = req.params;
  const { name, specialty, phone, notes } = req.body;

  if (userRole === 'INQUILINO') {
    res.status(403).json({ error: 'Acceso denegado. Solo propietarios pueden gestionar proveedores.' });
    return;
  }

  try {
    const existing = await prisma.proveedor.findFirst({ where: { id: parseInt(id as string), tenantId } });
    if (!existing) {
      res.status(404).json({ error: 'Proveedor no encontrado.' });
      return;
    }

    const updated = await prisma.proveedor.update({
      where: { id: existing.id },
      data: {
        name: name?.trim() ?? existing.name,
        specialty: specialty?.trim() ?? existing.specialty,
        phone: phone?.trim() ?? existing.phone,
        notes: notes !== undefined ? (notes?.trim() || null) : existing.notes
      }
    });
    res.json(updated);
  } catch (error) {
    console.error('Error en updateProveedor:', error);
    res.status(500).json({ error: 'Error al actualizar el proveedor.' });
  }
};

export const deleteProveedor = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;
  const { id } = req.params;

  if (userRole === 'INQUILINO') {
    res.status(403).json({ error: 'Acceso denegado. Solo propietarios pueden gestionar proveedores.' });
    return;
  }

  try {
    const existing = await prisma.proveedor.findFirst({ where: { id: parseInt(id as string), tenantId } });
    if (!existing) {
      res.status(404).json({ error: 'Proveedor no encontrado.' });
      return;
    }

    await prisma.proveedor.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (error) {
    console.error('Error en deleteProveedor:', error);
    res.status(500).json({ error: 'Error al eliminar el proveedor.' });
  }
};
