// Pronóstico de carga: cuánto pesa cada uno de los próximos 7 días, juntando lo que la app ya sabe
// (evaluaciones y entregas, agenda, hábitos y cómo te va con ellos ese día de la semana, sueño atrasado y
// pagos). Es una estimación con reglas fijas, no una medida: sirve para ver venir una semana cargada y
// mover algo a tiempo. Lógica pura (sin base de datos): se prueba en tests/pulse.test.ts.

export type PulseKind = 'exam' | 'task' | 'agenda' | 'habits' | 'sleep' | 'money';
export type PulseLevel = 'clear' | 'cloudy' | 'storm';

export interface PulseInput {
  /** Día de hoy en el calendario de la persona (AAAA-MM-DD). */
  today: string;
  exams: { day: string; title: string; course: string; weight: number; pendingTopics: number }[];
  tasks: { day: string; title: string }[];
  /** Un elemento por evento de la agenda. */
  events: { day: string }[];
  /** Días de la semana en que toca cada hábito activo (0 = domingo); null = todos los días. */
  habits: { days: number[] | null }[];
  /** Por día de la semana: parte de los hábitos que sueles cumplir (0–1); null sin historial. */
  habitRate: (number | null)[];
  /** Horas dormidas en las últimas noches, la más reciente primero. */
  nights: number[];
  /** Deudas, recibos y pagos de tarjeta que vencen. */
  dues: { day: string; title: string }[];
}

export interface PulseFactor {
  kind: PulseKind;
  points: number;
  /** Cuántas cosas hay detrás (en `sleep`: horas de sueño que faltan por noche). */
  count: number;
  /** Lo que más pesa de este factor (la evaluación, la entrega, el pago). */
  title?: string;
}

export interface PulseDay { day: string; load: number; level: PulseLevel; factors: PulseFactor[] }

export interface PulseAdvice {
  /** study: repasar antes de la evaluación · move: adelantar algo a un día ligero · today: por dónde empezar hoy · sleep: recuperar sueño · calm: semana tranquila */
  kind: 'study' | 'move' | 'today' | 'sleep' | 'calm';
  /** El día cargado. */
  day?: string;
  /** El día más ligero antes de él, para adelantar. */
  to?: string;
  title?: string;
  count?: number;
}

export interface Pulse { days: PulseDay[]; advice: PulseAdvice }

export const PULSE_DAYS = 7;
export const SLEEP_NEED_HOURS = 7.5;
const CLOUDY = 35;
const STORM = 65;

export const addDays = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();
const round = (n: number) => Math.round(n * 10) / 10;

/** Horas de sueño que faltan por noche frente a lo que hace falta (0 sin datos). */
export function sleepDebt(nights: number[]): number {
  if (!nights.length) return 0;
  const avg = nights.reduce((a, b) => a + b, 0) / nights.length;
  return round(Math.max(0, SLEEP_NEED_HOURS - avg));
}

export const levelOf = (load: number): PulseLevel => (load >= STORM ? 'storm' : load >= CLOUDY ? 'cloudy' : 'clear');

export function buildPulse(input: PulseInput): Pulse {
  const debt = sleepDebt(input.nights);
  const days: PulseDay[] = Array.from({ length: PULSE_DAYS }, (_, i) => {
    const day = addDays(input.today, i);
    const next = addDays(day, 1);
    const factors: PulseFactor[] = [];
    const add = (kind: PulseKind, points: number, count: number, title?: string) => {
      if (points > 0) factors.push({ kind, points: round(points), count, ...(title && { title }) });
    };

    // Evaluaciones: pesan por su porcentaje y por los temas que faltan; la víspera también cuenta.
    const exams = input.exams.filter((e) => e.day === day).sort((a, b) => b.weight - a.weight);
    const eve = input.exams.filter((e) => e.day === next);
    const examPoints = exams.reduce((sum, e) => sum + Math.min(45, 22 + e.weight * 0.5) + Math.min(15, e.pendingTopics * 3), 0) + eve.length * 12;
    add('exam', Math.min(70, examPoints), exams.length + eve.length, (exams[0] ?? eve[0])?.title);

    const tasks = input.tasks.filter((t) => t.day === day);
    const tasksEve = input.tasks.filter((t) => t.day === next);
    add('task', Math.min(36, tasks.length * 12) + Math.min(12, tasksEve.length * 4), tasks.length + tasksEve.length, (tasks[0] ?? tasksEve[0])?.title);

    const events = input.events.filter((e) => e.day === day).length;
    add('agenda', Math.min(25, events * 5), events);

    // Hábitos: los que tocan ese día, con más peso si ese día de la semana se te suelen quedar.
    const weekday = weekdayOf(day);
    const due = input.habits.filter((h) => !h.days || h.days.includes(weekday)).length;
    const rate = input.habitRate[weekday] ?? 0.7;
    add('habits', Math.min(20, due * 2.5 * (1.3 - rate)), due);

    // El sueño atrasado pesa hoy, menos mañana y casi nada después.
    add('sleep', Math.min(24, debt * ([6, 3, 1.5][i] ?? 0)), debt);

    const dues = input.dues.filter((d) => d.day === day);
    add('money', Math.min(16, dues.length * 8), dues.length, dues[0]?.title);

    factors.sort((a, b) => b.points - a.points);
    const load = Math.min(100, Math.round(factors.reduce((sum, f) => sum + f.points, 0)));
    return { day, load, level: levelOf(load), factors };
  });

  return { days, advice: adviceFor(days, input, debt) };
}

/** Una sola sugerencia: la que más alivia el día más cargado. */
function adviceFor(days: PulseDay[], input: PulseInput, debt: number): PulseAdvice {
  const worst = [...days].sort((a, b) => b.load - a.load)[0];
  if (worst.level === 'clear') return debt >= 1 ? { kind: 'sleep', count: debt } : { kind: 'calm' };
  const index = days.indexOf(worst);
  // El día más ligero antes del cargado es donde conviene adelantar.
  const before = days.slice(0, index).sort((a, b) => a.load - b.load)[0];
  const top = worst.factors[0];
  if (top.kind === 'exam') {
    const exam = input.exams.filter((e) => e.day === worst.day || e.day === addDays(worst.day, 1)).sort((a, b) => b.weight - a.weight)[0];
    return { kind: 'study', day: worst.day, to: before?.day, title: exam?.course ?? top.title, count: exam?.pendingTopics ?? 0 };
  }
  if (top.kind === 'sleep') return { kind: 'sleep', day: worst.day, count: debt };
  // El día cargado es hoy: ya no hay a dónde adelantar, solo por dónde empezar.
  if (!before) return { kind: 'today', day: worst.day, title: top.title };
  return { kind: 'move', day: worst.day, to: before.day, title: top.title };
}

/** Parte de los hábitos cumplidos por día de la semana en las últimas `weeks` semanas. */
export function habitRateByWeekday(habits: { days: number[] | null }[], completedDays: string[], weeks = 4): (number | null)[] {
  const done = Array<number>(7).fill(0);
  for (const day of completedDays) done[weekdayOf(day)] += 1;
  return done.map((count, weekday) => {
    const due = habits.filter((h) => !h.days || h.days.includes(weekday)).length * weeks;
    return due ? Math.min(1, count / due) : null;
  });
}
