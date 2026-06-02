import { Router } from 'express';
import { register, login, validateTenant } from './auth.controller';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/validate-tenant', validateTenant);

export default router;
