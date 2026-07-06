import { Request, Response } from 'express';
import prisma from '../../core/db/prisma';
import { saveBase64Image } from '../../core/utils/upload';
import { notifyOwners, notifyInquilino } from '../notificaciones/notification.service';
import { getPaginationParams, buildPaginatedResponse } from '../../core/utils/pagination';

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
      prisma.contrato.findMany({
        where: whereClause,
        include: {
          inquilino: true,
          room: {
            include: {
              property: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        ...(isPaginated ? { skip, take: limit } : {})
      }),
      isPaginated ? prisma.contrato.count({ where: whereClause }) : Promise.resolve(0)
    ]);

    const dtos = list.map((c: any) => ({
      id: c.id,
      tenantId: c.tenantId,
      inquilinoId: c.inquilinoId,
      inquilinoName: c.inquilino.name,
      inquilinoDocument: c.inquilino.document,
      roomId: c.roomId,
      roomNumber: c.room.roomNumber,
      propertyId: c.room.propertyId,
      propertyName: c.room.property.name,
      propertyServices: c.room.property.services || '',
      startDate: c.startDate.toISOString().split('T')[0],
      endDate: c.endDate.toISOString().split('T')[0],
      amount: c.amount,
      diaCobro: c.diaCobro || undefined,
      status: c.status,
      landlordName: c.landlordName || undefined,
      landlordRuc: c.landlordRuc || undefined,
      landlordAddress: c.landlordAddress || undefined,
      specialTerms: c.specialTerms || undefined,
      signatureUrl: c.signatureUrl || undefined,
      acceptedTerms: c.acceptedTerms,
      createdAt: c.createdAt
    }));

    res.json(isPaginated ? buildPaginatedResponse(dtos, total, page, limit) : dtos);
  } catch (error) {
    console.error('Error en getContratos:', error);
    res.status(500).json({ error: 'Error al obtener contratos.' });
  }
};

