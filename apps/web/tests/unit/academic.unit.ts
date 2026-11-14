import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calibrated, calibration, courseStats, daysUntil, formatGrade, improvementAreas, periodStats, periodsOf, round2, upcoming,
} from '../../src/lib/academic';
import type { AcademicCourse, AcademicGrade, AcademicTask, AcademicTopic } from '../../src/services/academic.service';

/** Sábado 14 de noviembre de 2026, 10:00 hora local. */
const NOW = new Date(2026, 10, 14, 10, 0);
const day = (offset: number) => new Date(Date.UTC(2026, 10, 14 + offset, 12)).toISOString();

let seq = 0;
const grade = (weight: number, score: number | null, over: Partial<AcademicGrade> = {}): AcademicGrade => ({
  id: `g${++seq}`, courseId: 'c', title: `Evaluación ${seq}`, kind: 'EXAM', weight, score, predicted: null, date: null, archivedAt: null, ...over,
});
const topic = (mastery: 0 | 1 | 2 | 3, over: Partial<AcademicTopic> = {}): AcademicTopic => ({
  id: `t${++seq}`, courseId: 'c', gradeId: null, title: `Tema ${seq}`, mastery, order: 0, archivedAt: null, ...over,
});
const course = (grades: AcademicGrade[], over: Partial<AcademicCourse> = {}): AcademicCourse => ({
  id: `c${++seq}`, name: 'Cálculo', period: '2026-2', teacher: null, color: 'jade', credits: 3, scaleMin: 0, scaleMax: 5, passGrade: 3,
  targetGrade: null, archivedAt: null, createdAt: '2026-08-01T00:00:00.000Z', grades, topics: [], ...over,
});

test('promedio ponderado: solo cuenta lo calificado, cada nota con su peso', () => {
  const s = courseStats(course([grade(30, 4), grade(20, 2), grade(50, null)]));
  assert.equal(round2(s.average!), 3.2, '(4×30 + 2×20) / 50');
  assert.equal(s.gradedWeight, 50);
  assert.equal(s.assignedWeight, 100);
  assert.equal(s.pendingWeight, 50);
  assert.equal(round2(s.earned), 1.6);
  assert.equal(round2(s.neededToPass!), 2.8, 'faltan 1,4 puntos en el 50 % que queda');
  assert.equal(s.status, 'onTrack', 'necesita menos de lo que lleva');
});

test('lo archivado no cuenta y lo que aún no tiene evaluación también falta por calificar', () => {
  const s = courseStats(course([grade(40, 2), grade(30, 5, { archivedAt: day(0) })]));
  assert.equal(s.average, 2);
  assert.equal(s.assignedWeight, 40);
  assert.equal(s.pendingWeight, 60, 'el 60 % sin evaluación creada sigue pendiente');
  assert.equal(round2(s.neededToPass!), 3.67);
  assert.equal(s.status, 'atRisk', 'necesita más de lo que lleva');
});

test('estados de una materia: sin notas, asegurada, perdida y cerrada', () => {
  assert.equal(courseStats(course([grade(50, null)])).status, 'empty');
  assert.equal(courseStats(course([grade(70, 4.8), grade(30, null)])).status, 'passed', 'aprueba aunque saque la mínima en lo que queda');
  const lost = courseStats(course([grade(80, 1.5), grade(20, null)]));
  assert.equal(lost.status, 'lost');
  assert.equal(round2(lost.neededToPass!), 9, 'haría falta un 9 sobre 5');
  const closed = courseStats(course([grade(60, 3), grade(40, 3)]));
  assert.equal(closed.neededToPass, null, 'no queda nada por calificar');
  assert.equal(closed.status, 'passed', 'cerró justo en la nota de aprobar');
  assert.equal(courseStats(course([grade(100, 2.9)])).status, 'lost');
});

test('meta propia: qué nota hace falta para llegar', () => {
  const s = courseStats(course([grade(50, 4)], { targetGrade: 4.5 }));
  assert.equal(round2(s.neededForTarget!), 5);
  assert.equal(courseStats(course([grade(50, 4)])).neededForTarget, null, 'sin meta no hay cuenta');
});

test('promedio del periodo: pondera por créditos y avisa de las materias en riesgo', () => {
  const calc = course([grade(100, 4)], { credits: 4 });
  const fisica = course([grade(50, 2), grade(50, null)], { credits: 2, name: 'Física' });
  const nueva = course([], { credits: 3, name: 'Química' });
  const p = periodStats([calc, fisica, nueva, course([grade(100, 1)], { archivedAt: day(0) })]);
  assert.equal(round2(p.average!), 3.33, '(4×4 + 2×2) / 6: la materia sin notas no baja el promedio');
  assert.equal(round2(p.ratio!), 0.67);
  assert.equal(p.credits, 9);
  assert.equal(p.atRisk, 1);
  assert.equal(round2(p.gradedWeight), 55.56, '(100×4 + 50×2 + 0×3) / 9');
  assert.equal(periodStats([]).average, null);
});

test('promedio del periodo con escalas mezcladas: cada materia entra como parte de su escala', () => {
  const sobre5 = course([grade(100, 4)], { credits: 1 });
  const sobre100 = course([grade(100, 60)], { credits: 1, scaleMax: 100, passGrade: 60 });
  assert.equal(round2(periodStats([sobre5, sobre100]).average!), 3.5, '0,8 y 0,6 de su escala: 0,7 de 5');
});

