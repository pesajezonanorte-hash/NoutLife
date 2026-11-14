// NoutLife v5: carteras, pronóstico de carga, banda sonora del enfoque, académico y oficina.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prisma } from '../src/lib/prisma';
import { ApiError } from '../src/lib/http';
import { V5_SQL } from '../src/lib/v5-migrations';
import { cycleStart, netWorth, summarizeAccount, type AccountRow } from '../src/lib/wallets';
import { buildPulse, habitRateByWeekday, levelOf, sleepDebt, type PulseInput } from '../src/lib/pulse';
import { rankSoundtracks } from '../src/services/focus.service';
import { createGrade, updateCourse, updateTask } from '../src/services/academic.service';
import { createCourseSchema, createGradeSchema, createTaskSchema, updateTopicSchema } from '../src/schemas/academic.schemas';
import { createAccountSchema, createTransactionSchema, createTransferSchema } from '../src/schemas/finance.schemas';
import { BLANK, CONTENT_SCHEMAS, officeAiSchema } from '../src/schemas/office.schemas';
import { parseSlides } from '../src/services/office.service';
import { completeFocusSchema } from '../src/schemas/focus.schemas';

type Client = Record<string, Record<string, unknown>>;
const client = prisma as unknown as Client;

/** Sustituye métodos de Prisma durante la prueba (sin base de datos). */
async function withMocks(mocks: Record<string, Record<string, unknown>>, run: () => Promise<void>) {
  const saved: Array<[string, string, unknown]> = [];
  for (const [model, methods] of Object.entries(mocks)) {
    for (const [name, fn] of Object.entries(methods)) {
      saved.push([model, name, client[model][name]]);
      client[model][name] = fn;
    }
  }
  try { await run(); } finally { for (const [model, name, fn] of saved) client[model][name] = fn; }
}

const says = (text: RegExp, status = 400) => (err: unknown) => err instanceof ApiError && err.status === status && text.test(err.message);

// ─── Migración ────────────────────────────────────────────────────────────────

test('la migración v5 se puede repetir: cada sentencia es idempotente', () => {
  for (const sql of V5_SQL) {
    assert.ok(/IF NOT EXISTS|EXCEPTION WHEN duplicate_object|ENABLE ROW LEVEL SECURITY/.test(sql), sql.slice(0, 80));
  }
});

// ─── Carteras ─────────────────────────────────────────────────────────────────

const utc = (iso: string) => new Date(`${iso}T15:00:00Z`);
const account = (over: Partial<AccountRow> = {}): AccountRow => ({ id: 'a', kind: 'WALLET', openingBalance: 0, creditLimit: null, cutoffDay: null, archivedAt: null, ...over });

test('el ciclo de una tarjeta empieza el día siguiente a su último corte', () => {
  assert.equal(cycleStart(15, utc('2026-11-20')).toISOString().slice(0, 10), '2026-11-16');
  assert.equal(cycleStart(15, utc('2026-11-15')).toISOString().slice(0, 10), '2026-10-16', 'el día de corte aún es del ciclo que se cierra');
  assert.equal(cycleStart(15, utc('2026-01-03')).toISOString().slice(0, 10), '2025-12-16', 'cruza el año');
  assert.equal(cycleStart(31, utc('2026-03-10')).toISOString().slice(0, 10), '2026-03-01', 'un corte el 31 cae en el último día de febrero');
  assert.equal(cycleStart(null, utc('2026-11-20')).toISOString().slice(0, 10), '2026-11-01', 'sin corte: el mes del calendario');
});

test('saldo de una cartera: saldo inicial, movimientos y traslados', () => {
  const nequi = summarizeAccount(
    account({ id: 'nequi', openingBalance: 100_000 }),
    [{ accountId: 'nequi', type: 'INCOME', amount: 50_000 }, { accountId: 'nequi', type: 'EXPENSE', amount: 30_000 }, { accountId: 'otra', type: 'EXPENSE', amount: 999 }],
    [{ accountId: 'nequi', amount: 20_000 }],
    [{ accountId: 'nequi', amount: 5_000 }],
    [{ accountId: 'nequi', amount: 30_000, date: utc('2026-11-10') }, { accountId: 'nequi', amount: 7_000, date: utc('2026-10-28') }],
    utc('2026-11-20'),
  );
  assert.equal(nequi.balance, 135_000);
  assert.equal(nequi.monthSpent, 30_000, 'solo los gastos de este mes');
  assert.equal(nequi.cycleSpent, null);
  assert.equal(nequi.available, null);
});

