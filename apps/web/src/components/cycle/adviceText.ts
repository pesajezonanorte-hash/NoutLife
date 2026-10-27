// Consejos del ciclo en inglés. La API los genera en español desde una tabla fija
// (entrenamiento por intensidad, hábitos y una nota por fase). Aquí se traducen esas
// mismas frases por clave: la intensidad, si se pausa el ejercicio y el texto de la nota.
// Si una frase no está en la tabla, se muestra la que llegó de la API.
import type { CycleAdvice } from '@/services/cycle.service';
import type { Locale } from '@/lib/locale';

type Training = CycleAdvice['training'];
export interface AdviceCopy { training: Training; habits: { title: string; body: string }; note: string }

const TRAINING_EN: Record<CycleAdvice['intensity'], Training> = {
  rest: {
    title: 'Today calls for active rest',
    body: 'Your body is asking for a pause. A short walk, stretching or a few minutes of breathing also counts as training.',
    load: 'Rest or very gentle movement',
    ideas: ['Easy 15–20 minute walk', 'Stretching or restorative yoga', 'Local heat and water if you have cramps'],
  },
  gentle: {
    title: 'Gentle movement',
    body: 'Lower the intensity: technique, mobility and light cardio. Stop as soon as something hurts.',
    load: 'Lighter loads and 30–40% fewer sets',
    ideas: ['Gentle yoga or pilates', 'Walk for 30 minutes', 'Light weights with more rest between sets'],
  },
  moderate: {
    title: 'Steady pace',
    body: 'A good day for a moderate session. Warm up without rushing and drink water.',
    load: 'Your usual volume',
    ideas: ['Strength with your usual loads', 'Steady cardio for 30–40 minutes', 'Swimming or cycling at a comfortable pace'],
  },
  high: {
    title: 'A day to push yourself',
    body: 'Your energy is high: make the most of it to progress. Warm up well before hard effort.',
    load: 'You can increase by 5–10%',
    ideas: ['Intervals or HIIT', 'Try for a personal record', 'Add weight or try something new'],
  },
};

const HABITS_EN = {
  essentialPaused: {
    title: 'Habits in essential mode',
    body: 'Start with the easiest ones. If exercise isn’t for you today, pause it: your streak won’t break.',
  },
  essential: {
    title: 'Habits in essential mode',
    body: 'Start with the easiest ones and save the demanding ones for when you feel better.',
  },
  steady: { title: 'Keep the pace', body: 'Complete your usual habits and make time to rest.' },
  push: { title: 'Good day for the hard stuff', body: 'Use the energy for the habits that cost you the most.' },
};

const NOTE_EN: Record<string, string> = {
  'Durante el periodo, el descanso, el agua y comer bien ayudan más que nunca.': 'During your period, rest, water and eating well help more than ever.',
  'La energía suele subir día a día: buen momento para empezar retos.': 'Energy usually rises day by day: a good time to start challenges.',
  'Para muchas personas es el pico de energía del ciclo.': 'For many people, this is the peak of energy in the cycle.',
  'Antes del periodo es normal tener menos energía o más antojos. Sé amable contigo.': 'Before your period it is normal to have less energy or more cravings. Be kind to yourself.',
  'La energía se mantiene; el cuerpo agradece dormir bien y beber más agua.': 'Energy holds steady; your body appreciates good sleep and more water.',
};

/** Textos del consejo en el idioma indicado; en español, los de la API tal cual. */
export function adviceCopy(advice: CycleAdvice, locale: Locale = 'es'): AdviceCopy {
  const es: AdviceCopy = { training: advice.training, habits: advice.habits, note: advice.note };
  if (locale !== 'en') return es;
  const essential = advice.intensity === 'rest' || advice.intensity === 'gentle';
  const habits = essential ? (advice.pauseFitness ? HABITS_EN.essentialPaused : HABITS_EN.essential)
    : advice.intensity === 'moderate' ? HABITS_EN.steady : HABITS_EN.push;
  return {
    training: TRAINING_EN[advice.intensity] ?? advice.training,
    habits,
    note: NOTE_EN[advice.note] ?? advice.note,
  };
}
