import { Request, Response } from 'express';
import prisma from '../../core/db/prisma';
import { logEvent } from '../../core/services/audit.service';
import { toCsv } from '../../core/utils/csv';
import { getPaginationParams, buildPaginatedResponse } from '../../core/utils/pagination';

// Resumen general de la plataforma para el panel del ADMIN.
export const getOverview = async (req: Request, res: Response): Promise<void> => {
  try {
    const [tenantCount, usuariosPorRol, propertyCount, inquilinoCount, contratoActivos, pagosPendientes, recentTenants] =
      await Promise.all([
        prisma.tenant.count(),
        prisma.usuario.groupBy({ by: ['role'], _count: { _all: true } }),
        prisma.property.count(),
        prisma.inquilino.count({ where: { status: 'ACTIVO' } }),
        prisma.contrato.count({ where: { status: 'VIGENTE' } }),
        prisma.payment.count({ where: { status: 'PENDIENTE' } }),
        prisma.tenant.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, slug: true, companyName: true, createdAt: true }
        })
      ]);

    const roleCounts = usuariosPorRol.reduce<Record<string, number>>((acc, row) => {
      acc[row.role] = row._count._all;
      return acc;
    }, {});

    res.json({
      tenantCount,
      usuarioCount: Object.values(roleCounts).reduce((a, b) => a + b, 0),
      roleCounts,
      propertyCount,
      inquilinoActivosCount: inquilinoCount,
      contratoActivosCount: contratoActivos,
      pagosPendientesCount: pagosPendientes,
      recentTenants
    });
  } catch (error) {
    console.error('Error en getOverview:', error);
    res.status(500).json({ error: 'Error al obtener el resumen de la plataforma.' });
  }
};

// Lista todos los tenants de la plataforma con conteos detallados y su última actividad
// (el login más reciente entre todos sus usuarios), para distinguir tenants activos de abandonados.
export const listTenants = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        slug: true,
        companyName: true,
        createdAt: true,
        _count: {
          select: {
            usuarios: true,
            properties: true,
            inquilinos: true,
            contratos: true,
            payments: true,
            tickets: true
          }
        },
        usuarios: { select: { lastLoginAt: true } }
      }
    });

    const result = tenants.map(({ usuarios, ...tenant }) => {
      const lastActivity = usuarios.reduce<Date | null>((latest, u) => {
        if (!u.lastLoginAt) return latest;
        return !latest || u.lastLoginAt > latest ? u.lastLoginAt : latest;
      }, null);
      return { ...tenant, lastActivity };
    });

    res.json({ tenants: result });
  } catch (error) {
    console.error('Error en listTenants:', error);
    res.status(500).json({ error: 'Error al listar los tenants.' });
  }
};

// Lista todos los usuarios de la plataforma (de todos los tenants) para supervisión del ADMIN.
export const listUsuarios = async (req: Request, res: Response): Promise<void> => {
  try {
    const usuarios = await prisma.usuario.findMany({
      orderBy: { id: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        lastLoginAt: true,
        tenant: { select: { slug: true, companyName: true } }
      }
    });

    res.json({ usuarios });
  } catch (error) {
    console.error('Error en listUsuarios:', error);
    res.status(500).json({ error: 'Error al listar los usuarios.' });
  }
};

// Elimina la cuenta de acceso de un usuario (típicamente un inquilino) para poder recrearla
// desde cero y volver a probar el envío de credenciales por correo.
export const deleteUsuario = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const usuarioId = parseInt(String(id));

  if (isNaN(usuarioId)) {
    res.status(400).json({ error: 'ID de usuario inválido.' });
    return;
  }

  if (usuarioId === req.userId) {
    res.status(400).json({ error: 'No puedes eliminar tu propia cuenta de administrador.' });
    return;
  }

  try {
    const target = await prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!target) {
      res.status(404).json({ error: 'Usuario no encontrado.' });
      return;
    }

    if (target.role === 'ADMIN') {
      res.status(400).json({ error: 'No se puede eliminar una cuenta de administrador de la plataforma.' });
      return;
    }

    await prisma.usuario.delete({ where: { id: usuarioId } });

    await logEvent({
      category: 'ADMIN',
      action: 'USUARIO_ELIMINADO',
      actorId: req.userId,
      targetType: 'Usuario',
      targetId: usuarioId,
      metadata: { email: target.email, role: target.role },
      req
    });

    res.json({ message: 'Usuario eliminado correctamente.' });
  } catch (error) {
    console.error('Error en deleteUsuario:', error);
    res.status(500).json({ error: 'Error al eliminar el usuario.' });
  }
};

