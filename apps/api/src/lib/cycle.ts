// Ciclo menstrual: fases, promedios, regularidad, predicciones, analítica y
// consejos para el Coliseo y los hábitos. Todo es puro (sin base de datos) para
// poder probarlo; el servicio lo alimenta con los datos de la usuaria. Las
// predicciones son estimaciones a partir de promedios y del historial propio: no
// son un diagnóstico médico ni un método anticonceptivo.
//
// Las fechas son claves de día (medianoche UTC) del calendario de la usuaria,
// como en el resto de la app (lib/calendar).

export const PHASES = ['menstrual', 'follicular', 'ovulation', 'luteal'] as const;
export type Phase = (typeof PHASES)[number];

export const FLOWS = ['none', 'spotting', 'light', 'medium', 'heavy'] as const;
export type Flow = (typeof FLOWS)[number];
/** Flujo que cuenta como día de periodo (el manchado no). */
export const BLEEDING: readonly Flow[] = ['light', 'medium', 'heavy'];

export const SYMPTOMS = [
  'cramps', 'headache', 'bloating', 'breast_tenderness', 'back_pain', 'acne',
  'nausea', 'fatigue', 'cravings', 'insomnia', 'anxiety', 'irritability',
] as const;
export type Symptom = (typeof SYMPTOMS)[number];
/** Síntomas que piden bajar la intensidad del día. */
const DEMANDING: readonly Symptom[] = ['cramps', 'headache', 'back_pain', 'nausea', 'fatigue'];

export const MOODS = ['happy', 'energetic', 'sensitive', 'anxious', 'irritable', 'mood_swings'] as const;
export type Mood = (typeof MOODS)[number];

export const SEXUAL_ACTIVITY = ['none', 'protected', 'unprotected'] as const;
export type SexualActivity = (typeof SEXUAL_ACTIVITY)[number];

export const CONTRACEPTIVES = ['none', 'pill', 'iud', 'implant', 'injection', 'condom', 'other'] as const;
export type Contraceptive = (typeof CONTRACEPTIVES)[number];

export const CYCLE_RANGE = { min: 18, max: 60 } as const;
export const PERIOD_RANGE = { min: 2, max: 10 } as const;
/** Lo que se considera un registro de estilo de vida válido (sueño, estrés 1–5; agua en vasos). */
export const SCALE_RANGE = { min: 1, max: 5 } as const;
export const WATER_RANGE = { min: 0, max: 20 } as const;

const DAY_MS = 86_400_000;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)));
export const diffDays = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / DAY_MS);
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
export const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Días del ciclo (desde 1, inclusivos) de una fase. Vacía si end < start. */
export interface PhaseRange { start: number; end: number }
export interface CycleShape {
  length: number;
  period: number;
  ovulationDay: number;
  ranges: Record<Phase, PhaseRange>;
}

/**
 * Reparto de un ciclo en sus cuatro fases. La fase lútea dura unos 14 días, así
 * que la ovulación cae unos 14 días antes del siguiente periodo; la ventana de
 * ovulación es ese día con el anterior y el siguiente.
 */
export function cycleShape(cycleLength: number, periodLength: number): CycleShape {
  const length = clamp(cycleLength, CYCLE_RANGE.min, CYCLE_RANGE.max);
  const period = Math.min(clamp(periodLength, PERIOD_RANGE.min, PERIOD_RANGE.max), length - 6);
  const ovulationDay = Math.max(period + 2, length - 14);
  const ovulation = { start: ovulationDay - 1, end: ovulationDay + 1 };
  return {
    length,
    period,
    ovulationDay,
    ranges: {
      menstrual: { start: 1, end: period },
      follicular: { start: period + 1, end: ovulation.start - 1 },
      ovulation,
      luteal: { start: ovulation.end + 1, end: length },
    },
  };
}

/** Fase de un día del ciclo. Pasado el largo previsto sigue la lútea (el periodo se retrasa). */
export function phaseOn(cycleDay: number, shape: CycleShape): Phase {
  for (const phase of PHASES) {
    const r = shape.ranges[phase];
    if (cycleDay >= r.start && cycleDay <= r.end) return phase;
  }
  return 'luteal';
}

export interface PeriodRow { startDate: Date; endDate: Date | null }
export interface DayLogRow {
  date: Date;
  flow: string | null;
  energy: number | null;
  symptoms: string[];
}

export type Regularity = 'regular' | 'variable' | 'irregular';

