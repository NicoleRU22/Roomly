import { vi } from 'vitest';
import type { Request, Response } from 'express';

/**
 * Construye un mock mínimo de Request para probar controladores sin levantar Express.
 * Los campos tenantId/userId/userRole son inyectados normalmente por los middlewares de auth/tenant.
 */
export function mockRequest(overrides: Partial<Request> & Record<string, any> = {}): Request {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    ...overrides
  } as unknown as Request;
}

/**
 * Construye un mock de Response encadenable (res.status().json()) con spies de vitest,
 * para poder aserir sobre el código de estado y el payload devuelto por el controlador.
 */
export function mockResponse(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  return res as Response;
}
