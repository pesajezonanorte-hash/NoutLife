import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { idempotent } from '../middleware/idempotency.middleware';
import { validate } from '../middleware/validate.middleware';
import { createQuestSchema, updateQuestSchema, subObjectiveToggleSchema } from '../schemas/quest.schemas';
import * as questController from '../controllers/quest.controller';

const router = Router();

router.use(requireAuth);

router.get('/',                      questController.listQuests);
router.post('/', validate(createQuestSchema), idempotent, questController.createQuest);
router.get('/:id',                   questController.getQuest);
router.patch('/:id', validate(updateQuestSchema), questController.updateQuest);
router.delete('/:id',                questController.archiveQuest);
router.post('/:id/complete',         idempotent, questController.completeQuest);
router.post('/:id/fail',             questController.failQuest);
router.patch('/:id/subobjective', validate(subObjectiveToggleSchema), questController.toggleSubObjective);

export default router;
