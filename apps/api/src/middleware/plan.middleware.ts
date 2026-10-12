import type { NextFunction, Response } from 'express';
import type { AuthRequest } from './auth.middleware';
import { prisma } from '../lib/prisma';
import { LITE_LIMITS } from '../lib/plans';
import { getPlan } from '../services/billing.service';

/** Funciones que Lite limita. El cliente abre el modal de Pro con el mensaje de cada una. */
export type ProFeature = 'habits' | 'history' | 'ai';

export const PRO_MESSAGES: Record<ProFeature, string> = {
  habits: `NoutLife Lite admite ${LITE_LIMITS.activeHabits} hábitos activos. Con Pro no hay límite.`,
  history: `NoutLife Lite muestra tus últimos ${LITE_LIMITS.historyDays} días. Con Pro ves todo tu historial.`,
  ai: 'Actualiza a Pro para desbloquear los análisis de IA y más mensajes con el Sabio.',
};

/** 402 Payment Required: `error` es el texto para la persona; el cliente lo reconoce por `code: 'PRO_REQUIRED'`. */
export function sendProRequired(res: Response, feature: ProFeature): void {
  res.status(402).json({ error: PRO_MESSAGES[feature], code: 'PRO_REQUIRED', feature });
}

/** Solo Pro (análisis de IA del Sabio). */
export function requirePro(feature: ProFeature) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if ((await getPlan(req.userId!)) === 'pro') { next(); return; }
      sendProRequired(res, feature);
    } catch (err) {
      next(err);
    }
  };
}

/** Lite: como mucho LITE_LIMITS.activeHabits hábitos activos. Los que ya existían se conservan. */
export async function limitActiveHabits(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if ((await getPlan(req.userId!)) === 'pro') { next(); return; }
    const active = await prisma.habit.count({ where: { userId: req.userId!, isActive: true } });
    if (active >= LITE_LIMITS.activeHabits) { sendProRequired(res, 'habits'); return; }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Lite: el historial y las estadísticas se recortan a los últimos
 * LITE_LIMITS.historyDays días. Deja la ventana en `req.historyDays`
 * (undefined = sin recorte) y fuerza el periodo semanal de /stats.
 */
export async function liteHistoryWindow(req: AuthRequest & { historyDays?: number }, res: Response, next: NextFunction): Promise<void> {
  try {
    if ((await getPlan(req.userId!)) === 'pro') { next(); return; }
    req.historyDays = LITE_LIMITS.historyDays;
    if (typeof req.query.period === 'string' || req.baseUrl.endsWith('/stats')) req.query.period = 'week';
    res.setHeader('X-Plan-Limit', `history-${LITE_LIMITS.historyDays}d`);
    next();
  } catch (err) {
    next(err);
  }
}

/** Primer día visible (00:00) de una ventana de `days` días que termina hoy. */
export function historyWindowStart(days: number, now = new Date()): Date {
  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  return start;
}
