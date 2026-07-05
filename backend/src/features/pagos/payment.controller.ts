import { Request, Response } from 'express';
import prisma from '../../core/db/prisma';
import { saveBase64Image } from '../../core/utils/upload';
import { notifyOwners, notifyInquilino } from '../notificaciones/notification.service';
import { generateRecurringInvoices } from './recurring.service';

// Helper para calcular la mora
const calculateDelay = (dueDateStr: Date | string): number => {
  const due = new Date(dueDateStr);
  const today = new Date();
  
  // Setear horas a 0 para comparar solo fechas
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  if (today.getTime() > due.getTime()) {
    const diffTime = Math.abs(today.getTime() - due.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Penalización: a partir del 5to día, 5 soles de mora por cada día que pase
    if (diffDays >= 5) {
      return diffDays * 5.0;
    }
  }
  return 0.0;
};

export const getAllPayments = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;
  const userId = req.userId!;

  try {
    let whereClause: any = { tenantId };

    if (userRole === 'INQUILINO') {
      const user = await prisma.usuario.findUnique({
        where: { id: userId }
      });
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

    const list = await prisma.payment.findMany({
      where: whereClause,
      include: {
        inquilino: true,
        room: true
      },
      orderBy: { dueDate: 'asc' }
    });

    // Actualizar mora dinámicamente al listar para asegurar datos frescos
    const updatedList = await Promise.all(list.map(async (p: any) => {
      if (p.status !== 'PAGADO' && p.status !== 'CANCELADO') {
        const penalty = calculateDelay(p.dueDate);
        let newStatus = p.status;
        
        // Si está pendiente y ya venció
        if (p.status === 'PENDIENTE' && new Date() > new Date(p.dueDate)) {
          newStatus = 'VENCIDO';
        }

        if (penalty !== p.delayPenalty || newStatus !== p.status) {
          return await prisma.payment.update({
            where: { id: p.id },
            data: { delayPenalty: penalty, status: newStatus },
            include: { inquilino: true, room: true }
          });
        }
      }
      return p;
    }));

    res.json(updatedList.map((p: any) => ({
      id: p.id,
      inquilinoId: p.inquilinoId,
      inquilinoName: p.inquilino.name,
      roomId: p.roomId || undefined,
      roomNumber: p.room?.roomNumber || undefined,
      amount: p.amount,
      amountPaid: p.amountPaid,
      delayPenalty: p.delayPenalty,
      dueDate: p.dueDate.toISOString().split('T')[0],
      lastPaymentDate: p.lastPaymentDate ? p.lastPaymentDate.toISOString().split('T')[0] : undefined,
      status: p.status,
      paymentType: p.paymentType,
      description: p.description || undefined,
      receiptReference: p.receiptReference || undefined,
      receiptImageUrl: p.receiptImageUrl || undefined,
      receiptStatus: p.receiptStatus,
      rejectionReason: p.rejectionReason || undefined,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    })));

  } catch (error) {
    console.error('Error en getAllPayments:', error);
    res.status(500).json({ error: 'Error al obtener los pagos.' });
  }
};

export const createPayment = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;

  if (userRole === 'INQUILINO') {
    res.status(403).json({ error: 'Acceso denegado. No tienes permisos para registrar pagos.' });
    return;
  }

  const { inquilinoId, roomId, amount, dueDate, paymentType, description } = req.body;

  if (!inquilinoId || !amount || !dueDate) {
    res.status(400).json({ error: 'Inquilino, monto y fecha de vencimiento son requeridos.' });
    return;
  }

  try {
    const inqId = parseInt(inquilinoId);
    
    // Validar inquilino
    const inquilino = await prisma.inquilino.findFirst({
      where: { id: inqId, tenantId }
    });
    if (!inquilino) {
      res.status(404).json({ error: 'Inquilino no encontrado.' });
      return;
    }

    // Validar cuarto si se envía
    let rId: number | null = null;
    if (roomId) {
      const room = await prisma.room.findFirst({ where: { id: parseInt(roomId), tenantId } });
      if (room) rId = room.id;
    }

    const due = new Date(dueDate);
    const delayPenalty = calculateDelay(due);
    const status = due < new Date() ? 'VENCIDO' : 'PENDIENTE';

    const payment = await prisma.payment.create({
      data: {
        inquilinoId: inqId,
        roomId: rId,
        amount: parseFloat(amount),
        amountPaid: 0.0,
        delayPenalty,
        dueDate: due,
        status,
        paymentType: paymentType || 'ALQUILER',
        description,
        tenantId
      }
    });

    await notifyInquilino(
      tenantId,
      inqId,
      'PAGO_GENERADO',
      'Nuevo recibo emitido',
      `Se generó un recibo de ${payment.paymentType === 'ALQUILER' ? 'alquiler' : 'servicio'} por S/. ${payment.amount.toFixed(2)}, con vencimiento el ${due.toLocaleDateString('es-PE')}.`,
      '/pagos'
    );

    res.status(201).json(payment);
  } catch (error) {
    console.error('Error en createPayment:', error);
    res.status(500).json({ error: 'Error al registrar el pago.' });
  }
};