test('tarjeta de crédito: lo que se debe resta, pagarla es un traslado y el cupo se mide', () => {
  const card = account({ id: 'visa', kind: 'CREDIT_CARD', openingBalance: 200_000, creditLimit: 1_000_000, cutoffDay: 15 });
  const summary = summarizeAccount(
    card,
    [{ accountId: 'visa', type: 'EXPENSE', amount: 300_000 }],
    [{ accountId: 'visa', amount: 100_000 }],
    [],
    [{ accountId: 'visa', amount: 250_000, date: utc('2026-11-17') }, { accountId: 'visa', amount: 50_000, date: utc('2026-11-12') }],
    utc('2026-11-20'),
  );
  assert.equal(summary.balance, -400_000, 'debía 200, gastó 300 y pagó 100');
  assert.equal(summary.available, 600_000);
  assert.equal(summary.usage, 0.4);
  assert.equal(summary.cycleSpent, 250_000, 'solo lo gastado desde el corte del 15');
  assert.equal(summary.monthSpent, 300_000);

  const totals = netWorth(
    [{ ...card, ...summary }, { ...account({ id: 'efectivo', kind: 'CASH' }), balance: 80_000, monthSpent: 0, cycleSpent: null, available: null, usage: null },
      { ...account({ id: 'vieja', archivedAt: new Date() }), balance: 5_000_000, monthSpent: 0, cycleSpent: null, available: null, usage: null }],
    [{ accountId: null, type: 'INCOME', amount: 10_000 }, { accountId: null, type: 'EXPENSE', amount: 4_000 }, { accountId: 'visa', type: 'EXPENSE', amount: 300_000 }],
  );
  assert.deepEqual(totals, { unassigned: 6_000, assets: 80_000, debt: 400_000, total: -314_000 }, 'las archivadas no cuentan');
});

test('esquemas de carteras: nunca el número completo de la tarjeta', () => {
  assert.equal(createAccountSchema.safeParse({ name: 'Nequi', kind: 'WALLET' }).success, true);
  assert.equal(createAccountSchema.safeParse({ name: 'Visa', kind: 'CREDIT_CARD', last4: '4242', creditLimit: 2_000_000, cutoffDay: 15, dueDay: 30 }).success, true);
  assert.equal(createAccountSchema.safeParse({ name: 'Visa', kind: 'CREDIT_CARD', last4: '4242424242424242' }).success, false);
  assert.equal(createAccountSchema.safeParse({ name: 'x', kind: 'CRYPTO' }).success, false);
  assert.equal(createAccountSchema.safeParse({ name: 'x', kind: 'BANK', openingBalance: -1 }).success, false);
  assert.equal(createAccountSchema.safeParse({ name: 'x', kind: 'BANK', userId: 'otro' }).success, false, 'no se cuelan campos ajenos');
  assert.equal(createTransferSchema.safeParse({ fromAccountId: 'a', toAccountId: 'a', amount: 10 }).success, false, 'dos carteras distintas');
  assert.equal(createTransferSchema.safeParse({ fromAccountId: 'a', toAccountId: 'b', amount: 10, date: '2026-11-14' }).success, true);
  assert.equal(createTransactionSchema.safeParse({ type: 'EXPENSE', amount: 10, category: 'FOOD', accountId: 'a' }).success, true);
  assert.equal(createTransactionSchema.safeParse({ type: 'EXPENSE', amount: 10, category: 'FOOD', accountId: null }).success, true);
});

// ─── Pronóstico de carga ──────────────────────────────────────────────────────

const quiet: PulseInput = { today: '2026-11-16', exams: [], tasks: [], events: [], habits: [], habitRate: Array(7).fill(null), nights: [], dues: [] };

