import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import * as historyController from '../controllers/history.controller';
import { liteHistoryWindow } from '../middleware/plan.middleware';

const router = Router();

router.use(requireAuth);
// NoutLife Lite: solo los últimos 7 días.
router.use(liteHistoryWindow);

router.get('/',           historyController.getHistory);
router.get('/day/:date',  historyController.getDayDetail);

export default router;
