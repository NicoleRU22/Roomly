import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import {
  getOverview, listTenants, listUsuarios, deleteUsuario, getGrowth,
  listAuditLogs, exportAuditLogs, getAlerts, listSessions, revokeSession,
  getHealth, exportUsuarios, exportTenants
} from './admin.controller';

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
router.get('/tenants/export', exportTenants);
router.get('/usuarios', listUsuarios);
router.get('/usuarios/export', exportUsuarios);
router.delete('/usuarios/:id', deleteUsuario);
router.get('/growth', getGrowth);
router.get('/audit-logs', listAuditLogs);
router.get('/audit-logs/export', exportAuditLogs);
router.get('/alerts', getAlerts);
router.get('/sessions', listSessions);
router.post('/sessions/:id/revoke', revokeSession);
router.get('/health', getHealth);

export default router;
