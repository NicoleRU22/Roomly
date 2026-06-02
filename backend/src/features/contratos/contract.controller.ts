import { Request, Response } from 'express';
import prisma from '../../core/db/prisma';
import { saveBase64Image } from '../../core/utils/upload';

export const getContratos = async (req: Request, res: Response): Promise<void> => {
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

    const list = await prisma.contrato.findMany({
      where: whereClause,
      include: {
        inquilino: true,
        room: {
          include: {
            property: true
          }
        }
      }
    });

    res.json(list.map((c: any) => ({
      id: c.id,
      tenantId: c.tenantId,
      inquilinoId: c.inquilinoId,
      inquilinoName: c.inquilino.name,
      inquilinoDocument: c.inquilino.document,
      roomId: c.roomId,
      roomNumber: c.room.roomNumber,
      propertyId: c.room.propertyId,
      propertyName: c.room.property.name,
      startDate: c.startDate.toISOString().split('T')[0],
      endDate: c.endDate.toISOString().split('T')[0],
      amount: c.amount,
      status: c.status,
      signatureUrl: c.signatureUrl || undefined,
      acceptedTerms: c.acceptedTerms,
      createdAt: c.createdAt
    })));
  } catch (error) {
    console.error('Error en getContratos:', error);
    res.status(500).json({ error: 'Error al obtener contratos.' });
  }
};

export const signContrato = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const { id } = req.params;
  const { signatureImage, acceptedTerms } = req.body;

  if (!signatureImage || !acceptedTerms) {
    res.status(400).json({ error: 'La firma y la aceptación de términos son requeridas.' });
    return;
  }

  try {
    const contratoId = parseInt(id as string);
    const contrato = await prisma.contrato.findFirst({
      where: { id: contratoId, tenantId },
      include: { inquilino: true }
    });

    if (!contrato) {
      res.status(404).json({ error: 'Contrato no encontrado.' });
      return;
    }

    // Si es inquilino, validar que firme su propio contrato
    if (req.userRole === 'INQUILINO') {
      const user = await prisma.usuario.findUnique({ where: { id: req.userId! } });
      if (user) {
        const inquilino = await prisma.inquilino.findFirst({
          where: { email: { equals: user.email, mode: 'insensitive' }, tenantId }
        });
        if (!inquilino || contrato.inquilinoId !== inquilino.id) {
          res.status(403).json({ error: 'No tienes permisos para firmar este contrato.' });
          return;
        }
      }
    }

    // Decodificar y guardar la firma en el subdirectorio de firmas
    const signatureUrl = saveBase64Image(signatureImage, 'signatures');

    const updated = await prisma.contrato.update({
        where: { id: contratoId },
        data: {
          signatureUrl,
          acceptedTerms: true,
          status: 'VIGENTE'
        }
      });
  
      res.json(updated);
    } catch (error) {
      console.error('Error en signContrato:', error);
      res.status(500).json({ error: 'Error al firmar el contrato.' });
    }
  };
  
  export const renewContrato = async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenantId!;
    const userRole = req.userRole;
    const { id } = req.params;
    const { startDate, endDate, amount } = req.body;
  
    if (userRole === 'INQUILINO') {
      res.status(403).json({ error: 'Acceso denegado. Solo propietarios pueden renovar contratos.' });
      return;
    }
  
    if (!startDate || !endDate || !amount) {
      res.status(400).json({ error: 'Fecha inicio, fin y monto son requeridos.' });
      return;
    }
  
    try {
      const contratoId = parseInt(id as string);
      const existing = await prisma.contrato.findFirst({
        where: { id: contratoId, tenantId }
      });
  
      if (!existing) {
        res.status(404).json({ error: 'Contrato no encontrado o sin permisos.' });
        return;
      }
  
      // Usar transacción para actualizar el contrato anterior y crear el borrador nuevo
      const [oldUpdated, newContrato] = await prisma.$transaction([
        prisma.contrato.update({
          where: { id: contratoId },
          data: { status: 'FINALIZADO' }
        }),
        prisma.contrato.create({
          data: {
            tenantId,
            inquilinoId: existing.inquilinoId,
            roomId: existing.roomId,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            amount: parseFloat(amount),
            status: 'PENDIENTE_FIRMA',
            acceptedTerms: false
          }
        })
      ]);
  
      res.status(201).json(newContrato);
    } catch (error) {
      console.error('Error en renewContrato:', error);
      res.status(500).json({ error: 'Error al renovar el contrato.' });
    }
  };