test('periodos: el más reciente primero, sin los que solo tienen materias archivadas', () => {
  const list = periodsOf([
    course([], { period: '2026-1', createdAt: '2026-02-01T00:00:00.000Z' }),
    course([], { period: '2026-2', createdAt: '2026-08-01T00:00:00.000Z' }),
    course([], { period: '2026-2', createdAt: '2026-08-05T00:00:00.000Z' }),
    course([], { period: '2025-2', createdAt: '2025-08-01T00:00:00.000Z', archivedAt: day(0) }),
  ]);
  assert.deepEqual(list, ['2026-2', '2026-1']);
});

test('dónde mejorar: lo perdido va primero; después lo que necesita más de lo que lleva', () => {
  const perdida = course([grade(80, 1.5), grade(20, null)], { name: 'Física' });
  const riesgo = course([grade(40, 2), grade(60, null)], { name: 'Química' });
  const bien = course([grade(50, 4.5), grade(50, null)], { name: 'Arte' });
  const areas = improvementAreas([bien, riesgo, perdida], NOW);
  assert.deepEqual(areas.map((a) => [a.course, a.kind]), [['Física', 'lost'], ['Química', 'needed']]);
  assert.equal(areas[0].severity, 100);
  assert.equal(round2(areas[1].value!), 3.67);
});

test('dónde mejorar: evaluación cerca con temas sin practicar', () => {
  const parcial = grade(30, null, { title: 'Parcial 2', date: day(5) });
  const c = course([grade(30, 4), parcial, grade(40, null, { title: 'Final', date: day(40) })]);
  c.topics = [topic(0, { gradeId: parcial.id }), topic(1), topic(3, { gradeId: parcial.id }), topic(0, { archivedAt: day(0) }), topic(0, { gradeId: 'otra' })];
  const [area] = improvementAreas([c], NOW);
  assert.equal(area.kind, 'topics');
  assert.equal(area.count, 2, 'el suyo sin ver y el que no tiene evaluación asignada; el dominado, el archivado y el de otra no');
  assert.equal(area.days, 5);
  assert.equal(area.title, 'Parcial 2');
});

test('dónde mejorar: un tipo de evaluación que baja la nota y una tendencia a la baja', () => {
  const quices = course([
    grade(10, 2, { kind: 'QUIZ' }), grade(10, 2.4, { kind: 'QUIZ' }),
    grade(20, 4.4, { kind: 'HOMEWORK' }), grade(20, 4.6, { kind: 'HOMEWORK' }),
  ]);
  const weak = improvementAreas([quices], NOW).find((a) => a.kind === 'weakKind')!;
  assert.equal(weak.gradeKind, 'QUIZ');
  assert.equal(round2(weak.value!), 2.2);
  assert.equal(round2(weak.other!), 4.5);

  const baja = course([grade(20, 4.5, { date: day(-40) }), grade(20, 4.3, { date: day(-30) }), grade(20, 3.4, { date: day(-12) }), grade(20, 3.2, { date: day(-3) })]);
  const trend = improvementAreas([baja], NOW).find((a) => a.kind === 'trend')!;
  assert.equal(round2(trend.value!), 3.3);
  assert.equal(round2(trend.other!), 4.4);
  assert.equal(improvementAreas([course([grade(50, 4.5, { date: day(-9) }), grade(50, 4.6, { date: day(-2) })])], NOW).length, 0, 'una materia que va bien no sale');
});

test('calibración: mide si esperas de más o de menos y corrige la siguiente predicción', () => {
  const c = course([grade(20, 3.5, { predicted: 4 }), grade(20, 3, { predicted: 4 }), grade(20, 4, { predicted: 4.5 }), grade(20, 5), grade(20, null, { predicted: 5 })]);
  const cal = calibration([c])!;
  assert.equal(cal.n, 3, 'solo las que tienen predicción y nota');
  assert.equal(round2(cal.bias * 5), 0.67, 'espera 0,67 de más sobre 5');
  assert.equal(round2(cal.error * 5), 0.67);
  assert.equal(round2(calibrated(4.5, c, cal)!), 3.83);
  assert.equal(calibrated(0.2, c, cal), 0, 'nunca por debajo de la escala');
  assert.equal(calibrated(4, c, { ...cal, n: 2 }), null, 'con menos de 3 predicciones no se corrige nada');
  assert.equal(calibration([course([grade(50, 4)])]), null);
});

test('lo que viene: evaluaciones por presentar y entregas abiertas, las vencidas primero', () => {
  const c = course([grade(30, null, { title: 'Parcial', date: day(3) }), grade(30, 4, { date: day(1) }), grade(20, null, { title: 'Sin fecha' })]);
  const task = (title: string, offset: number, over: Partial<AcademicTask> = {}): AcademicTask => ({
    id: title, courseId: null, title, kind: 'DELIVERY', dueAt: day(offset), done: false, doneAt: null, notes: null, archivedAt: null, ...over,
  });
  const list = upcoming([c], [task('Ensayo', 1, { courseId: c.id }), task('Vencida', -2), task('Hecha', 0, { done: true }), task('Archivada', 0, { archivedAt: day(0) })], NOW);
  assert.deepEqual(list.map((u) => [u.title, u.days, u.course]), [['Vencida', -2, null], ['Ensayo', 1, 'Cálculo'], ['Parcial', 3, 'Cálculo']]);
  assert.equal(daysUntil(day(0), NOW), 0);
  assert.equal(daysUntil(day(-1), new Date(2026, 10, 14, 23, 59)), -1, 'cuenta días de calendario, no horas');
});

test('formato de nota según la escala', () => {
  assert.equal(formatGrade(4.25, 5, 'es-CO'), '4,25');
  assert.equal(formatGrade(4, 5, 'es-CO'), '4,0');
  assert.equal(formatGrade(85.4, 100, 'en-US'), '85');
});