export const recordPayment = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const { id } = req.params;
  const { amountToAdd, receiptReference, receiptImage } = req.body;

  try {
    const paymentId = parseInt(id as string);
    const existing = await prisma.payment.findFirst({
      where: { id: paymentId, tenantId }
    });

    if (!existing) {
      res.status(404).json({ error: 'Pago no encontrado o sin permisos.' });
      return;
    }

    const isTenant = req.userRole === 'INQUILINO';
    if (isTenant) {
      const user = await prisma.usuario.findUnique({ where: { id: req.userId! } });
      if (user) {
        const inquilino = await prisma.inquilino.findFirst({
          where: { email: { equals: user.email, mode: 'insensitive' }, tenantId }
        });
        if (!inquilino || existing.inquilinoId !== inquilino.id) {
          res.status(403).json({ error: 'Acceso denegado. No puedes registrar pagos en este comprobante.' });
          return;
        }
      } else {
        res.status(404).json({ error: 'Usuario no encontrado.' });
        return;
      }
    }

    // Si el inquilino sube una imagen de comprobante (Yape/Transferencia)
    if (isTenant && receiptImage) {
      const imageUrl = saveBase64Image(receiptImage, 'receipts');
      
      const updated = await prisma.payment.update({
        where: { id: paymentId },
        data: {
          receiptImageUrl: imageUrl,
          receiptStatus: 'PENDIENTE',
          receiptReference: receiptReference || existing.receiptReference
        }
      });

      await notifyOwners(
        tenantId,
        'COMPROBANTE_PENDIENTE',
        'Comprobante pendiente de validación',
        `Se subió un comprobante de pago por S/. ${existing.amount.toFixed(2)} que requiere tu aprobación.`,
        '/pagos'
      );

      res.json(updated);
      return;
    }

    // Registro de pago por el Propietario (o efectivo directo sin imagen)
    const toAdd = parseFloat(amountToAdd || '0');
    if (toAdd <= 0) {
      res.status(400).json({ error: 'El monto a registrar debe ser un número positivo.' });
      return;
    }

    const newAmountPaid = existing.amountPaid + toAdd;
    let newStatus = existing.status;
    let newPenalty = existing.delayPenalty;

    // Si ya completó el pago total
    if (newAmountPaid >= (existing.amount + existing.delayPenalty)) {
      newStatus = 'PAGADO';
      newPenalty = 0.0; // Anular mora
    } else {
      newStatus = 'PAGADO_PARCIAL';
    }

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        amountPaid: newAmountPaid,
        delayPenalty: newPenalty,
        status: newStatus,
        lastPaymentDate: new Date(),
        receiptReference: receiptReference || existing.receiptReference,
        receiptStatus: 'APROBADO'
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error en recordPayment:', error);
    res.status(500).json({ error: 'Error al registrar el cobro.' });
  }
};

export const approvePayment = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;
  const { id } = req.params;

  if (userRole === 'INQUILINO') {
    res.status(403).json({ error: 'Acceso denegado. Solo propietarios pueden validar comprobantes.' });
    return;
  }

  try {
    const paymentId = parseInt(id as string);
    const existing = await prisma.payment.findFirst({
      where: { id: paymentId, tenantId }
    });

    if (!existing) {
      res.status(404).json({ error: 'Pago no encontrado o sin permisos.' });
      return;
    }

    // Al aprobar, se considera cancelado el saldo total (monto + mora actual)
    const totalToPay = existing.amount + existing.delayPenalty;

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        amountPaid: totalToPay,
        status: 'PAGADO',
        receiptStatus: 'APROBADO',
        lastPaymentDate: new Date(),
        rejectionReason: null
      }
    });

    await notifyInquilino(
      tenantId,
      existing.inquilinoId,
      'PAGO_APROBADO',
      'Pago aprobado',
      `Tu comprobante de pago por S/. ${totalToPay.toFixed(2)} fue validado y aprobado.`,
      '/pagos'
    );

    res.json(updated);
  } catch (error) {
    console.error('Error en approvePayment:', error);
    res.status(500).json({ error: 'Error al aprobar el pago.' });
  }
};

