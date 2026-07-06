import prisma from '../../core/db/prisma';
import { notifyInquilino } from '../notificaciones/notification.service';

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

// Calcula la fecha de vencimiento del ciclo de facturación vigente para un contrato,
// usando el día de cobro configurado (o, si no se configuró, el día del mes en que inició el contrato).
const getCurrentBillingDate = (startDate: Date, today: Date, diaCobro?: number | null): Date => {
  const billingDay = diaCobro || startDate.getUTCDate();

  const clampToMonth = (year: number, month: number, day: number): Date => {
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(day, daysInMonth)));
  };

  const candidate = clampToMonth(today.getUTCFullYear(), today.getUTCMonth(), billingDay);

  // Si el día de cobro de este mes todavía no llega, el ciclo vigente es el del mes anterior.
  if (candidate.getTime() > today.getTime()) {
    const prevMonthDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
    return clampToMonth(prevMonthDate.getUTCFullYear(), prevMonthDate.getUTCMonth(), billingDay);
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

  const tenants = await prisma.tenant.findMany({
    where: { id: { in: [...new Set(contratos.map((c) => c.tenantId))] } },
    select: { id: true, defaultBillingDay: true }
  });
  const defaultBillingDayByTenant = new Map(tenants.map((t) => [t.id, t.defaultBillingDay]));

  let created = 0;

  for (const contrato of contratos) {
    const startDate = new Date(contrato.startDate);
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(contrato.endDate);
    endDate.setUTCHours(0, 0, 0, 0);

    if (startDate.getTime() > today.getTime()) continue; // el contrato aún no empieza
    if (endDate.getTime() < today.getTime()) continue; // el contrato ya venció

    const diaCobro = contrato.diaCobro ?? defaultBillingDayByTenant.get(contrato.tenantId) ?? null;
    const billingDate = getCurrentBillingDate(startDate, today, diaCobro);
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
