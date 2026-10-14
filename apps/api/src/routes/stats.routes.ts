import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import * as stats from '../controllers/stats.controller';
import { liteHistoryWindow } from '../middleware/plan.middleware';

const router = Router();
router.use(requireAuth);
// NoutLife Lite: estadísticas de la última semana.
router.use(liteHistoryWindow);

router.get('/summary',       stats.summary);
router.get('/xp-history',    stats.xpHistory);
router.get('/radar',         stats.activityRadar);
router.get('/finance-trend', stats.financeTrend);
router.get('/heatmap',       stats.habitHeatmap);
router.get('/sleep',         stats.sleepScatter);
router.get('/coliseo',       stats.coliseoProgression);
router.get('/gym',           stats.coliseoProgression); // alias legado
router.get('/predictions',   stats.predictions);

export default router;