// Tendencia de crecimiento: tenants y usuarios nuevos por semana, últimas `weeks` semanas (por defecto 12).
export const getGrowth = async (req: Request, res: Response): Promise<void> => {
  try {
    const weeks = Math.min(Math.max(Number(req.query.weeks) || 12, 1), 52);

    const [tenants, usuarios] = await Promise.all([
      prisma.tenant.findMany({ select: { createdAt: true } }),
      prisma.usuario.findMany({ select: { createdAt: true } })
    ]);

    // Buckets semanales alineados a lunes, terminando en la semana actual.
    const MS_DAY = 24 * 60 * 60 * 1000;
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // 0 = lunes
    const currentWeekStart = new Date(now);
    currentWeekStart.setHours(0, 0, 0, 0);
    currentWeekStart.setDate(currentWeekStart.getDate() - dayOfWeek);

    const bucketStarts: Date[] = [];
    for (let i = weeks - 1; i >= 0; i--) {
      bucketStarts.push(new Date(currentWeekStart.getTime() - i * 7 * MS_DAY));
    }

    const bucketIndex = (date: Date): number => {
      const diffDays = Math.floor((date.getTime() - bucketStarts[0].getTime()) / MS_DAY);
      const idx = Math.floor(diffDays / 7);
      return idx >= 0 && idx < weeks ? idx : -1;
    };

    const tenantCounts = new Array(weeks).fill(0);
    const usuarioCounts = new Array(weeks).fill(0);

    for (const t of tenants) {
      const idx = bucketIndex(t.createdAt);
      if (idx >= 0) tenantCounts[idx]++;
    }
    for (const u of usuarios) {
      const idx = bucketIndex(u.createdAt);
      if (idx >= 0) usuarioCounts[idx]++;
    }

    const series = bucketStarts.map((weekStart, i) => ({
      weekStart,
      newTenants: tenantCounts[i],
      newUsuarios: usuarioCounts[i]
    }));

    res.json({ series });
  } catch (error) {
    console.error('Error en getGrowth:', error);
    res.status(500).json({ error: 'Error al calcular la tendencia de crecimiento.' });
  }
};

// Lista el historial de auditoría (acciones admin, logins fallidos, eventos de sistema), paginado y filtrable.
export const listAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, action, search } = req.query;
    const where: any = {};
    if (category) where.category = String(category);
    if (action) where.action = String(action);
    if (search) where.actorEmail = { contains: String(search), mode: 'insensitive' };

    const pagination = getPaginationParams(req, 25);
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit
      }),
      prisma.auditLog.count({ where })
    ]);

    res.json(buildPaginatedResponse(logs, total, pagination.page, pagination.limit));
  } catch (error) {
    console.error('Error en listAuditLogs:', error);
    res.status(500).json({ error: 'Error al listar el historial de auditoría.' });
  }
};

const MAX_EXPORT_ROWS = 5000;

// Exporta el historial de auditoría filtrado a CSV.
export const exportAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, action, search } = req.query;
    const where: any = {};
    if (category) where.category = String(category);
    if (action) where.action = String(action);
    if (search) where.actorEmail = { contains: String(search), mode: 'insensitive' };

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS
    });

    const csv = toCsv(logs, [
      { key: 'id', header: 'ID' },
      { key: 'createdAt', header: 'Fecha' },
      { key: 'category', header: 'Categoría' },
      { key: 'action', header: 'Acción' },
      { key: 'actorEmail', header: 'Actor' },
      { key: 'targetType', header: 'Tipo de objetivo' },
      { key: 'targetId', header: 'ID de objetivo' },
      { key: 'ip', header: 'IP' },
      { key: 'metadata', header: 'Detalle' }
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="auditoria.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Error en exportAuditLogs:', error);
    res.status(500).json({ error: 'Error al exportar el historial de auditoría.' });
  }
};

