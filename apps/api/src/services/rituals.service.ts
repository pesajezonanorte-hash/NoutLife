import { prisma } from '../lib/prisma';
import { settleLevel } from './xp.service';
import { DEFAULT_TIMEZONE, addCalendarDays, getCalendarDay } from '../lib/calendar';

const PRESET_RITUALS = [
  {
    name: 'Mañana de Campeón',
    type: 'morning',
    icon: '☀️',
    steps: [
      { title: 'Tomar un vaso de agua', durationMin: 1, order: 0 },
      { title: 'Estiramientos básicos', durationMin: 5, order: 1 },
      { title: 'Revisar tus metas del día', durationMin: 3, order: 2 },
      { title: 'Meditación o respiración', durationMin: 5, order: 3 },
      { title: 'Desayuno nutritivo', durationMin: 10, order: 4 },
    ],
  },
  {
    name: 'Noche de Descanso',
    type: 'night',
    icon: '🌙',
    steps: [
      { title: 'Sin pantallas 30 min antes', durationMin: null, order: 0 },
      { title: 'Escribir 3 cosas de hoy', durationMin: 5, order: 1 },
      { title: 'Preparar ropa del día siguiente', durationMin: 3, order: 2 },
      { title: 'Lectura tranquila', durationMin: 15, order: 3 },
      { title: 'Respiración para dormir', durationMin: 3, order: 4 },
    ],
  },
  {
    name: 'Reset de Domingo',
    type: 'custom',
    icon: '🔄',
    steps: [
      { title: 'Revisar la semana pasada', durationMin: 10, order: 0 },
      { title: 'Planificar la semana nueva', durationMin: 15, order: 1 },
      { title: 'Limpiar el espacio de trabajo', durationMin: 10, order: 2 },
      { title: 'Meal prep básico', durationMin: 30, order: 3 },
      { title: 'Tiempo libre sin culpa', durationMin: null, order: 4 },
    ],
  },
];

const RITUAL_XP = 30;
const RITUAL_GOLD = 5;

export async function listRituals(userId: string) {
  return prisma.ritual.findMany({
    where: { userId },
    include: { steps: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  });
}

export async function createRitual(
  userId: string,
  data: {
    name: string;
    type: string;
    icon?: string;
    steps?: { title: string; durationMin?: number; order: number }[];
  }
) {
  return prisma.ritual.create({
    data: {
      userId,
      name: data.name,
      type: data.type,
      icon: data.icon ?? '⚡',
      steps: data.steps ? { create: data.steps } : undefined,
    },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
}

export async function updateRitual(
  userId: string,
  ritualId: string,
  data: Partial<{ name: string; type: string; icon: string; isActive: boolean }>
) {
  await prisma.ritual.findFirstOrThrow({ where: { id: ritualId, userId } });
  return prisma.ritual.update({
    where: { id: ritualId },
    data,
    include: { steps: { orderBy: { order: 'asc' } } },
  });
}

export async function deleteRitual(userId: string, ritualId: string) {
  await prisma.ritual.findFirstOrThrow({ where: { id: ritualId, userId } });
  return prisma.ritual.delete({ where: { id: ritualId } });
}

/**
 * Completes a ritual once per local calendar day. The unique ritualId+date
 * index is the authoritative idempotency boundary; the log and rewards are
 * committed in one transaction so a partial completion cannot mint XP/gold.
 */
export async function completeRitual(userId: string, ritualId: string) {
  const ritual = await prisma.ritual.findFirst({
    where: { id: ritualId, userId },
    include: { user: { select: { timezone: true } } },
  });
  if (!ritual) throw new Error('RITUAL_NOT_FOUND');

  const date = getCalendarDay(ritual.user.timezone ?? DEFAULT_TIMEZONE);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Repeat the ownership check inside the transaction so the mutation's
      // authorization and its side effects are one logical operation.
      const ownedRitual = await tx.ritual.findFirst({ where: { id: ritualId, userId }, select: { id: true } });
      if (!ownedRitual) throw new Error('RITUAL_NOT_FOUND');

      const existingLog = await tx.ritualLog.findUnique({
        where: { ritualId_date: { ritualId, date } },
      });
      if (existingLog) {
        return {
          alreadyDone: true,
          xpEarned: 0,
          goldEarned: 0,
          message: '¡Ya completaste este ritual hoy!',
        };
      }

      await tx.ritualLog.create({ data: { ritualId, userId, date } });
      await tx.user.update({
        where: { id: userId },
        data: { xp: { increment: RITUAL_XP }, gold: { increment: RITUAL_GOLD } },
      });

      return {
        alreadyDone: false,
        xpEarned: RITUAL_XP,
        goldEarned: RITUAL_GOLD,
        message: '¡Ritual completado! +30 XP',
      };
    });
    if (!result.alreadyDone) {
      // La XP del ritual también cuenta para subir de nivel y queda en el historial.
      await prisma.xpEvent.create({ data: { userId, xpAmount: RITUAL_XP, goldAmount: RITUAL_GOLD, source: 'ritual', sourceId: ritualId, description: 'Ritual completado' } }).catch(() => null);
      // Si falla, el nivel se pone al día en la próxima recompensa: el ritual ya quedó hecho.
      await settleLevel(userId).catch(() => null);
    }
    return result;
  } catch (error) {
    // Two taps may pass the transaction-local pre-check simultaneously. The
    // database unique key admits one; convert the loser into the same benign,
    // idempotent response instead of an error or a second reward.
    if (!isUniqueConstraintError(error)) throw error;

    const existingLog = await prisma.ritualLog.findFirst({
      where: { ritualId, userId, date },
      select: { id: true },
    });
    if (!existingLog) throw error;

    return {
      alreadyDone: true,
      xpEarned: 0,
      goldEarned: 0,
      message: '¡Ya completaste este ritual hoy!',
    };
  }
}

export async function getRitualStats(userId: string, ritualId: string) {
  const [ritual, logs] = await Promise.all([
    prisma.ritual.findFirst({
      where: { id: ritualId, userId },
      include: { user: { select: { timezone: true } } },
    }),
    prisma.ritualLog.findMany({
      where: { ritualId, userId },
      orderBy: { completedAt: 'desc' },
    }),
  ]);

  const today = getCalendarDay(ritual?.user.timezone ?? DEFAULT_TIMEZONE);
  const thisMonth = logs.filter((log) => (
    log.date.getUTCMonth() === today.getUTCMonth() &&
    log.date.getUTCFullYear() === today.getUTCFullYear()
  ));

  let streak = 0;
  for (let i = 0; i < 30; i += 1) {
    const day = addCalendarDays(today, -i);
    const found = logs.find((log) => log.date.getTime() === day.getTime());
    if (found) streak += 1;
    else break;
  }

  return { totalLogs: logs.length, thisMonth: thisMonth.length, streak };
}

export async function seedPresetRituals(userId: string) {
  const existing = await prisma.ritual.count({ where: { userId } });
  if (existing > 0) return [];

  const created = await Promise.all(
    PRESET_RITUALS.map((r) =>
      prisma.ritual.create({
        data: {
          userId,
          name: r.name,
          type: r.type,
          icon: r.icon,
          steps: {
            create: r.steps.map((s) => ({
              title: s.title,
              durationMin: s.durationMin ?? null,
              order: s.order,
            })),
          },
        },
        include: { steps: { orderBy: { order: 'asc' } } },
      })
    )
  );
  return created;
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002',
  );
}
