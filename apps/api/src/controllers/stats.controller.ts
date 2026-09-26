import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import * as stats from '../services/stats.service';

function sendStatsError(res: Response, error: unknown, operation: string) {
  // Controllers used to let rejected promises escape Express 4. Returning a
  // stable JSON error lets the frontend keep the rest of the dashboard usable.
  console.error(`[STATS_${operation.toUpperCase()}_ERROR]`, error);
  res.status(500).json({ error: 'No se pudieron cargar estas estadísticas.' });
}

export async function summary(req: AuthRequest, res: Response): Promise<void> {
  try {
    const period = (req.query.period as string) ?? 'month';
    res.json(await stats.getStatsSummary(req.userId!, period));
  } catch (error) {
    sendStatsError(res, error, 'summary');
  }
}

export async function xpHistory(req: AuthRequest, res: Response): Promise<void> {
  try {
    const period = (req.query.period as string) ?? 'month';
    res.json(await stats.getXpHistory(req.userId!, period));
  } catch (error) {
    sendStatsError(res, error, 'xp-history');
  }
}

export async function activityRadar(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json(await stats.getActivityRadar(req.userId!));
  } catch (error) {
    sendStatsError(res, error, 'radar');
  }
}

export async function financeTrend(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json(await stats.getFinanceTrend(req.userId!));
  } catch (error) {
    sendStatsError(res, error, 'finance-trend');
  }
}

export async function habitHeatmap(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json(await stats.getHabitHeatmap(req.userId!));
  } catch (error) {
    sendStatsError(res, error, 'heatmap');
  }
}

export async function sleepScatter(req: AuthRequest, res: Response): Promise<void> {
  try {
    const period = (req.query.period as string) ?? 'month';
    res.json(await stats.getSleepScatter(req.userId!, period));
  } catch (error) {
    sendStatsError(res, error, 'sleep');
  }
}

export async function gymProgression(req: AuthRequest, res: Response): Promise<void> {
  try {
    const period = (req.query.period as string) ?? 'month';
    res.json(await stats.getGymProgression(req.userId!, period));
  } catch (error) {
    sendStatsError(res, error, 'gym');
  }
}

export async function predictions(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json(await stats.getPredictions(req.userId!));
  } catch (error) {
    sendStatsError(res, error, 'predictions');
  }
}
