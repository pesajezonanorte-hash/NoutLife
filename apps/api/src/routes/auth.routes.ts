import { Router } from 'express';
import { oauth, providers, refresh, logout, me, factoryReset, deleteAccount } from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { deleteAccountSchema, factoryResetSchema, oauthSchema } from '../schemas/auth.schemas';
import { factoryResetLimiter, loginLimiter } from '../middleware/rate-limit.middleware';

const router = Router();

router.get('/providers', providers);
router.post('/oauth', loginLimiter, validate(oauthSchema), oauth);
router.post('/refresh', refresh);
router.post('/logout', requireAuth, logout);
router.post('/factory-reset', requireAuth, factoryResetLimiter, validate(factoryResetSchema), factoryReset);
router.post('/delete-account', requireAuth, factoryResetLimiter, validate(deleteAccountSchema), deleteAccount);
router.get('/me', requireAuth, me);

export default router;
