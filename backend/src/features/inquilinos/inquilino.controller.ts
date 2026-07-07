import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma, { runInTransaction } from '../../core/db/prisma';
import { sendCredentialsEmail } from '../../core/services/email.service';
import { getPaginationParams, buildPaginatedResponse } from '../../core/utils/pagination';

export const getAllInquilinos = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;
  const userId = req.userId!;

  try {
    let whereClause: any = { tenantId };

    if (userRole === 'INQUILINO') {
      const user = await prisma.usuario.findUnique({ where: { id: userId } });
      if (user) {
        whereClause.email = { equals: user.email, mode: 'insensitive' };
      } else {
        res.status(404).json({ error: 'Usuario no encontrado.' });
        return;
      }
    }

    const { page, limit, skip, isPaginated } = getPaginationParams(req);

    const [list, total] = await Promise.all([
      prisma.inquilino.findMany({
        where: whereClause,
        include: {
          property: true,
          room: true
        },
        orderBy: { id: 'desc' },
        ...(isPaginated ? { skip, take: limit } : {})
      }),
      isPaginated ? prisma.inquilino.count({ where: whereClause }) : Promise.resolve(0)
    ]);

    // Mapear al formato DTO para que el front lo consuma igual
    const dtos = list.map((i: any) => ({
      id: i.id,
      name: i.name,
      document: i.document,
      email: i.email,
      phone: i.phone,
      status: i.status,
      propertyId: i.propertyId || undefined,
      propertyName: i.property?.name || undefined,
      roomId: i.roomId || undefined,
      roomNumber: i.room?.roomNumber || undefined,
      roomPrice: i.room?.price || undefined,
      moveOutDate: i.moveOutDate || undefined,
      moveOutReason: i.moveOutReason || undefined
    }));

    res.json(isPaginated ? buildPaginatedResponse(dtos, total, page, limit) : dtos);
  } catch (error) {
    console.error('Error en getAllInquilinos:', error);
    res.status(500).json({ error: 'Error al obtener inquilinos.' });
  }
};

export const getMyInfo = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userId = req.userId!;

  try {
    // 1. Obtener email del usuario logueado
    const user = await prisma.usuario.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado.' });
      return;
    }

    // 2. Buscar inquilino con ese email e igual tenantId
    const inquilino = await prisma.inquilino.findFirst({
      where: { email: { equals: user.email, mode: 'insensitive' }, tenantId },
      include: { property: true, room: true }
    });

    if (!inquilino) {
      res.status(404).json({ error: 'Información de inquilino no encontrada.' });
      return;
    }

    res.json({
      id: inquilino.id,
      name: inquilino.name,
      document: inquilino.document,
      email: inquilino.email,
      phone: inquilino.phone,
      status: inquilino.status,
      propertyId: inquilino.propertyId || undefined,
      propertyName: inquilino.property?.name || undefined,
      roomId: inquilino.roomId || undefined,
      roomNumber: inquilino.room?.roomNumber || undefined,
      roomPrice: inquilino.room?.price || undefined
    });

  } catch (error) {
    console.error('Error en getMyInfo:', error);
    res.status(500).json({ error: 'Error al obtener información personal.' });
  }
};