const LOGIN_FAILED_WINDOW_MS = 24 * 60 * 60 * 1000;
const LOGIN_FAILED_SHORT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_FAILED_SHORT_THRESHOLD = 5;
const LOGIN_FAILED_LONG_THRESHOLD = 10;

// Detecta posibles ataques de fuerza bruta: agrupa logins fallidos de las últimas 24h por correo,
// marcando como alerta a quienes superen el umbral en la ventana corta (15 min) o larga (24h).
export const getAlerts = async (req: Request, res: Response): Promise<void> => {
  try {
    const since = new Date(Date.now() - LOGIN_FAILED_WINDOW_MS);
    const failures = await prisma.auditLog.findMany({
      where: { category: 'AUTH', action: 'LOGIN_FAILED', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' }
    });

    const shortWindowStart = Date.now() - LOGIN_FAILED_SHORT_WINDOW_MS;
    const byEmail = new Map<string, { total: number; last15min: number; lastAttempt: Date; ips: Set<string> }>();

    for (const f of failures) {
      const email = f.actorEmail || 'desconocido';
      const entry = byEmail.get(email) || { total: 0, last15min: 0, lastAttempt: f.createdAt, ips: new Set<string>() };
      entry.total += 1;
      if (f.createdAt.getTime() >= shortWindowStart) entry.last15min += 1;
      if (f.ip) entry.ips.add(f.ip);
      if (f.createdAt > entry.lastAttempt) entry.lastAttempt = f.createdAt;
      byEmail.set(email, entry);
    }

    const alerts = Array.from(byEmail.entries())
      .filter(([, e]) => e.last15min >= LOGIN_FAILED_SHORT_THRESHOLD || e.total >= LOGIN_FAILED_LONG_THRESHOLD)
      .map(([email, e]) => ({
        email,
        totalAttempts: e.total,
        attemptsLast15Min: e.last15min,
        distinctIps: e.ips.size,
        lastAttempt: e.lastAttempt
      }))
      .sort((a, b) => b.totalAttempts - a.totalAttempts);

    res.json({ alerts, windowHours: 24 });
  } catch (error) {
    console.error('Error en getAlerts:', error);
    res.status(500).json({ error: 'Error al calcular las alertas de actividad sospechosa.' });
  }
};

// Lista las sesiones activas (no revocadas ni expiradas) de toda la plataforma.
export const listSessions = async (req: Request, res: Response): Promise<void> => {
  try {
    const sessions = await prisma.session.findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
      include: { usuario: { select: { id: true, email: true, firstName: true, lastName: true, role: true, tenant: { select: { slug: true, companyName: true } } } } }
    });

    res.json({ sessions });
  } catch (error) {
    console.error('Error en listSessions:', error);
    res.status(500).json({ error: 'Error al listar las sesiones activas.' });
  }
};

// Revoca una sesión: el próximo request con ese token recibirá 401 (ver authMiddleware).
export const revokeSession = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const sessionId = parseInt(String(id));

  if (isNaN(sessionId)) {
    res.status(400).json({ error: 'ID de sesión inválido.' });
    return;
  }

  try {
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      res.status(404).json({ error: 'Sesión no encontrada.' });
      return;
    }

    await prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });

    await logEvent({
      category: 'ADMIN',
      action: 'SESSION_REVOKED',
      actorId: req.userId,
      targetType: 'Session',
      targetId: sessionId,
      metadata: { usuarioId: session.usuarioId },
      req
    });

    res.json({ message: 'Sesión revocada correctamente.' });
  } catch (error) {
    console.error('Error en revokeSession:', error);
    res.status(500).json({ error: 'Error al revocar la sesión.' });
  }
};

