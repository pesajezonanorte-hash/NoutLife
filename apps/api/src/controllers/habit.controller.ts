import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import * as habitService from '../services/habit.service';

export async function listHabits(req: AuthRequest, res: Response): Promise<void> {
  try {
    const habits = await habitService.listHabits(req.userId!);
    res.json({ habits });
  } catch {
    res.status(500).json({ error: 'Error al obtener hábitos.' });
  }
}

export async function createHabit(req: AuthRequest, res: Response): Promise<void> {
  try {
    const habit = await habitService.createHabit(req.userId!, req.body);
    res.status(201).json({ habit });
  } catch {
    res.status(500).json({ error: 'Error al crear el hábito.' });
  }
}

export async function getHabit(req: AuthRequest, res: Response): Promise<void> {
  try {
    const habit = await habitService.getHabitById(req.userId!, req.params.id);
    if (!habit) { res.status(404).json({ error: 'Hábito no encontrado.' }); return; }
    res.json({ habit });
  } catch {
    res.status(500).json({ error: 'Error al obtener el hábito.' });
  }
}

export async function updateHabit(req: AuthRequest, res: Response): Promise<void> {
  try {
    const habit = await habitService.updateHabit(req.userId!, req.params.id, req.body);
    res.json({ habit });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'HABIT_NOT_FOUND') { res.status(404).json({ error: 'Hábito no encontrado.' }); return; }
    res.status(500).json({ error: 'Error al actualizar el hábito.' });
  }
}

export async function archiveHabit(req: AuthRequest, res: Response): Promise<void> {
  try {
    await habitService.archiveHabit(req.userId!, req.params.id);
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'HABIT_NOT_FOUND') { res.status(404).json({ error: 'Hábito no encontrado.' }); return; }
    res.status(500).json({ error: 'Error al archivar el hábito.' });
  }
}

export async function logHabit(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { status, notes, date } = req.body;
    const result = await habitService.logHabit(req.userId!, req.params.id, status, notes, date);
    res.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'HABIT_NOT_FOUND') { res.status(404).json({ error: 'Hábito no encontrado.' }); return; }
    if (msg === 'HABIT_ALREADY_COMPLETED') {
      res.status(409).json({ error: 'Este hábito ya fue completado para esa fecha; su XP ya está registrada.' });
      return;
    }
    if (msg === 'INVALID_HABIT_LOG_DATE' || msg === 'HABIT_LOG_FUTURE_DATE') {
      res.status(400).json({
        error: 'Datos inválidos',
        details: [{
          field: 'date',
          message: msg === 'HABIT_LOG_FUTURE_DATE'
            ? 'No puedes registrar hábitos en una fecha futura.'
            : 'La fecha debe tener el formato calendario YYYY-MM-DD y ser real.',
        }],
      });
      return;
    }
    res.status(500).json({ error: 'Error al registrar el hábito.' });
  }
}

export async function getHabitHeatmap(req: AuthRequest, res: Response): Promise<void> {
  try {
    const days = parseInt(req.query.days as string) || 90;
    const heatmap = await habitService.getHabitHeatmap(req.userId!, req.params.id, days);
    res.json({ heatmap });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'HABIT_NOT_FOUND') { res.status(404).json({ error: 'Hábito no encontrado.' }); return; }
    res.status(500).json({ error: 'Error al obtener el heatmap.' });
  }
}
