import prisma from '../../core/db/prisma';

export type NotificationType =
  | 'PAGO_GENERADO'
  | 'PAGO_APROBADO'
  | 'PAGO_RECHAZADO'
  | 'COMPROBANTE_PENDIENTE'
  | 'CONTRATO_PENDIENTE'
  | 'CONTRATO_FIRMADO'
  | 'TICKET_CREADO'
  | 'TICKET_ACTUALIZADO'
  | 'RECORDATORIO_DEUDA';

interface CreateNotificationInput {
  tenantId: number;
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

export const createNotification = async (input: CreateNotificationInput) => {
  return prisma.notification.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link
    }
  });
};

// Mapea cada tipo de notificación dirigida al propietario con su preferencia configurable en Tenant.
// Los tipos que no están en este mapa (p. ej. los dirigidos al inquilino) nunca se filtran.
const OWNER_NOTIFICATION_PREFERENCE_FIELD: Partial<Record<NotificationType, 'notifyComprobantePendiente' | 'notifyContratoFirmado' | 'notifyTicketCreado'>> = {
  COMPROBANTE_PENDIENTE: 'notifyComprobantePendiente',
  CONTRATO_FIRMADO: 'notifyContratoFirmado',
  TICKET_CREADO: 'notifyTicketCreado'
};

// Notifica a todos los usuarios con rol PROPIETARIO dentro del tenant,
// respetando sus preferencias de notificación configuradas en Configuración del negocio.
export const notifyOwners = async (
  tenantId: number,
  type: NotificationType,
  title: string,
  message: string,
  link?: string
) => {
  const preferenceField = OWNER_NOTIFICATION_PREFERENCE_FIELD[type];
  if (preferenceField) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (tenant && tenant[preferenceField] === false) return;
  }

  const owners = await prisma.usuario.findMany({
    where: { tenantId, role: 'PROPIETARIO' }
  });

  await Promise.all(
    owners.map(owner =>
      createNotification({ tenantId, userId: owner.id, type, title, message, link })
    )
  );
};

// Notifica al usuario asociado a un inquilino (por email compartido entre Inquilino y Usuario).
export const notifyInquilino = async (
  tenantId: number,
  inquilinoId: number,
  type: NotificationType,
  title: string,
  message: string,
  link?: string
) => {
  const inquilino = await prisma.inquilino.findFirst({ where: { id: inquilinoId, tenantId } });
  if (!inquilino) return;

  const user = await prisma.usuario.findFirst({
    where: { email: { equals: inquilino.email, mode: 'insensitive' }, tenantId }
  });
  if (!user) return;

  await createNotification({ tenantId, userId: user.id, type, title, message, link });
};