export const createInquilino = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;
  const creatorUserId = req.userId!;

  if (userRole === 'INQUILINO') {
    res.status(403).json({ error: 'Acceso denegado. No tienes permisos para crear inquilinos.' });
    return;
  }

  const { name, document, email, phone, status, propertyId, roomId, password, entryDate, contractMonths, diaCobro } = req.body;

  if (!name || !document || !email) {
    res.status(400).json({ error: 'Nombre, documento y correo son requeridos.' });
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

  const normalizedEmail = email.trim().toLowerCase();

  try {
    let plainPass = password;
    if (!plainPass || plainPass.length < 6) {
      const rand = Math.floor(1000 + Math.random() * 9000);
      plainPass = `Roomly-${rand}`;
    }
    const hashedPassword = await bcrypt.hash(plainPass, 10);

    // Iniciar transacción para crear inquilino y usuario a la vez
    const result = await runInTransaction(async (tx: any) => {
      // 1. Validar que la propiedad pertenezca al tenant si se envía
      let pId: number | null = null;
      if (propertyId && !isNaN(parseInt(propertyId))) {
        const prop = await tx.property.findFirst({ where: { id: parseInt(propertyId), tenantId } });
        if (prop) pId = prop.id;
      }

      // 2. Validar y obtener la habitación si se envía
      let rId: number | null = null;
      let roomObj: any = null;
      if (roomId && !isNaN(parseInt(roomId))) {
        const room = await tx.room.findFirst({ where: { id: parseInt(roomId), tenantId } });
        if (room) {
          if (room.status !== 'Disponible') {
            throw new Error('La habitación seleccionada no está disponible.');
          }
          rId = room.id;
          roomObj = room;
          await tx.room.update({
            where: { id: room.id },
            data: { status: 'Ocupado' }
          });
        }
      }

      // 3. Crear Inquilino
      const inquilino = await tx.inquilino.create({
        data: {
          name,
          document,
          email: normalizedEmail,
          phone,
          status: status || 'ACTIVO',
          propertyId: pId,
          roomId: rId,
          tenantId
        },
        include: { property: true, room: true }
      });

      // 4. Crear Contrato Borrador si se asignó un cuarto
      let contractCreated = false;
      if (rId && roomObj) {
        const startDate = entryDate ? new Date(entryDate) : new Date();
        const months = parseInt(contractMonths) || 12; // 12 meses por defecto
        const endDate = new Date(startDate);
        endDate.setMonth(startDate.getMonth() + months);
        const tenantRecordForContract = await tx.tenant.findUnique({ where: { id: tenantId } });

        await tx.contrato.create({
          data: {
            tenantId,
            inquilinoId: inquilino.id,
            roomId: rId,
            startDate,
            endDate,
            amount: roomObj.price,
            diaCobro: parsedDiaCobro,
            status: 'PENDIENTE_FIRMA',
            landlordName: tenantRecordForContract?.companyName || null,
            landlordRuc: tenantRecordForContract?.landlordRuc || null,
            landlordAddress: tenantRecordForContract?.landlordAddress || null,
            acceptedTerms: false
          }
        });
        contractCreated = true;

        // Registrar evento de alta en el historial
        await tx.inquilinoHistorial.create({
          data: {
            tenantId,
            inquilinoId: inquilino.id,
            type: 'ALTA',
            toPropertyId: pId,
            toPropertyName: inquilino.property?.name || null,
            toRoomId: rId,
            toRoomNumber: roomObj.roomNumber,
            eventDate: startDate
          }
        });
      }

      // 5. Crear Usuario para login si no existe
      let tenantUser = await tx.usuario.findUnique({ where: { email: normalizedEmail } });
      const isNewTenantUser = !tenantUser;
      if (!tenantUser) {
        tenantUser = await tx.usuario.create({
          data: {
            email: normalizedEmail,
            password: hashedPassword,
            firstName: name,
            role: 'INQUILINO',
            tenantId,
            // El propietario ya garantiza esta cuenta al crearla y entregarle la contraseña directamente,
            // así que no se le exige el flujo de verificación por correo de las cuentas autorregistradas.
            emailVerified: true
          }
        });
      }

      // 5.1 Enviar las credenciales de acceso por mensajería interna (solo si la cuenta es nueva)
      if (isNewTenantUser && tenantUser) {
        await tx.mensaje.create({
          data: {
            tenantId,
            senderId: creatorUserId,
            receiverId: tenantUser.id,
            content: `¡Bienvenido(a) a Roomly, ${name}! Estas son tus credenciales de acceso:\n\nUsuario: ${normalizedEmail}\nContraseña temporal: ${plainPass}\n\nTe recomendamos iniciar sesión y cambiar tu contraseña desde tu perfil.`
          }
        });
      }

      // 6. Notificar al inquilino si se generó un contrato pendiente de firma
      if (contractCreated && tenantUser) {
        await tx.notification.create({
          data: {
            tenantId,
            userId: tenantUser.id,
            type: 'CONTRATO_PENDIENTE',
            title: 'Contrato pendiente de firma',
            message: `Tienes un contrato de arrendamiento para la habitación ${roomObj.roomNumber} en borrador. Por favor, revísalo y fírmalo.`,
            link: '/contratos'
          }
        });
      }

      return inquilino;
    });

    // Enviar las credenciales de acceso al correo real del inquilino.
    // Si el envío falla, no se revierte la creación (ya quedó registrado y recibió el mensaje interno).
    const tenantRecord = await prisma.tenant.findUnique({ where: { id: tenantId } });
    try {
      await sendCredentialsEmail(normalizedEmail, name, plainPass, tenantRecord?.slug || '');
    } catch (emailError) {
      console.error('Error enviando correo de credenciales al inquilino:', emailError);
    }

    res.status(201).json({
      id: result.id,
      name: result.name,
      document: result.document,
      email: result.email,
      phone: result.phone,
      status: result.status,
      propertyId: result.propertyId || undefined,
      propertyName: result.property?.name || undefined,
      roomId: result.roomId || undefined,
      roomNumber: result.room?.roomNumber || undefined,
      tempPassword: plainPass
    });

  } catch (error) {
    console.error('Error en createInquilino:', error);
    if (error instanceof Error && error.message.includes('no está disponible')) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Error al registrar el inquilino.' });
  }
};

