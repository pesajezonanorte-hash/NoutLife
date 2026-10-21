import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import * as admin from '../services/admin.service';

const router = Router();
router.use(requireAuth, requireAdmin);

router.delete('/users/:id', async (req: AuthRequest, res, next) => {
  try { res.json(await admin.deleteUser(req.userId!, String(req.params.id))); }
  catch (err) {
    if (err instanceof admin.AdminError) { res.status(err.status).json({ error: err.message }); return; }
    next(err);
  }
});

router.get('/users', async (_req, res, next) => {
  try { res.json({ users: await admin.listUsers() }); } catch (err) { next(err); }
});

router.get('/push-stats', async (_req, res, next) => {
  try { res.json(await admin.pushStats()); } catch (err) { next(err); }
});

export default router;
