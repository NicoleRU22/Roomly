import { Request, Response } from 'express';
import prisma from '../../core/db/prisma';

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