export const updateInquilino = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;

  if (userRole === 'INQUILINO') {
    res.status(403).json({ error: 'Acceso denegado. No tienes permisos para actualizar inquilinos.' });
    return;
  }

  const { id } = req.params;
  const { name, document, email, phone, status, propertyId, roomId, password } = req.body;

  const normalizedEmail = email ? email.trim().toLowerCase() : undefined;

  try {
    const inquilinoId = parseInt(id as string);
    const existing = await prisma.inquilino.findFirst({
      where: { id: inquilinoId, tenantId },
      include: { room: true }
    });

    if (!existing) {
      res.status(404).json({ error: 'Inquilino no encontrado o sin permisos.' });
      return;
    }

    const oldEmail = existing.email;

    const { updated: result, newAccountCredentials } = await runInTransaction(async (tx: any) => {
      // 1. Validar propiedad
      let pId: number | null = null;
      if (propertyId && !isNaN(parseInt(propertyId))) {
        const prop = await tx.property.findFirst({ where: { id: parseInt(propertyId), tenantId } });
        if (prop) pId = prop.id;
      }

      // 2. Controlar cambios de habitación
      let rId: number | null = null;
      if (roomId && !isNaN(parseInt(roomId))) {
        const newRoom = await tx.room.findFirst({ where: { id: parseInt(roomId), tenantId } });
        if (newRoom) {
          if (newRoom.id !== existing.roomId && newRoom.status !== 'Disponible') {
            throw new Error('La habitación seleccionada no está disponible.');
          }
          rId = newRoom.id;
          // Marcar como ocupado
          await tx.room.update({
            where: { id: newRoom.id },
            data: { status: 'Ocupado' }
          });
        }
      }

      // Si cambió de habitación o se desvinculó, liberar la anterior
      if (existing.roomId && existing.roomId !== rId) {
        await tx.room.update({
          where: { id: existing.roomId },
          data: { status: 'Disponible' }
        });
      }

      // 3. Actualizar Inquilino
      const updated = await tx.inquilino.update({
        where: { id: inquilinoId },
        data: {
          name,
          document,
          email: normalizedEmail,
          phone,
          status,
          propertyId: pId,
          roomId: rId
        },
        include: { property: true, room: true }
      });

      // 4. Actualizar login de usuario (o crearlo si el inquilino todavía no tenía cuenta de acceso)
      let newAccountCredentials: { email: string; plainPass: string } | null = null;
      const existingUser = await tx.usuario.findUnique({ where: { email: oldEmail } });
      if (existingUser) {
        const dataToUpdate: any = {
          email: normalizedEmail,
          firstName: name
        };
        if (password && password.length >= 6) {
          dataToUpdate.password = await bcrypt.hash(password, 10);
        }
        await tx.usuario.update({
          where: { id: existingUser.id },
          data: dataToUpdate
        });
      } else if (normalizedEmail) {
        let plainPass = password;
        if (!plainPass || plainPass.length < 6) {
          const rand = Math.floor(1000 + Math.random() * 9000);
          plainPass = `Roomly-${rand}`;
        }
        const hashedPassword = await bcrypt.hash(plainPass, 10);

        await tx.usuario.create({
          data: {
            email: normalizedEmail,
            password: hashedPassword,
            firstName: name,
            role: 'INQUILINO',
            tenantId,
            emailVerified: true
          }
        });

        newAccountCredentials = { email: normalizedEmail, plainPass };
      }

      return { updated, newAccountCredentials };
    });

    // Si se creó una cuenta de acceso nueva durante la edición, enviar las credenciales al correo real.
    if (newAccountCredentials) {
      const tenantRecord = await prisma.tenant.findUnique({ where: { id: tenantId } });
      try {
        await sendCredentialsEmail(newAccountCredentials.email, result.name, newAccountCredentials.plainPass, tenantRecord?.slug || '');
      } catch (emailError) {
        console.error('Error enviando correo de credenciales al inquilino (edición):', emailError);
      }
    }

    res.json({
      id: result.id,
      name: result.name,
      document: result.document,
      email: result.email,
      phone: result.phone,
      status: result.status,
      propertyId: result.propertyId || undefined,
      propertyName: result.property?.name || undefined,
      roomId: result.roomId || undefined,
      roomNumber: result.room?.roomNumber || undefined
    });

  } catch (error) {
    console.error('Error en updateInquilino:', error);
    if (error instanceof Error && error.message.includes('no está disponible')) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Error al actualizar el inquilino.' });
  }
};

