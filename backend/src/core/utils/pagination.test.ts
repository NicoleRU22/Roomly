import { describe, it, expect } from 'vitest';
import type { Request } from 'express';
import { getPaginationParams, buildPaginatedResponse } from './pagination';

const reqWith = (query: Record<string, any>): Request => ({ query } as unknown as Request);

describe('getPaginationParams', () => {
  it('no está paginado si el cliente no envía page ni limit', () => {
    const result = getPaginationParams(reqWith({}));
    expect(result).toEqual({ page: 1, limit: 10, skip: 0, isPaginated: false });
  });

  it('se marca como paginado si el cliente envía page', () => {
    const result = getPaginationParams(reqWith({ page: '2' }));
    expect(result.isPaginated).toBe(true);
    expect(result.page).toBe(2);
    expect(result.skip).toBe(10);
  });

  it('se marca como paginado si el cliente envía solo limit', () => {
    const result = getPaginationParams(reqWith({ limit: '5' }));
    expect(result.isPaginated).toBe(true);
    expect(result.limit).toBe(5);
  });

  it('cae al default si page/limit no son numéricos', () => {
    const result = getPaginationParams(reqWith({ page: 'abc', limit: 'xyz' }));
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
  });

  it('cae al default si page/limit son negativos o cero', () => {
    const result = getPaginationParams(reqWith({ page: '-1', limit: '0' }));
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
  });

  it('limita el límite máximo a 100 aunque el cliente pida más', () => {
    const result = getPaginationParams(reqWith({ limit: '500' }));
    expect(result.limit).toBe(100);
  });

  it('calcula skip correctamente para páginas mayores a 1', () => {
    const result = getPaginationParams(reqWith({ page: '4', limit: '20' }));
    expect(result.skip).toBe(60);
  });

  it('respeta un defaultLimit distinto cuando se pasa explícitamente', () => {
    const result = getPaginationParams(reqWith({}), 25);
    expect(result.limit).toBe(25);
  });
});

describe('buildPaginatedResponse', () => {
  it('calcula totalPages redondeando hacia arriba', () => {
    const result = buildPaginatedResponse(['a', 'b'], 25, 1, 10);
    expect(result.totalPages).toBe(3);
  });

  it('nunca reporta menos de 1 página, incluso con total 0', () => {
    const result = buildPaginatedResponse([], 0, 1, 10);
    expect(result.totalPages).toBe(1);
  });

  it('conserva data, total y page en la respuesta', () => {
    const result = buildPaginatedResponse([{ id: 1 }], 1, 3, 10);
    expect(result).toEqual({ data: [{ id: 1 }], total: 1, page: 3, totalPages: 1 });
  });
});
