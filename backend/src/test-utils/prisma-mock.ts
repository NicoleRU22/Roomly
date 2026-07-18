import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';

/**
 * Mock profundo y type-safe de PrismaClient, para probar controladores/servicios
 * sin necesitar una base de datos real. Cada archivo de test debe:
 *
 *   vi.mock('../../core/db/prisma', () => ({ default: prismaMock, prisma: prismaMock }));
 *
 * y llamar a resetPrismaMock() en un beforeEach para aislar cada caso.
 */
export const prismaMock = mockDeep<PrismaClient>() as unknown as DeepMockProxy<PrismaClient>;

export function resetPrismaMock() {
  mockReset(prismaMock);
}