export interface CycleAverages {
  cycleLength: number;
  periodLength: number;
  /** Ciclos completos que entran en el promedio (los 6 últimos con un largo creíble). */
  cyclesTracked: number;
  shortest: number | null;
  longest: number | null;
  /** Desviación típica del largo de ciclo, en días. Null con menos de 2 ciclos. */
  stdDev: number | null;
  /** Qué tan parejos son sus ciclos. Null con menos de 2 ciclos. */
  regularity: Regularity | null;
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const spread = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

/** Regularidad a partir de la desviación: hasta 2 días es regular, hasta 5 variable. */
export function regularityOf(stdDev: number): Regularity {
  if (stdDev <= 2) return 'regular';
  if (stdDev <= 5) return 'variable';
  return 'irregular';
}

/** Largos de ciclo creíbles (entre periodo y periodo), en orden de fecha. */
export function cycleLengths(periods: PeriodRow[]): { start: Date; length: number }[] {
  const sorted = [...periods].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const out: { start: Date; length: number }[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const days = diffDays(sorted[i].startDate, sorted[i - 1].startDate);
    if (days >= CYCLE_RANGE.min && days <= CYCLE_RANGE.max) out.push({ start: sorted[i - 1].startDate, length: days });
  }
  return out;
}

/**
 * Promedios propios: el largo de sus últimos 6 ciclos, su variabilidad y la
 * duración de sus últimos 6 periodos cerrados. Sin historial, lo que declaró en
 * sus ajustes. Un ciclo de largo imposible (un periodo que no se anotó) no entra.
 */
export function averages(periods: PeriodRow[], fallback: { cycleLength: number; periodLength: number }): CycleAverages {
  const recent = cycleLengths(periods).slice(-6).map((c) => c.length);
  const bleeds = [...periods]
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    .filter((p): p is PeriodRow & { endDate: Date } => Boolean(p.endDate))
    .map((p) => diffDays(p.endDate, p.startDate) + 1)
    .filter((days) => days >= 1 && days <= 12);
  const recentBleeds = bleeds.slice(-6);
  const stdDev = recent.length >= 2 ? Math.round(spread(recent) * 10) / 10 : null;
  return {
    cycleLength: clamp(recent.length ? mean(recent) : fallback.cycleLength, CYCLE_RANGE.min, CYCLE_RANGE.max),
    periodLength: clamp(recentBleeds.length ? mean(recentBleeds) : fallback.periodLength, PERIOD_RANGE.min, PERIOD_RANGE.max),
    cyclesTracked: recent.length,
    shortest: recent.length ? Math.min(...recent) : null,
    longest: recent.length ? Math.max(...recent) : null,
    stdDev,
    regularity: stdDev == null ? null : regularityOf(stdDev),
  };
}

/** Periodo en curso o el último que empezó antes de `day`. */
export function periodBefore(day: Date, periods: PeriodRow[]): PeriodRow | null {
  let best: PeriodRow | null = null;
  for (const p of periods) {
    if (p.startDate.getTime() > day.getTime()) continue;
    if (!best || p.startDate.getTime() > best.startDate.getTime()) best = p;
  }
  return best;
}

/** Lo que hace falta de un promedio para predecir: el largo, el periodo y su variabilidad. */
export type Forecast = Pick<CycleAverages, 'cycleLength' | 'periodLength'> & Partial<Pick<CycleAverages, 'stdDev'>>;

/** Fertilidad estimada de un día: pico (el día de la ovulación ±1), alta (ventana fértil) o baja. */
export type Fertility = 'peak' | 'high' | 'low';

export interface CycleSnapshot {
  cycleDay: number;
  phase: Phase;
  /** Día dentro de la fase y lo que dura la fase (con retraso, la lútea se alarga). */
  phaseDay: number;
  phaseLength: number;
  onPeriod: boolean;
  /** El periodo actual sigue abierto (sin fecha de fin). */
  periodOpen: boolean;
  periodStart: string;
  nextPeriod: string;
  /** Margen de la próxima regla (días antes o después de la fecha central). Null sin historial suficiente. */
  nextPeriodEarliest: string | null;
  nextPeriodLatest: string | null;
  daysUntilNextPeriod: number;
  /** Días de retraso respecto al promedio (0 si no hay retraso). */
  lateDays: number;
  ovulation: string;
  fertileStart: string;
  fertileEnd: string;
  fertility: Fertility;
  shape: CycleShape;
}

/** Margen de incertidumbre: lo que se desvían sus ciclos, sin pasar de 4 días. */
const marginOf = (stdDev: number | null | undefined) => Math.min(4, Math.ceil(stdDev ?? 0));

/**
 * Dónde está hoy en su ciclo. `bleedDays`: días del periodo abierto con flujo
 * anotado (un periodo que se alarga más que el promedio sigue contando como tal).
 * Con ciclos variables, la próxima regla y la ventana fértil se abren hacia los
 * lados según la desviación.
 */
export function snapshot(today: Date, periods: PeriodRow[], avg: Forecast, bleedDays = 0): CycleSnapshot | null {
  const current = periodBefore(today, periods);
  if (!current) return null;
  const cycleDay = diffDays(today, current.startDate) + 1;
  const bleed = current.endDate ? diffDays(current.endDate, current.startDate) + 1 : Math.max(avg.periodLength, bleedDays);
  const shape = cycleShape(avg.cycleLength, bleed);
  const phase = phaseOn(cycleDay, shape);
  const range = shape.ranges[phase];
  const lateDays = Math.max(0, cycleDay - shape.length);
  const margin = marginOf(avg.stdDev);
  const nextPeriod = addDays(current.startDate, shape.length);
  const ovulation = addDays(current.startDate, shape.ovulationDay - 1);
  const fertileFromDay = shape.ovulationDay - 5 - margin;
  const fertileToDay = shape.ovulationDay + 1 + margin;
  const fertility: Fertility = Math.abs(cycleDay - shape.ovulationDay) <= 1 ? 'peak'
    : cycleDay >= fertileFromDay && cycleDay <= fertileToDay ? 'high'
    : 'low';
  const hasWindow = avg.stdDev != null;
  return {
    cycleDay,
    phase,
    phaseDay: cycleDay - range.start + 1,
    phaseLength: Math.max(range.end, cycleDay) - range.start + 1,
    onPeriod: current.endDate ? today.getTime() <= current.endDate.getTime() : cycleDay <= shape.period,
    periodOpen: !current.endDate,
    periodStart: dayKey(current.startDate),
    nextPeriod: dayKey(nextPeriod),
    nextPeriodEarliest: hasWindow ? dayKey(addDays(nextPeriod, -margin)) : null,
    nextPeriodLatest: hasWindow ? dayKey(addDays(nextPeriod, margin)) : null,
    daysUntilNextPeriod: Math.max(0, diffDays(nextPeriod, today)),
    lateDays,
    ovulation: dayKey(ovulation),
    fertileStart: dayKey(addDays(ovulation, -5 - margin)),
    fertileEnd: dayKey(addDays(ovulation, 1 + margin)),
    fertility,
    shape,
  };
}

/** Fase en la que cayó un día pasado (con el periodo que lo precede). */
export function phaseOfDate(date: Date, periods: PeriodRow[], avg: Forecast): Phase | null {
  const period = periodBefore(date, periods);
  if (!period) return null;
  const cycleDay = diffDays(date, period.startDate) + 1;
  if (cycleDay > CYCLE_RANGE.max) return null;
  const bleed = period.endDate ? diffDays(period.endDate, period.startDate) + 1 : avg.periodLength;
  return phaseOn(cycleDay, cycleShape(avg.cycleLength, bleed));
}

/**
 * Energía típica (1–5) de cada momento del ciclo. Es un patrón general: los
 * registros propios lo sustituyen en cuanto hay suficientes.
 */
export function typicalEnergy(cycleDay: number, shape: CycleShape): number {
  const phase = phaseOn(cycleDay, shape);
  if (phase === 'menstrual') return cycleDay <= 2 ? 2 : 3;
  if (phase === 'follicular') return 4;
  if (phase === 'ovulation') return 5;
  if (cycleDay > shape.length - 5) return 2;
  return cycleDay <= shape.ranges.luteal.start + 3 ? 4 : 3;
}

export interface CyclePatterns {
  /** Energía media que anotó en cada fase (con 3 registros o más). */
  energy: Record<Phase, number | null>;
  /** Síntomas que suele anotar en cada fase (en 2 días o más y al menos el 40 % de los registros de esa fase). */
  symptoms: Record<Phase, Symptom[]>;
}

export function patterns(logs: DayLogRow[], periods: PeriodRow[], avg: Forecast): CyclePatterns {
  const energies: Record<Phase, number[]> = { menstrual: [], follicular: [], ovulation: [], luteal: [] };
  const days: Record<Phase, number> = { menstrual: 0, follicular: 0, ovulation: 0, luteal: 0 };
  const counts: Record<Phase, Map<Symptom, number>> = { menstrual: new Map(), follicular: new Map(), ovulation: new Map(), luteal: new Map() };
  for (const log of logs) {
    const phase = phaseOfDate(log.date, periods, avg);
    if (!phase) continue;
    days[phase] += 1;
    if (log.energy != null) energies[phase].push(log.energy);
    for (const s of log.symptoms) {
      if ((SYMPTOMS as readonly string[]).includes(s)) counts[phase].set(s as Symptom, (counts[phase].get(s as Symptom) ?? 0) + 1);
    }
  }
  const energy = {} as CyclePatterns['energy'];
  const symptoms = {} as CyclePatterns['symptoms'];
  for (const phase of PHASES) {
    energy[phase] = energies[phase].length >= 3 ? Math.round(mean(energies[phase])) : null;
    symptoms[phase] = [...counts[phase]]
      .filter(([, n]) => n >= 2 && n / Math.max(1, days[phase]) >= 0.4)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([s]) => s);
  }
  return { energy, symptoms };
}

