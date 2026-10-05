import { publicErrorMessage } from '../middleware/error.middleware';
import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import { sageLimiter, sageDailyLimiter } from '../middleware/rate-limit.middleware';
import * as sage from '../controllers/sage.controller';
import { getTodayProactiveNote, markProactiveNoteRead } from '../services/sage-proactive.service';

const router = Router();
router.use(requireAuth);

// Solo el chat y sus botones llevan límites de ráfaga/día. El consejo y resumen
// del día, la nota proactiva y el cupo no se limitan: nunca bloquean otras zonas.
const chatLimits = [sageLimiter, sageDailyLimiter];
router.post('/chat',             ...chatLimits, sage.chat);
router.post('/suggest-quests',   ...chatLimits, sage.suggestQuests);
router.post('/analyze-habits',   ...chatLimits, sage.analyzeHabits);
router.post('/analyze-finances', ...chatLimits, sage.analyzeFinances);
router.post('/plan-workout',     ...chatLimits, sage.planWorkout);
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
