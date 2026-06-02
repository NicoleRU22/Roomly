import { Router } from 'express';
import { getContratos, signContrato, renewContrato } from './contract.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { tenantMiddleware } from '../../core/middlewares/tenant.middleware';

const router = Router();

router.use(tenantMiddleware, authMiddleware);

router.get('/contratos', getContratos);
router.put('/contratos/:id/sign', signContrato);
router.post('/contratos/:id/renew', renewContrato);

export default router;
