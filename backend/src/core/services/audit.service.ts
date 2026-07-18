import { Request } from 'express';
import prisma from '../db/prisma';

export type AuditCategory = 'ADMIN' | 'AUTH' | 'SYSTEM';

interface LogEventParams {
  category: AuditCategory;
  action: string;
  actorId?: number | null;
  actorEmail?: string | null;
  targetType?: string;
  targetId?: string | number;
  metadata?: Record<string, unknown>;
  req?: Request;
}

// Registra un evento de auditoría/sistema. Nunca lanza: un fallo al auditar no debe romper la acción real.
export async function logEvent(params: LogEventParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        category: params.category,
        action: params.action,
        actorId: params.actorId ?? null,
        actorEmail: params.actorEmail ?? null,
        targetType: params.targetType,
        targetId: params.targetId !== undefined ? String(params.targetId) : undefined,
        metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
        ip: params.req?.ip,
        userAgent: params.req?.headers['user-agent'],
      },
    });
  } catch (error) {
    console.error('Error registrando evento de auditoría:', error);
  }
}