export const deleteInquilino = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;

  if (userRole === 'INQUILINO') {
    res.status(403).json({ error: 'Acceso denegado. No tienes permisos para eliminar inquilinos.' });
    return;
  }

  const { id } = req.params;

  try {
    const inquilinoId = parseInt(id as string);
    const existing = await prisma.inquilino.findFirst({
      where: { id: inquilinoId, tenantId }
    });

    if (!existing) {
      res.status(404).json({ error: 'Inquilino no encontrado o sin permisos.' });
      return;
    }

    await runInTransaction(async (tx: any) => {
      // 1. Liberar habitación si tenía asignada
      if (existing.roomId) {
        await tx.room.update({
          where: { id: existing.roomId },
          data: { status: 'Disponible' }
        });
      }

      // 2. Eliminar usuario asociado
      await tx.usuario.deleteMany({
        where: { email: { equals: existing.email, mode: 'insensitive' }, tenantId }
      });

      // 3. Eliminar Inquilino
      await tx.inquilino.delete({
        where: { id: inquilinoId }
      });
    });

    res.json({ message: 'Inquilino eliminado con éxito.' });
  } catch (error) {
    console.error('Error en deleteInquilino:', error);
    res.status(500).json({ error: 'Error al eliminar el inquilino.' });
  }
};

export const darDeBajaInquilino = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;

  if (userRole === 'INQUILINO') {
    res.status(403).json({ error: 'Acceso denegado. No tienes permisos para dar de baja inquilinos.' });
    return;
  }

  const { id } = req.params;
  const { moveOutDate, reason } = req.body;

  if (!moveOutDate) {
    res.status(400).json({ error: 'La fecha de mudanza es requerida.' });
    return;
  }

  try {
    const inquilinoId = parseInt(id as string);
    const existing = await prisma.inquilino.findFirst({
      where: { id: inquilinoId, tenantId },
      include: { property: true, room: true }
    });

    if (!existing) {
      res.status(404).json({ error: 'Inquilino no encontrado o sin permisos.' });
      return;
    }

    const updated = await runInTransaction(async (tx: any) => {
      // 1. Liberar habitación si tenía asignada
      if (existing.roomId) {
        await tx.room.update({
          where: { id: existing.roomId },
          data: { status: 'Disponible' }
        });
      }

      // 2. Finalizar contratos vigentes o pendientes de firma
      await tx.contrato.updateMany({
        where: { inquilinoId, status: { not: 'FINALIZADO' } },
        data: { status: 'FINALIZADO' }
      });

      // 3. Marcar inquilino como INACTIVO, registrar fecha y motivo, y liberar su cuarto
      const result = await tx.inquilino.update({
        where: { id: inquilinoId },
        data: {
          status: 'INACTIVO',
          moveOutDate: new Date(moveOutDate),
          moveOutReason: reason || null,
          propertyId: null,
          roomId: null
        }
      });

      // 4. Registrar evento en el historial
      await tx.inquilinoHistorial.create({
        data: {
          tenantId,
          inquilinoId,
          type: 'BAJA',
          fromPropertyId: existing.propertyId,
          fromPropertyName: existing.property?.name || null,
          fromRoomId: existing.roomId,
          fromRoomNumber: existing.room?.roomNumber || null,
          reason: reason || null,
          eventDate: new Date(moveOutDate)
        }
      });

      return result;
    });

    res.json({
      id: updated.id,
      status: updated.status,
      moveOutDate: updated.moveOutDate,
      moveOutReason: updated.moveOutReason,
      message: 'Inquilino dado de baja con éxito.'
    });
  } catch (error) {
    console.error('Error en darDeBajaInquilino:', error);
    res.status(500).json({ error: 'Error al dar de baja al inquilino.' });
  }
};

