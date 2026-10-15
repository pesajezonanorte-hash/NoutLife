import { Router, type NextFunction, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { publicErrorMessage } from '../middleware/error.middleware';
import { prisma } from '../lib/prisma';
import { canUseCycle } from '../lib/gender';
import { cycleLogSchema, cyclePeriodSchema, cyclePeriodUpdateSchema, cycleSettingsSchema } from '../schemas/cycle.schemas';
import {
  CycleError, addPeriod, clearDay, deletePeriod, getCycle, getCycleAdvice, logDay, saveSettings, updatePeriod,
} from '../services/cycle.service';

const router = Router();
router.use(requireAuth);

/** La zona Ciclo solo existe para quien indica en su perfil que es mujer. */
async function requireCycle(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { gender: true } });
    if (!canUseCycle(user?.gender)) {
      res.status(403).json({ error: 'La zona Ciclo se activa cuando en tu perfil indicas que eres mujer.', code: 'CYCLE_UNAVAILABLE' });
      return;
    }
    next();
  } catch (err) { next(err); }
}
router.use(requireCycle);

const userIdOf = (req: unknown) => (req as AuthRequest).userId!;
const fail = (res: Response, err: unknown) => {
  if (err instanceof CycleError) { res.status(400).json({ error: err.message }); return; }
  res.status(500).json({ error: publicErrorMessage(err) });
};

router.get('/', async (req, res) => {
  try { res.json(await getCycle(userIdOf(req))); } catch (err) { fail(res, err); }
});

router.get('/advice', async (req, res) => {
  try { res.json(await getCycleAdvice(userIdOf(req))); } catch (err) { fail(res, err); }
});

router.put('/settings', validate(cycleSettingsSchema), async (req, res) => {
  try { res.json(await saveSettings(userIdOf(req), req.body)); } catch (err) { fail(res, err); }
});

router.post('/periods', validate(cyclePeriodSchema), async (req, res) => {
  try { res.status(201).json(await addPeriod(userIdOf(req), req.body)); } catch (err) { fail(res, err); }
});

router.patch('/periods/:id', validate(cyclePeriodUpdateSchema), async (req, res) => {
  try {
    const period = await updatePeriod(userIdOf(req), req.params.id, req.body);
    if (!period) { res.status(404).json({ error: 'Ese periodo ya no existe.' }); return; }
    res.json(period);
  } catch (err) { fail(res, err); }
});

router.delete('/periods/:id', async (req, res) => {
  try {
    if (!(await deletePeriod(userIdOf(req), req.params.id))) { res.status(404).json({ error: 'Ese periodo ya no existe.' }); return; }
    res.json({ success: true });
  } catch (err) { fail(res, err); }
});

router.put('/logs/:date', validate(cycleLogSchema), async (req, res) => {
  try { res.json(await logDay(userIdOf(req), req.params.date, req.body)); } catch (err) { fail(res, err); }
});

router.delete('/logs/:date', async (req, res) => {
  try { await clearDay(userIdOf(req), req.params.date); res.json({ success: true }); } catch (err) { fail(res, err); }
});

export default router;