export const updateContrato = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;
  const { id } = req.params;
  const { startDate, endDate, amount, landlordName, landlordRuc, landlordAddress, specialTerms, diaCobro } = req.body;

  if (userRole === 'INQUILINO') {
    res.status(403).json({ error: 'Acceso denegado. Solo propietarios pueden editar contratos.' });
    return;
  }

  if (!startDate || !endDate || amount === undefined) {
    res.status(400).json({ error: 'Fecha inicio, fin y monto son requeridos.' });
    return;
  }

  let parsedDiaCobro: number | null = null;
  if (diaCobro !== undefined && diaCobro !== null && diaCobro !== '') {
    parsedDiaCobro = parseInt(diaCobro);
    if (isNaN(parsedDiaCobro) || parsedDiaCobro < 1 || parsedDiaCobro > 31) {
      res.status(400).json({ error: 'El día de cobro debe ser un número entre 1 y 31.' });
      return;
    }
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

    if (existing.status !== 'PENDIENTE_FIRMA') {
      res.status(400).json({ error: 'Solo se pueden editar contratos en borrador.' });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const parsedAmount = parseFloat(amount);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start || isNaN(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({ error: 'Fechas o monto inválidos para el contrato.' });
      return;
    }

    const updated = await prisma.contrato.update({
      where: { id: contratoId },
      data: {
        startDate: start,
        endDate: end,
        amount: parsedAmount,
        diaCobro: parsedDiaCobro,
        landlordName: landlordName ? String(landlordName).trim() : null,
        landlordRuc: landlordRuc ? String(landlordRuc).replace(/\D/g, '') : null,
        landlordAddress: landlordAddress ? String(landlordAddress).trim() : null,
        specialTerms: specialTerms ? String(specialTerms).trim() : null
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error en updateContrato:', error);
    res.status(500).json({ error: 'Error al editar el contrato.' });
  }
};

export const getRoomAvailability = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const { roomId } = req.params;

  try {
    const rId = parseInt(roomId as string);
    const room = await prisma.room.findFirst({ where: { id: rId, tenantId } });
    if (!room) {
      res.status(404).json({ error: 'Habitación no encontrada.' });
      return;
    }

    const contratos = await prisma.contrato.findMany({
      where: {
        roomId: rId,
        tenantId,
        status: { not: 'CANCELADO' }
      },
      include: { inquilino: true },
      orderBy: { startDate: 'asc' }
    });

    res.json({
      roomId: room.id,
      roomNumber: room.roomNumber,
      roomStatus: room.status,
      occupiedRanges: contratos.map((c: any) => ({
        contratoId: c.id,
        inquilinoName: c.inquilino.name,
        startDate: c.startDate.toISOString().split('T')[0],
        endDate: c.endDate.toISOString().split('T')[0],
        status: c.status
      }))
    });
  } catch (error) {
    console.error('Error en getRoomAvailability:', error);
    res.status(500).json({ error: 'Error al obtener la disponibilidad de la habitación.' });
  }
};

export const consultarRucSunat = async (req: Request, res: Response): Promise<void> => {
  const { ruc } = req.params;
  const cleanRuc = String(ruc || '').replace(/\D/g, '');

  if (cleanRuc.length !== 11) {
    res.status(400).json({ error: 'El RUC debe tener 11 dígitos.' });
    return;
  }

  try {
    const token = process.env.APIPERU_TOKEN;
    const baseUrl = process.env.APIPERU_BASE_URL || 'https://apiperu.dev';

    if (!token) {
      res.status(400).json({ error: 'No se configuró APIPERU_TOKEN para consultar SUNAT.' });
      return;
    }

    const response = await fetch(`${baseUrl}/api/ruc/${cleanRuc}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      res.status(400).json({ error: 'Error en la consulta a la API SUNAT.' });
      return;
    }

    const json: any = await response.json();
    if (!json.success) {
      res.status(404).json({ error: 'RUC no encontrado en SUNAT.' });
      return;
    }

    const data = json.data || {};
    res.json({
      success: true,
      ruc: data.ruc || cleanRuc,
      razonSocial: data.razon_social || data.nombre_o_razon_social || data.nombre || '',
      direccion: data.direccion || data.direccion_completa || '',
      estado: data.estado || '',
      condicion: data.condicion || ''
    });
  } catch (error) {
    console.error('Error en consultarRucSunat:', error);
    res.status(500).json({ error: 'Error interno del servidor al consultar SUNAT.' });
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

    if (contrato.status !== 'PENDIENTE_FIRMA') {
      res.status(400).json({ error: 'Solo se pueden firmar contratos en borrador.' });
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

      await notifyOwners(
        tenantId,
        'CONTRATO_FIRMADO',
        'Contrato firmado',
        `${contrato.inquilino.name} firmó el contrato de arrendamiento de la habitación.`,
        '/contratos'
      );

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
    const { startDate, endDate, amount, diaCobro } = req.body;

    if (userRole === 'INQUILINO') {
      res.status(403).json({ error: 'Acceso denegado. Solo propietarios pueden renovar contratos.' });
      return;
    }

    if (!startDate || !endDate || !amount) {
      res.status(400).json({ error: 'Fecha inicio, fin y monto son requeridos.' });
      return;
    }

    let parsedDiaCobro: number | null = null;
    if (diaCobro !== undefined && diaCobro !== null && diaCobro !== '') {
      parsedDiaCobro = parseInt(diaCobro);
      if (isNaN(parsedDiaCobro) || parsedDiaCobro < 1 || parsedDiaCobro > 31) {
        res.status(400).json({ error: 'El día de cobro debe ser un número entre 1 y 31.' });
        return;
      }
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
            diaCobro: parsedDiaCobro !== null ? parsedDiaCobro : existing.diaCobro,
            status: 'PENDIENTE_FIRMA',
            landlordName: existing.landlordName,
            landlordRuc: existing.landlordRuc,
            landlordAddress: existing.landlordAddress,
            specialTerms: existing.specialTerms,
            acceptedTerms: false
          }
        })
      ]);

      await notifyInquilino(
        tenantId,
        existing.inquilinoId,
        'CONTRATO_PENDIENTE',
        'Renovación de contrato pendiente de firma',
        'Se generó un nuevo contrato de renovación. Por favor, revísalo y fírmalo.',
        '/contratos'
      );

      res.status(201).json(newContrato);
    } catch (error) {
      console.error('Error en renewContrato:', error);
      res.status(500).json({ error: 'Error al renovar el contrato.' });
    }
  };
