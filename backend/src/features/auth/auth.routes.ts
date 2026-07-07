import { Router } from 'express';
import { register, login, validateTenant, googleAuth, verifyEmail, resendVerification } from './auth.controller';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.get('/validate-tenant', validateTenant);

export default router;
