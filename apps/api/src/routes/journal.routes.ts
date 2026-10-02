import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createJournalSchema, updateJournalSchema } from '../schemas/activity.schemas';
import * as ctrl from '../controllers/journal.controller';

const router = Router();
router.use(requireAuth);

router.get('/',         ctrl.listJournal);
router.post('/',        validate(createJournalSchema), ctrl.createJournalEntry);
router.get('/streak',   ctrl.getJournalStreak);
router.get('/:id',      ctrl.getJournalEntry);
router.patch('/:id',    validate(updateJournalSchema), ctrl.updateJournalEntry);
router.delete('/:id',   ctrl.deleteJournalEntry);

export default router;
