import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock, resetPrismaMock } from '../../test-utils/prisma-mock';

vi.mock('../../core/db/prisma', () => ({ default: prismaMock, prisma: prismaMock }));
vi.mock('../notificaciones/notification.service', () => ({ notifyOwners: vi.fn(), notifyInquilino: vi.fn() }));

import { checkContractExpirations } from './contract-expiration.service';
import { notifyOwners, notifyInquilino } from '../notificaciones/notification.service';

const daysAgo = (n: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};
const daysAhead = (n: number) => daysAgo(-n);

describe('checkContractExpirations', () => {
  beforeEach(() => {
    resetPrismaMock();
    vi.mocked(notifyOwners).mockReset();
    vi.mocked(notifyInquilino).mockReset();
  });

  const baseContrato = {
    id: 1,
    tenantId: 1,
    inquilinoId: 10,
    expirationWarningSent: false,
    inquilino: { name: 'Ana López' },
    room: { roomNumber: '203' }
  };

  it('marca como FINALIZADO un contrato cuya fecha de fin ya pasó y notifica a ambas partes', async () => {
    const vencido = { ...baseContrato, endDate: daysAgo(3) };
    prismaMock.contrato.findMany.mockResolvedValue([vencido] as any);
    prismaMock.tenant.findMany.mockResolvedValue([{ id: 1, contractExpirationWarningDays: 30 }] as any);

    const result = await checkContractExpirations();

    expect(result.finalizados).toBe(1);
    expect(result.avisos).toBe(0);
    expect(prismaMock.contrato.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { status: 'FINALIZADO' } });
    expect(notifyOwners).toHaveBeenCalledTimes(1);
    expect(notifyInquilino).toHaveBeenCalledTimes(1);
  });

  it('envía aviso de vencimiento próximo una sola vez cuando entra en la ventana configurada', async () => {
    const porVencer = { ...baseContrato, endDate: daysAhead(10) };
    prismaMock.contrato.findMany.mockResolvedValue([porVencer] as any);
    prismaMock.tenant.findMany.mockResolvedValue([{ id: 1, contractExpirationWarningDays: 30 }] as any);

    const result = await checkContractExpirations();

    expect(result.avisos).toBe(1);
    expect(result.finalizados).toBe(0);
    expect(notifyOwners).toHaveBeenCalledTimes(1);
    expect(notifyInquilino).not.toHaveBeenCalled();
    expect(prismaMock.contrato.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { expirationWarningSent: true } });
  });

  it('no reenvía el aviso si expirationWarningSent ya está en true', async () => {
    const yaAvisado = { ...baseContrato, endDate: daysAhead(10), expirationWarningSent: true };
    prismaMock.contrato.findMany.mockResolvedValue([yaAvisado] as any);
    prismaMock.tenant.findMany.mockResolvedValue([{ id: 1, contractExpirationWarningDays: 30 }] as any);

    const result = await checkContractExpirations();

    expect(result.avisos).toBe(0);
    expect(notifyOwners).not.toHaveBeenCalled();
  });

  it('no avisa si el contrato vence fuera de la ventana de aviso configurada', async () => {
    const lejano = { ...baseContrato, endDate: daysAhead(90) };
    prismaMock.contrato.findMany.mockResolvedValue([lejano] as any);
    prismaMock.tenant.findMany.mockResolvedValue([{ id: 1, contractExpirationWarningDays: 30 }] as any);

    const result = await checkContractExpirations();

    expect(result.avisos).toBe(0);
    expect(result.finalizados).toBe(0);
    expect(notifyOwners).not.toHaveBeenCalled();
  });

  it('usa 30 días de ventana por default si el tenant no la configuró', async () => {
    const porVencer = { ...baseContrato, endDate: daysAhead(29) };
    prismaMock.contrato.findMany.mockResolvedValue([porVencer] as any);
    prismaMock.tenant.findMany.mockResolvedValue([{ id: 1, contractExpirationWarningDays: null }] as any);

    const result = await checkContractExpirations();

    expect(result.avisos).toBe(1);
  });
});