const JOB_NAMES = ['recurring_invoices', 'contract_expiration'] as const;

// Estado de salud operativa: última corrida de cada job en background y errores recientes del servidor.
export const getHealth = async (req: Request, res: Response): Promise<void> => {
  try {
    const recentRuns = await prisma.auditLog.findMany({
      where: { category: 'SYSTEM', action: 'JOB_RUN' },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const jobs = JOB_NAMES.map((jobName) => {
      const lastRun = recentRuns.find((r) => {
        try {
          return r.metadata && JSON.parse(r.metadata).jobName === jobName;
        } catch {
          return false;
        }
      });
      return {
        jobName,
        lastRunAt: lastRun?.createdAt ?? null,
        detail: lastRun?.metadata ? JSON.parse(lastRun.metadata) : null
      };
    });

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since1h = new Date(Date.now() - 60 * 60 * 1000);

    const [errorCount24h, errorCount1h, recentErrors] = await Promise.all([
      prisma.auditLog.count({ where: { category: 'SYSTEM', action: 'SERVER_ERROR', createdAt: { gte: since24h } } }),
      prisma.auditLog.count({ where: { category: 'SYSTEM', action: 'SERVER_ERROR', createdAt: { gte: since1h } } }),
      prisma.auditLog.findMany({
        where: { category: 'SYSTEM', action: 'SERVER_ERROR' },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ]);

    res.json({ jobs, errorCount24h, errorCount1h, recentErrors });
  } catch (error) {
    console.error('Error en getHealth:', error);
    res.status(500).json({ error: 'Error al obtener el estado de salud del sistema.' });
  }
};

// Exporta todos los usuarios de la plataforma a CSV.
export const exportUsuarios = async (req: Request, res: Response): Promise<void> => {
  try {
    const usuarios = await prisma.usuario.findMany({
      orderBy: { id: 'desc' },
      take: MAX_EXPORT_ROWS,
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true,
        emailVerified: true, createdAt: true, lastLoginAt: true,
        tenant: { select: { companyName: true } }
      }
    });

    const csv = toCsv(usuarios, [
      { key: 'id', header: 'ID' },
      { key: 'email', header: 'Correo' },
      { key: 'firstName', header: 'Nombre' },
      { key: 'lastName', header: 'Apellido' },
      { key: 'role', header: 'Rol' },
      { key: (u) => u.tenant?.companyName ?? '', header: 'Empresa' },
      { key: 'emailVerified', header: 'Verificado' },
      { key: 'lastLoginAt', header: 'Último acceso' },
      { key: 'createdAt', header: 'Creado' }
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="usuarios.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Error en exportUsuarios:', error);
    res.status(500).json({ error: 'Error al exportar los usuarios.' });
  }
};

// Exporta todos los tenants de la plataforma a CSV.
export const exportTenants = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: { id: 'asc' },
      take: MAX_EXPORT_ROWS,
      select: {
        id: true, slug: true, companyName: true, createdAt: true,
        _count: { select: { usuarios: true, properties: true, inquilinos: true, contratos: true, payments: true, tickets: true } }
      }
    });

    const csv = toCsv(tenants, [
      { key: 'id', header: 'ID' },
      { key: 'slug', header: 'Slug' },
      { key: 'companyName', header: 'Empresa' },
      { key: (t) => t._count.usuarios, header: 'Usuarios' },
      { key: (t) => t._count.properties, header: 'Propiedades' },
      { key: (t) => t._count.inquilinos, header: 'Inquilinos' },
      { key: (t) => t._count.contratos, header: 'Contratos' },
      { key: (t) => t._count.payments, header: 'Pagos' },
      { key: (t) => t._count.tickets, header: 'Tickets' },
      { key: 'createdAt', header: 'Creado' }
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="tenants.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Error en exportTenants:', error);
    res.status(500).json({ error: 'Error al exportar los tenants.' });
  }
};
