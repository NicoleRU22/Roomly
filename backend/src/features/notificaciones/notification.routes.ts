import { Router } from 'express';
import { getMyNotifications, getUnreadCount, markAsRead, markAllAsRead } from './notification.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { tenantMiddleware } from '../../core/middlewares/tenant.middleware';

const router = Router();

router.use(tenantMiddleware, authMiddleware);

router.get('/notifications', getMyNotifications);
router.get('/notifications/unread-count', getUnreadCount);
router.put('/notifications/:id/read', markAsRead);
router.put('/notifications/read-all', markAllAsRead);

export default router;
