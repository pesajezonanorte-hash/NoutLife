// Rituales y Higiene Personal: un hábito puede ser un ritual (pasos ordenados que
// se marcan uno a uno) y la categoría Higiene Personal se enlaza con una rutina de
// Cuidado Personal (Espejo) en los dos sentidos. Completar en una vista marca la
// otra. Las recompensas (XP y oro) se dan una sola vez: en la vista donde se
// completó primero. La otra vista solo refleja el estado, sin premiar de nuevo.
//
// Sin imports de habit.service: ese servicio llama a este, no al revés.
import { prisma } from '../lib/prisma';

/** Un ritual guarda como mucho este número de pasos. */
export const MAX_RITUAL_STEPS = 12;

/** Títulos de pasos limpios: sin espacios sobrantes, sin vacíos y con tope. */
export function cleanStepTitles(titles: readonly string[] | undefined | null): string[] {
  return (titles ?? [])
    .map((t) => t.trim().slice(0, 100))
    .filter((t) => t.length > 0)
    .slice(0, MAX_RITUAL_STEPS);
}

/**
 * Pone los pasos de un hábito igual que `titles`. Conserva el id de cada paso
 * por posición: así el progreso de hoy sobrevive a un cambio de texto.
 */
export async function replaceSteps(habitId: string, titles: string[]): Promise<void> {
  const current = await prisma.habitStep.findMany({ where: { habitId }, orderBy: { order: 'asc' } });
  const ops = [];
  for (let i = 0; i < Math.max(current.length, titles.length); i += 1) {
    const row = current[i];
    const title = titles[i];
    if (row && title === undefined) ops.push(prisma.habitStep.delete({ where: { id: row.id } }));
    else if (row && row.title !== title) ops.push(prisma.habitStep.update({ where: { id: row.id }, data: { title, order: i } }));
    else if (row && row.order !== i) ops.push(prisma.habitStep.update({ where: { id: row.id }, data: { order: i } }));
    else if (!row && title !== undefined) ops.push(prisma.habitStep.create({ data: { habitId, title, order: i } }));
  }
  if (ops.length) await prisma.$transaction(ops);
}

/**
 * Hábito de Higiene Personal → rutina de Cuidado Personal enlazada. Crea la
 * rutina si falta, la actualiza si cambió y la desactiva al archivar el hábito o
 * al quitarle la categoría (en ese caso también se rompe el enlace).
 */
