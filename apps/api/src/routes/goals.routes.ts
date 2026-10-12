import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import * as goals from '../services/goals.service';
import { requirePro } from '../middleware/plan.middleware';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const data = await goals.listGoals((req as AuthRequest).userId!);
    res.json(data);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const goal = await goals.createGoal((req as AuthRequest).userId!, req.body);
    res.status(201).json(goal);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const goal = await goals.updateGoal((req as AuthRequest).userId!, req.params.id, req.body);
    res.json(goal);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await goals.deleteGoal((req as AuthRequest).userId!, req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/:id/milestones', async (req, res, next) => {
  try {
    const m = await goals.addMilestone((req as AuthRequest).userId!, req.params.id, req.body.title);
    res.status(201).json(m);
  } catch (err) { next(err); }
});

router.patch('/milestones/:milestoneId/toggle', async (req, res, next) => {
  try {
    const goal = await goals.toggleMilestone((req as AuthRequest).userId!, req.params.milestoneId);
    res.json(goal);
  } catch (err) { next(err); }
});

router.delete('/milestones/:milestoneId', async (req, res, next) => {
  try {
    await goals.deleteMilestone((req as AuthRequest).userId!, req.params.milestoneId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/:id/ai-breakdown', requirePro('ai'), async (req, res, next) => {
  try {
    const milestones = await goals.aiBreakdownGoal((req as AuthRequest).userId!, req.params.id);
    res.json(milestones);
  } catch (err) { next(err); }
});

export default router;
