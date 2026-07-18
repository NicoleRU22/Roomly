import { Router } from 'express';
import { getConfiguracion, updateConfiguracion, uploadLandlordSignature } from './configuracion.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { tenantMiddleware } from '../../core/middlewares/tenant.middleware';

const router = Router();

router.use(tenantMiddleware, authMiddleware);

router.get('/configuracion', getConfiguracion);
router.put('/configuracion', updateConfiguracion);
router.put('/configuracion/landlord-signature', uploadLandlordSignature);

export default router;
