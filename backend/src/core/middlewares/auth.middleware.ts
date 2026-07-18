import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../db/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'roomly-super-secret-key';

interface DecodedToken {
  userId: number;
  role: string;
  tenantId: number | null;
  email: string;
  jti: string;
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;

    // Validar la sesión asociada al jti: permite revocar tokens individuales desde el panel admin.
    const session = await prisma.session.findUnique({ where: { jti: decoded.jti } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Sesión revocada o expirada.' });
    }
    prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});

    // Adjuntar datos del usuario al request
    req.userId = decoded.userId;
    req.userRole = decoded.role;

    // El ADMIN es un superadmin de plataforma: no pertenece a ningún tenant,
    // así que puede acceder a cualquier tenant resuelto por tenantMiddleware (vía header X-Tenant-Slug).
    if (decoded.role === 'ADMIN') {
      return next();
    }

    // VALIDACIÓN CRÍTICA: Asegurar que el usuario pertenezca al tenant solicitado en la ruta
    if (req.tenantId && decoded.tenantId !== req.tenantId) {
      return res.status(403).json({ error: 'No tienes permiso para acceder a los datos de este inquilino/empresa.' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }
};
