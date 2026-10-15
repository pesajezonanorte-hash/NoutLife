// Ciclo Menstrual: terminología médica para las cuatro fases (menstruación, fase
// folicular, ovulación y fase lútea). Cada fase tiene su color (styles/ambience.css,
// --cy-*), su ícono y su texto: el color nunca va solo. Las opciones del registro
// diario (flujo, síntomas, ánimo, estilo de vida) también viven aquí, con su ícono.
import {
  ArrowUpDown, Bone, BatteryLow, Brain, Cookie, Droplet, Flame, Frown, Heart, Moon, Smile, Sparkle, Sprout, Activity, Wind, Zap, CircleDot,
  type LucideIcon,
} from 'lucide-react';
import type { CycleContraceptive, CycleFlow, CycleIntensity, CycleMood, CyclePhase, CycleSexualActivity, CycleSymptom } from '@/services/cycle.service';

export interface PhaseMeta {
  name: string;
  icon: LucideIcon;
  /** Una línea: qué suele pasar en esta fase. */
  summary: string;
}

export const PHASES: CyclePhase[] = ['menstrual', 'follicular', 'ovulation', 'luteal'];

export const PHASE_META: Record<CyclePhase, PhaseMeta> = {
  menstrual: { name: 'Menstruación', icon: Droplet, summary: 'El cuerpo se renueva: descansa más y muévete con suavidad.' },
  follicular: { name: 'Fase folicular', icon: Sprout, summary: 'La energía vuelve día a día. Buen momento para empezar cosas.' },
  ovulation: { name: 'Ovulación', icon: CircleDot, summary: 'Suele ser el pico de energía y de ganas de socializar.' },
  luteal: { name: 'Fase lútea', icon: Moon, summary: 'La energía baja poco a poco; al final pueden llegar antojos o cambios de ánimo.' },
};

/** Color de la fase (relleno de gráficos) con transparencia opcional. */
export const phaseFill = (phase: CyclePhase, alpha = 1) => `rgb(var(--cy-${phase}) / ${alpha})`;
/** Color de texto de la fase (AA sobre la superficie). */
export const phaseInk = (phase: CyclePhase) => `rgb(var(--cy-${phase}-text))`;

export const FLOW_OPTIONS: { value: CycleFlow; label: string; drops: number }[] = [
  { value: 'none', label: 'Sin flujo', drops: 0 },
  { value: 'spotting', label: 'Manchado', drops: 0 },
  { value: 'light', label: 'Ligero', drops: 1 },
  { value: 'medium', label: 'Moderado', drops: 2 },
  { value: 'heavy', label: 'Abundante', drops: 3 },
];
export const isBleeding = (flow: CycleFlow | null | undefined) => flow === 'light' || flow === 'medium' || flow === 'heavy';

export const SYMPTOM_META: Record<CycleSymptom, { label: string; icon: LucideIcon }> = {
  cramps: { label: 'Cólicos', icon: Activity },
  headache: { label: 'Dolor de cabeza', icon: Brain },
  bloating: { label: 'Hinchazón', icon: Wind },
  breast_tenderness: { label: 'Sensibilidad mamaria', icon: Heart },
  back_pain: { label: 'Dolor lumbar', icon: Bone },
  acne: { label: 'Brotes o acné', icon: Sparkle },
  nausea: { label: 'Náuseas', icon: Frown },
  fatigue: { label: 'Cansancio', icon: BatteryLow },
  cravings: { label: 'Antojos', icon: Cookie },
  insomnia: { label: 'Insomnio', icon: Moon },
  anxiety: { label: 'Ansiedad', icon: Wind },
  irritability: { label: 'Irritabilidad', icon: Flame },
};
export const SYMPTOM_LABELS = Object.fromEntries(Object.entries(SYMPTOM_META).map(([k, v]) => [k, v.label])) as Record<CycleSymptom, string>;
export const SYMPTOMS = Object.keys(SYMPTOM_META) as CycleSymptom[];

export const MOOD_META: Record<CycleMood, { label: string; icon: LucideIcon }> = {
  happy: { label: 'Feliz', icon: Smile },
  energetic: { label: 'Enérgica', icon: Zap },
  sensitive: { label: 'Sensible', icon: Heart },
  anxious: { label: 'Ansiosa', icon: Wind },
  irritable: { label: 'Irritable', icon: Flame },
  mood_swings: { label: 'Altibajos', icon: ArrowUpDown },
};
export const MOODS = Object.keys(MOOD_META) as CycleMood[];

export const SEXUAL_OPTIONS: { value: CycleSexualActivity; label: string }[] = [
  { value: 'none', label: 'Sin actividad' },
  { value: 'protected', label: 'Con protección' },
  { value: 'unprotected', label: 'Sin protección' },
];

export const CONTRACEPTIVE_OPTIONS: { value: CycleContraceptive; label: string }[] = [
  { value: 'none', label: 'Ninguno' },
  { value: 'pill', label: 'Pastillas' },
  { value: 'iud', label: 'DIU' },
  { value: 'implant', label: 'Implante' },
  { value: 'injection', label: 'Inyección' },
  { value: 'condom', label: 'Condón' },
  { value: 'other', label: 'Otro' },
];

export const ENERGY_LABELS = ['Agotada', 'Baja', 'Normal', 'Buena', 'A tope'] as const;
export const energyLabel = (n: number) => ENERGY_LABELS[Math.min(5, Math.max(1, n)) - 1];

export const INTENSITY_LABEL: Record<CycleIntensity, string> = {
  rest: 'Descanso activo', gentle: 'Suave', moderate: 'Moderada', high: 'Alta',
};
/** «descanso activo» o «intensidad suave». */
export const intensityLine = (i: CycleIntensity) => (i === 'rest' ? 'descanso activo' : `intensidad ${INTENSITY_LABEL[i].toLowerCase()}`);

export const SOURCE_LABEL = { today: 'según lo que anotaste hoy', history: 'según tus ciclos anteriores', typical: 'patrón habitual de esta fase' } as const;

const DAY_MS = 86_400_000;
/** Días entre dos claves YYYY-MM-DD (b − a). */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
export const shiftDay = (key: string, days: number) => new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
/** «14 de octubre» / «mar 14». */
export const longDay = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
export const weekdayShort = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '');

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

export const FERTILITY_LABEL = {
  peak: 'Pico de fertilidad estimado',
  high: 'Ventana fértil estimada',
  low: 'Fertilidad baja estimada',
} as const;
