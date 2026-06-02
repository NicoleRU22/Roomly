import { Router } from 'express';
import { getTickets, createTicket, updateTicketStatus } from './maintenance.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { tenantMiddleware } from '../../core/middlewares/tenant.middleware';

const router = Router();

router.use(tenantMiddleware, authMiddleware);

router.get('/mantenimiento', getTickets);
router.post('/mantenimiento', createTicket);
router.put('/mantenimiento/:id/status', updateTicketStatus);

export default router;
