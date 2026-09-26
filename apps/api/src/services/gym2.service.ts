import { prisma } from '../lib/prisma';

// ─── Body Weight ───────────────────────────────────────────────────────────────

export async function logBodyWeight(userId: string, weight: number, date: Date, notes?: string) {
  return prisma.bodyWeight.create({
    data: { userId, weight, date, notes },
  });
}

export async function getBodyWeights(userId: string, from?: Date, to?: Date) {
  return prisma.bodyWeight.findMany({
    where: {
      userId,
      ...(from || to ? { date: { gte: from, lte: to } } : {}),
    },
    orderBy: { date: 'asc' },
  });
}

export async function deleteBodyWeight(userId: string, id: string) {
  return prisma.bodyWeight.deleteMany({ where: { id, userId } });
}

// ─── Progress Photos ───────────────────────────────────────────────────────────

export async function saveProgressPhoto(userId: string, photoData: string, date: Date, notes?: string) {
  const count = await prisma.progressPhoto.count({ where: { userId } });
  if (count >= 24) throw new Error('Máximo 24 fotos de progreso');
  return prisma.progressPhoto.create({ data: { userId, photoData, date, notes } });
}

export async function getProgressPhotos(userId: string) {
  return prisma.progressPhoto.findMany({
    where: { userId },
    orderBy: { date: 'asc' },
    select: { id: true, date: true, notes: true, createdAt: true, photoData: true },
  });
}

export async function deleteProgressPhoto(userId: string, id: string) {
  return prisma.progressPhoto.deleteMany({ where: { id, userId } });
}

// ─── Exercise History ──────────────────────────────────────────────────────────

export async function getExerciseHistory(userId: string, exerciseId: string) {
  const now = new Date();
  const workoutExercises = await prisma.workoutExercise.findMany({
    where: {
      exerciseId,
      workout: { userId, date: { lte: now }, xpEarned: { gt: 0 } },
    },
    include: {
      workout: { select: { date: true, title: true } },
      exercise: { select: { name: true, muscleGroup: true } },
    },
    orderBy: { workout: { date: 'desc' } },
    take: 50,
  });

  const sessions = workoutExercises.map((we) => {
    const sets = (we.sets as Array<{ weight?: number; reps?: number; completed?: boolean }>) ?? [];
    const completedSets = sets.filter((s) => s.completed !== false);
    const maxWeight = completedSets.reduce((max, s) => Math.max(max, s.weight ?? 0), 0);
    const totalVolume = completedSets.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0);
    const bestSet = completedSets.reduce(
      (best, s) => ((s.weight ?? 0) > (best.weight ?? 0) ? s : best),
      {} as { weight?: number; reps?: number }
    );

    return {
      workoutDate: we.workout.date,
      workoutTitle: we.workout.title,
      sets: completedSets,
      maxWeight,
      totalVolume,
      bestSet,
      oneRepMax: bestSet.weight && bestSet.reps
        ? Math.round(bestSet.weight * (1 + bestSet.reps / 30))
        : null,
    };
  });

  const allTimeBest = sessions.reduce(
    (best, s) => (s.maxWeight > best.maxWeight ? s : best),
    { maxWeight: 0, workoutDate: new Date(), bestSet: {} } as (typeof sessions)[0]
  );

  return {
    exercise: workoutExercises[0]?.exercise ?? null,
    sessions,
    allTimeBest: sessions.length ? allTimeBest : null,
    totalSessions: sessions.length,
  };
}

// ─── Weekly Volume by Muscle ───────────────────────────────────────────────────

export async function getWeeklyVolume(userId: string) {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const workoutExercises = await prisma.workoutExercise.findMany({
    where: { workout: { userId, date: { gte: weekAgo, lte: now }, xpEarned: { gt: 0 } } },
    include: { exercise: { select: { muscleGroup: true, name: true } } },
  });

  const volumeByMuscle: Record<string, { sets: number; volume: number }> = {};

  for (const we of workoutExercises) {
    const muscle = we.exercise.muscleGroup ?? 'Otros';
    const sets = (we.sets as Array<{ weight?: number; reps?: number; completed?: boolean }>) ?? [];
    const doneSets = sets.filter((s) => s.completed !== false);
    if (!volumeByMuscle[muscle]) volumeByMuscle[muscle] = { sets: 0, volume: 0 };
    volumeByMuscle[muscle].sets += doneSets.length;
    volumeByMuscle[muscle].volume += doneSets.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0);
  }

  return volumeByMuscle;
}

// ─── 1RM Calculator (Epley formula) ───────────────────────────────────────────

export function calculate1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}
