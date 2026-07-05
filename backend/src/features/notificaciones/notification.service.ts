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

// Notifica a todos los usuarios con rol PROPIETARIO dentro del tenant.
export const notifyOwners = async (
  tenantId: number,
  type: NotificationType,
  title: string,
  message: string,
  link?: string
) => {
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
