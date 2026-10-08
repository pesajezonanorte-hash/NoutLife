import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import * as antiHabits from '../services/anti-habit.service';

const router = Router();
router.use(requireAuth);
const userIdOf = (req: AuthRequest) => req.userId!;
const fail = (res: Response, err: unknown) => {
  const code = err instanceof Error ? err.message : '';
  if (code === 'ANTI_HABIT_NOT_FOUND' || code === 'ANTI_HABIT_LOG_NOT_FOUND') {
    res.status(404).json({ error: 'El anti-hábito o el registro no existe.' });
    return;
  }
  if (code === 'INVALID_ANTI_HABIT_DATE' || code === 'ANTI_HABIT_FUTURE_DATE') {
    res.status(400).json({ error: 'La fecha del registro no es válida.' });
    return;
  }
  res.status(500).json({ error: 'No se pudo completar la acción.' });
};
const cleanText = (value: unknown, max: number) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;

router.get('/', async (req, res, next) => {
  try { res.json(await antiHabits.listAntiHabits(userIdOf(req as AuthRequest))); }
  catch (err) { next(err); }
});

router.post('/', async (req, res) => {
  const { title, category = 'general', cue, targetPerWeek } = req.body ?? {};
  if (!cleanText(title, 100) || !cleanText(category, 32) ||
    (cue !== undefined && cue !== null && (typeof cue !== 'string' || cue.length > 200)) ||
    (targetPerWeek !== undefined && (!Number.isInteger(targetPerWeek) || targetPerWeek < 1 || targetPerWeek > 100))) {
    res.status(400).json({ error: 'Revisa el título, la categoría y la meta semanal.' });
    return;
  }
  try { res.status(201).json(await antiHabits.createAntiHabit(userIdOf(req as AuthRequest), { title, category, cue, targetPerWeek })); }
  catch { res.status(500).json({ error: 'No se pudo registrar el anti-hábito.' }); }
});

router.post('/:id/logs', async (req, res) => {
  const { occurred, amount = 1, intensity, note, date } = req.body ?? {};
  if (typeof occurred !== 'boolean' || !Number.isInteger(amount) || amount < 1 || amount > 999 ||
    (intensity !== undefined && (!Number.isInteger(intensity) || intensity < 1 || intensity > 5)) ||
    (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 500)) ||
    (date !== undefined && (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)))) {
    res.status(400).json({ error: 'El registro debe indicar qué pasó, una cantidad válida y una intensidad opcional de 1 a 5.' });
    return;
  }
  try { res.status(201).json(await antiHabits.logAntiHabit(userIdOf(req as AuthRequest), req.params.id, { occurred, amount, intensity, note, date })); }
  catch (err) { fail(res, err); }
});

router.delete('/:id', async (req, res) => {
  try { await antiHabits.archiveAntiHabit(userIdOf(req as AuthRequest), req.params.id); res.json({ success: true }); }
  catch (err) { fail(res, err); }
});

router.delete('/logs/:logId', async (req, res) => {
  try { await antiHabits.deleteAntiHabitLog(userIdOf(req as AuthRequest), req.params.logId); res.json({ success: true }); }
  catch (err) { fail(res, err); }
});

export default router;
