import { Request } from 'express';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  // Los endpoints solo paginan si el cliente manda page o limit explícitamente,
  // así los consumidores que necesitan el dataset completo (dashboards, selects, agregados) no se rompen.
  isPaginated: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

export function getPaginationParams(req: Request, defaultLimit: number = DEFAULT_LIMIT): PaginationParams {
  const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

  const parsedPage = parseInt(String(req.query.page ?? '1'), 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const parsedLimit = parseInt(String(req.query.limit ?? String(defaultLimit)), 10);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, MAX_LIMIT)
    : defaultLimit;

  return { page, limit, skip: (page - 1) * limit, isPaginated };
}

export function buildPaginatedResponse<T>(data: T[], total: number, page: number, limit: number): PaginatedResponse<T> {
  return {
    data,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit))
  };
}