export const cambiarHabitacionInquilino = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;

  if (userRole === 'INQUILINO') {
    res.status(403).json({ error: 'Acceso denegado. No tienes permisos para cambiar de habitación a inquilinos.' });
    return;
  }

  const { id } = req.params;
  const { roomId, transferDate, reason, contractMonths } = req.body;

  if (!roomId) {
    res.status(400).json({ error: 'La nueva habitación es requerida.' });
    return;
  }

  try {
    const inquilinoId = parseInt(id as string);
    const newRoomId = parseInt(roomId);

    const existing = await prisma.inquilino.findFirst({
      where: { id: inquilinoId, tenantId },
      include: { property: true, room: true }
    });

    if (!existing) {
      res.status(404).json({ error: 'Inquilino no encontrado o sin permisos.' });
      return;
    }

    if (existing.roomId === newRoomId) {
      res.status(400).json({ error: 'El inquilino ya se encuentra en esa habitación.' });
      return;
    }

    const result = await runInTransaction(async (tx: any) => {
      // 1. Validar que la nueva habitación pertenezca al mismo propietario (tenant) y esté disponible
      const newRoom = await tx.room.findFirst({
        where: { id: newRoomId, tenantId },
        include: { property: true }
      });

      if (!newRoom) {
        throw new Error('La habitación destino no existe o no pertenece a tu portafolio.');
      }
      if (newRoom.status !== 'Disponible') {
        throw new Error('La habitación destino no está disponible.');
      }

      // 2. Liberar la habitación anterior
      if (existing.roomId) {
        await tx.room.update({
          where: { id: existing.roomId },
          data: { status: 'Disponible' }
        });
      }

      // 3. Ocupar la nueva habitación
      await tx.room.update({
        where: { id: newRoom.id },
        data: { status: 'Ocupado' }
      });

      // 4. Finalizar el contrato anterior y crear uno nuevo para la nueva habitación
      const previousContrato = await tx.contrato.findFirst({
        where: { inquilinoId, status: { not: 'FINALIZADO' } },
        orderBy: { createdAt: 'desc' }
      });
      await tx.contrato.updateMany({
        where: { inquilinoId, status: { not: 'FINALIZADO' } },
        data: { status: 'FINALIZADO' }
      });

      const startDate = transferDate ? new Date(transferDate) : new Date();
      const months = parseInt(contractMonths) || 12;
      const endDate = new Date(startDate);
      endDate.setMonth(startDate.getMonth() + months);
      const tenantRecord = await tx.tenant.findUnique({ where: { id: tenantId } });

      await tx.contrato.create({
        data: {
          tenantId,
          inquilinoId,
          roomId: newRoom.id,
          startDate,
          endDate,
          amount: newRoom.price,
          diaCobro: previousContrato?.diaCobro ?? null,
          status: 'PENDIENTE_FIRMA',
          landlordName: tenantRecord?.companyName || null,
          landlordRuc: tenantRecord?.landlordRuc || null,
          landlordAddress: tenantRecord?.landlordAddress || null,
          acceptedTerms: false
        }
      });

      // 5. Actualizar el inquilino con la nueva propiedad/habitación
      const updated = await tx.inquilino.update({
        where: { id: inquilinoId },
        data: {
          propertyId: newRoom.propertyId,
          roomId: newRoom.id
        },
        include: { property: true, room: true }
      });

      // 6. Registrar evento en el historial
      await tx.inquilinoHistorial.create({
        data: {
          tenantId,
          inquilinoId,
          type: 'CAMBIO_HABITACION',
          fromPropertyId: existing.propertyId,
          fromPropertyName: existing.property?.name || null,
          fromRoomId: existing.roomId,
          fromRoomNumber: existing.room?.roomNumber || null,
          toPropertyId: newRoom.propertyId,
          toPropertyName: newRoom.property?.name || null,
          toRoomId: newRoom.id,
          toRoomNumber: newRoom.roomNumber,
          reason: reason || null,
          eventDate: startDate
        }
      });

      // 7. Notificar al inquilino si tiene usuario asociado
      const tenantUser = await tx.usuario.findFirst({ where: { email: { equals: existing.email, mode: 'insensitive' }, tenantId } });
      if (tenantUser) {
        await tx.notification.create({
          data: {
            tenantId,
            userId: tenantUser.id,
            type: 'CONTRATO_PENDIENTE',
            title: 'Cambio de habitación registrado',
            message: `Te hemos trasladado a la habitación ${newRoom.roomNumber} en ${newRoom.property?.name || 'tu edificio'}. Tienes un nuevo contrato pendiente de firma.`,
            link: '/contratos'
          }
        });
      }

      return updated;
    });

    res.json({
      id: result.id,
      propertyId: result.propertyId || undefined,
      propertyName: result.property?.name || undefined,
      roomId: result.roomId || undefined,
      roomNumber: result.room?.roomNumber || undefined,
      message: 'Cambio de habitación realizado con éxito.'
    });
  } catch (error) {
    console.error('Error en cambiarHabitacionInquilino:', error);
    if (error instanceof Error && (error.message.includes('no está disponible') || error.message.includes('no existe'))) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Error al cambiar de habitación al inquilino.' });
  }
};

