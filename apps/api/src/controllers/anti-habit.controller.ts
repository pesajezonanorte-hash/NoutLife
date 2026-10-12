import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import * as svc from '../services/anti-habit.service';

function fail(res: Response, err: unknown, fallback: string): void {
  if (err instanceof Error && err.message === 'ANTI_HABIT_NOT_FOUND') {
    res.status(404).json({ error: 'Obstáculo no encontrado.' });
    return;
  }
  res.status(500).json({ error: fallback });
}

export async function listAntiHabits(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json({ antiHabits: await svc.listAntiHabits(req.userId!) });
  } catch (err) { fail(res, err, 'Error al obtener los obstáculos.'); }
}

export async function createAntiHabit(req: AuthRequest, res: Response): Promise<void> {
  try {
    const antiHabit = await svc.createAntiHabit(req.userId!, req.body);
    res.status(201).json({ antiHabit });
  } catch (err) { fail(res, err, 'Error al crear el obstáculo.'); }
}

export async function deleteAntiHabit(req: AuthRequest, res: Response): Promise<void> {
  try {
    await svc.deleteAntiHabit(req.userId!, req.params.id);
    res.json({ success: true });
  } catch (err) { fail(res, err, 'Error al eliminar el obstáculo.'); }
}

export async function logSlip(req: AuthRequest, res: Response): Promise<void> {
  try {
    await svc.logSlip(req.userId!, req.params.id, req.body?.note);
    const antiHabits = await svc.listAntiHabits(req.userId!);
    res.status(201).json({ antiHabit: antiHabits.find((habit) => habit.id === req.params.id) ?? null });
  } catch (err) { fail(res, err, 'Error al registrar la caída.'); }
}
