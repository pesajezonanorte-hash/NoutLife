import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import * as dashboardService from '../services/dashboard.service';

export async function getDashboard(req: AuthRequest, res: Response): Promise<void> {
  try {
    const data = await dashboardService.getDashboard(req.userId!);
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Error al cargar el castillo.' });
  }
}

export async function getTodayQuests(req: AuthRequest, res: Response): Promise<void> {
  try {
    const quests = await dashboardService.getTodayQuests(req.userId!);
    res.json({ quests });
  } catch {
    res.status(500).json({ error: 'Error al cargar misiones del día.' });
  }
}

/** Focused daily snapshot used by the Castle's Plan de hoy. */
export async function getTodayPlan(req: AuthRequest, res: Response): Promise<void> {
  try {
    const plan = await dashboardService.getTodayPlan(req.userId!);
    res.json(plan);
  } catch {
    res.status(500).json({ error: 'Error al preparar el plan de hoy.' });
  }
}