export const getInquilinoHistorial = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const { id } = req.params;

  try {
    const inquilinoId = parseInt(id as string);
    const existing = await prisma.inquilino.findFirst({ where: { id: inquilinoId, tenantId } });

    if (!existing) {
      res.status(404).json({ error: 'Inquilino no encontrado o sin permisos.' });
      return;
    }

    const historial = await prisma.inquilinoHistorial.findMany({
      where: { inquilinoId, tenantId },
      orderBy: { eventDate: 'desc' }
    });

    res.json(historial);
  } catch (error) {
    console.error('Error en getInquilinoHistorial:', error);
    res.status(500).json({ error: 'Error al obtener el historial del inquilino.' });
  }
};

export const changeInquilinoPassword = async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { password } = req.body;

  if (!password || password.length < 6) {
    res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    return;
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.usuario.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Contraseña actualizada con éxito.' });
  } catch (error) {
    console.error('Error en changeInquilinoPassword:', error);
    res.status(500).json({ error: 'Error al cambiar contraseña.' });
  }
};

export const consultarDni = async (req: Request, res: Response): Promise<void> => {
  const { dni } = req.params;
  
  if (!dni || dni.length !== 8) {
    res.status(400).json({ error: 'El DNI debe tener 8 dígitos.' });
    return;
  }

  try {
    const token = process.env.APIPERU_TOKEN;
    const baseUrl = process.env.APIPERU_BASE_URL || 'https://apiperu.dev';
    
    const response = await fetch(`${baseUrl}/api/dni/${dni}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      res.status(400).json({ error: 'Error en la consulta a la API de DNI.' });
      return;
    }

    const json: any = await response.json();
    if (!json.success) {
      res.status(450).json({ error: 'DNI no encontrado en RENIEC.' });
      return;
    }

    const data = json.data;
    const fullName = `${data.nombres} ${data.apellido_paterno} ${data.apellido_materno}`.trim();

    res.json({
      success: true,
      name: fullName,
      document: dni,
      nombres: data.nombres,
      apellidoPaterno: data.apellido_paterno,
      apellidoMaterno: data.apellido_materno
    });
  } catch (error: any) {
    console.error('Error en consultarDni:', error);
    res.status(500).json({ error: 'Error interno del servidor al consultar DNI.' });
  }
};
