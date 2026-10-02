import { publicErrorMessage } from '../middleware/error.middleware';
import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import * as dashboardController from '../controllers/dashboard.controller';
import { getTodayPriorities } from '../services/dashboard.service';

const router = Router();

router.use(requireAuth);

router.get('/', dashboardController.getDashboard);
router.get('/today-quests', dashboardController.getTodayQuests);
router.get('/today-plan', dashboardController.getTodayPlan);

router.get('/priorities', async (req, res) => {
  try {
    const priorities = await getTodayPriorities((req as AuthRequest).userId!);
    res.json(priorities);
  } catch (err: any) { res.status(500).json({ message: publicErrorMessage(err) }); }
});

export default router;
