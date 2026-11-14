// Cuentas del módulo académico: promedio ponderado de una materia, qué nota hace falta, promedio del periodo,
// «dónde mejorar» y qué tan bien predice la persona sus propias notas. Lógica pura (sin red ni React): se
// prueba en tests/unit/academic.unit.ts.
import type { AcademicCourse, AcademicGrade, AcademicTask, GradeKind } from '@/services/academic.service';
import type { StudyDue } from './reminderPlan';

const DAY_MS = 86_400_000;

/** Evaluaciones y temas a la vista (lo archivado no cuenta). */
export const live = <T extends { archivedAt: string | null }>(items: T[]) => items.filter((item) => !item.archivedAt);
const graded = (course: AcademicCourse) => live(course.grades).filter((g): g is AcademicGrade & { score: number } => g.score !== null);
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
export const round2 = (n: number) => Math.round(n * 100) / 100;
const range = (course: Pick<AcademicCourse, 'scaleMin' | 'scaleMax'>) => course.scaleMax - course.scaleMin;

/** Días de calendario desde hoy hasta una fecha guardada (negativo: ya pasó). */
export function daysUntil(iso: string, now = new Date()): number {
  const day = new Date(iso);
  const target = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
  return Math.round((target - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / DAY_MS);
}

export type CourseStatus = 'empty' | 'passed' | 'onTrack' | 'atRisk' | 'lost';

export interface CourseStats {
  /** Promedio ponderado de lo ya calificado (null sin notas). */
  average: number | null;
  /** % de la materia ya calificado. */
  gradedWeight: number;
  /** % de la materia que tiene evaluación creada (calificada o no). */
  assignedWeight: number;
  /** % que falta por calificar: lo creado sin nota más lo que aún no tiene evaluación. */
  pendingWeight: number;
  /** Puntos ya ganados sobre la nota final. */
  earned: number;
  /** Nota media que hace falta en lo que queda para aprobar; null si ya no queda nada. */
  neededToPass: number | null;
  /** Lo mismo para la meta de la persona (null sin meta). */
  neededForTarget: number | null;
  status: CourseStatus;
}

export function courseStats(course: AcademicCourse): CourseStats {
  const all = live(course.grades);
  const done = graded(course);
  const gradedWeight = done.reduce((sum, g) => sum + g.weight, 0);
  const assignedWeight = all.reduce((sum, g) => sum + g.weight, 0);
  const pendingWeight = Math.max(0, 100 - gradedWeight);
  const earned = done.reduce((sum, g) => sum + (g.score * g.weight) / 100, 0);
  const average = gradedWeight > 0 ? earned / (gradedWeight / 100) : null;
  const needed = (goal: number) => (pendingWeight > 0 ? (goal - earned) / (pendingWeight / 100) : null);
  const neededToPass = needed(course.passGrade);

  let status: CourseStatus;
  if (average === null) status = 'empty';
  else if (neededToPass === null) status = earned >= course.passGrade - 1e-9 ? 'passed' : 'lost';
  else if (neededToPass <= course.scaleMin) status = 'passed';
  else if (neededToPass > course.scaleMax + 1e-9) status = 'lost';
  else status = neededToPass > average ? 'atRisk' : 'onTrack';

  return {
    average, gradedWeight, assignedWeight, pendingWeight, earned, neededToPass,
    neededForTarget: course.targetGrade === null ? null : needed(course.targetGrade),
    status,
  };
}

/** Periodos con materias activas, el más reciente primero. */
export function periodsOf(courses: AcademicCourse[]): string[] {
  const latest = new Map<string, string>();
  for (const c of live(courses)) if ((latest.get(c.period) ?? '') < c.createdAt) latest.set(c.period, c.createdAt);
  return [...latest].sort((a, b) => b[1].localeCompare(a[1])).map(([period]) => period);
}

export interface PeriodStats {
  /** Promedio del periodo ponderado por créditos, en la escala de sus materias (null sin notas). */
  average: number | null;
  /** El mismo promedio como parte de la escala, 0–1 (para el aro). */
  ratio: number | null;
  scaleMin: number;
  scaleMax: number;
  passGrade: number;
  credits: number;
  atRisk: number;
  /** % calificado del periodo, ponderado por créditos. */
  gradedWeight: number;
}

/**
 * Promedio del periodo. Cada materia entra con su promedio llevado a 0–1 de su propia escala, así un periodo
 * con escalas mezcladas no se desvirtúa; el resultado se muestra en la escala de la primera materia.
 */
export function periodStats(courses: AcademicCourse[]): PeriodStats {
  const active = live(courses);
  const stats = active.map((course) => ({ course, s: courseStats(course) }));
  const withNotes = stats.filter(({ s }) => s.average !== null);
  const credits = active.reduce((sum, c) => sum + c.credits, 0);
  const base = active[0] ?? { scaleMin: 0, scaleMax: 5, passGrade: 3 };
  const weight = withNotes.reduce((sum, { course }) => sum + course.credits, 0);
  const ratio = weight ? withNotes.reduce((sum, { course, s }) => sum + ((s.average! - course.scaleMin) / range(course)) * course.credits, 0) / weight : null;
  return {
    average: ratio === null ? null : base.scaleMin + ratio * (base.scaleMax - base.scaleMin),
    ratio,
    scaleMin: base.scaleMin,
    scaleMax: base.scaleMax,
    passGrade: base.passGrade,
    credits,
    atRisk: stats.filter(({ s }) => s.status === 'atRisk' || s.status === 'lost').length,
    gradedWeight: credits ? stats.reduce((sum, { course, s }) => sum + s.gradedWeight * course.credits, 0) / credits : 0,
  };
}

// ─── Dónde mejorar ────────────────────────────────────────────────────────────

/**
 * lost: ya no alcanza ni con la nota máxima · needed: necesita más de lo que lleva · topics: evaluación cerca
 * con temas sin practicar · weakKind: un tipo de evaluación le baja la nota · trend: las últimas notas bajan
 */
export type InsightKind = 'lost' | 'needed' | 'topics' | 'weakKind' | 'trend';

export interface Insight {
  courseId: string;
  course: string;
  kind: InsightKind;
  /** 0–100: cuánto urge. */
  severity: number;
  /** needed/lost: la nota que hace falta · weakKind: promedio de ese tipo · trend: promedio reciente */
  value?: number;
  /** weakKind: promedio del resto · trend: promedio de antes */
  other?: number;
  gradeKind?: GradeKind;
  /** topics: temas sin practicar, días que faltan y la evaluación */
  count?: number;
  days?: number;
  title?: string;
}

const UPCOMING_DAYS = 14;

export function improvementAreas(courses: AcademicCourse[], now = new Date()): Insight[] {
  const out: Insight[] = [];
  for (const course of live(courses)) {
    const s = courseStats(course);
    const span = range(course);
    const push = (insight: Omit<Insight, 'courseId' | 'course'>) => out.push({ courseId: course.id, course: course.name, ...insight, severity: Math.round(Math.min(100, insight.severity)) });

    if (s.status === 'lost' && s.neededToPass !== null) push({ kind: 'lost', severity: 100, value: s.neededToPass });
    else if (s.status === 'atRisk') push({ kind: 'needed', severity: 60 + 35 * Math.min(1, (s.neededToPass! - s.average!) / span), value: s.neededToPass! });

    // Evaluación cercana con temas sin practicar (los temas sin evaluación asignada cuentan para la próxima).
    const next = live(course.grades)
      .filter((g) => g.score === null && g.date && daysUntil(g.date, now) >= 0 && daysUntil(g.date, now) <= UPCOMING_DAYS)
      .sort((a, b) => a.date!.localeCompare(b.date!))[0];
    if (next) {
      const pending = live(course.topics).filter((t) => t.mastery < 2 && (t.gradeId === next.id || t.gradeId === null)).length;
      const days = daysUntil(next.date!, now);
      if (pending > 0) push({ kind: 'topics', severity: 40 + Math.min(40, pending * 5) + (UPCOMING_DAYS - days) * 1.5, count: pending, days, title: next.title });
    }

    // Un tipo de evaluación (quices, talleres…) que queda claramente por debajo del resto.
    const done = graded(course);
    const kinds = [...new Set(done.map((g) => g.kind))];
    if (kinds.length >= 2) {
      const weakest = kinds
        .map((kind) => ({ kind, own: done.filter((g) => g.kind === kind), rest: done.filter((g) => g.kind !== kind) }))
        .filter(({ own }) => own.length >= 2)
        .map(({ kind, own, rest }) => ({ kind, avg: mean(own.map((g) => g.score)), restAvg: mean(rest.map((g) => g.score)) }))
        .sort((a, b) => (a.avg - a.restAvg) - (b.avg - b.restAvg))[0];
      const gap = weakest ? weakest.restAvg - weakest.avg : 0;
      if (weakest && gap >= span * 0.1) push({ kind: 'weakKind', severity: 30 + (gap / span) * 80, value: weakest.avg, other: weakest.restAvg, gradeKind: weakest.kind });
    }

    // Tendencia: las dos últimas notas frente a las anteriores.
    const dated = done.filter((g) => g.date).sort((a, b) => a.date!.localeCompare(b.date!));
    if (dated.length >= 3) {
      const recent = mean(dated.slice(-2).map((g) => g.score));
      const before = mean(dated.slice(0, -2).map((g) => g.score));
      const drop = before - recent;
      if (drop >= span * 0.1) push({ kind: 'trend', severity: 25 + (drop / span) * 80, value: recent, other: before });
    }
  }
  return out.sort((a, b) => b.severity - a.severity);
}

// ─── Calibración: ¿qué tan bien predices tus notas? ──────────────────────────

export interface Calibration {
  /** Evaluaciones con predicción y nota. */
  n: number;
  /** Media de (predicción − nota) como parte de la escala: positivo = esperas de más. */
  bias: number;
  /** Desvío medio sin signo, como parte de la escala. */
  error: number;
}

/** Predicciones necesarias antes de dar un sesgo por bueno. */
export const CALIBRATION_MIN = 3;

export function calibration(courses: AcademicCourse[]): Calibration | null {
  const diffs = live(courses).flatMap((course) => graded(course)
    .filter((g) => g.predicted !== null)
    .map((g) => (g.predicted! - g.score) / range(course)));
  if (!diffs.length) return null;
  return { n: diffs.length, bias: mean(diffs), error: mean(diffs.map(Math.abs)) };
}

/** La nota que cabe esperar según el historial: la predicción corregida con el sesgo de la persona. */
export function calibrated(predicted: number, course: Pick<AcademicCourse, 'scaleMin' | 'scaleMax'>, cal: Calibration | null): number | null {
  if (!cal || cal.n < CALIBRATION_MIN) return null;
  return Math.min(course.scaleMax, Math.max(course.scaleMin, predicted - cal.bias * range(course)));
}

// ─── Lo que viene ─────────────────────────────────────────────────────────────

export interface Upcoming { id: string; type: 'exam' | 'task'; title: string; courseId: string | null; course: string | null; days: number; date: string }

/** Evaluaciones por presentar y entregas abiertas, de la más cercana a la más lejana (las vencidas primero). */
export function upcoming(courses: AcademicCourse[], tasks: AcademicTask[], now = new Date()): Upcoming[] {
  const active = live(courses);
  const name = (id: string | null) => active.find((c) => c.id === id)?.name ?? null;
  const exams = active.flatMap((c) => live(c.grades)
    .filter((g) => g.score === null && g.date && daysUntil(g.date, now) >= 0)
    .map((g): Upcoming => ({ id: g.id, type: 'exam', title: g.title, courseId: c.id, course: c.name, days: daysUntil(g.date!, now), date: g.date! })));
  const open = live(tasks).filter((t) => !t.done)
    .map((t): Upcoming => ({ id: t.id, type: 'task', title: t.title, courseId: t.courseId, course: name(t.courseId), days: daysUntil(t.dueAt, now), date: t.dueAt }));
  return [...exams, ...open].sort((a, b) => a.days - b.days);
}

/** Lo que entra en los recordatorios (lib/reminderPlan): cada evaluación lleva sus temas sin practicar. */
export function studyDues(courses: AcademicCourse[], tasks: AcademicTask[], now = new Date()): StudyDue[] {
  const active = live(courses);
  return upcoming(active, tasks, now).filter((u) => u.days >= 0).map((u) => {
    const course = u.type === 'exam' ? active.find((c) => c.id === u.courseId) : undefined;
    return {
      id: u.id, type: u.type, title: u.title, course: u.course, date: u.date,
      ...(course && { pendingTopics: live(course.topics).filter((t) => t.mastery < 2 && (t.gradeId === u.id || t.gradeId === null)).length }),
    };
  });
}

/** Nota con los decimales de su escala: «4,2» en 0–5 y «85» en 0–100. */
export function formatGrade(value: number, scaleMax: number, locale: string): string {
  const digits = scaleMax > 20 ? 0 : scaleMax > 10 ? 1 : 2;
  return value.toLocaleString(locale, { minimumFractionDigits: Math.min(1, digits), maximumFractionDigits: digits });
}
