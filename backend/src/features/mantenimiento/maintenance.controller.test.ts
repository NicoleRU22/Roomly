import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock, resetPrismaMock } from '../../test-utils/prisma-mock';
import { mockRequest, mockResponse } from '../../test-utils/express-mocks';

vi.mock('../../core/db/prisma', () => ({ default: prismaMock, prisma: prismaMock }));
vi.mock('../notificaciones/notification.service', () => ({ notifyOwners: vi.fn(), notifyInquilino: vi.fn() }));
vi.mock('../../core/utils/upload', () => ({ saveBase64Image: vi.fn() }));

import { computeDueDate, createTicket, updateTicketStatus } from './maintenance.controller';
import { notifyOwners, notifyInquilino } from '../notificaciones/notification.service';

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

describe('computeDueDate', () => {
  it('da 1 día de plazo para prioridad ALTA', () => {
    expect(computeDueDate('ALTA', utc(2026, 0, 1))).toEqual(utc(2026, 0, 2));
  });

  it('da 3 días de plazo para prioridad MEDIA', () => {
    expect(computeDueDate('MEDIA', utc(2026, 0, 1))).toEqual(utc(2026, 0, 4));
  });

  it('da 7 días de plazo para prioridad BAJA', () => {
    expect(computeDueDate('BAJA', utc(2026, 0, 1))).toEqual(utc(2026, 0, 8));
  });

  it('usa el plazo de MEDIA como fallback ante una prioridad desconocida', () => {
    expect(computeDueDate('URGENTISIMA', utc(2026, 0, 1))).toEqual(utc(2026, 0, 4));
  });
});

describe('createTicket', () => {
  beforeEach(() => {
    resetPrismaMock();
    vi.mocked(notifyOwners).mockReset();
  });

  it('rechaza si faltan campos obligatorios', async () => {
    const req = mockRequest({ tenantId: 1, userId: 1, body: { title: 'Fuga' } });
    const res = mockResponse();

    await createTicket(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prismaMock.maintenanceTicket.create).not.toHaveBeenCalled();
  });

  it('responde 404 si el usuario autenticado no tiene un Inquilino asociado', async () => {
    const req = mockRequest({
      tenantId: 1, userId: 1,
      body: { title: 'Fuga', description: 'Fuga en el baño', propertyId: '1' }
    });
    const res = mockResponse();
    prismaMock.usuario.findUnique.mockResolvedValue({ id: 1, email: 'a@a.com' } as any);
    prismaMock.inquilino.findFirst.mockResolvedValue(null);

    await createTicket(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('crea el ticket con prioridad MEDIA por default y calcula el SLA', async () => {
    const req = mockRequest({
      tenantId: 1, userId: 1,
      body: { title: 'Fuga', description: 'Fuga en el baño', propertyId: '1' }
    });
    const res = mockResponse();
    prismaMock.usuario.findUnique.mockResolvedValue({ id: 1, email: 'a@a.com' } as any);
    prismaMock.inquilino.findFirst.mockResolvedValue({ id: 10, roomId: 5 } as any);
    prismaMock.maintenanceTicket.create.mockResolvedValue({ id: 1 } as any);

    await createTicket(req, res);

    expect(prismaMock.maintenanceTicket.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ priority: 'MEDIA', roomId: 5, status: 'PENDIENTE' }) })
    );
    expect(notifyOwners).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('updateTicketStatus', () => {
  beforeEach(() => {
    resetPrismaMock();
    vi.mocked(notifyInquilino).mockReset();
  });

  it('rechaza la actualización si el usuario es INQUILINO', async () => {
    const req = mockRequest({ tenantId: 1, userRole: 'INQUILINO', params: { id: '1' }, body: {} });
    const res = mockResponse();

    await updateTicketStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prismaMock.maintenanceTicket.update).not.toHaveBeenCalled();
  });

  it('responde 404 si el ticket no existe en el tenant', async () => {
    const req = mockRequest({ tenantId: 1, userRole: 'PROPIETARIO', params: { id: '1' }, body: { status: 'RESUELTO' } });
    const res = mockResponse();
    prismaMock.maintenanceTicket.findFirst.mockResolvedValue(null);

    await updateTicketStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('recalcula el dueDate (SLA) cuando cambia la prioridad', async () => {
    const req = mockRequest({
      tenantId: 1, userRole: 'PROPIETARIO', params: { id: '1' },
      body: { priority: 'ALTA' }
    });
    const res = mockResponse();
    const createdAt = utc(2026, 0, 1);
    prismaMock.maintenanceTicket.findFirst.mockResolvedValue({
      id: 1, tenantId: 1, priority: 'BAJA', status: 'PENDIENTE', createdAt, inquilinoId: 10, title: 'Fuga'
    } as any);
    prismaMock.maintenanceTicket.update.mockResolvedValue({ id: 1 } as any);

    await updateTicketStatus(req, res);

    expect(prismaMock.maintenanceTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ priority: 'ALTA', dueDate: utc(2026, 0, 2) }) })
    );
  });

  it('conserva el dueDate original si la prioridad no cambia', async () => {
    const req = mockRequest({ tenantId: 1, userRole: 'PROPIETARIO', params: { id: '1' }, body: { status: 'EN_PROGRESO' } });
    const res = mockResponse();
    const originalDue = utc(2026, 0, 8);
    prismaMock.maintenanceTicket.findFirst.mockResolvedValue({
      id: 1, tenantId: 1, priority: 'BAJA', status: 'PENDIENTE', createdAt: utc(2026, 0, 1), dueDate: originalDue, inquilinoId: 10, title: 'Fuga'
    } as any);
    prismaMock.maintenanceTicket.update.mockResolvedValue({ id: 1 } as any);

    await updateTicketStatus(req, res);

    expect(prismaMock.maintenanceTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ dueDate: originalDue }) })
    );
    expect(notifyInquilino).toHaveBeenCalledTimes(1);
  });

  it('responde 400 si el proveedorId enviado no existe en el tenant', async () => {
    const req = mockRequest({ tenantId: 1, userRole: 'PROPIETARIO', params: { id: '1' }, body: { proveedorId: '99' } });
    const res = mockResponse();
    prismaMock.maintenanceTicket.findFirst.mockResolvedValue({ id: 1, tenantId: 1, priority: 'MEDIA', createdAt: new Date() } as any);
    prismaMock.proveedor.findFirst.mockResolvedValue(null);

    await updateTicketStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prismaMock.maintenanceTicket.update).not.toHaveBeenCalled();
  });
});
