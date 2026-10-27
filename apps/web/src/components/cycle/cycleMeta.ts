// Ciclo Menstrual: terminología médica para las cuatro fases (menstruación, fase
// folicular, ovulación y fase lútea). Cada fase tiene su color (styles/ambience.css,
// --cy-*), su ícono y su texto: el color nunca va solo. Las opciones del registro
// diario (flujo, síntomas, ánimo, estilo de vida) también viven aquí, con su ícono.
// Los textos salen en el idioma indicado (`locale`, español por defecto).
import {
  ArrowUpDown, Bone, BatteryLow, Brain, Cookie, Droplet, Flame, Frown, Heart, Moon, Smile, Sparkle, Sprout, Activity, Wind, Zap, CircleDot,
  type LucideIcon,
} from 'lucide-react';
import type { CycleContraceptive, CycleFlow, CycleIntensity, CycleMood, CyclePhase, CycleSexualActivity, CycleSymptom } from '@/services/cycle.service';
import { INTL_LOCALE, type Locale } from '@/lib/locale';

export interface PhaseMeta {
  name: string;
  icon: LucideIcon;
  /** Una línea: qué suele pasar en esta fase. */
  summary: string;
}

export const PHASES: CyclePhase[] = ['menstrual', 'follicular', 'ovulation', 'luteal'];

const PHASE_ICON: Record<CyclePhase, LucideIcon> = { menstrual: Droplet, follicular: Sprout, ovulation: CircleDot, luteal: Moon };
const PHASE_TEXT: Record<Locale, Record<CyclePhase, { name: string; summary: string }>> = {
  es: {
    menstrual: { name: 'Menstruación', summary: 'El cuerpo se renueva: descansa más y muévete con suavidad.' },
    follicular: { name: 'Fase folicular', summary: 'La energía vuelve día a día. Buen momento para empezar cosas.' },
    ovulation: { name: 'Ovulación', summary: 'Suele ser el pico de energía y de ganas de socializar.' },
    luteal: { name: 'Fase lútea', summary: 'La energía baja poco a poco; al final pueden llegar antojos o cambios de ánimo.' },
  },
  en: {
    menstrual: { name: 'Menstruation', summary: 'Your body renews itself: rest more and move gently.' },
    follicular: { name: 'Follicular phase', summary: 'Energy returns day by day. A good time to start things.' },
    ovulation: { name: 'Ovulation', summary: 'Often the peak of energy and the urge to socialize.' },
    luteal: { name: 'Luteal phase', summary: 'Energy eases off gradually; cravings or mood shifts may appear toward the end.' },
  },
};

/** Nombre, ícono y resumen de cada fase en el idioma indicado. */
export function phaseMetaFor(locale: Locale = 'es'): Record<CyclePhase, PhaseMeta> {
  return Object.fromEntries(PHASES.map((p) => [p, { ...PHASE_TEXT[locale][p], icon: PHASE_ICON[p] }])) as Record<CyclePhase, PhaseMeta>;
}
/** Compatibilidad: las fases en español. */
export const PHASE_META = phaseMetaFor('es');

/** Color de la fase (relleno de gráficos) con transparencia opcional. */
export const phaseFill = (phase: CyclePhase, alpha = 1) => `rgb(var(--cy-${phase}) / ${alpha})`;
/** Color de texto de la fase (AA sobre la superficie). */
export const phaseInk = (phase: CyclePhase) => `rgb(var(--cy-${phase}-text))`;

const FLOW_TEXT: Record<Locale, Record<CycleFlow, string>> = {
  es: { none: 'Sin flujo', spotting: 'Manchado', light: 'Ligero', medium: 'Moderado', heavy: 'Abundante' },
  en: { none: 'No flow', spotting: 'Spotting', light: 'Light', medium: 'Medium', heavy: 'Heavy' },
};
const FLOW_DROPS: Record<CycleFlow, number> = { none: 0, spotting: 0, light: 1, medium: 2, heavy: 3 };
export function flowOptionsFor(locale: Locale = 'es') {
  return (['none', 'spotting', 'light', 'medium', 'heavy'] as CycleFlow[]).map((value) => ({ value, label: FLOW_TEXT[locale][value], drops: FLOW_DROPS[value] }));
}
export const FLOW_OPTIONS = flowOptionsFor('es');
export const isBleeding = (flow: CycleFlow | null | undefined) => flow === 'light' || flow === 'medium' || flow === 'heavy';