export interface CycleAnalytics {
  /** Últimos ciclos completos: cuándo empezaron y cuánto duraron. */
  cycles: { start: string; length: number }[];
  /** Últimos periodos cerrados: cuándo empezaron y cuántos días sangró. */
  periods: { start: string; length: number }[];
  /** Por fase: cuántos días tiene registro y qué síntomas aparecieron más. */
  symptomsByPhase: Record<Phase, { days: number; symptoms: { symptom: Symptom; count: number }[] }>;
}

/** Tendencias para la pantalla de analítica (últimos 12 ciclos y periodos). */
export function analytics(logs: DayLogRow[], periods: PeriodRow[], avg: Forecast): CycleAnalytics {
  const cycles = cycleLengths(periods).slice(-12).map((c) => ({ start: dayKey(c.start), length: c.length }));
  const closed = [...periods]
    .filter((p): p is PeriodRow & { endDate: Date } => Boolean(p.endDate))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    .slice(-12)
    .map((p) => ({ start: dayKey(p.startDate), length: diffDays(p.endDate, p.startDate) + 1 }));

  const days: Record<Phase, number> = { menstrual: 0, follicular: 0, ovulation: 0, luteal: 0 };
  const counts: Record<Phase, Map<Symptom, number>> = { menstrual: new Map(), follicular: new Map(), ovulation: new Map(), luteal: new Map() };
  for (const log of logs) {
    const phase = phaseOfDate(log.date, periods, avg);
    if (!phase) continue;
    days[phase] += 1;
    for (const s of log.symptoms) {
      if ((SYMPTOMS as readonly string[]).includes(s)) counts[phase].set(s as Symptom, (counts[phase].get(s as Symptom) ?? 0) + 1);
    }
  }
  const symptomsByPhase = {} as CycleAnalytics['symptomsByPhase'];
  for (const phase of PHASES) {
    symptomsByPhase[phase] = {
      days: days[phase],
      symptoms: [...counts[phase]].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([symptom, count]) => ({ symptom, count })),
    };
  }
  return { cycles, periods: closed, symptomsByPhase };
}

