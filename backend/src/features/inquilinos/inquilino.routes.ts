import { Router } from 'express';
import { 
  getAllInquilinos, 
  getMyInfo, 
  createInquilino, 
  updateInquilino, 
  deleteInquilino, 
  changeInquilinoPassword,
  consultarDni
} from './inquilino.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { tenantMiddleware } from '../../core/middlewares/tenant.middleware';

const router = Router();

router.use(tenantMiddleware, authMiddleware);

router.get('/inquilinos', getAllInquilinos);
router.get('/inquilinos/me', getMyInfo);
router.get('/inquilinos/consultar-dni/:dni', consultarDni);
router.post('/inquilinos', createInquilino);
router.put('/inquilinos/:id', updateInquilino);
router.delete('/inquilinos/:id', deleteInquilino);
router.put('/inquilinos/change-password', changeInquilinoPassword);

export default router;
