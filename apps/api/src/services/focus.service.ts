import { prisma } from '../lib/prisma';
import { settleLevel } from './xp.service';

export async function logFocusSession(
  userId: string,
  durationMin: number,
  questId?: string,
  taskLabel?: string,
  sound: { plannedMin?: number; soundtrack?: string } = {},
) {
  const xpEarned = Math.round(durationMin * 2); // 2 XP per minute
  await prisma.$transaction([
    prisma.focusSession.create({
      data: { userId, durationMin, questId, taskLabel, xpEarned, plannedMin: sound.plannedMin, soundtrack: sound.soundtrack },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        xp: { increment: xpEarned },
        gold: { increment: Math.round(durationMin * 0.5) },
        focusMinutesTotal: { increment: durationMin },
      },
    }),
    prisma.xpEvent.create({
      data: {
        userId,
        xpAmount: xpEarned,
        goldAmount: Math.round(durationMin * 0.5),
        source: 'focus',
        description: `Sesión de enfoque: ${durationMin} minutos`,
      },
    }),
  ]);
  await settleLevel(userId);

  return { xpEarned, message: `+${xpEarned} XP por ${durationMin} min de enfoque` };
}

export interface SoundtrackStat {
  id: string;
  sessions: number;
  /** Parte de lo propuesto que se cumplió, 0–1. */
  completion: number;
}

/** Mínimo de sesiones para comparar una banda sonora con otra. */
export const SOUNDTRACK_MIN_SESSIONS = 3;

/**
 * Con qué sonido terminas más tus sesiones: por cada banda sonora, cuánto de lo propuesto cumpliste de
 * media. Primero las que tienen sesiones suficientes; entre ellas, la de mayor cumplimiento.
 */
export function rankSoundtracks(sessions: { soundtrack: string | null; plannedMin: number | null; durationMin: number }[]): SoundtrackStat[] {
  const groups = new Map<string, number[]>();
  for (const s of sessions) {
    if (!s.soundtrack || !s.plannedMin) continue;
    groups.set(s.soundtrack, [...(groups.get(s.soundtrack) ?? []), Math.min(1, s.durationMin / s.plannedMin)]);
  }
  const enough = (stat: SoundtrackStat) => Number(stat.sessions >= SOUNDTRACK_MIN_SESSIONS);
  return [...groups]
    .map(([id, parts]) => ({ id, sessions: parts.length, completion: Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100) / 100 }))
    .sort((a, b) => enough(b) - enough(a) || b.completion - a.completion || b.sessions - a.sessions);
}

export async function getFocusStats(userId: string) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const [totalMinutes, weekSessions, user, recent] = await Promise.all([
    prisma.focusSession.aggregate({
      where: { userId },
      _sum: { durationMin: true },
    }),
    prisma.focusSession.findMany({
      where: { userId, completedAt: { gte: startOfWeek } },
      orderBy: { completedAt: 'desc' },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { focusMinutesTotal: true },
    }),
    // Tres meses de sesiones con sonido: de ahí sale con cuál rindes más.
    prisma.focusSession.findMany({
      where: { userId, soundtrack: { not: null }, completedAt: { gte: new Date(now.getTime() - 90 * 86_400_000) } },
      select: { soundtrack: true, plannedMin: true, durationMin: true },
      take: 500,
    }),
  ]);

  const weekMinutes = weekSessions.reduce((s, sess) => s + sess.durationMin, 0);

  return {
    totalMinutes: totalMinutes._sum.durationMin ?? user.focusMinutesTotal,
    weekMinutes,
    weekSessions: weekSessions.length,
    recentSessions: weekSessions.slice(0, 5),
    soundtracks: rankSoundtracks(recent),
  };
}
