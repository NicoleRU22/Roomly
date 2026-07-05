import prisma from '../../core/db/prisma';
import { notifyInquilino } from '../notificaciones/notification.service';

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

// Calcula la fecha de vencimiento del ciclo de facturación vigente para un contrato,
// usando el día del mes en que inició el contrato como "día de aniversario".
const getCurrentBillingDate = (startDate: Date, today: Date): Date => {
  const billingDay = startDate.getUTCDate();
  const candidate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), billingDay));

  // Si el día de aniversario de este mes todavía no llega, el ciclo vigente es el del mes anterior.
  if (candidate.getTime() > today.getTime()) {
    candidate.setUTCMonth(candidate.getUTCMonth() - 1);
  }
  return candidate;
};

/**
 * Genera automáticamente los recibos de alquiler mensuales para los contratos vigentes
 * que ya alcanzaron su fecha de aniversario de facturación y todavía no tienen un recibo
 * generado para ese ciclo. Si se pasa tenantId, se limita a ese tenant (uso manual);
 * si no, se ejecuta sobre todos los tenants (uso del cron).
 */
export const generateRecurringInvoices = async (tenantId?: number): Promise<{ created: number }> => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const contratos = await prisma.contrato.findMany({
    where: {
      status: 'VIGENTE',
      ...(tenantId !== undefined ? { tenantId } : {})
    },
    include: { inquilino: true, room: true }
  });

  let created = 0;

  for (const contrato of contratos) {
    const startDate = new Date(contrato.startDate);
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(contrato.endDate);
    endDate.setUTCHours(0, 0, 0, 0);

    if (startDate.getTime() > today.getTime()) continue; // el contrato aún no empieza
    if (endDate.getTime() < today.getTime()) continue; // el contrato ya venció

    const billingDate = getCurrentBillingDate(startDate, today);
    if (billingDate.getTime() < startDate.getTime()) continue; // el primer aniversario aún no llega

    const existing = await prisma.payment.findFirst({
      where: {
        inquilinoId: contrato.inquilinoId,
        roomId: contrato.roomId,
        paymentType: 'ALQUILER',
        dueDate: billingDate
      }
    });
    if (existing) continue;

    const payment = await prisma.payment.create({
      data: {
        inquilinoId: contrato.inquilinoId,
        roomId: contrato.roomId,
        amount: contrato.amount,
        amountPaid: 0.0,
        delayPenalty: 0.0,
        dueDate: billingDate,
        status: 'PENDIENTE',
        paymentType: 'ALQUILER',
        description: `Alquiler correspondiente a ${MONTH_NAMES[billingDate.getUTCMonth()]} ${billingDate.getUTCFullYear()} (generado automáticamente)`,
        tenantId: contrato.tenantId
      }
    });
    created++;

    await notifyInquilino(
      contrato.tenantId,
      contrato.inquilinoId,
      'PAGO_GENERADO',
      'Nuevo recibo emitido',
      `Se generó automáticamente tu recibo de alquiler por S/. ${payment.amount.toFixed(2)}, con vencimiento el ${billingDate.toLocaleDateString('es-PE', { timeZone: 'UTC' })}.`,
      '/pagos'
    );
  }

  return { created };
};
