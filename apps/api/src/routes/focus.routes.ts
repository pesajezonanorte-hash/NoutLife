import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { completeFocusSchema } from '../schemas/focus.schemas';
import * as focus from '../services/focus.service';

const router = Router();
router.use(requireAuth);

router.post('/complete', validate(completeFocusSchema), async (req, res, next) => {
  try {
    const { durationMin, questId, taskLabel } = req.body;
    const result = await focus.logFocusSession((req as AuthRequest).userId!, durationMin, questId, taskLabel);
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/stats', async (req, res, next) => {
  try {
    const data = await focus.getFocusStats((req as AuthRequest).userId!);
    res.json(data);
  } catch (err) { next(err); }
});

export default router;