export const rejectPayment = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;
  const { id } = req.params;
  const { reason } = req.body;

  if (userRole === 'INQUILINO') {
    res.status(403).json({ error: 'Acceso denegado. Solo propietarios pueden validar comprobantes.' });
    return;
  }

  try {
    const paymentId = parseInt(id as string);
    const existing = await prisma.payment.findFirst({
      where: { id: paymentId, tenantId }
    });

    if (!existing) {
      res.status(404).json({ error: 'Pago no encontrado o sin permisos.' });
      return;
    }

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        receiptStatus: 'RECHAZADO',
        rejectionReason: reason || 'Comprobante inválido o ilegible.'
      }
    });

    await notifyInquilino(
      tenantId,
      existing.inquilinoId,
      'PAGO_RECHAZADO',
      'Comprobante rechazado',
      reason ? `Tu comprobante fue rechazado: ${reason}` : 'Tu comprobante fue rechazado. Por favor, sube uno nuevo.',
      '/pagos'
    );

    res.json(updated);
  } catch (error) {
    console.error('Error en rejectPayment:', error);
    res.status(500).json({ error: 'Error al rechazar el pago.' });
  }
};

export const runRecurringInvoices = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;

  if (userRole === 'INQUILINO') {
    res.status(403).json({ error: 'Acceso denegado. No tienes permisos para generar cobros recurrentes.' });
    return;
  }

  try {
    const result = await generateRecurringInvoices(tenantId);
    res.json({ message: `Se generaron ${result.created} recibo(s) automáticamente.`, created: result.created });
  } catch (error) {
    console.error('Error en runRecurringInvoices:', error);
    res.status(500).json({ error: 'Error al generar los cobros recurrentes.' });
  }
};

export const sendDebtReminder = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;
  const { inquilinoId } = req.params;

  if (userRole === 'INQUILINO') {
    res.status(403).json({ error: 'Acceso denegado. No tienes permisos para enviar recordatorios.' });
    return;
  }

  try {
    const inqId = parseInt(inquilinoId as string);
    const inquilino = await prisma.inquilino.findFirst({ where: { id: inqId, tenantId } });
    if (!inquilino) {
      res.status(404).json({ error: 'Inquilino no encontrado.' });
      return;
    }

    const pendingPayments = await prisma.payment.findMany({
      where: {
        tenantId,
        inquilinoId: inqId,
        status: { notIn: ['PAGADO', 'CANCELADO'] }
      }
    });

    if (pendingPayments.length === 0) {
      res.status(400).json({ error: 'Este inquilino no tiene deudas pendientes.' });
      return;
    }

    const totalDebt = pendingPayments.reduce((sum: number, p: any) => sum + ((p.amount - p.amountPaid) + p.delayPenalty), 0);

    await notifyInquilino(
      tenantId,
      inqId,
      'RECORDATORIO_DEUDA',
      'Recordatorio de pago pendiente',
      `Tienes una deuda acumulada de S/. ${totalDebt.toFixed(2)} en ${pendingPayments.length} recibo(s). Por favor, regulariza tus pagos pendientes.`,
      '/pagos'
    );

    res.json({ message: 'Recordatorio enviado con éxito.', totalDebt });
  } catch (error) {
    console.error('Error en sendDebtReminder:', error);
    res.status(500).json({ error: 'Error al enviar el recordatorio.' });
  }
};

export const exportPaymentsReport = async (req: Request, res: Response): Promise<void> => {
  // Retornar un simple resumen para emular la descarga de reporte
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=reporte-ingresos.csv');
  res.send('ID,Inquilino,Concepto,Monto,Mora,Pagado,Estado,Fecha Vencimiento\n');
};

export const deletePayment = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;

  if (userRole === 'INQUILINO') {
    res.status(403).json({ error: 'Acceso denegado. No tienes permisos para eliminar pagos.' });
    return;
  }

  const { id } = req.params;

  try {
    const paymentId = parseInt(id as string);
    const existing = await prisma.payment.findFirst({
      where: { id: paymentId, tenantId }
    });

    if (!existing) {
      res.status(404).json({ error: 'Pago no encontrado o sin permisos.' });
      return;
    }

    await prisma.payment.delete({
      where: { id: paymentId }
    });

    res.json({ message: 'Registro de pago eliminado con éxito.' });
  } catch (error) {
    console.error('Error en deletePayment:', error);
    res.status(500).json({ error: 'Error al eliminar el pago.' });
  }
};
