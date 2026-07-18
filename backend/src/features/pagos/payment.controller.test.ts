import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock, resetPrismaMock } from '../../test-utils/prisma-mock';
import { mockRequest, mockResponse } from '../../test-utils/express-mocks';

vi.mock('../../core/db/prisma', () => ({ default: prismaMock, prisma: prismaMock }));
vi.mock('../notificaciones/notification.service', () => ({ notifyOwners: vi.fn(), notifyInquilino: vi.fn() }));
vi.mock('../../core/utils/upload', () => ({ saveBase64Image: vi.fn() }));

import { calculateDelay, mapCulqiError, createPayment, recordPayment, approvePayment } from './payment.controller';
import { notifyInquilino } from '../notificaciones/notification.service';

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
const daysAhead = (n: number) => daysAgo(-n);

describe('calculateDelay', () => {
  it('no aplica mora si el pago aún no vence', () => {
    expect(calculateDelay(daysAhead(3), 5, 5)).toBe(0);
  });

  it('no aplica mora dentro de los días de gracia', () => {
    expect(calculateDelay(daysAgo(3), 5, 5)).toBe(0);
  });

  it('aplica mora justo al cumplirse los días de gracia', () => {
    expect(calculateDelay(daysAgo(5), 5, 5)).toBe(25); // 5 días * 5.0
  });

  it('acumula la mora por cada día de retraso una vez superada la gracia', () => {
    expect(calculateDelay(daysAgo(10), 5, 5)).toBe(50); // 10 días * 5.0
  });

  it('respeta una tarifa de mora distinta a la default', () => {
    expect(calculateDelay(daysAgo(6), 5, 2.5)).toBe(15); // 6 * 2.5
  });
});

describe('mapCulqiError', () => {
  it('devuelve un mensaje genérico cuando no hay resultado', () => {
    expect(mapCulqiError(null)).toMatch(/no pudo ser procesado/i);
  });

  it('mapea el código de fondos insuficientes', () => {
    expect(mapCulqiError({ code: 'insufficient_funds' })).toMatch(/saldo insuficiente/i);
  });

  it('mapea tarjeta vencida', () => {
    expect(mapCulqiError({ decline_code: 'expired_card' })).toMatch(/vencido o expirado/i);
  });

  it('cae al mensaje del comercio cuando no hay código reconocido', () => {
    expect(mapCulqiError({ user_message: 'Motivo desconocido del banco' })).toBe('Motivo desconocido del banco');
  });
});

describe('createPayment', () => {
  beforeEach(() => {
    resetPrismaMock();
    vi.mocked(notifyInquilino).mockReset();
  });

  it('rechaza la creación si el usuario es INQUILINO', async () => {
    const req = mockRequest({ tenantId: 1, userRole: 'INQUILINO', body: {} });
    const res = mockResponse();

    await createPayment(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prismaMock.payment.create).not.toHaveBeenCalled();
  });

  it('valida que inquilino, monto y fecha sean requeridos', async () => {
    const req = mockRequest({ tenantId: 1, userRole: 'PROPIETARIO', body: { amount: 100 } });
    const res = mockResponse();

    await createPayment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('crea el pago con estado PENDIENTE cuando el vencimiento es futuro', async () => {
    const req = mockRequest({
      tenantId: 1,
      userRole: 'PROPIETARIO',
      body: { inquilinoId: '10', amount: '500', dueDate: daysAhead(10).toISOString(), paymentType: 'ALQUILER' }
    });
    const res = mockResponse();

    prismaMock.inquilino.findFirst.mockResolvedValue({ id: 10, tenantId: 1 } as any);
    prismaMock.tenant.findUnique.mockResolvedValue({ graceDays: 5, lateFeePerDay: 5 } as any);
    prismaMock.payment.create.mockResolvedValue({ id: 1, amount: 500, paymentType: 'ALQUILER' } as any);

    await createPayment(req, res);

    expect(prismaMock.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PENDIENTE', delayPenalty: 0 }) })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('crea el pago como VENCIDO con mora si el vencimiento ya pasó la gracia', async () => {
    const req = mockRequest({
      tenantId: 1,
      userRole: 'PROPIETARIO',
      body: { inquilinoId: '10', amount: '500', dueDate: daysAgo(10).toISOString(), paymentType: 'ALQUILER' }
    });
    const res = mockResponse();

    prismaMock.inquilino.findFirst.mockResolvedValue({ id: 10, tenantId: 1 } as any);
    prismaMock.tenant.findUnique.mockResolvedValue({ graceDays: 5, lateFeePerDay: 5 } as any);
    prismaMock.payment.create.mockResolvedValue({ id: 1, amount: 500, paymentType: 'ALQUILER' } as any);

    await createPayment(req, res);

    expect(prismaMock.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'VENCIDO', delayPenalty: 50 }) })
    );
  });

  it('responde 404 si el inquilino no existe en el tenant', async () => {
    const req = mockRequest({
      tenantId: 1,
      userRole: 'PROPIETARIO',
      body: { inquilinoId: '999', amount: '500', dueDate: daysAhead(5).toISOString() }
    });
    const res = mockResponse();
    prismaMock.inquilino.findFirst.mockResolvedValue(null);

    await createPayment(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prismaMock.payment.create).not.toHaveBeenCalled();
  });
});

