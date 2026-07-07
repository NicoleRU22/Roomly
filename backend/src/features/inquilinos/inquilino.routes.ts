import { Router } from 'express';
import {
  getAllInquilinos,
  getMyInfo,
  createInquilino,
  updateInquilino,
  deleteInquilino,
  changeInquilinoPassword,
  consultarDni,
  darDeBajaInquilino,
  cambiarHabitacionInquilino,
  getInquilinoHistorial
} from './inquilino.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { tenantMiddleware } from '../../core/middlewares/tenant.middleware';

const router = Router();

router.use(tenantMiddleware, authMiddleware);

// Las rutas literales (change-password, me, consultar-dni) deben registrarse
// antes que '/inquilinos/:id', o Express las confunde con el parámetro :id.
router.get('/inquilinos', getAllInquilinos);
router.get('/inquilinos/me', getMyInfo);
router.get('/inquilinos/consultar-dni/:dni', consultarDni);
router.put('/inquilinos/change-password', changeInquilinoPassword);
router.post('/inquilinos', createInquilino);
router.put('/inquilinos/:id', updateInquilino);
router.delete('/inquilinos/:id', deleteInquilino);
router.put('/inquilinos/:id/baja', darDeBajaInquilino);
router.put('/inquilinos/:id/cambiar-habitacion', cambiarHabitacionInquilino);
router.get('/inquilinos/:id/historial', getInquilinoHistorial);

export default router;
