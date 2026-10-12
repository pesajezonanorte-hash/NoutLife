import { publicErrorMessage } from '../middleware/error.middleware';
import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';
import {
  getNutritionGoal, upsertNutritionGoal,
  getSavedMeals, createSavedMeal, deleteSavedMeal,
  parseMealWithAI, getDailyMacros,
} from '../services/nutrition2.service';

const router = Router();
router.use(requireAuth);

router.get('/goals', async (req, res) => {
  try { res.json(await getNutritionGoal((req as AuthRequest).userId!)); }
  catch (err: any) { res.status(400).json({ message: publicErrorMessage(err) }); }
});

router.put('/goals', async (req, res) => {
  try { res.json(await upsertNutritionGoal((req as AuthRequest).userId!, req.body)); }
  catch (err: any) { res.status(400).json({ message: publicErrorMessage(err) }); }
});

router.get('/saved-meals', async (req, res) => {
  try { res.json(await getSavedMeals((req as AuthRequest).userId!)); }
  catch (err: any) { res.status(400).json({ message: publicErrorMessage(err) }); }
});

router.post('/saved-meals', async (req, res) => {
  try { res.status(201).json(await createSavedMeal((req as AuthRequest).userId!, req.body)); }
  catch (err: any) { res.status(400).json({ message: publicErrorMessage(err) }); }
});

router.delete('/saved-meals/:id', async (req, res) => {
  try {
    await deleteSavedMeal((req as AuthRequest).userId!, req.params.id);
    res.json({ success: true });
  } catch (err: any) { res.status(400).json({ message: publicErrorMessage(err) }); }
});

router.post('/ai-parse', async (req, res) => {
  try {
    const { description } = req.body;
    if (!description) return res.status(400).json({ message: 'description requerido' });
    res.json(await parseMealWithAI(description));
  } catch (err: any) { res.status(400).json({ message: publicErrorMessage(err) }); }
});

router.get('/daily', async (req, res) => {
  try {
    const date = req.query.date ? new Date(req.query.date as string) : new Date();
    res.json(await getDailyMacros((req as AuthRequest).userId!, date));
  } catch (err: any) { res.status(400).json({ message: publicErrorMessage(err) }); }
});

export default router;