describe('recordPayment', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('responde 404 si el pago no existe o no pertenece al tenant', async () => {
    const req = mockRequest({ tenantId: 1, userRole: 'PROPIETARIO', params: { id: '1' }, body: { amountToAdd: '100' } });
    const res = mockResponse();
    prismaMock.payment.findFirst.mockResolvedValue(null);

    await recordPayment(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rechaza un monto a registrar menor o igual a cero', async () => {
    const req = mockRequest({ tenantId: 1, userRole: 'PROPIETARIO', params: { id: '1' }, body: { amountToAdd: '0' } });
    const res = mockResponse();
    prismaMock.payment.findFirst.mockResolvedValue({ id: 1, tenantId: 1, amount: 500, amountPaid: 0, delayPenalty: 0, status: 'PENDIENTE' } as any);

    await recordPayment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prismaMock.payment.update).not.toHaveBeenCalled();
  });

  it('marca PAGADO_PARCIAL cuando el abono no cubre el total', async () => {
    const req = mockRequest({ tenantId: 1, userRole: 'PROPIETARIO', params: { id: '1' }, body: { amountToAdd: '200' } });
    const res = mockResponse();
    prismaMock.payment.findFirst.mockResolvedValue({ id: 1, tenantId: 1, amount: 500, amountPaid: 0, delayPenalty: 0, status: 'PENDIENTE' } as any);
    prismaMock.payment.update.mockResolvedValue({ id: 1, status: 'PAGADO_PARCIAL' } as any);

    await recordPayment(req, res);

    expect(prismaMock.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amountPaid: 200, status: 'PAGADO_PARCIAL' }) })
    );
  });

  it('marca PAGADO y anula la mora cuando el abono cubre el saldo total', async () => {
    const req = mockRequest({ tenantId: 1, userRole: 'PROPIETARIO', params: { id: '1' }, body: { amountToAdd: '520' } });
    const res = mockResponse();
    prismaMock.payment.findFirst.mockResolvedValue({ id: 1, tenantId: 1, amount: 500, amountPaid: 0, delayPenalty: 20, status: 'VENCIDO' } as any);
    prismaMock.payment.update.mockResolvedValue({ id: 1, status: 'PAGADO' } as any);

    await recordPayment(req, res);

    expect(prismaMock.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PAGADO', delayPenalty: 0, amountPaid: 520 }) })
    );
  });
});

describe('approvePayment', () => {
  beforeEach(() => {
    resetPrismaMock();
    vi.mocked(notifyInquilino).mockReset();
  });

  it('rechaza la aprobación si el usuario es INQUILINO', async () => {
    const req = mockRequest({ tenantId: 1, userRole: 'INQUILINO', params: { id: '1' } });
    const res = mockResponse();

    await approvePayment(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prismaMock.payment.update).not.toHaveBeenCalled();
  });

  it('aprueba el pago cubriendo monto + mora y notifica al inquilino', async () => {
    const req = mockRequest({ tenantId: 1, userRole: 'PROPIETARIO', params: { id: '1' } });
    const res = mockResponse();
    prismaMock.payment.findFirst.mockResolvedValue({ id: 1, tenantId: 1, amount: 500, delayPenalty: 25, inquilinoId: 10 } as any);
    prismaMock.payment.update.mockResolvedValue({ id: 1, status: 'PAGADO' } as any);

    await approvePayment(req, res);

    expect(prismaMock.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amountPaid: 525, status: 'PAGADO' }) })
    );
    expect(notifyInquilino).toHaveBeenCalledTimes(1);
  });
});
