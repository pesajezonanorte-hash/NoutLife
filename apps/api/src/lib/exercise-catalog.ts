import type { PrismaClient } from '@prisma/client';

export const EXERCISE_CATALOG = [
  { name: 'Press de Banca',                muscleGroup: 'Pecho',    equipment: 'Barra' },
  { name: 'Press Inclinado con Mancuernas',muscleGroup: 'Pecho',    equipment: 'Mancuernas' },
  { name: 'Press Declinado',               muscleGroup: 'Pecho',    equipment: 'Barra' },
  { name: 'Aperturas con Mancuernas',      muscleGroup: 'Pecho',    equipment: 'Mancuernas' },
  { name: 'Fondos en Paralelas',           muscleGroup: 'Pecho',    equipment: 'Peso Corporal' },
  { name: 'Flexiones',                     muscleGroup: 'Pecho',    equipment: 'Peso Corporal' },
  { name: 'Dominadas',                     muscleGroup: 'Espalda',  equipment: 'Peso Corporal' },
  { name: 'Remo con Barra',                muscleGroup: 'Espalda',  equipment: 'Barra' },
  { name: 'Remo con Mancuerna',            muscleGroup: 'Espalda',  equipment: 'Mancuernas' },
  { name: 'Jalón al Pecho',                muscleGroup: 'Espalda',  equipment: 'Máquina' },
  { name: 'Peso Muerto',                   muscleGroup: 'Espalda',  equipment: 'Barra' },
  { name: 'Hiperextensiones',              muscleGroup: 'Espalda',  equipment: 'Banco' },
  { name: 'Press Militar',                 muscleGroup: 'Hombros',  equipment: 'Barra' },
  { name: 'Press Arnold',                  muscleGroup: 'Hombros',  equipment: 'Mancuernas' },
  { name: 'Elevaciones Laterales',         muscleGroup: 'Hombros',  equipment: 'Mancuernas' },
  { name: 'Elevaciones Frontales',         muscleGroup: 'Hombros',  equipment: 'Mancuernas' },
  { name: 'Pájaros',                       muscleGroup: 'Hombros',  equipment: 'Mancuernas' },
  { name: 'Curl con Barra',                muscleGroup: 'Bíceps',   equipment: 'Barra' },
  { name: 'Curl con Mancuernas',           muscleGroup: 'Bíceps',   equipment: 'Mancuernas' },
  { name: 'Curl Martillo',                 muscleGroup: 'Bíceps',   equipment: 'Mancuernas' },
  { name: 'Extensión de Tríceps Polea',    muscleGroup: 'Tríceps',  equipment: 'Polea' },
  { name: 'Press Francés',                 muscleGroup: 'Tríceps',  equipment: 'Barra' },
  { name: 'Fondos en Banco',               muscleGroup: 'Tríceps',  equipment: 'Banco' },
  { name: 'Sentadilla',                    muscleGroup: 'Piernas',  equipment: 'Barra' },
  { name: 'Sentadilla Goblet',             muscleGroup: 'Piernas',  equipment: 'Mancuernas' },
  { name: 'Prensa de Piernas',             muscleGroup: 'Piernas',  equipment: 'Máquina' },
  { name: 'Zancadas',                      muscleGroup: 'Piernas',  equipment: 'Mancuernas' },
  { name: 'Extensión de Cuádriceps',       muscleGroup: 'Piernas',  equipment: 'Máquina' },
  { name: 'Curl de Isquiotibiales',        muscleGroup: 'Piernas',  equipment: 'Máquina' },
  { name: 'Peso Muerto Rumano',            muscleGroup: 'Piernas',  equipment: 'Barra' },
  { name: 'Elevación de Gemelos',          muscleGroup: 'Piernas',  equipment: 'Máquina' },
  { name: 'Plancha',                       muscleGroup: 'Core',     equipment: 'Peso Corporal' },
  { name: 'Crunches',                      muscleGroup: 'Core',     equipment: 'Peso Corporal' },
  { name: 'Elevación de Piernas',          muscleGroup: 'Core',     equipment: 'Peso Corporal' },
  { name: 'Russian Twists',                muscleGroup: 'Core',     equipment: 'Peso Corporal' },
  { name: 'Carrera en Cinta',              muscleGroup: 'Cardio',   equipment: 'Máquina' },
  { name: 'Bicicleta Estática',            muscleGroup: 'Cardio',   equipment: 'Máquina' },
  { name: 'Remo Ergómetro',                muscleGroup: 'Cardio',   equipment: 'Máquina' },
  { name: 'Saltar la Cuerda',              muscleGroup: 'Cardio',   equipment: 'Cuerda' },
  { name: 'Burpees',                       muscleGroup: 'Cardio',   equipment: 'Peso Corporal' },
];

export async function ensureExerciseCatalog(client: Pick<PrismaClient, 'exercise'>): Promise<void> {
  for (const ex of EXERCISE_CATALOG) {
    await client.exercise.upsert({
      where: { name: ex.name },
      update: { muscleGroup: ex.muscleGroup, equipment: ex.equipment },
      create: ex,
    });
  }
}
