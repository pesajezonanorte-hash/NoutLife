import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import { limitActiveRoutines } from '../middleware/plan.middleware';
import * as rituals from '../services/rituals.service';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const data = await rituals.listRituals((req as AuthRequest).userId!);
    res.json(data);
  } catch (err) { next(err); }
});

router.post('/seed-presets', async (req, res, next) => {
  try {
    const data = await rituals.seedPresetRituals((req as AuthRequest).userId!);
    res.json(data);
  } catch (err) { next(err); }
});

// Lite: como mucho LITE_LIMITS.activeRoutines rutinas activas.
router.post('/', limitActiveRoutines, async (req, res, next) => {
  try {
    const ritual = await rituals.createRitual((req as AuthRequest).userId!, req.body);
    res.status(201).json(ritual);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const ritual = await rituals.updateRitual((req as AuthRequest).userId!, req.params.id, req.body);
    res.json(ritual);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await rituals.deleteRitual((req as AuthRequest).userId!, req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/:id/complete', async (req, res, next) => {
  try {
    const result = await rituals.completeRitual((req as AuthRequest).userId!, req.params.id);
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/:id/stats', async (req, res, next) => {
  try {
    const stats = await rituals.getRitualStats((req as AuthRequest).userId!, req.params.id);
    res.json(stats);
  } catch (err) { next(err); }
});

export default router;
