import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import * as ctrl from '../controllers/checklist.controller';
import {
  addItemSchema, createChecklistSchema, reorderItemsSchema, shareLinkSchema, shareUserSchema,
  updateChecklistSchema, updateItemSchema, updateShareSchema,
} from '../schemas/checklist.schemas';

const router = Router();
router.use(requireAuth);

router.get('/',                          ctrl.list);
router.post('/', validate(createChecklistSchema), ctrl.create);
router.get('/join/:token',               ctrl.previewJoin);
router.post('/join/:token',              ctrl.join);
router.get('/:id',                       ctrl.get);
router.patch('/:id', validate(updateChecklistSchema), ctrl.update);
router.delete('/:id',                    ctrl.remove);
router.post('/:id/leave',                ctrl.leave);
router.post('/:id/items', validate(addItemSchema), ctrl.addItem);
router.patch('/:id/items/:itemId', validate(updateItemSchema), ctrl.updateItem);
router.delete('/:id/items/:itemId',      ctrl.deleteItem);
router.post('/:id/reorder', validate(reorderItemsSchema), ctrl.reorder);
router.post('/:id/clear-done',           ctrl.clearDone);
router.get('/:id/shares',                ctrl.shares);
router.post('/:id/shares/link', validate(shareLinkSchema), ctrl.shareLink);
router.post('/:id/shares/user', validate(shareUserSchema), ctrl.shareUser);
router.patch('/:id/shares/:shareId', validate(updateShareSchema), ctrl.updateShare);
router.delete('/:id/shares/:shareId',    ctrl.revokeShare);

export default router;
