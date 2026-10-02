import { publicErrorMessage } from '../middleware/error.middleware';
import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';
import { calculateLifeScore, getCorrelations, getMorningBriefing, getYearInReview, calculateDynamicLifeScore } from '../services/lifescore.service';
import { getGlowUpData } from '../services/glowup.service';

const router = Router();
router.use(requireAuth);

router.get('/score', async (req, res) => {
  try { res.json(await calculateLifeScore((req as AuthRequest).userId!)); }
  catch (err: any) { res.status(500).json({ message: publicErrorMessage(err) }); }
});

router.get('/correlations', async (req, res) => {
  try { res.json(await getCorrelations((req as AuthRequest).userId!)); }
  catch (err: any) { res.status(500).json({ message: publicErrorMessage(err) }); }
});

router.get('/morning-briefing', async (req, res) => {
  try { res.json(await getMorningBriefing((req as AuthRequest).userId!)); }
  catch (err: any) { res.status(500).json({ message: publicErrorMessage(err) }); }
});

router.get('/year-review', async (req, res) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    res.json(await getYearInReview((req as AuthRequest).userId!, year));
  } catch (err: any) { res.status(500).json({ message: publicErrorMessage(err) }); }
});

router.get('/dynamic', async (req, res) => {
  try {
    const period = typeof req.query.period === 'string' ? req.query.period : 'month';
    res.json(await calculateDynamicLifeScore((req as AuthRequest).userId!, period));
  } catch (err: any) { res.status(500).json({ message: publicErrorMessage(err) }); }
});

router.get('/glow-up', async (req, res) => {
  try { res.json(await getGlowUpData((req as AuthRequest).userId!)); }
  catch (err: any) { res.status(500).json({ message: publicErrorMessage(err) }); }
});

export default router;
