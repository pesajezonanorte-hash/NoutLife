-- Walks and general cardio can be logged next to strength sessions.
CREATE TYPE "WorkoutKind" AS ENUM ('STRENGTH', 'WALK', 'CARDIO');
ALTER TABLE "workouts" ADD COLUMN "kind" "WorkoutKind" NOT NULL DEFAULT 'STRENGTH';
ALTER TABLE "workouts" ADD COLUMN "distanceKm" DOUBLE PRECISION;
