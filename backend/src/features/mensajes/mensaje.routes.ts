import { Router } from 'express';
import { getConversaciones, getUnreadCount, getConversacion, sendMensaje, markConversacionAsRead } from './mensaje.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { tenantMiddleware } from '../../core/middlewares/tenant.middleware';

const router = Router();

router.use(tenantMiddleware, authMiddleware);

router.get('/mensajes/conversaciones', getConversaciones);
router.get('/mensajes/unread-count', getUnreadCount);
router.get('/mensajes/:userId', getConversacion);
router.post('/mensajes/:userId', sendMensaje);
router.put('/mensajes/:userId/read', markConversacionAsRead);

export default router;