export async function syncHabitToCare(userId: string, habitId: string): Promise<void> {
  const habit = await prisma.habit.findFirst({
    where: { id: habitId, userId },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
  if (!habit) return;
  const names = habit.steps.map((s) => s.title);

  if (!habit.isActive) {
    if (habit.careRoutineId) await prisma.careRoutine.update({ where: { id: habit.careRoutineId }, data: { isActive: false } });
    return;
  }
  if (habit.category !== 'HYGIENE') {
    if (habit.careRoutineId) {
      await prisma.$transaction([
        prisma.careRoutine.update({ where: { id: habit.careRoutineId }, data: { isActive: false } }),
        prisma.habit.update({ where: { id: habit.id }, data: { careRoutineId: null } }),
      ]);
    }
    return;
  }

  const stepsData = names.map((name, order) => ({ name, order }));
  if (habit.careRoutineId) {
    await prisma.careRoutine.update({
      where: { id: habit.careRoutineId },
      data: { name: habit.title, isActive: true, steps: { deleteMany: {}, create: stepsData } },
    });
    return;
  }
  const routine = await prisma.careRoutine.create({
    data: { userId, name: habit.title, timeOfDay: 'custom', steps: { create: stepsData } },
  });
  await prisma.habit.update({ where: { id: habit.id }, data: { careRoutineId: routine.id } });
}

/**
 * Rutina de Cuidado Personal (Espejo) → hábito de Higiene Personal enlazado en
 * la Libreta. Crea el hábito si la rutina es nueva; si no, lo actualiza. Una
 * rutina desactivada archiva su hábito.
 */
export async function syncRoutineToHabit(userId: string, routineId: string): Promise<void> {
  const routine = await prisma.careRoutine.findFirst({
    where: { id: routineId, userId },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
  if (!routine) return;
  const habit = await prisma.habit.findFirst({ where: { userId, careRoutineId: routineId }, select: { id: true } });
  const names = routine.steps.map((s) => s.name);
  const kind = names.length ? 'ritual' : 'habit';

  if (!routine.isActive) {
    if (habit) await prisma.habit.update({ where: { id: habit.id }, data: { isActive: false } });
    return;
  }
  if (habit) {
    await prisma.habit.update({ where: { id: habit.id }, data: { title: routine.name, isActive: true, kind } });
    await replaceSteps(habit.id, names);
    return;
  }
  await prisma.habit.create({
    data: {
      userId,
      title: routine.name,
      category: 'HYGIENE',
      kind,
      icon: '🧴',
      careRoutineId: routine.id,
      steps: { create: names.map((title, order) => ({ title, order })) },
    },
  });
}

/** Hábito completado en un día → rutina de Espejo marcada (la recompensa ya fue del hábito). */
export async function markCareDoneForHabit(userId: string, careRoutineId: string, date: Date, isToday: boolean): Promise<void> {
  const existing = await prisma.careLog.findFirst({ where: { userId, routineId: careRoutineId, date } });
  if (!existing) await prisma.careLog.create({ data: { userId, routineId: careRoutineId, date } });
  if (isToday) await prisma.careRoutine.update({ where: { id: careRoutineId }, data: { lastDoneAt: new Date() } });
}

/** Hábito deshecho → se quita la marca de Espejo de ese día. */
export async function clearCareDoneForHabit(userId: string, careRoutineId: string, date: Date, isToday: boolean): Promise<void> {
  await prisma.careLog.deleteMany({ where: { userId, routineId: careRoutineId, date } });
  if (isToday) await prisma.careRoutine.updateMany({ where: { id: careRoutineId, userId }, data: { lastDoneAt: null } });
}

/** Rutina completada desde Espejo → hábito enlazado completado ese día, sin recompensa de nuevo. */
export async function markHabitDoneFromCare(userId: string, careRoutineId: string, date: Date): Promise<void> {
  const habit = await prisma.habit.findFirst({ where: { userId, careRoutineId, isActive: true }, select: { id: true, kind: true } });
  if (!habit) return;
  const log = await prisma.habitLog.findUnique({ where: { habitId_date: { habitId: habit.id, date } } });
  if (!log) {
    await prisma.habitLog.create({
      data: { userId, habitId: habit.id, date, completed: true, status: 'completed', rewardsGranted: true },
    });
  } else if (!log.completed) {
    await prisma.habitLog.update({ where: { id: log.id }, data: { completed: true, status: 'completed' } });
  }
  if (habit.kind === 'ritual') await fillStepsForDay(userId, habit.id, date);
}

/** Marca todos los pasos de un ritual para un día. */
export async function fillStepsForDay(userId: string, habitId: string, date: Date): Promise<void> {
  const steps = await prisma.habitStep.findMany({ where: { habitId }, select: { id: true } });
  if (!steps.length) return;
  const done = await prisma.habitStepLog.findMany({ where: { habitId, date }, select: { stepId: true } });
  const doneIds = new Set(done.map((d) => d.stepId));
  const missing = steps.filter((s) => !doneIds.has(s.id));
  if (missing.length) {
    await prisma.habitStepLog.createMany({
      data: missing.map((s) => ({ stepId: s.id, habitId, userId, date })),
      skipDuplicates: true,
    });
  }
}

/** Quita los pasos marcados de un ritual en un día. */
export async function clearStepsForDay(habitId: string, date: Date): Promise<void> {
  await prisma.habitStepLog.deleteMany({ where: { habitId, date } });
}
