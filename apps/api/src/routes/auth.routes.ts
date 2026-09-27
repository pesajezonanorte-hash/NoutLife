import { Router } from 'express';
import { register, login, refresh, logout, me, factoryReset } from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { factoryResetSchema, registerSchema, loginSchema } from '../schemas/auth.schemas';
import { factoryResetLimiter, loginLimiter, registerLimiter } from '../middleware/rate-limit.middleware';

const router = Router();

router.post('/register', registerLimiter, validate(registerSchema), register);
router.post('/login', loginLimiter, validate(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', requireAuth, logout);
router.post('/factory-reset', requireAuth, factoryResetLimiter, validate(factoryResetSchema), factoryReset);
router.get('/me', requireAuth, me);

export default router;