const SYMPTOM_TEXT: Record<Locale, Record<CycleSymptom, string>> = {
  es: {
    cramps: 'Cólicos', headache: 'Dolor de cabeza', bloating: 'Hinchazón', breast_tenderness: 'Sensibilidad mamaria', back_pain: 'Dolor lumbar',
    acne: 'Brotes o acné', nausea: 'Náuseas', fatigue: 'Cansancio', cravings: 'Antojos', insomnia: 'Insomnio', anxiety: 'Ansiedad', irritability: 'Irritabilidad',
  },
  en: {
    cramps: 'Cramps', headache: 'Headache', bloating: 'Bloating', breast_tenderness: 'Breast tenderness', back_pain: 'Back pain',
    acne: 'Breakouts or acne', nausea: 'Nausea', fatigue: 'Fatigue', cravings: 'Cravings', insomnia: 'Insomnia', anxiety: 'Anxiety', irritability: 'Irritability',
  },
};
const SYMPTOM_ICON: Record<CycleSymptom, LucideIcon> = {
  cramps: Activity, headache: Brain, bloating: Wind, breast_tenderness: Heart, back_pain: Bone, acne: Sparkle, nausea: Frown,
  fatigue: BatteryLow, cravings: Cookie, insomnia: Moon, anxiety: Wind, irritability: Flame,
};
export function symptomLabelsFor(locale: Locale = 'es'): Record<CycleSymptom, string> {
  return SYMPTOM_TEXT[locale];
}
export const SYMPTOM_LABELS = symptomLabelsFor('es');
export const SYMPTOM_META = Object.fromEntries(
  (Object.keys(SYMPTOM_ICON) as CycleSymptom[]).map((k) => [k, { label: SYMPTOM_LABELS[k], icon: SYMPTOM_ICON[k] }]),
) as Record<CycleSymptom, { label: string; icon: LucideIcon }>;
export const SYMPTOMS = Object.keys(SYMPTOM_ICON) as CycleSymptom[];

const MOOD_TEXT: Record<Locale, Record<CycleMood, string>> = {
  es: { happy: 'Feliz', energetic: 'Enérgica', sensitive: 'Sensible', anxious: 'Ansiosa', irritable: 'Irritable', mood_swings: 'Altibajos' },
  en: { happy: 'Happy', energetic: 'Energetic', sensitive: 'Sensitive', anxious: 'Anxious', irritable: 'Irritable', mood_swings: 'Mood swings' },
};
const MOOD_ICON: Record<CycleMood, LucideIcon> = { happy: Smile, energetic: Zap, sensitive: Heart, anxious: Wind, irritable: Flame, mood_swings: ArrowUpDown };
export function moodOptionsFor(locale: Locale = 'es') {
  return (Object.keys(MOOD_ICON) as CycleMood[]).map((value) => ({ value, label: MOOD_TEXT[locale][value], icon: MOOD_ICON[value] }));
}
export const MOOD_META = Object.fromEntries(moodOptionsFor('es').map((m) => [m.value, { label: m.label, icon: m.icon }])) as Record<CycleMood, { label: string; icon: LucideIcon }>;
export const MOODS = Object.keys(MOOD_ICON) as CycleMood[];

const SEXUAL_TEXT: Record<Locale, Record<CycleSexualActivity, string>> = {
  es: { none: 'Sin actividad', protected: 'Con protección', unprotected: 'Sin protección' },
  en: { none: 'No activity', protected: 'Protected', unprotected: 'Unprotected' },
};
export function sexualOptionsFor(locale: Locale = 'es') {
  return (['none', 'protected', 'unprotected'] as CycleSexualActivity[]).map((value) => ({ value, label: SEXUAL_TEXT[locale][value] }));
}
export const SEXUAL_OPTIONS = sexualOptionsFor('es');

const CONTRA_TEXT: Record<Locale, Record<CycleContraceptive, string>> = {
  es: { none: 'Ninguno', pill: 'Pastillas', iud: 'DIU', implant: 'Implante', injection: 'Inyección', condom: 'Condón', other: 'Otro' },
  en: { none: 'None', pill: 'Pill', iud: 'IUD', implant: 'Implant', injection: 'Injection', condom: 'Condom', other: 'Other' },
};
export function contraceptiveOptionsFor(locale: Locale = 'es') {
  return (['none', 'pill', 'iud', 'implant', 'injection', 'condom', 'other'] as CycleContraceptive[]).map((value) => ({ value, label: CONTRA_TEXT[locale][value] }));
}
export const CONTRACEPTIVE_OPTIONS = contraceptiveOptionsFor('es');

