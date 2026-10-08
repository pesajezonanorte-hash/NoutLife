import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import * as svc from '../services/sleep.service';

const s = (l: { createdAt: Date; date: Date; bedtime: Date; wakeTime: Date; [k: string]: unknown }) => ({
  ...l,
  date: l.date.toISOString(),
  bedtime: l.bedtime.toISOString(),
  wakeTime: l.wakeTime.toISOString(),
  createdAt: l.createdAt.toISOString(),
});

export async function listSleep(req: AuthRequest, res: Response): Promise<void> {
  try {
    const logs = await svc.listSleep(req.userId!, req.query.month as string);
    res.json({ logs: logs.map(s) });
  } catch { res.status(500).json({ error: 'Error al obtener registros de sueño.' }); }
}

export async function createSleep(req: AuthRequest, res: Response): Promise<void> {
  try {
    const log = await svc.createSleep(req.userId!, req.body);
    res.status(201).json({ log: s(log) });
  } catch (err) {
    if (err instanceof Error && err.message === 'SLEEP_DURATION_INVALID') {
      res.status(400).json({ error: 'La duración no es válida: siestas de 5 min a 4 h, noches de 30 min a 12 h.' });
      return;
    }
    res.status(500).json({ error: 'Error al registrar sueño.' });
  }
}

export async function updateSleep(req: AuthRequest, res: Response): Promise<void> {
  try {
    const log = await svc.updateSleep(req.userId!, req.params.id, req.body);
    res.json({ log: s(log) });
  } catch (err) {
    if (err instanceof Error && err.message === 'SLEEP_NOT_FOUND') {
      res.status(404).json({ error: 'Registro de sueño no encontrado.' });
      return;
    }
    if (err instanceof Error && err.message === 'SLEEP_DURATION_INVALID') {
      res.status(400).json({ error: 'La duración no es válida: siestas de 5 min a 4 h, noches de 30 min a 12 h.' });
      return;
    }
    res.status(500).json({ error: 'Error al actualizar sueño.' });
  }
}

export async function deleteSleep(req: AuthRequest, res: Response): Promise<void> {
  try {
    await svc.deleteSleep(req.userId!, req.params.id);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Error al eliminar registro.' }); }
}

export async function getSleepStats(req: AuthRequest, res: Response): Promise<void> {
  try {
    const stats = await svc.getSleepStats(req.userId!);
    res.json({ stats });
  } catch { res.status(500).json({ error: 'Error al obtener estadísticas.' }); }
}
