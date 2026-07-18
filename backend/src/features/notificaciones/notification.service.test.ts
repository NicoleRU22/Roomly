import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../../test-utils/prisma-mock';

import { notifyOwners, notifyInquilino } from './notification.service';

vi.mock('../../core/db/prisma', () => ({ default: prismaMock, prisma: prismaMock }));

describe('notifyOwners', () => {
  beforeEach(() => resetPrismaMock());

  it('notifica a todos los usuarios PROPIETARIO del tenant cuando el tipo no tiene preferencia configurable', async () => {
    prismaMock.usuario.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }] as any);
    prismaMock.notification.create.mockResolvedValue({} as any);

    await notifyOwners(1, 'PAGO_APROBADO', 'Título', 'Mensaje');

    expect(prismaMock.tenant.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(2);
  });

  it('respeta la preferencia del tenant y NO notifica si está desactivada', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({ id: 1, notifyComprobantePendiente: false } as any);

    await notifyOwners(1, 'COMPROBANTE_PENDIENTE', 'Título', 'Mensaje');

    expect(prismaMock.usuario.findMany).not.toHaveBeenCalled();
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it('notifica si la preferencia está activada (o no está explícitamente en false)', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({ id: 1, notifyComprobantePendiente: true } as any);
    prismaMock.usuario.findMany.mockResolvedValue([{ id: 1 }] as any);
    prismaMock.notification.create.mockResolvedValue({} as any);

    await notifyOwners(1, 'COMPROBANTE_PENDIENTE', 'Título', 'Mensaje');

    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1);
  });

  it('un tipo distinto al configurado en el mapa de preferencias no consulta al tenant', async () => {
    prismaMock.usuario.findMany.mockResolvedValue([] as any);

    await notifyOwners(1, 'RECORDATORIO_DEUDA', 'Título', 'Mensaje');

    expect(prismaMock.tenant.findUnique).not.toHaveBeenCalled();
  });
});

describe('notifyInquilino', () => {
  beforeEach(() => resetPrismaMock());

  it('no hace nada si el inquilino no existe en el tenant', async () => {
    prismaMock.inquilino.findFirst.mockResolvedValue(null);

    await notifyInquilino(1, 999, 'PAGO_GENERADO', 'Título', 'Mensaje');

    expect(prismaMock.usuario.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it('no hace nada si no hay un Usuario con el mismo correo del inquilino', async () => {
    prismaMock.inquilino.findFirst.mockResolvedValue({ id: 10, email: 'a@a.com' } as any);
    prismaMock.usuario.findFirst.mockResolvedValue(null);

    await notifyInquilino(1, 10, 'PAGO_GENERADO', 'Título', 'Mensaje');

    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it('crea la notificación para el usuario vinculado al inquilino por email', async () => {
    prismaMock.inquilino.findFirst.mockResolvedValue({ id: 10, email: 'a@a.com' } as any);
    prismaMock.usuario.findFirst.mockResolvedValue({ id: 55 } as any);
    prismaMock.notification.create.mockResolvedValue({} as any);

    await notifyInquilino(1, 10, 'PAGO_GENERADO', 'Título', 'Mensaje', '/pagos');

    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: { tenantId: 1, userId: 55, type: 'PAGO_GENERADO', title: 'Título', message: 'Mensaje', link: '/pagos' }
    });
  });
});
