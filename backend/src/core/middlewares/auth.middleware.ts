import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'roomly-super-secret-key';

interface DecodedToken {
  userId: number;
  role: string;
  tenantId: number;
  email: string;
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
    
    // Adjuntar datos del usuario al request
    req.userId = decoded.userId;
    req.userRole = decoded.role;

    // VALIDACIÓN CRÍTICA: Asegurar que el usuario pertenezca al tenant solicitado en la ruta
    // (A menos que sea un super-admin o ruta libre de tenant, pero aquí todo está asociado a tenant)
    if (req.tenantId && decoded.tenantId !== req.tenantId) {
      return res.status(403).json({ error: 'No tienes permiso para acceder a los datos de este inquilino/empresa.' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }
};
