export interface WorkoutSet {
  id: string;
  weight?: number;
  reps?: number;
  duration?: number;
  completed: boolean;
}

export interface WorkoutExercise {
  id: string;
  workoutId: string;
  exerciseId: string;
  exerciseName: string;
  muscleGroup?: string;
  sets: WorkoutSet[];
  notes?: string;
  order: number;
}

export interface Workout {
  id: string;
  userId: string;
  title: string;
  notes?: string;
  duration?: number;
  date: string;
  xpEarned: number;
  goldEarned: number;
  routineDayId?: string | null;
  attendanceId?: string | null;
  exercises: WorkoutExercise[];
  createdAt: string;
  updatedAt: string;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup?: string;
  equipment?: string;
}

export interface RoutineExercise {
  exerciseId: string;
  name: string;
  sets: number;
  reps?: number;
  weight?: number;
  notes?: string;
}

export interface RoutineTargetSet {
  weight?: number;
  reps?: number;
  duration?: number;
}

export interface RoutineDayExercise {
  id: string;
  routineDayId: string;
  exerciseId: string;
  targetSets: RoutineTargetSet[];
  notes?: string;
  order: number;
  exercise: Exercise;
}

export interface RoutineDay {
  id: string;
  routineId: string;
  weekday: number;
  title?: string;
  isRestDay: boolean;
  exercises: RoutineDayExercise[];
}

export interface Routine {
  id: string;
  userId: string;
  name: string;
  description?: string;
  // Legacy fields remain available for saved routines created before weekly days.
  exercises: RoutineExercise[];
  targetDays: string[];
  estimatedDuration?: number;
  isActive: boolean;
  days: RoutineDay[];
  createdAt: string;
  updatedAt: string;
}

export interface ExerciseProgress {
  date: string;
  maxWeight: number;
  totalVolume: number;
  sets: WorkoutSet[];
}
