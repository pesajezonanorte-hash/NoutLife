import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireProZone } from '../middleware/plan.middleware';
import { validate } from '../middleware/validate.middleware';
import { createJournalSchema, updateJournalSchema } from '../schemas/activity.schemas';
import * as ctrl from '../controllers/journal.controller';

const router = Router();
router.use(requireAuth);
// Zona Pro: en NoutLife Lite toda la zona responde 402 (lo guardado se conserva).
router.use(requireProZone('journal'));

router.get('/',         ctrl.listJournal);
router.post('/',        validate(createJournalSchema), ctrl.createJournalEntry);
router.get('/streak',   ctrl.getJournalStreak);
router.get('/:id',      ctrl.getJournalEntry);
router.patch('/:id',    validate(updateJournalSchema), ctrl.updateJournalEntry);
router.delete('/:id',   ctrl.deleteJournalEntry);

export default router;
