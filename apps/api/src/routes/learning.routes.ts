import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { Response } from 'express';
import { validate } from '../middleware/validate.middleware';
import { createLearningSchema } from '../schemas/activity.schemas';
import * as ctrl from '../controllers/learning.controller';
import * as svc from '../services/learning.service';

const router = Router();
router.use(requireAuth);

router.get('/',        ctrl.listLearning);
router.post('/',       validate(createLearningSchema), ctrl.createLearning);
router.patch('/:id',   ctrl.updateLearning);
router.delete('/:id',  ctrl.deleteLearning);
router.get('/stats',   ctrl.getLearningStats);

// Notes
router.get('/:id/notes', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const item = await svc.listLearning(req.userId!).then(items => items.find(i => i.id === req.params.id));
    if (!item) { res.status(404).json({ error: 'No encontrado' }); return; }
    const notes = ((item.richNotes as unknown as any[]) ?? []).map((n: any) => ({
      id: n.id, text: n.content ?? n.text, createdAt: n.createdAt,
    }));
    res.json({ notes });
  } catch { res.status(500).json({ error: 'Error' }); }
});

router.post('/:id/notes', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const updated = await svc.addNote(req.userId!, req.params.id, { content: req.body.text ?? req.body.content });
    const notes = (updated.richNotes as unknown as any[]) ?? [];
    const last = notes[notes.length - 1];
    res.json({ note: { id: last.id, text: last.content ?? last.text, createdAt: last.createdAt } });
  } catch { res.status(500).json({ error: 'Error' }); }
});

router.delete('/:id/notes/:noteId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await svc.deleteNote(req.userId!, req.params.id, req.params.noteId);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Error' }); }
});

// Vocab cards
router.get('/:id/vocab', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const item = await svc.listLearning(req.userId!).then(items => items.find(i => i.id === req.params.id));
    if (!item) { res.status(404).json({ error: 'No encontrado' }); return; }
    const cards = ((item.vocabularyCards as unknown as any[]) ?? []).map((c: any) => ({
      id: c.id, front: c.word ?? c.front, back: c.meaning ?? c.back,
      example: c.example, nextReview: c.nextReview, interval: c.interval,
      easiness: c.easiness, repetitions: c.repetitions,
    }));
    res.json({ cards });
  } catch { res.status(500).json({ error: 'Error' }); }
});

router.post('/:id/vocab', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const updated = await svc.addVocabCard(req.userId!, req.params.id, {
      word: req.body.front ?? req.body.word,
      meaning: req.body.back ?? req.body.meaning,
    });
    const cards = (updated.vocabularyCards as unknown as any[]) ?? [];
    const last = cards[cards.length - 1];
    res.json({ card: { id: last.id, front: last.word, back: last.meaning, nextReview: last.nextReview, interval: last.interval, easiness: last.easiness, repetitions: last.repetitions } });
  } catch { res.status(500).json({ error: 'Error' }); }
});

router.post('/:id/vocab/:cardId/review', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const updated = await svc.reviewVocabCard(req.userId!, req.params.id, req.params.cardId, req.body.quality);
    const cards = (updated.vocabularyCards as unknown as any[]) ?? [];
    const card = cards.find((c: any) => c.id === req.params.cardId);
    res.json({ card: { id: card.id, front: card.word, back: card.meaning, nextReview: card.nextReview, interval: card.interval, easiness: card.easiness, repetitions: card.repetitions } });
  } catch { res.status(500).json({ error: 'Error' }); }
});

// Pomodoro
router.post('/pomodoro', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await svc.completedPomodoro(req.userId!);
    res.json({ xp: (result as any)?.xpEarned ?? 15, gold: (result as any)?.goldEarned ?? 3 });
  } catch { res.status(500).json({ error: 'Error' }); }
});

export default router;
