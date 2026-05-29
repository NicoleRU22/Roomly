import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';

export const tenantMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  // Ignorar rutas públicas globales (login, registro de tenant/propietario)
  const isPublicRoute = 
    req.path.endsWith('/auth/login') || 
    req.path.endsWith('/auth/register') ||
    req.path.endsWith('/auth/validate-tenant');

  if (isPublicRoute) {
    return next();
  }

  // Extraer slug del header o query o params
  let slug = req.headers['x-tenant-slug'] as string;

  // Si no está en el header, intentar extraer de la ruta /api/:tenantSlug/...
  if (!slug) {
    const parts = req.baseUrl.split('/');
    // Si la ruta es del tipo /api/:tenantSlug/...
    if (parts.length > 2 && parts[1] === 'api') {
      slug = parts[2];
    }
  }

  if (!slug) {
    return res.status(400).json({ error: 'Falta la identificación del Tenant (Slug)' });
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: slug.toLowerCase().trim() }
    });

    if (!tenant) {
      return res.status(404).json({ error: `Tenant '${slug}' no encontrado.` });
    }

    req.tenantId = tenant.id;
    next();
  } catch (error) {
    console.error('Error en tenantMiddleware:', error);
    res.status(500).json({ error: 'Error interno al validar el Tenant' });
  }
};
