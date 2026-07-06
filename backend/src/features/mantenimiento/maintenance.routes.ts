import { Router } from 'express';
import { getTickets, createTicket, updateTicketStatus } from './maintenance.controller';
import { getProveedores, createProveedor, updateProveedor, deleteProveedor } from './proveedor.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { tenantMiddleware } from '../../core/middlewares/tenant.middleware';

const router = Router();

router.use(tenantMiddleware, authMiddleware);

router.get('/mantenimiento', getTickets);
router.post('/mantenimiento', createTicket);
router.put('/mantenimiento/:id/status', updateTicketStatus);

router.get('/proveedores', getProveedores);
router.post('/proveedores', createProveedor);
router.put('/proveedores/:id', updateProveedor);
router.delete('/proveedores/:id', deleteProveedor);

export default router;
