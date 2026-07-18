import { Router } from 'express';
import {
  getAllPayments,
  createPayment,
  recordPayment,
  approvePayment,
  rejectPayment,
  exportPaymentsReport,
  deletePayment,
  sendDebtReminder,
  runRecurringInvoices,
  getPaymentSchedule,
  getCulqiConfig,
  processCulqiCharge
} from './payment.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { tenantMiddleware } from '../../core/middlewares/tenant.middleware';

const router = Router();

router.use(tenantMiddleware, authMiddleware);

router.get('/payments', getAllPayments);
router.get('/payments/schedule', getPaymentSchedule);
router.get('/payments/export', exportPaymentsReport);
router.get('/payments/culqi/config', getCulqiConfig);
router.post('/payments', createPayment);
router.put('/payments/:id/record', recordPayment);
router.put('/payments/:id/approve', approvePayment);
router.put('/payments/:id/reject', rejectPayment);
router.post('/payments/:id/culqi-charge', processCulqiCharge);
router.post('/payments/remind-debt/:inquilinoId', sendDebtReminder);
router.post('/payments/generate-recurring', runRecurringInvoices);
router.delete('/payments/:id', deletePayment);

export default router;
