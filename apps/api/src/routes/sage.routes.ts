import { publicErrorMessage } from '../middleware/error.middleware';
import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import { sageLimiter, sageDailyLimiter } from '../middleware/rate-limit.middleware';
import * as sage from '../controllers/sage.controller';
import { getTodayProactiveNote, markProactiveNoteRead } from '../services/sage-proactive.service';

const router = Router();
router.use(requireAuth);
router.use(sageLimiter);
router.use(sageDailyLimiter);

router.post('/chat',             sage.chat);
router.post('/suggest-quests',   sage.suggestQuests);
router.post('/analyze-habits',   sage.analyzeHabits);
router.post('/analyze-finances', sage.analyzeFinances);
router.post('/plan-workout',     sage.planWorkout);
router.get('/daily-summary',     sage.dailySummary);
router.get('/daily-tip',         sage.dailyTip);
router.get('/rate-info',         sage.rateInfo);

// Proactive note (max 1 per day)
router.get('/proactive-note', async (req, res) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const note = await getTodayProactiveNote(userId);
    res.json(note);
  } catch (err: any) { res.status(500).json({ message: publicErrorMessage(err) }); }
});

router.post('/proactive-note/:id/read', async (req, res) => {
  try {
    const userId = (req as AuthRequest).userId!;
    await markProactiveNoteRead(userId, req.params.id);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: publicErrorMessage(err) }); }
});

export default router;