test('semana sin nada: siete días despejados y consejo de calma', () => {
  const pulse = buildPulse(quiet);
  assert.equal(pulse.days.length, 7);
  assert.deepEqual(pulse.days.map((d) => d.day), ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']);
  assert.ok(pulse.days.every((d) => d.load === 0 && d.level === 'clear'));
  assert.deepEqual(pulse.advice, { kind: 'calm' });
});

test('un parcial con temas sin dominar hace tormenta ese día, pesa la víspera y aconseja repasar', () => {
  const pulse = buildPulse({
    ...quiet,
    exams: [{ day: '2026-11-19', title: 'Parcial 2', course: 'Cálculo', weight: 30, pendingTopics: 4 }],
    tasks: [{ day: '2026-11-19', title: 'Taller' }, { day: '2026-11-19', title: 'Ensayo' }],
  });
  const [mon, , wed, thu] = pulse.days;
  assert.equal(thu.level, 'storm');
  assert.equal(thu.factors[0].kind, 'exam');
  assert.equal(thu.factors[0].title, 'Parcial 2');
  assert.ok(wed.load > mon.load, 'la víspera carga más que un día cualquiera');
  assert.deepEqual(pulse.advice, { kind: 'study', day: '2026-11-19', to: '2026-11-16', title: 'Cálculo', count: 4 });
});

test('entregas amontonadas: aconseja adelantar al día más ligero de antes; si es hoy, por dónde empezar', () => {
  const tasks = ['A', 'B', 'C'].map((title) => ({ day: '2026-11-18', title }));
  const events = Array.from({ length: 3 }, () => ({ day: '2026-11-18' }));
  const later = buildPulse({ ...quiet, tasks, events, habits: [{ days: null }, { days: null }] });
  assert.equal(later.advice.kind, 'move');
  assert.equal(later.advice.day, '2026-11-18');
  assert.equal(later.advice.title, 'A');
  assert.ok(['2026-11-16', '2026-11-17'].includes(later.advice.to!));

  const today = buildPulse({ ...quiet, today: '2026-11-18', tasks, events });
  assert.deepEqual(today.advice, { kind: 'today', day: '2026-11-18', title: 'A' });
});

test('el sueño atrasado pesa hoy y se va diluyendo', () => {
  assert.equal(sleepDebt([5, 6, 5.5]), 2);
  assert.equal(sleepDebt([8, 9]), 0);
  assert.equal(sleepDebt([]), 0, 'sin registros no se inventa deuda');
  const pulse = buildPulse({ ...quiet, nights: [5, 6, 5.5] });
  const points = pulse.days.map((d) => d.factors.find((f) => f.kind === 'sleep')?.points ?? 0);
  assert.deepEqual(points, [12, 6, 3, 0, 0, 0, 0]);
  assert.deepEqual(pulse.advice, { kind: 'sleep', count: 2 });
});

test('los hábitos pesan más el día de la semana en que se suelen quedar', () => {
  const habits = [{ days: null }, { days: null }, { days: [1] }];
  // Lunes 2026-11-16: cumple casi todo. Martes: casi nada.
  const rate = habitRateByWeekday(habits, ['2026-11-09', '2026-11-09', '2026-11-09', '2026-11-02', '2026-11-02', '2026-11-02', '2026-11-10'], 2);
  assert.equal(rate[1], 1);
  assert.equal(rate[2], 0.25);
  assert.equal(habitRateByWeekday([], [], 4)[3], null, 'sin hábitos no hay tasa');
  const pulse = buildPulse({ ...quiet, habits, habitRate: rate });
  const pts = (i: number) => pulse.days[i].factors.find((f) => f.kind === 'habits')!.points;
  assert.ok(pts(1) > pts(0), 'el martes, con menos hábitos, pesa más porque se le suelen quedar');
  assert.equal(levelOf(34), 'clear');
  assert.equal(levelOf(35), 'cloudy');
  assert.equal(levelOf(65), 'storm');
});

// ─── Banda sonora del enfoque ─────────────────────────────────────────────────

test('con qué sonido terminas más: pide un mínimo de sesiones antes de comparar', () => {
  const s = (soundtrack: string | null, plannedMin: number | null, durationMin: number) => ({ soundtrack, plannedMin, durationMin });
  const ranked = rankSoundtracks([
    s('rain', 25, 25), s('rain', 25, 20), s('rain', 50, 50),
    s('spotify:deep-focus', 25, 10), s('spotify:deep-focus', 25, 12), s('spotify:deep-focus', 25, 25),
    s('fire', 25, 25),
    s(null, 25, 25), s('waves', null, 25),
  ]);
  assert.deepEqual(ranked.map((r) => r.id), ['rain', 'spotify:deep-focus', 'fire'], 'una sola sesión perfecta no gana a tres');
  assert.deepEqual(ranked[0], { id: 'rain', sessions: 3, completion: 0.93 });
  assert.equal(completeFocusSchema.safeParse({ durationMin: 25, plannedMin: 25, soundtrack: 'spotify:deep-focus' }).success, true);
  assert.equal(completeFocusSchema.safeParse({ durationMin: 25, soundtrack: '<script>' }).success, false);
});

// ─── Académico ────────────────────────────────────────────────────────────────

test('esquemas académicos: fechas de calendario, pesos y dominio dentro de rango', () => {
  assert.deepEqual(createCourseSchema.parse({ name: ' Cálculo ', period: '2026-2' }), { name: 'Cálculo', period: '2026-2' });
  assert.equal(createCourseSchema.safeParse({ name: '', period: '2026-2' }).success, false);
  assert.equal(createGradeSchema.safeParse({ title: 'Parcial', weight: 30, score: 4.2, date: '2026-11-20' }).success, true);
  assert.equal(createGradeSchema.safeParse({ title: 'Parcial', weight: 0 }).success, false);
  assert.equal(createGradeSchema.safeParse({ title: 'Parcial', weight: 101 }).success, false);
  assert.equal(createGradeSchema.safeParse({ title: 'Parcial', weight: 30, date: '2026-02-30' }).success, false, 'el 30 de febrero no existe');
  assert.equal(createTaskSchema.safeParse({ title: 'Entregar taller', dueAt: '2026-11-20' }).success, true);
  assert.equal(createTaskSchema.safeParse({ title: 'Entregar taller' }).success, false, 'un compromiso lleva fecha');
  assert.equal(updateTopicSchema.safeParse({ mastery: 4 }).success, false);
  assert.equal(updateTopicSchema.safeParse({ mastery: 3, archived: true }).success, true);
});

const course = (grades: Array<{ id: string; title: string; weight: number; score: number | null; archivedAt: Date | null }>) => ({
  id: 'c1', userId: 'u1', scaleMin: 0, scaleMax: 5, passGrade: 3, targetGrade: null, grades, topics: [],
});

test('una evaluación no entra si los pesos pasan de 100 % o la nota se sale de la escala', async () => {
  const existing = [
    { id: 'g1', title: 'Parcial 1', weight: 40, score: 3.5, archivedAt: null },
    { id: 'g2', title: 'Parcial 2', weight: 40, score: null, archivedAt: null },
    { id: 'g3', title: 'Anulada', weight: 50, score: null, archivedAt: new Date() },
  ];
  let created: unknown = null;
  await withMocks({
    academicCourse: { findFirst: async () => course(existing) },
    academicGrade: { create: async ({ data }: { data: unknown }) => { created = data; return data; } },
  }, async () => {
    await assert.rejects(() => createGrade('u1', 'c1', { title: 'Final', weight: 30 }), says(/sumarían 110 %/));
    await assert.rejects(() => createGrade('u1', 'c1', { title: 'Final', weight: 20, score: 5.5 }), says(/La nota debe estar entre 0 y 5/));
    await assert.rejects(() => createGrade('u1', 'c1', { title: 'Final', weight: 20, predicted: -1 }), says(/Tu predicción/));
    await createGrade('u1', 'c1', { title: 'Final', weight: 20, predicted: 4, date: '2026-12-01' });
    assert.equal((created as { date: Date }).date.toISOString(), '2026-12-01T12:00:00.000Z', 'el día cae al mediodía UTC');
  });
});

test('la materia de otra persona responde como si no existiera', async () => {
  await withMocks({ academicCourse: { findFirst: async () => null } }, async () => {
    await assert.rejects(() => createGrade('u2', 'c1', { title: 'Final', weight: 20 }), says(/ya no existe/, 404));
    await assert.rejects(() => updateCourse('u2', 'c1', { name: 'Mía' }), says(/ya no existe/, 404));
  });
});

test('cambiar la escala no puede dejar fuera una nota ya puesta', async () => {
  await withMocks({
    academicCourse: { findFirst: async () => course([{ id: 'g1', title: 'Parcial 1', weight: 40, score: 4.5, archivedAt: null }]) },
  }, async () => {
    await assert.rejects(() => updateCourse('u1', 'c1', { scaleMax: 4 }), says(/Parcial 1/));
    await assert.rejects(() => updateCourse('u1', 'c1', { scaleMin: 5 }), says(/mayor que la mínima/));
    await assert.rejects(() => updateCourse('u1', 'c1', { passGrade: 6 }), says(/dentro de la escala/));
  });
});

test('marcar un compromiso pone la fecha de cierre una sola vez', async () => {
  const writes: Array<Record<string, unknown>> = [];
  await withMocks({
    academicTask: {
      findFirst: async () => ({ id: 't1', done: true }),
      update: async ({ data }: { data: Record<string, unknown> }) => { writes.push(data); return data; },
    },
  }, async () => {
    await updateTask('u1', 't1', { done: true, title: 'Otro nombre' });
    assert.equal('doneAt' in writes[0], false, 'ya estaba hecho: la fecha no se mueve');
    await updateTask('u1', 't1', { done: false });
    assert.equal(writes[1].done, false);
    assert.equal(writes[1].doneAt, null);
  });
});

// ─── Oficina ──────────────────────────────────────────────────────────────────

test('cada tipo de archivo nace con un contenido válido y rechaza el de otro tipo', () => {
  for (const kind of ['doc', 'sheet', 'slides'] as const) assert.equal(CONTENT_SCHEMAS[kind].safeParse(BLANK[kind]()).success, true, kind);
  assert.equal(CONTENT_SCHEMAS.sheet.safeParse({ rows: 30, cols: 8, cells: { B2: '=SUM(A1:A5)' } }).success, true);
  assert.equal(CONTENT_SCHEMAS.sheet.safeParse({ rows: 30, cols: 8, cells: { 'B2); DROP': '1' } }).success, false);
  assert.equal(CONTENT_SCHEMAS.sheet.safeParse({ rows: 9999, cols: 8, cells: {} }).success, false);
  assert.equal(CONTENT_SCHEMAS.doc.safeParse(BLANK.sheet()).success, false);
  assert.equal(CONTENT_SCHEMAS.slides.safeParse({ theme: 'jade', slides: [] }).success, false, 'al menos una diapositiva');
});

test('copiloto: necesita una petición o un contenido, y limpia las diapositivas que devuelve el modelo', () => {
  assert.equal(officeAiSchema.safeParse({ action: 'write' }).success, false);
  assert.equal(officeAiSchema.safeParse({ action: 'write', prompt: 'Un ensayo sobre el agua' }).success, true);
  assert.equal(officeAiSchema.safeParse({ action: 'hack', prompt: 'x' }).success, false);
  const slides = parseSlides('```json\n{"slides":[{"layout":"title","title":"El agua","body":"Por qué importa"},{"layout":"raro","title":"Usos","body":["Beber","Regar"]},{"title":"","body":""}]}\n```');
  assert.deepEqual(slides, [
    { layout: 'title', title: 'El agua', body: 'Por qué importa' },
    { layout: 'bullets', title: 'Usos', body: 'Beber\nRegar' },
  ]);
  assert.equal(parseSlides('No pude hacerlo.'), null);
  assert.equal(parseSlides('{"slides":"nada"}'), null);
});
