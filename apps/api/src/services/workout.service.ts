import { prisma } from '../lib/prisma';
import { awardXpAndGold } from './xp.service';
import { createNotification } from './notification.service';
import { listGymAttendances, recordManualGymAttendance, recordWorkoutGymAttendance } from './gym-attendance.service';

function calcWorkoutXp(durationMinutes: number, totalVolume: number): number {
  const durationXp = Math.min(durationMinutes * 2, 100);
  const volumeXp = Math.min(Math.floor(totalVolume / 500), 50);
  return durationXp + volumeXp + 20;
}

export async function listWorkouts(userId: string, limit = 20) {
  return prisma.workout.findMany({
    where: { userId },
    include: { exercises: { include: { exercise: true }, orderBy: { order: 'asc' } } },
    orderBy: { date: 'desc' },
    take: limit,
  });
}

export async function getWorkout(userId: string, id: string) {
  return prisma.workout.findFirst({
    where: { id, userId },
    include: { exercises: { include: { exercise: true }, orderBy: { order: 'asc' } } },
  });
}

export async function createWorkout(userId: string, body: { title: string; date?: string; notes?: string; routineDayId?: string }) {
  if (body.routineDayId) {
    const routineDay = await prisma.routineDay.findFirst({ where: { id: body.routineDayId, routine: { userId } }, select: { id: true } });
    if (!routineDay) throw new Error('ROUTINE_DAY_NOT_FOUND');
  }

  return prisma.workout.create({
    data: {
      userId,
      title: body.title,
      date: body.date ? new Date(body.date) : new Date(),
      notes: body.notes,
      routineDayId: body.routineDayId,
    },
    include: { exercises: { include: { exercise: true } } },
  });
}

export async function updateWorkout(userId: string, id: string, body: Record<string, unknown>) {
  const { exercises, ...rest } = body as { exercises?: Array<{ exerciseId: string; sets: unknown[]; notes?: string; order?: number }>; [key: string]: unknown };

  const workout = await prisma.workout.update({
    where: { id, userId },
    data: {
      ...(rest.title ? { title: rest.title as string } : {}),
      ...(rest.notes !== undefined ? { notes: rest.notes as string } : {}),
      ...(rest.duration ? { duration: rest.duration as number } : {}),
    },
  });

  if (exercises) {
    await prisma.workoutExercise.deleteMany({ where: { workoutId: id } });
    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i];
      await prisma.workoutExercise.create({
        data: {
          workoutId: id,
          exerciseId: ex.exerciseId,
          sets: ex.sets as never,
          notes: ex.notes,
          order: ex.order ?? i,
        },
      });
    }
  }

  return prisma.workout.findFirst({
    where: { id },
    include: { exercises: { include: { exercise: true }, orderBy: { order: 'asc' } } },
  });
}

