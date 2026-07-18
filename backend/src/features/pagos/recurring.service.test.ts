import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock, resetPrismaMock } from '../../test-utils/prisma-mock';

vi.mock('../../core/db/prisma', () => ({ default: prismaMock, prisma: prismaMock }));
vi.mock('../notificaciones/notification.service', () => ({ notifyInquilino: vi.fn() }));

import { getCurrentBillingDate, generateRecurringInvoices } from './recurring.service';
import { notifyInquilino } from '../notificaciones/notification.service';

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

describe('getCurrentBillingDate', () => {
  it('usa el día de cobro del mes actual cuando ya llegó', () => {
    const result = getCurrentBillingDate(utc(2025, 0, 5), utc(2025, 5, 20), 15);
    expect(result).toEqual(utc(2025, 5, 15));
  });

  it('retrocede al mes anterior cuando el día de cobro de este mes todavía no llega', () => {
    const result = getCurrentBillingDate(utc(2025, 0, 5), utc(2025, 5, 10), 15);
    expect(result).toEqual(utc(2025, 4, 15));
  });

  it('usa el día de inicio del contrato como día de cobro si no se configuró uno', () => {
    const result = getCurrentBillingDate(utc(2025, 0, 20), utc(2025, 5, 25));
    expect(result).toEqual(utc(2025, 5, 20));
  });

  it('recorta el día de cobro al último día del mes cuando el mes actual es más corto (p. ej. día 31 en abril, que tiene 30 días)', () => {
    const result = getCurrentBillingDate(utc(2025, 0, 31), utc(2025, 3, 30), 31);
    expect(result).toEqual(utc(2025, 3, 30));
  });

  it('si el día de cobro (31) todavía no "llegó" en un mes corto, retrocede al mes anterior también recortado', () => {
    // Hoy es 20 de febrero: el día 31 nunca ocurre en febrero, así que el ciclo vigente
    // es el de enero (recortado solo si enero también fuera corto; aquí no lo es).
    const result = getCurrentBillingDate(utc(2025, 0, 31), utc(2025, 1, 20), 31);
    expect(result).toEqual(utc(2025, 0, 31));
  });

  it('coincide exactamente con el día de hoy cuando hoy es el día de cobro', () => {
    const result = getCurrentBillingDate(utc(2025, 0, 5), utc(2025, 5, 15), 15);
    expect(result).toEqual(utc(2025, 5, 15));
  });

  it('retrocede correctamente en enero (cruce de año)', () => {
    const result = getCurrentBillingDate(utc(2024, 0, 20), utc(2025, 0, 10), 20);
    expect(result).toEqual(utc(2024, 11, 20));
  });
});

describe('generateRecurringInvoices', () => {
  beforeEach(() => {
    resetPrismaMock();
    vi.mocked(notifyInquilino).mockReset();
  });

  // Fechas relativas a "hoy" para que el contrato esté siempre vigente sin importar
  // cuándo se ejecute el test (generateRecurringInvoices usa new Date() internamente).
  const now = new Date();
  const oneYearAgo = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1));
  const oneYearAhead = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), 28));

  const baseContrato = {
    id: 1,
    tenantId: 1,
    inquilinoId: 10,
    roomId: 20,
    amount: 500,
    diaCobro: null as number | null,
    startDate: oneYearAgo,
    endDate: oneYearAhead,
    status: 'VIGENTE',
    inquilino: { name: 'Juan Pérez' },
    room: { roomNumber: '101' }
  };

  it('crea un recibo cuando el ciclo vigente aún no tiene pago generado', async () => {
    prismaMock.contrato.findMany.mockResolvedValue([baseContrato] as any);
    prismaMock.tenant.findMany.mockResolvedValue([{ id: 1, defaultBillingDay: 1 }] as any);
    prismaMock.payment.findFirst.mockResolvedValue(null);
    prismaMock.payment.create.mockResolvedValue({ id: 99, amount: 500 } as any);

    const result = await generateRecurringInvoices(1);

    expect(result.created).toBe(1);
    expect(prismaMock.payment.create).toHaveBeenCalledTimes(1);
    expect(notifyInquilino).toHaveBeenCalledTimes(1);
  });

  it('no duplica el recibo si ya existe uno para el ciclo vigente', async () => {
    prismaMock.contrato.findMany.mockResolvedValue([baseContrato] as any);
    prismaMock.tenant.findMany.mockResolvedValue([{ id: 1, defaultBillingDay: 1 }] as any);
    prismaMock.payment.findFirst.mockResolvedValue({ id: 5 } as any);

    const result = await generateRecurringInvoices(1);

    expect(result.created).toBe(0);
    expect(prismaMock.payment.create).not.toHaveBeenCalled();
  });

  it('omite contratos que todavía no comenzaron', async () => {
    const futuro = { ...baseContrato, startDate: utc(2099, 0, 1), endDate: utc(2099, 11, 31) };
    prismaMock.contrato.findMany.mockResolvedValue([futuro] as any);
    prismaMock.tenant.findMany.mockResolvedValue([{ id: 1, defaultBillingDay: 1 }] as any);

    const result = await generateRecurringInvoices(1);

    expect(result.created).toBe(0);
    expect(prismaMock.payment.findFirst).not.toHaveBeenCalled();
  });

  it('omite contratos ya vencidos', async () => {
    const vencido = { ...baseContrato, startDate: utc(2020, 0, 1), endDate: utc(2020, 11, 31) };
    prismaMock.contrato.findMany.mockResolvedValue([vencido] as any);
    prismaMock.tenant.findMany.mockResolvedValue([{ id: 1, defaultBillingDay: 1 }] as any);

    const result = await generateRecurringInvoices(1);

    expect(result.created).toBe(0);
    expect(prismaMock.payment.findFirst).not.toHaveBeenCalled();
  });
});
