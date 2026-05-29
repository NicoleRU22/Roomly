import { Router } from 'express';
import { 
  getAllPayments, 
  createPayment, 
  recordPayment, 
  deletePayment 
} from '../controllers/payment.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { tenantMiddleware } from '../middlewares/tenant.middleware';

const router = Router();

router.use(tenantMiddleware, authMiddleware);

router.get('/payments', getAllPayments);
router.post('/payments', createPayment);
router.put('/payments/:id/record', recordPayment);
router.delete('/payments/:id', deletePayment);

export default router;