export async function finishWorkout(userId: string, id: string, body: { notes?: string; duration?: number; exercises?: Array<{ exerciseId: string; sets: Array<{ weight?: number; reps?: number; completed: boolean }>; notes?: string; order?: number }> }) {
  // Finishing is the point at which rewards and the stats event are written.
  // Guard it explicitly so a retry/double click cannot farm XP or corrupt the
  // workout timeline with multiple reward events.
  const existing = await prisma.workout.findFirst({
    where: { id, userId },
    select: { id: true, xpEarned: true, date: true },
  });
  if (!existing) throw new Error('WORKOUT_NOT_FOUND');
  if (existing.xpEarned > 0) throw new Error('WORKOUT_ALREADY_FINISHED');

  if (body.exercises) {
    await prisma.workoutExercise.deleteMany({ where: { workoutId: id } });
    for (let i = 0; i < body.exercises.length; i++) {
      const ex = body.exercises[i];
      await prisma.workoutExercise.create({
        data: { workoutId: id, exerciseId: ex.exerciseId, sets: ex.sets as never, notes: ex.notes, order: ex.order ?? i },
      });
    }
  }

  const durationMinutes = body.duration ?? 45;
  const exercises = await prisma.workoutExercise.findMany({ where: { workoutId: id }, include: { exercise: true } });
  const totalVolume = (exercises as Array<{ sets: Array<{ weight?: number; reps?: number; completed?: boolean }> }>).reduce((acc, we) => {
    return acc + we.sets.filter(s => s.completed).reduce((a, s) => a + ((s.weight ?? 0) * (s.reps ?? 1)), 0);
  }, 0);

  const xp = calcWorkoutXp(durationMinutes, totalVolume);
  const gold = Math.floor(xp * 0.3);
  // Validate/record the visit before granting rewards so a future-dated draft
  // cannot become a completed workout with XP but no valid attendance.
  const attendance = await recordWorkoutGymAttendance(userId, existing.date);
  const result = await awardXpAndGold(userId, xp, gold, 'workout', { sourceId: id, description: 'Entrenamiento completado' });

  const workout = await prisma.workout.update({
    where: { id, userId },
    data: { duration: durationMinutes, notes: body.notes, xpEarned: xp, goldEarned: gold, attendanceId: attendance.id },
    include: { exercises: { include: { exercise: true }, orderBy: { order: 'asc' } } },
  });

  createNotification(userId, {
    type: 'workout',
    category: 'GYM',
    dedupeKey: `workout-${id}`,
    title: `🏋️ "${workout.title}" completado`,
    body: `+${result.xpGained} XP por tu entrenamiento.`,
    icon: '🏋️',
    link: '/gym',
  }).catch(() => {});

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return { workout, rewards: result, user };
}

export async function deleteWorkout(userId: string, id: string) {
  const workout = await prisma.workout.findFirst({
    where: { id, userId },
    select: { id: true, xpEarned: true },
  });
  if (!workout) throw new Error('WORKOUT_NOT_FOUND');

  // Deleting a rewarded session would leave its XP event in the ledger while
  // removing the session from gym stats. Completed workouts remain editable,
  // but are intentionally protected from deletion until a true reward reversal
  // flow exists.
  if (workout.xpEarned > 0) throw new Error('WORKOUT_COMPLETED_CANNOT_DELETE');
  return prisma.workout.delete({ where: { id } });
}

export async function listExercises(search?: string, muscleGroup?: string) {
  return prisma.exercise.findMany({
    where: {
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
      ...(muscleGroup && { muscleGroup: { equals: muscleGroup, mode: 'insensitive' } }),
    },
    orderBy: { name: 'asc' },
    take: 100,
  });
}

export async function getExerciseProgress(userId: string, exerciseId: string) {
  const workoutExercises = await prisma.workoutExercise.findMany({
    where: { exerciseId, workout: { userId } },
    include: { workout: true },
    orderBy: { workout: { date: 'asc' } },
  });

  return workoutExercises.map(we => {
    const sets = we.sets as Array<{ weight?: number; reps?: number; completed?: boolean }>;
    const maxWeight = Math.max(0, ...sets.filter(s => s.completed).map(s => s.weight ?? 0));
    const totalVolume = sets.filter(s => s.completed).reduce((a, s) => a + ((s.weight ?? 0) * (s.reps ?? 1)), 0);
    return { date: we.workout.date.toISOString(), maxWeight, totalVolume, sets };
  });
}

type RoutineDayInput = {
  weekday: number;
  title?: string;
  isRestDay?: boolean;
  exercises?: Array<{
    exerciseId: string;
    targetSets?: unknown;
    // Legacy clients may still provide a set count and repetitions.
    sets?: number;
    reps?: number;
    notes?: string;
    order?: number;
  }>;
};

function normalizeRoutineDays(value: unknown): RoutineDayInput[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error('INVALID_ROUTINE_DAYS');

  const seen = new Set<number>();
  return value.map((raw) => {
    if (!raw || typeof raw !== 'object') throw new Error('INVALID_ROUTINE_DAY');
    const day = raw as RoutineDayInput;
    if (!Number.isInteger(day.weekday) || day.weekday < 0 || day.weekday > 6 || seen.has(day.weekday)) {
      throw new Error('INVALID_ROUTINE_WEEKDAY');
    }
    seen.add(day.weekday);
    return {
      weekday: day.weekday,
      title: typeof day.title === 'string' ? day.title.slice(0, 100) : undefined,
      isRestDay: Boolean(day.isRestDay),
      exercises: Array.isArray(day.exercises) ? day.exercises : [],
    };
  });
}

