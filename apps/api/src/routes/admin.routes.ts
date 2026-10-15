import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import * as admin from '../services/admin.service';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/users', async (_req, res, next) => {
  try { res.json({ users: await admin.listUsers() }); } catch (err) { next(err); }
});

export default router;
