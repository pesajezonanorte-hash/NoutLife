// Nombres de ejercicio, grupo muscular y equipo según el idioma. El catálogo llega de la
// API en español (y los ejercicios propios se guardan tal cual los escribió la persona), así
// que aquí solo se traduce la presentación. La lógica (descansos, fatiga) sigue usando el
// nombre original. Si no hay traducción, se muestra el texto que llegó.
import type { Locale } from '@/lib/locale';

const EXERCISE_EN: Record<string, string> = {
  'Press de Banca': 'Bench Press',
  'Press Inclinado con Mancuernas': 'Incline Dumbbell Press',
  'Press Declinado': 'Decline Press',
  'Aperturas con Mancuernas': 'Dumbbell Flyes',
  'Fondos en Paralelas': 'Parallel Bar Dips',
  'Flexiones': 'Push-ups',
  'Dominadas': 'Pull-ups',
  'Remo con Barra': 'Barbell Row',
  'Remo con Mancuerna': 'One-Arm Dumbbell Row',
  'Jalón al Pecho': 'Lat Pulldown',
  'Peso Muerto': 'Deadlift',
  'Hiperextensiones': 'Back Extensions',
  'Press Militar': 'Overhead Press',
  'Press Arnold': 'Arnold Press',
  'Elevaciones Laterales': 'Lateral Raises',
  'Elevaciones Frontales': 'Front Raises',
  'Pájaros': 'Rear Delt Flyes',
  'Curl con Barra': 'Barbell Curl',
  'Curl con Mancuernas': 'Dumbbell Curl',
  'Curl Martillo': 'Hammer Curl',
  'Extensión de Tríceps Polea': 'Cable Triceps Extension',
  'Press Francés': 'French Press',
  'Fondos en Banco': 'Bench Dips',
  'Sentadilla': 'Squat',
  'Sentadilla Goblet': 'Goblet Squat',
  'Prensa de Piernas': 'Leg Press',
  'Zancadas': 'Lunges',
  'Extensión de Cuádriceps': 'Leg Extension',
  'Curl de Isquiotibiales': 'Leg Curl',
  'Peso Muerto Rumano': 'Romanian Deadlift',
  'Elevación de Gemelos': 'Calf Raise',
  'Plancha': 'Plank',
  'Crunches': 'Crunches',
  'Elevación de Piernas': 'Leg Raises',
  'Carrera en Cinta': 'Treadmill Run',
  'Bicicleta Estática': 'Stationary Bike',
  'Remo Ergómetro': 'Rowing Machine',
  'Saltar la Cuerda': 'Jump Rope',
  'Burpees': 'Burpees',
};

const GROUP_EN: Record<string, string> = {
  Pecho: 'Chest', Espalda: 'Back', Hombros: 'Shoulders', 'Bíceps': 'Biceps', 'Tríceps': 'Triceps',
  Piernas: 'Legs', Core: 'Core', Cardio: 'Cardio',
};

const EQUIPMENT_EN: Record<string, string> = {
  Barra: 'Barbell', Mancuernas: 'Dumbbells', 'Peso Corporal': 'Bodyweight', 'Máquina': 'Machine',
  Polea: 'Cable', Banco: 'Bench', Cuerda: 'Rope',
};

/** Nombre de un ejercicio en el idioma indicado (el del catálogo; los propios se muestran tal cual). */
export function exerciseName(name: string, locale: Locale = 'es'): string {
  if (locale !== 'en') return name;
  return EXERCISE_EN[name] ?? name;
}

/** «Pecho · Barra» o «Chest · Barbell», según el idioma. Omite los campos vacíos. */
export function exerciseTags(muscleGroup: string | undefined, equipment: string | undefined, locale: Locale = 'es'): string {
  const tr = (value: string | undefined, dict: Record<string, string>) => (value && locale === 'en' ? dict[value] ?? value : value);
  return [tr(muscleGroup, GROUP_EN), tr(equipment, EQUIPMENT_EN)].filter(Boolean).join(' · ');
}
