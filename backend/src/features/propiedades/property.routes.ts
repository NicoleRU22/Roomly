import { Router } from 'express';
import { 
  getAllProperties, 
  createProperty, 
  updateProperty, 
  deleteProperty, 
  getRoomsByProperty, 
  createRoom, 
  updateRoom, 
  deleteRoom 
} from './property.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { tenantMiddleware } from '../../core/middlewares/tenant.middleware';

const router = Router();

// Todas las rutas de propiedades/cuartos requieren autenticación y pertenecen al tenant
router.use(tenantMiddleware, authMiddleware);

router.get('/properties', getAllProperties);
router.post('/properties', createProperty);
router.put('/properties/:id', updateProperty);
router.delete('/properties/:id', deleteProperty);

router.get('/properties/:propertyId/rooms', getRoomsByProperty);
router.post('/rooms', createRoom);
router.put('/rooms/:id', updateRoom);
router.delete('/rooms/:id', deleteRoom);

export default router;