const ENERGY: Record<Locale, readonly string[]> = {
  es: ['Agotada', 'Baja', 'Normal', 'Buena', 'A tope'],
  en: ['Drained', 'Low', 'Normal', 'Good', 'Full of energy'],
};
export const energyLabelFor = (n: number, locale: Locale = 'es') => ENERGY[locale][Math.min(5, Math.max(1, n)) - 1];
export const energyLabel = (n: number) => energyLabelFor(n, 'es');
export const ENERGY_LABELS = ENERGY.es;

const INTENSITY: Record<Locale, Record<CycleIntensity, string>> = {
  es: { rest: 'Descanso activo', gentle: 'Suave', moderate: 'Moderada', high: 'Alta' },
  en: { rest: 'Active rest', gentle: 'Gentle', moderate: 'Moderate', high: 'High' },
};
export const INTENSITY_LABEL = INTENSITY.es;
/** «descanso activo» o «intensidad suave» (en inglés, «gentle intensity»). */
export function intensityLineFor(i: CycleIntensity, locale: Locale = 'es') {
  if (locale === 'en') return i === 'rest' ? 'active rest' : `${INTENSITY.en[i].toLowerCase()} intensity`;
  return i === 'rest' ? 'descanso activo' : `intensidad ${INTENSITY.es[i].toLowerCase()}`;
}
export const intensityLine = (i: CycleIntensity) => intensityLineFor(i, 'es');

const SOURCE: Record<Locale, Record<'today' | 'history' | 'typical', string>> = {
  es: { today: 'según lo que anotaste hoy', history: 'según tus ciclos anteriores', typical: 'patrón habitual de esta fase' },
  en: { today: 'based on what you logged today', history: 'based on your previous cycles', typical: 'usual pattern for this phase' },
};
export const sourceLabelFor = (s: 'today' | 'history' | 'typical', locale: Locale = 'es') => SOURCE[locale][s];
export const SOURCE_LABEL = SOURCE.es;

const DAY_MS = 86_400_000;
/** Días entre dos claves YYYY-MM-DD (b − a). */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
export const shiftDay = (key: string, days: number) => new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
/** «14 de octubre» / «October 14». */
export const longDay = (key: string, locale: Locale = 'es') => new Date(`${key}T12:00:00`).toLocaleDateString(INTL_LOCALE[locale], { day: 'numeric', month: 'long' });
export const weekdayShort = (key: string, locale: Locale = 'es') => new Date(`${key}T12:00:00`).toLocaleDateString(INTL_LOCALE[locale], { weekday: 'short' }).replace('.', '');

/** Fase de un día del ciclo con la forma del ciclo actual (pasado el largo, sigue la lútea). */
export function phaseOnDay(cycleDay: number, ranges: Record<CyclePhase, { start: number; end: number }>): CyclePhase {
  for (const p of PHASES) if (cycleDay >= ranges[p].start && cycleDay <= ranges[p].end) return p;
  return 'luteal';
}

/** Mismo reparto de fases que la API (lib/cycle.ts cycleShape), para dibujar ciclos previstos. */
export function cycleRanges(cycleLength: number, periodLength: number): Record<CyclePhase, { start: number; end: number }> {
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)));
  const length = clamp(cycleLength, 18, 60);
  const period = Math.min(clamp(periodLength, 2, 10), length - 6);
  const ovulationDay = Math.max(period + 2, length - 14);
  return {
    menstrual: { start: 1, end: period },
    follicular: { start: period + 1, end: ovulationDay - 2 },
    ovulation: { start: ovulationDay - 1, end: ovulationDay + 1 },
    luteal: { start: ovulationDay + 2, end: length },
  };
}

const FERTILITY: Record<Locale, Record<'peak' | 'high' | 'low', string>> = {
  es: { peak: 'Pico de fertilidad estimado', high: 'Ventana fértil estimada', low: 'Fertilidad baja estimada' },
  en: { peak: 'Estimated fertility peak', high: 'Estimated fertile window', low: 'Estimated low fertility' },
};
export const fertilityLabelFor = (k: 'peak' | 'high' | 'low', locale: Locale = 'es') => FERTILITY[locale][k];
export const FERTILITY_LABEL = FERTILITY.es;