function routineDayCreateData(days: RoutineDayInput[]) {
  return days.map((day) => ({
    weekday: day.weekday,
    title: day.title,
    isRestDay: day.isRestDay,
    exercises: {
      create: (day.exercises ?? []).map((exercise, index) => ({
        exerciseId: exercise.exerciseId,
        targetSets: (exercise.targetSets ?? Array.from({ length: Math.max(0, exercise.sets ?? 0) }, () => ({ reps: exercise.reps }))) as never,
        notes: exercise.notes,
        order: exercise.order ?? index,
      })),
    },
  }));
}

const routineInclude = {
  days: {
    orderBy: { weekday: 'asc' as const },
    include: { exercises: { orderBy: { order: 'asc' as const }, include: { exercise: true } } },
  },
};

export async function listRoutines(userId: string) {
  return prisma.routine.findMany({ where: { userId }, include: routineInclude, orderBy: { createdAt: 'desc' } });
}

export async function createRoutine(userId: string, body: Record<string, unknown>) {
  const days = normalizeRoutineDays(body.days);
  return prisma.routine.create({
    data: {
      userId,
      name: body.name as string,
      description: body.description as string | undefined,
      exercises: (body.exercises as never) ?? [],
      targetDays: (body.targetDays as never) ?? [],
      estimatedDuration: body.estimatedDuration as number | undefined,
      isActive: body.isActive === undefined ? true : Boolean(body.isActive),
      ...(days ? { days: { create: routineDayCreateData(days) } } : {}),
    },
    include: routineInclude,
  });
}

export async function updateRoutine(userId: string, id: string, body: Record<string, unknown>) {
  const days = normalizeRoutineDays(body.days);
  const routine = await prisma.routine.update({
    where: { id, userId },
    data: {
      ...(body.name ? { name: body.name as string } : {}),
      ...(body.description !== undefined ? { description: body.description as string } : {}),
      ...(body.exercises ? { exercises: body.exercises as never } : {}),
      ...(body.targetDays ? { targetDays: body.targetDays as never } : {}),
      ...(body.estimatedDuration !== undefined ? { estimatedDuration: body.estimatedDuration as number } : {}),
      ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
    },
  });

  if (days !== undefined) {
    await prisma.routineDay.deleteMany({ where: { routineId: routine.id } });
    if (days.length > 0) {
      await prisma.routineDay.createMany({
        data: days.map((day) => ({ routineId: routine.id, weekday: day.weekday, title: day.title, isRestDay: day.isRestDay })),
      });
      // createMany does not return IDs; create the exercise rows through each day.
      for (const day of days) {
        const persisted = await prisma.routineDay.findUniqueOrThrow({ where: { routineId_weekday: { routineId: routine.id, weekday: day.weekday } } });
        if (day.exercises?.length) {
          await prisma.routineDayExercise.createMany({
            data: day.exercises.map((exercise, index) => ({
              routineDayId: persisted.id,
              exerciseId: exercise.exerciseId,
              targetSets: (exercise.targetSets ?? Array.from({ length: Math.max(0, exercise.sets ?? 0) }, () => ({ reps: exercise.reps }))) as never,
              notes: exercise.notes,
              order: exercise.order ?? index,
            })),
          });
        }
      }
    }
  }

  return prisma.routine.findUniqueOrThrow({ where: { id: routine.id }, include: routineInclude });
}

export async function deleteRoutine(userId: string, id: string) {
  return prisma.routine.delete({ where: { id, userId } });
}

export async function listAttendances(userId: string, from?: string, to?: string) {
  return listGymAttendances(userId, from, to);
}

export async function recordAttendance(userId: string, date?: string) {
  return recordManualGymAttendance(userId, date);
}
