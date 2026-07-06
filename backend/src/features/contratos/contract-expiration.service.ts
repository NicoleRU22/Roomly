import prisma from '../../core/db/prisma';
import { notifyOwners, notifyInquilino } from '../notificaciones/notification.service';

/**
 * Revisa los contratos VIGENTE de todos los tenants y:
 * - Marca como FINALIZADO los que ya pasaron su endDate.
 * - Notifica al propietario cuando un contrato está por vencer, según el
 *   número de días configurado en Tenant.contractExpirationWarningDays (una sola vez por contrato).
 */
export const checkContractExpirations = async (): Promise<{ finalizados: number; avisos: number }> => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const contratos = await prisma.contrato.findMany({
    where: { status: 'VIGENTE' },
    include: { inquilino: true, room: true }
  });

  const tenants = await prisma.tenant.findMany({
    where: { id: { in: [...new Set(contratos.map((c) => c.tenantId))] } },
    select: { id: true, contractExpirationWarningDays: true }
  });
  const warningDaysByTenant = new Map(tenants.map((t) => [t.id, t.contractExpirationWarningDays]));

  let finalizados = 0;
  let avisos = 0;

  for (const contrato of contratos) {
    const endDate = new Date(contrato.endDate);
    endDate.setUTCHours(0, 0, 0, 0);

    if (endDate.getTime() < today.getTime()) {
      await prisma.contrato.update({ where: { id: contrato.id }, data: { status: 'FINALIZADO' } });
      finalizados++;

      const roomLabel = contrato.room?.roomNumber ? ` (Habitación ${contrato.room.roomNumber})` : '';
      await notifyOwners(
        contrato.tenantId,
        'CONTRATO_FINALIZADO',
        'Contrato finalizado',
        `El contrato de ${contrato.inquilino.name}${roomLabel} venció el ${endDate.toLocaleDateString('es-PE', { timeZone: 'UTC' })} y fue marcado como finalizado.`,
        '/contratos'
      );
      await notifyInquilino(
        contrato.tenantId,
        contrato.inquilinoId,
        'CONTRATO_FINALIZADO',
        'Tu contrato ha finalizado',
        `Tu contrato de alquiler venció el ${endDate.toLocaleDateString('es-PE', { timeZone: 'UTC' })}.`,
        '/contratos'
      );
      continue;
    }

    if (contrato.expirationWarningSent) continue;

    const warningDays = warningDaysByTenant.get(contrato.tenantId) ?? 30;
    const diffDays = Math.round((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= warningDays) {
      const roomLabel = contrato.room?.roomNumber ? ` (Habitación ${contrato.room.roomNumber})` : '';
      await notifyOwners(
        contrato.tenantId,
        'CONTRATO_POR_VENCER',
        'Contrato por vencer',
        `El contrato de ${contrato.inquilino.name}${roomLabel} vence el ${endDate.toLocaleDateString('es-PE', { timeZone: 'UTC' })} (en ${diffDays} día${diffDays === 1 ? '' : 's'}).`,
        '/contratos'
      );
      await prisma.contrato.update({ where: { id: contrato.id }, data: { expirationWarningSent: true } });
      avisos++;
    }
  }

  return { finalizados, avisos };
};
