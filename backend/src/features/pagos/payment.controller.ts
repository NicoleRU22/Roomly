import { Request, Response } from 'express';
import prisma from '../../core/db/prisma';
import { saveBase64Image } from '../../core/utils/upload';
import { notifyOwners, notifyInquilino } from '../notificaciones/notification.service';
import { generateRecurringInvoices } from './recurring.service';

// Helper para calcular la mora, según las reglas de cobro configuradas por el propietario
// (graceDays: días de gracia antes de aplicar penalización; lateFeePerDay: monto por día de retraso)
const calculateDelay = (dueDateStr: Date | string, graceDays: number = 5, lateFeePerDay: number = 5.0): number => {
  const due = new Date(dueDateStr);
  const today = new Date();

  // Setear horas a 0 para comparar solo fechas
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  if (today.getTime() > due.getTime()) {
    const diffTime = Math.abs(today.getTime() - due.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays >= graceDays) {
      return diffDays * lateFeePerDay;
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
        room: { include: { property: true } }
      },
      orderBy: { dueDate: 'asc' }
    });

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const graceDays = tenant?.graceDays ?? 5;
    const lateFeePerDay = tenant?.lateFeePerDay ?? 5.0;

    // Actualizar mora dinámicamente al listar para asegurar datos frescos
    const updatedList = await Promise.all(list.map(async (p: any) => {
      if (p.status !== 'PAGADO' && p.status !== 'CANCELADO') {
        const penalty = calculateDelay(p.dueDate, graceDays, lateFeePerDay);
        let newStatus = p.status;
        
        // Si está pendiente y ya venció
        if (p.status === 'PENDIENTE' && new Date() > new Date(p.dueDate)) {
          newStatus = 'VENCIDO';
        }

        if (penalty !== p.delayPenalty || newStatus !== p.status) {
          return await prisma.payment.update({
            where: { id: p.id },
            data: { delayPenalty: penalty, status: newStatus },
            include: { inquilino: true, room: { include: { property: true } } }
          });
        }
      }
      return p;
    }));

    res.json(updatedList.map((p: any) => ({
      id: p.id,
      inquilinoId: p.inquilinoId,
      inquilinoName: p.inquilino.name,
      inquilinoDocument: p.inquilino.document || undefined,
      inquilinoEmail: p.inquilino.email || undefined,
      inquilinoPhone: p.inquilino.phone || undefined,
      inquilinoStatus: p.inquilino.status || undefined,
      roomId: p.roomId || undefined,
      roomNumber: p.room?.roomNumber || undefined,
      propertyName: p.room?.property?.name || undefined,
      propertyAddress: p.room?.property?.address || undefined,
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

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const due = new Date(dueDate);
    const delayPenalty = calculateDelay(due, tenant?.graceDays ?? 5, tenant?.lateFeePerDay ?? 5.0);
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

const SCHEDULE_MONTH_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];

const formatScheduleMonthLabel = (year: number, month: number): string => `${SCHEDULE_MONTH_ABBR[month]} ${String(year).slice(2)}`;

// Genera el cronograma de pagos (inquilino x mes) mostrando el estado de cobro de cada mes,
// derivado del contrato vigente en ese periodo y del recibo de alquiler correspondiente (si ya se generó).
export const getPaymentSchedule = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;

  if (userRole === 'INQUILINO') {
    res.status(403).json({ error: 'Acceso denegado. No tienes permisos para ver el cronograma de pagos.' });
    return;
  }

  try {
    const requestedMonths = parseInt(req.query.months as string);
    const numMonths = Math.min(Math.max(isNaN(requestedMonths) ? 12 : requestedMonths, 1), 24);

    const now = new Date();
    const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const months = Array.from({ length: numMonths }, (_, idx) => {
      const offset = numMonths - 1 - idx;
      const start = new Date(Date.UTC(currentMonthStart.getUTCFullYear(), currentMonthStart.getUTCMonth() - offset, 1));
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      return {
        key: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`,
        year: start.getUTCFullYear(),
        month: start.getUTCMonth(),
        start,
        end
      };
    });

    const rangeStart = months[0].start;
    const rangeEnd = months[months.length - 1].end;
    const isCurrentMonthKey = (key: string) => key === `${currentMonthStart.getUTCFullYear()}-${String(currentMonthStart.getUTCMonth() + 1).padStart(2, '0')}`;

    const inquilinos = await prisma.inquilino.findMany({
      where: { tenantId },
      include: {
        room: { include: { property: true } },
        contratos: { where: { status: { not: 'PENDIENTE_FIRMA' } } },
        payments: {
          where: {
            paymentType: 'ALQUILER',
            dueDate: { gte: rangeStart, lte: rangeEnd }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    const debtAgg = await prisma.payment.groupBy({
      by: ['inquilinoId'],
      where: { tenantId, status: { in: ['PENDIENTE', 'PAGADO_PARCIAL', 'VENCIDO'] } },
      _sum: { amount: true, amountPaid: true, delayPenalty: true }
    });
    const debtByInquilino = new Map(
      debtAgg.map((d) => [d.inquilinoId, (d._sum.amount || 0) - (d._sum.amountPaid || 0) + (d._sum.delayPenalty || 0)])
    );

    const totalsByKey = new Map(months.map((m) => [m.key, { key: m.key, collected: 0, expected: 0 }]));

    const inquilinosDto = inquilinos.map((inq: any) => {
      const cells: Record<string, any> = {};

      for (const m of months) {
        const contrato = inq.contratos.find((c: any) => new Date(c.startDate) <= m.end && new Date(c.endDate) >= m.start);
        const payment = inq.payments.find((p: any) => {
          const d = new Date(p.dueDate);
          return d >= m.start && d <= m.end;
        });

        if (!contrato || !payment || payment.status === 'CANCELADO') {
          cells[m.key] = { status: 'SIN_CONTRATO' };
          continue;
        }

        const cellStatus = payment.status === 'PAGADO_PARCIAL' ? 'PARCIAL' : payment.status;
        cells[m.key] = {
          status: cellStatus,
          amount: payment.amount,
          amountPaid: payment.amountPaid,
          delayPenalty: payment.delayPenalty,
          paymentId: payment.id,
          dueDate: payment.dueDate.toISOString().split('T')[0]
        };

        const totals = totalsByKey.get(m.key)!;
        totals.expected += payment.amount + payment.delayPenalty;
        totals.collected += payment.amountPaid;
      }

      return {
        inquilinoId: inq.id,
        name: inq.name,
        status: inq.status,
        roomNumber: inq.room?.roomNumber,
        propertyName: inq.room?.property?.name,
        cells,
        totalDebt: debtByInquilino.get(inq.id) || 0
      };
    });

    res.json({
      months: months.map((m) => ({ key: m.key, label: formatScheduleMonthLabel(m.year, m.month), isCurrent: isCurrentMonthKey(m.key) })),
      inquilinos: inquilinosDto,
      totals: Array.from(totalsByKey.values())
    });
  } catch (error) {
    console.error('Error en getPaymentSchedule:', error);
    res.status(500).json({ error: 'Error al obtener el cronograma de pagos.' });
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

// --- CULQI INTEGRATION CONTROLLERS ---

function mapCulqiError(result: any): string {
  if (!result) return 'El pago no pudo ser procesado. Intente con otra tarjeta o consulte con su banco.';

  if (typeof result === 'string') {
    return formatErrorMessage(result);
  }

  const code = result.code || result.error?.code || result.outcome?.code;
  const declineCode = result.decline_code || result.error?.decline_code || result.outcome?.decline_code;
  const type = result.type || result.error?.type || result.outcome?.type;
  const userMessage = result.user_message || result.error?.user_message || result.outcome?.user_message || result.merchant_message || result.error?.merchant_message || '';

  console.log(`[Culqi Error Mapper] Mapping error. Code: ${code}, DeclineCode: ${declineCode}, Type: ${type}, Message: ${userMessage}`);

  if (code === 'DNGA9999' || type === 'venta_denegada') {
    return 'La transacción fue denegada por el banco. Por favor, intente con otra tarjeta o consulte con su banco.';
  }
  if (declineCode === 'insufficient_funds' || code === 'insufficient_funds') {
    return 'Saldo insuficiente. Intente con otra tarjeta o consulte con su banco.';
  }
  if (declineCode === 'expired_card' || code === 'expired_card') {
    return 'La tarjeta ha vencido o expirado. Intente con otra tarjeta.';
  }
  if (declineCode === 'incorrect_cvv' || code === 'incorrect_cvv') {
    return 'Código de seguridad (CVV) incorrecto. Verifique los datos e intente de nuevo.';
  }
  if (declineCode === 'contact_bank' || code === 'contact_bank') {
    return 'Transacción no autorizada. Por favor, comuníquese con su banco emisor.';
  }
  if (declineCode === 'lost_or_stolen_card' || code === 'lost_or_stolen_card') {
    return 'Tarjeta reportada como perdida o robada. Intente con otra tarjeta.';
  }
  if (declineCode === 'restricted_card' || code === 'restricted_card') {
    return 'Tarjeta bloqueada o restringida. Consulte con su banco emisor.';
  }

  return formatErrorMessage(userMessage);
}

function formatErrorMessage(message: string): string {
  if (!message) return 'El pago no pudo ser procesado. Intente con otra tarjeta o consulte con su banco.';
  
  const msg = message.toLowerCase();
  
  if (
    msg.includes('límite permitido por el comercio') || 
    msg.includes('limite permitido por el comercio') ||
    msg.includes('supera el límite') ||
    msg.includes('supera el limite')
  ) {
    return 'La transacción fue declinada por seguridad. Por favor, consulte con su banco emisor o intente con otra tarjeta.';
  }
  if (msg.includes('fondos insuficientes') || msg.includes('saldo insuficiente')) {
    return 'Saldo insuficiente. Intente con otra tarjeta o consulte con su banco.';
  }
  if (msg.includes('tarjeta vencida') || msg.includes('expirada')) {
    return 'La tarjeta ha vencido o expirado. Intente con otra tarjeta.';
  }
  if (msg.includes('código de seguridad incorrecto') || msg.includes('cvv')) {
    return 'Código de seguridad (CVV) incorrecto. Verifique los datos e intente de nuevo.';
  }
  if (msg.includes('tarjeta bloqueada') || msg.includes('restringida')) {
    return 'Tarjeta bloqueada o restringida. Consulte con su banco emisor.';
  }
  if (msg.includes('operación denegada') || msg.includes('operacion denegada') || msg.includes('denegada')) {
    return 'Operación denegada por el banco. Por favor, intente de nuevo con otra tarjeta o consulte con su banco.';
  }
  
  return message;
}

export const getCulqiConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const env = (process.env.CULQI_ENVIRONMENT || 'integration').toLowerCase().trim();
    const publicKey = env === 'integration'
      ? process.env.CULQI_INTEGRATION_PUBLIC_KEY
      : process.env.CULQI_PRODUCTION_PUBLIC_KEY;
    res.json({
      configured: !!publicKey,
      publicKey: publicKey || 'pk_test_z7EquLH8eSo1aZHu'
    });
  } catch (error) {
    console.error('Error en getCulqiConfig:', error);
    res.status(500).json({ error: 'Error al obtener la configuración de Culqi.' });
  }
};

export const processCulqiCharge = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const { id } = req.params;
  const { token_id } = req.body;

  if (!token_id) {
    res.status(400).json({ error: 'El token de pago es requerido.' });
    return;
  }

  try {
    const paymentId = parseInt(id as string);
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, tenantId },
      include: { inquilino: true }
    });

    if (!payment) {
      res.status(404).json({ error: 'Pago no encontrado o sin permisos.' });
      return;
    }

    if (payment.status === 'PAGADO') {
      res.status(400).json({ error: 'Este recibo ya ha sido cancelado.' });
      return;
    }

    // Calcular monto total a cobrar (monto base - monto pagado + mora)
    const amountToPay = (payment.amount - payment.amountPaid) + payment.delayPenalty;
    if (amountToPay <= 0) {
      res.status(400).json({ error: 'El monto a pagar debe ser mayor a cero.' });
      return;
    }

    // Obtener llave privada de Culqi
    const env = (process.env.CULQI_ENVIRONMENT || 'integration').toLowerCase().trim();
    const privateKey = env === 'integration'
      ? process.env.CULQI_INTEGRATION_PRIVATE_KEY
      : process.env.CULQI_PRODUCTION_PRIVATE_KEY;

    if (!privateKey) {
      res.status(500).json({ error: 'La llave privada de Culqi no está configurada.' });
      return;
    }

    // Formatear monto en centavos (entero)
    const amountInCents = Math.round(amountToPay * 100);

    const chargeData = {
      amount: String(amountInCents),
      currency_code: 'PEN',
      email: payment.inquilino.email,
      source_id: token_id,
      description: `Pago Roomly - Recibo #${payment.id} - ${payment.inquilino.name}`,
      capture: true,
      antifraud_details: {
        first_name: payment.inquilino.name.split(' ')[0] || 'Inquilino',
        last_name: payment.inquilino.name.split(' ').slice(1).join(' ') || 'Roomly',
        country_code: 'PE'
      },
      metadata: {
        paymentId: String(payment.id),
        tenantId: String(tenantId)
      }
    };

    console.log(`[Culqi API] Iniciando cobro de S/. ${amountToPay.toFixed(2)}:`, JSON.stringify(chargeData, null, 2));

    const culqiResponse = await fetch('https://api.culqi.com/v2/charges', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${privateKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(chargeData)
    });

    const culqiResult = (await culqiResponse.json()) as any;

    if (!culqiResponse.ok) {
      console.error('[Culqi API] Error de Culqi:', culqiResult);
      res.status(culqiResponse.status).json({
        success: false,
        error: mapCulqiError(culqiResult)
      });
      return;
    }

    const outcome = culqiResult.outcome || {};
    const isApproved = outcome.type === 'venta_exitosa' || outcome.code === 'AUT0000';

    if (!isApproved) {
      res.status(400).json({
        success: false,
        error: mapCulqiError(outcome)
      });
      return;
    }

    console.log('[Culqi API] Pago aprobado:', culqiResult.id);

    // Actualizar estado del pago en la base de datos
    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        amountPaid: payment.amountPaid + amountToPay,
        delayPenalty: 0.0, // Al pagar el total se regulariza la mora
        status: 'PAGADO',
        receiptStatus: 'APROBADO',
        lastPaymentDate: new Date(),
        receiptReference: `CULQI-${culqiResult.id}`
      }
    });

    // Notificar a los propietarios del pago online exitoso
    try {
      await notifyOwners(
        tenantId,
        'PAGO_APROBADO',
        'Pago online recibido',
        `El inquilino ${payment.inquilino.name} pagó S/. ${amountToPay.toFixed(2)} online mediante Culqi para el recibo #${payment.id}.`,
        '/pagos'
      );
    } catch (notifyErr) {
      console.error('[Culqi API] Error enviando notificación:', notifyErr);
    }

    res.json({
      success: true,
      message: 'Pago procesado con éxito.',
      payment: updatedPayment
    });

  } catch (error: any) {
    console.error('Error al procesar cargo Culqi:', error);
    res.status(500).json({ error: `Error interno al procesar el pago: ${error.message}` });
  }
};
