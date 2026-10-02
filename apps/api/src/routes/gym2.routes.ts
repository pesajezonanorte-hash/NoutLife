import { publicErrorMessage } from '../middleware/error.middleware';
import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';
import {
  logBodyWeight,
  getBodyWeights,
  deleteBodyWeight,
  saveProgressPhoto,
  getProgressPhotos,
  deleteProgressPhoto,
  getExerciseHistory,
  getWeeklyVolume,
  calculate1RM,
} from '../services/gym2.service';

const router = Router();
router.use(requireAuth);

// Body Weight
router.post('/body-weight', async (req, res) => {
  try {
    const { weight, date, notes } = req.body;
    if (!(Number(weight) > 0)) { res.status(400).json({ message: 'El peso debe ser un número mayor que cero.' }); return; }
    const when = date ? new Date(date) : new Date();
    if (Number.isNaN(when.getTime())) { res.status(400).json({ message: 'La fecha no es válida.' }); return; }
    const record = await logBodyWeight((req as AuthRequest).userId!, Number(weight), when, notes);
    res.status(201).json(record);
  } catch (err: any) {
    res.status(400).json({ message: publicErrorMessage(err) });
  }
});

router.get('/body-weight', async (req, res) => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const records = await getBodyWeights((req as AuthRequest).userId!, from ? new Date(from) : undefined, to ? new Date(to) : undefined);
    res.json(records);
  } catch (err: any) {
    res.status(400).json({ message: publicErrorMessage(err) });
  }
});

router.delete('/body-weight/:id', async (req, res) => {
  try {
    await deleteBodyWeight((req as AuthRequest).userId!, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ message: publicErrorMessage(err) });
  }
});

// Progress Photos
router.post('/progress-photos', async (req, res) => {
  try {
    const { photoData, date, notes } = req.body;
    const record = await saveProgressPhoto((req as AuthRequest).userId!, photoData, new Date(date), notes);
    res.status(201).json({ ...record, photoData: undefined });
  } catch (err: any) {
    res.status(400).json({ message: publicErrorMessage(err) });
  }
});

router.get('/progress-photos', async (req, res) => {
  try {
    const photos = await getProgressPhotos((req as AuthRequest).userId!);
    res.json(photos);
  } catch (err: any) {
    res.status(400).json({ message: publicErrorMessage(err) });
  }
});

router.delete('/progress-photos/:id', async (req, res) => {
  try {
    await deleteProgressPhoto((req as AuthRequest).userId!, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ message: publicErrorMessage(err) });
  }
});

// Exercise History
router.get('/exercises/:exerciseId/history', async (req, res) => {
  try {
    const history = await getExerciseHistory((req as AuthRequest).userId!, req.params.exerciseId);
    res.json(history);
  } catch (err: any) {
    res.status(400).json({ message: publicErrorMessage(err) });
  }
});

// Weekly Volume
router.get('/volume-weekly', async (req, res) => {
  try {
    const volume = await getWeeklyVolume((req as AuthRequest).userId!);
    res.json(volume);
  } catch (err: any) {
    res.status(400).json({ message: publicErrorMessage(err) });
  }
});

// 1RM Calculator
router.post('/1rm', async (req, res) => {
  const { weight, reps } = req.body;
  res.json({ oneRepMax: calculate1RM(Number(weight), Number(reps)) });
});

export default router;
