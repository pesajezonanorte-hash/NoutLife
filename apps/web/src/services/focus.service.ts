import api from '../lib/api';

export interface FocusStats {
  totalMinutes: number;
  weekMinutes: number;
  weekSessions: number;
  recentSessions: { id: string; durationMin: number; taskLabel: string | null; completedAt: string }[];
  /** Con qué sonido se cumplen más las sesiones, el mejor primero (0–1 de lo propuesto). */
  soundtracks?: { id: string; sessions: number; completion: number }[];
}

export async function logFocusSession(
  durationMin: number,
  questId?: string,
  taskLabel?: string,
  /** Lo que se propuso y con qué sonó: de ahí la app aprende con qué sonido terminas más. */
  sound: { plannedMin?: number; soundtrack?: string } = {},
): Promise<{ xpEarned: number; message: string }> {
  const { data } = await api.post('/focus/complete', { durationMin, questId, taskLabel, ...sound });
  return data;
}

export async function getFocusStats(): Promise<FocusStats> {
  const { data } = await api.get('/focus/stats');
  return data;
}
