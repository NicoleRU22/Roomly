import { Router } from 'express';
import { 
  getAllServicios, 
  createServicio, 
  updateServicio, 
  deleteServicio 
} from '../controllers/servicio.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { tenantMiddleware } from '../middlewares/tenant.middleware';

const router = Router();

router.use(tenantMiddleware, authMiddleware);

router.get('/servicios', getAllServicios);
router.post('/servicios', createServicio);
router.put('/servicios/:id', updateServicio);
router.delete('/servicios/:id', deleteServicio);

export default router;
