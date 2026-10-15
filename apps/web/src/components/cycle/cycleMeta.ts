// La zona Ciclo cuenta el ciclo como cuatro estaciones interiores: el periodo es
// el invierno (descanso), la fase folicular la primavera (la energía vuelve),
// la ovulación el verano (el pico) y la fase lútea el otoño (la energía baja).
// Cada fase tiene su color (styles/ambience.css, --cy-*), su glifo y su texto:
// el color nunca va solo.
import { Leaf, Snowflake, Sprout, Sun, type LucideIcon } from 'lucide-react';
import type { CycleFlow, CycleIntensity, CyclePhase, CycleSymptom } from '@/services/cycle.service';

export interface PhaseMeta {
  name: string;
  season: string;
  icon: LucideIcon;
  /** Una línea: qué suele pasar en esta fase. */
  summary: string;
}

export const PHASES: CyclePhase[] = ['menstrual', 'follicular', 'ovulation', 'luteal'];

export const PHASE_META: Record<CyclePhase, PhaseMeta> = {
  menstrual: { name: 'Menstruación', season: 'Invierno', icon: Snowflake, summary: 'El cuerpo se renueva: descansa más y muévete con suavidad.' },
  follicular: { name: 'Fase folicular', season: 'Primavera', icon: Sprout, summary: 'La energía vuelve día a día. Buen momento para empezar cosas.' },
  ovulation: { name: 'Ovulación', season: 'Verano', icon: Sun, summary: 'Suele ser el pico de energía y de ganas de socializar.' },
  luteal: { name: 'Fase lútea', season: 'Otoño', icon: Leaf, summary: 'La energía baja poco a poco; al final pueden llegar antojos o cambios de ánimo.' },
};

/** Color de la fase (relleno de gráficos) con transparencia opcional. */
export const phaseFill = (phase: CyclePhase, alpha = 1) => `rgb(var(--cy-${phase}) / ${alpha})`;
/** Color de texto de la fase (AA sobre la superficie). */
export const phaseInk = (phase: CyclePhase) => `rgb(var(--cy-${phase}-text))`;

export const FLOW_OPTIONS: { value: CycleFlow; label: string; drops: number }[] = [
  { value: 'none', label: 'Sin flujo', drops: 0 },
  { value: 'spotting', label: 'Manchado', drops: 0 },
  { value: 'light', label: 'Ligero', drops: 1 },
  { value: 'medium', label: 'Medio', drops: 2 },
  { value: 'heavy', label: 'Abundante', drops: 3 },
];
export const isBleeding = (flow: CycleFlow | null | undefined) => flow === 'light' || flow === 'medium' || flow === 'heavy';

export const SYMPTOM_LABELS: Record<CycleSymptom, string> = {
  cramps: 'Cólicos',
  headache: 'Dolor de cabeza',
  bloating: 'Hinchazón',
  breast_tenderness: 'Senos sensibles',
  back_pain: 'Dolor de espalda',
  acne: 'Acné',
  nausea: 'Náuseas',
  fatigue: 'Cansancio',
  cravings: 'Antojos',
  insomnia: 'Insomnio',
  anxiety: 'Ansiedad',
  irritability: 'Irritabilidad',
};
export const SYMPTOMS = Object.keys(SYMPTOM_LABELS) as CycleSymptom[];

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
