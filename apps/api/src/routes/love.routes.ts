import { publicErrorMessage } from '../middleware/error.middleware';
import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { importantDateSchema } from '../schemas/activity.schemas';
import * as ctrl from '../controllers/love.controller';
import { getGiftIdeas, createGiftIdea, updateGiftIdea, deleteGiftIdea } from '../services/love.service';

const router = Router();
router.use(requireAuth);

router.get('/dashboard',                                     ctrl.getLoveDashboard);
router.get('/',                                              ctrl.listRelationships);
router.post('/',                                             ctrl.createRelationship);
router.patch('/:id',                                         ctrl.updateRelationship);
router.delete('/:id',                                        ctrl.deleteRelationship);

router.get('/:id/important-dates',                           ctrl.getImportantDates);
router.post('/:id/important-dates',                          validate(importantDateSchema), ctrl.addImportantDate);
router.patch('/:id/important-dates/:dateId',                 validate(importantDateSchema.partial()), ctrl.updateImportantDate);
router.delete('/:id/important-dates/:dateId',                ctrl.deleteImportantDate);

// Gift Ideas
router.get('/gift-ideas', async (req: AuthRequest, res) => {
  try { res.json(await getGiftIdeas(req.userId!, req.query.relationshipId as string)); }
  catch (err: any) { res.status(400).json({ message: publicErrorMessage(err) }); }
});
router.post('/gift-ideas', async (req: AuthRequest, res) => {
  try { res.status(201).json(await createGiftIdea(req.userId!, req.body)); }
  catch (err: any) { res.status(400).json({ message: publicErrorMessage(err) }); }
});
router.patch('/gift-ideas/:id', async (req: AuthRequest, res) => {
  try {
    await updateGiftIdea(req.userId!, req.params.id, req.body);
    res.json({ success: true });
  } catch (err: any) { res.status(400).json({ message: publicErrorMessage(err) }); }
});
router.delete('/gift-ideas/:id', async (req: AuthRequest, res) => {
  try {
    await deleteGiftIdea(req.userId!, req.params.id);
    res.json({ success: true });
  } catch (err: any) { res.status(400).json({ message: publicErrorMessage(err) }); }
});

export default router;
