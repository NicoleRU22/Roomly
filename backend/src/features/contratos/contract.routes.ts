import { Router } from 'express';
import { getContratos, signContrato, renewContrato, updateContrato, consultarRucSunat, getRoomAvailability } from './contract.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { tenantMiddleware } from '../../core/middlewares/tenant.middleware';

const router = Router();

router.use(tenantMiddleware, authMiddleware);

router.get('/contratos', getContratos);
router.get('/contratos/consultar-ruc/:ruc', consultarRucSunat);
router.get('/rooms/:roomId/availability', getRoomAvailability);
router.put('/contratos/:id', updateContrato);
router.put('/contratos/:id/sign', signContrato);
router.post('/contratos/:id/renew', renewContrato);

export default router;
