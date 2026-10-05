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
// Solo los campos del modelo: un campo de más hace fallar a Prisma.
const giftFields = (b: Record<string, unknown>) => {
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const price = b.estimatedPrice === undefined || b.estimatedPrice === null || b.estimatedPrice === '' ? undefined : Number(b.estimatedPrice);
  return {
    name: text(b.name),
    description: text(b.description),
    url: text(b.url),
    occasion: text(b.occasion),
    relationshipId: text(b.relationshipId),
    estimatedPrice: price !== undefined && Number.isFinite(price) && price >= 0 ? price : undefined,
    ...(typeof b.isPurchased === 'boolean' ? { isPurchased: b.isPurchased } : {}),
  };
};

router.post('/gift-ideas', async (req: AuthRequest, res) => {
  const { isPurchased: _ignored, ...data } = giftFields(req.body ?? {});
  if (!data.name) { res.status(400).json({ message: 'Escribe el nombre del regalo.' }); return; }
  try { res.status(201).json(await createGiftIdea(req.userId!, { ...data, name: data.name })); }
  catch (err: any) { res.status(400).json({ message: publicErrorMessage(err) }); }
});
router.patch('/gift-ideas/:id', async (req: AuthRequest, res) => {
  try {
    const { relationshipId: _r, ...data } = giftFields(req.body ?? {});
    await updateGiftIdea(req.userId!, req.params.id, Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)));
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