export type Intensity = 'rest' | 'gentle' | 'moderate' | 'high';

export interface CycleAdvice {
  phase: Phase;
  cycleDay: number;
  /** 1–5 */
  energy: number;
  /** De dónde sale: lo que anotó hoy, su promedio en esta fase o el patrón típico. */
  energySource: 'today' | 'history' | 'typical';
  /** Síntomas de hoy o los que suele tener en esta fase. */
  symptoms: Symptom[];
  symptomsSource: 'today' | 'history' | null;
  intensity: Intensity;
  training: { title: string; body: string; load: string; ideas: string[] };
  habits: { title: string; body: string };
  /**
   * Hoy puede pausar sus hábitos de ejercicio sin romper su racha. Solo con lo
   * que anotó hoy (energía baja, síntomas que piden calma o flujo abundante):
   * una predicción nunca pausa nada.
   */
  pauseFitness: boolean;
  /** Una frase sobre el momento del ciclo. */
  note: string;
}

const TRAINING: Record<Intensity, CycleAdvice['training']> = {
  rest: {
    title: 'Hoy toca descanso activo',
    body: 'Tu cuerpo pide pausa. Un paseo corto, estirar o respirar unos minutos también es entrenar.',
    load: 'Descanso o movimiento muy suave',
    ideas: ['Caminata suave de 15 a 20 minutos', 'Estiramientos o yoga restaurativo', 'Calor local y agua si hay cólicos'],
  },
  gentle: {
    title: 'Movimiento suave',
    body: 'Baja la intensidad: técnica, movilidad y cardio ligero. Para en cuanto algo duela.',
    load: 'Baja cargas y series un 30–40 %',
    ideas: ['Yoga o pilates suave', 'Caminar 30 minutos', 'Pesas ligeras con más descanso entre series'],
  },
  moderate: {
    title: 'Ritmo constante',
    body: 'Buen día para una sesión moderada. Calienta sin prisa y bebe agua.',
    load: 'Tu volumen de siempre',
    ideas: ['Fuerza con tus cargas habituales', 'Cardio continuo de 30 a 40 minutos', 'Natación o bici a ritmo cómodo'],
  },
  high: {
    title: 'Día para exigirte',
    body: 'Tu energía está alta: aprovecha para progresar. Calienta bien antes del esfuerzo fuerte.',
    load: 'Puedes subir un 5–10 %',
    ideas: ['Intervalos o HIIT', 'Intentar una marca personal', 'Subir cargas o probar algo nuevo'],
  },
};

