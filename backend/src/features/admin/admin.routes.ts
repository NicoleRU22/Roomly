import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { getOverview, listTenants, listUsuarios, getGrowth } from './admin.controller';

const router = Router();

// No usa tenantMiddleware: el ADMIN no pertenece a ningún tenant.
router.use(authMiddleware);

const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.userRole !== 'ADMIN') {
    res.status(403).json({ error: 'Solo el administrador de la plataforma puede acceder a esta ruta.' });
    return;
  }
  next();
};

router.use(requireAdmin);

router.get('/overview', getOverview);
router.get('/tenants', listTenants);
router.get('/usuarios', listUsuarios);
router.get('/growth', getGrowth);

export default router;