function noteFor(phase: Phase, cycleDay: number, shape: CycleShape): string {
  if (phase === 'menstrual') return 'Durante el periodo, el descanso, el agua y comer bien ayudan más que nunca.';
  if (phase === 'follicular') return 'La energía suele subir día a día: buen momento para empezar retos.';
  if (phase === 'ovulation') return 'Para muchas personas es el pico de energía del ciclo.';
  if (cycleDay > shape.length - 5) return 'Antes del periodo es normal tener menos energía o más antojos. Sé amable contigo.';
  return 'La energía se mantiene; el cuerpo agradece dormir bien y beber más agua.';
}

export function adviceFor(snap: Pick<CycleSnapshot, 'phase' | 'cycleDay' | 'shape'>, todayLog: DayLogRow | null, pattern: CyclePatterns): CycleAdvice {
  const { phase, cycleDay, shape } = snap;
  const fromHistory = pattern.energy[phase];
  const energy = todayLog?.energy ?? fromHistory ?? typicalEnergy(cycleDay, shape);
  const energySource: CycleAdvice['energySource'] = todayLog?.energy != null ? 'today' : fromHistory != null ? 'history' : 'typical';

  const loggedSymptoms = (todayLog?.symptoms ?? []).filter((s): s is Symptom => (SYMPTOMS as readonly string[]).includes(s));
  const symptoms = loggedSymptoms.length ? loggedSymptoms : pattern.symptoms[phase];
  const symptomsSource: CycleAdvice['symptomsSource'] = loggedSymptoms.length ? 'today' : symptoms.length ? 'history' : null;

  const demandingToday = loggedSymptoms.some((s) => DEMANDING.includes(s));
  const heavyToday = todayLog?.flow === 'heavy';
  const intensity: Intensity = energy <= 1 || (demandingToday && energy <= 2) ? 'rest'
    : energy <= 2 || demandingToday || heavyToday ? 'gentle'
    : energy === 3 ? 'moderate'
    : 'high';
  const pauseFitness = Boolean(todayLog) && ((todayLog?.energy != null && todayLog.energy <= 2) || demandingToday || heavyToday);

  const habits = intensity === 'rest' || intensity === 'gentle'
    ? {
      title: 'Hábitos en modo esencial',
      body: pauseFitness
        ? 'Empieza por los más fáciles. Si hoy el ejercicio no es para ti, páusalo: su racha no se rompe.'
        : 'Empieza por los más fáciles y deja los exigentes para cuando te sientas mejor.',
    }
    : intensity === 'moderate'
      ? { title: 'Mantén el ritmo', body: 'Completa tus hábitos de siempre y guarda un rato para descansar.' }
      : { title: 'Buen día para lo difícil', body: 'Aprovecha la energía para los hábitos que más te cuestan.' };

  return {
    phase, cycleDay, energy, energySource, symptoms, symptomsSource, intensity,
    training: TRAINING[intensity], habits, pauseFitness, note: noteFor(phase, cycleDay, shape),
  };
}
