import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from '../src/lib/prisma';

// El tope por persona se lee al importar sage.service: se fija antes.
process.env.SAGE_DAILY_AI_LIMIT = '5';
process.env.SAGE_MIN_DAILY_LIMIT = '5';

type Client = Record<string, unknown>;
const client = prisma as unknown as Client;

async function withMocks<T>(mocks: Client, run: () => Promise<T>): Promise<T> {
  const original = new Map<string, unknown>();
  for (const [key, value] of Object.entries(mocks)) {
    original.set(key, client[key]);
    client[key] = value;
  }
  try {
    return await run();
  } finally {
    for (const [key, value] of original) client[key] = value;
  }
}

test('packSections: nunca supera el presupuesto, prioriza y conserva el orden', async () => {
  const { packSections } = await import('../src/services/life-context.service');
  const sections = [
    { key: 'profile' as const, title: 'PERFIL', priority: 100, lines: ['Nivel 5.'] },
    { key: 'mirror' as const, title: 'ESPEJO', priority: 10, lines: ['x'.repeat(300)] },
    { key: 'habits' as const, title: 'HÁBITOS', priority: 90, lines: ['Leer: 18/30', 'Correr: 9/13', 'Meditar: 2/30'] },
  ];
  const out = packSections(sections, 60);
  assert.ok(out.length <= 60, `salida de ${out.length} caracteres`);
  assert.ok(out.startsWith('PERFIL:'), 'sale en el orden original');
  assert.ok(out.includes('Leer: 18/30'));
  assert.ok(!out.includes('ESPEJO'), 'lo de menor prioridad es lo primero en caer');
  for (let budget = 0; budget < 400; budget += 7) assert.ok(packSections(sections, budget).length <= budget);
});

test('trimHistory: últimos mensajes, recortados, empezando por el usuario', async () => {
  const { trimHistory } = await import('../src/services/sage.service');
  // La base los devuelve del más nuevo al más viejo.
  const memories = [
    { role: 'sage', content: 'r'.repeat(2000) },
    { role: 'user', content: 'pregunta 3' },
    { role: 'sage', content: 'respuesta 2' },
    { role: 'user', content: 'pregunta 2' },
    { role: 'sage', content: 'respuesta 1' },
    { role: 'user', content: 'pregunta 1' },
    { role: 'sage', content: 'muy vieja' },
  ];
  const history = trimHistory(memories);
  assert.equal(history[0].role, 'user');
  assert.ok(history.every((m) => m.content.length <= 480));
  assert.ok(history.reduce((n, m) => n + m.content.length, 0) <= 2000);
  assert.equal(history.at(-1)?.content.length, 480, 'el más reciente va al final, recortado');
  assert.ok(!history.some((m) => m.content === 'muy vieja'), 'solo los últimos 6');
});

test('consumeSageDailyAI: con mensajes simultáneos nunca pasa del tope diario', async () => {
  const row = { sageCallsToday: 0, sageCallsResetAt: new Date(Date.now() - 2 * 86_400_000) };
  type Where = { sageCallsResetAt?: { gte?: Date; lt?: Date }; sageCallsToday?: { lt?: number } };
  const matches = (where: Where) =>
    (!where.sageCallsResetAt?.gte || row.sageCallsResetAt >= where.sageCallsResetAt.gte) &&
    (!where.sageCallsResetAt?.lt || row.sageCallsResetAt < where.sageCallsResetAt.lt) &&
    (where.sageCallsToday?.lt === undefined || row.sageCallsToday < where.sageCallsToday.lt);
  const user = {
    // Cada UPDATE se evalúa y aplica de una vez, como en Postgres; el retraso mezcla el orden.
    updateMany: async ({ where, data }: { where: Where; data: { sageCallsToday: number | { increment: number }; sageCallsResetAt?: Date } }) => {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 4));
      if (!matches(where)) return { count: 0 };
      if (typeof data.sageCallsToday === 'object') row.sageCallsToday += data.sageCallsToday.increment;
      else { row.sageCallsToday = data.sageCallsToday; row.sageCallsResetAt = data.sageCallsResetAt!; }
      return { count: 1 };
    },
    aggregate: async () => ({ _sum: { sageCallsToday: 0 } }),
    count: async () => 1,
    findUniqueOrThrow: async () => ({ ...row }),
  };
  await withMocks({ user }, async () => {
    const { consumeSageDailyAI } = await import('../src/services/sage.service');
    const results = await Promise.all(Array.from({ length: 12 }, () => consumeSageDailyAI('u-1')));
    assert.equal(results.filter(Boolean).length, 5, 'exactamente el tope');
    assert.equal(row.sageCallsToday, 5);
    assert.equal(await consumeSageDailyAI('u-1'), null, 'agotado sigue agotado');
    assert.equal(row.sageCallsToday, 5, 'un intento rechazado no consume cupo');
  });
});

test('buildLifeSnapshot: ve todas las zonas y el contexto cabe en ~800 tokens', async () => {
  const now = new Date('2026-10-13T15:00:00Z');
  const day = (n: number) => new Date(now.getTime() - n * 86_400_000);
  const empty = { findMany: async () => [], count: async () => 0, findFirst: async () => null, findUnique: async () => null };
  const many = (rows: unknown[]) => ({ ...empty, findMany: async () => rows });
  const habits = Array.from({ length: 14 }, (_, i) => ({
    id: `h${i}`, title: `Hábito con un nombre bastante largo número ${i}`, frequency: { type: 'daily', days: [] }, currentStreak: i, longestStreak: i + 3,
  }));
  const mocks: Client = {
    user: { findUniqueOrThrow: async () => ({ displayName: 'Ana', timezone: 'America/Bogota', level: 7, xp: 320, xpToNextLevel: 900, gold: 140, currentStreak: 4, longestStreak: 12, strength: 6, intelligence: 9, charisma: 5 }) },
    habit: many(habits),
    habitLog: many(habits.flatMap((h, i) => Array.from({ length: i }, (_, d) => ({ habitId: h.id, date: new Date(Date.UTC(2026, 9, 13 - d)) })))),
    quest: many([{ title: 'Correr 10 km', type: 'MAIN', deadline: day(-2) }, { title: 'Leer 3 libros', type: 'SIDE', deadline: null }]),
    questCompletion: { ...empty, count: async () => 4 },
    workout: many([
      { date: day(1), kind: 'STRENGTH', duration: 50, distanceKm: null, exercises: [{ sets: [{ weight: 60 }], exercise: { name: 'Sentadilla', muscleGroup: 'Piernas' } }] },
      { date: day(2), kind: 'CARDIO', duration: 30, distanceKm: 5, exercises: [] },
      { date: day(40), kind: 'STRENGTH', duration: 45, distanceKm: null, exercises: [{ sets: [{ weight: 50 }], exercise: { name: 'Sentadilla', muscleGroup: 'Piernas' } }] },
    ]),
    coliseoAttendance: { ...empty, count: async () => 2 },
    meal: many([{ date: day(0), mealType: 'LUNCH', calories: 700, protein: 30, waterMl: null }, { date: day(1), mealType: 'DINNER', calories: 600, protein: 25, waterMl: null }, { date: day(0), mealType: 'WATER', calories: null, protein: null, waterMl: 500 }]),
    nutritionGoal: { ...empty, findUnique: async () => ({ calories: 2200, protein: 140, waterMl: 2500 }) },
    sleepLog: many([{ duration: 5.5, quality: 3 }, { duration: 6, quality: 2 }]),
    recreationEntry: { ...empty, findMany: async (args: { where: { status: string } }) => (args.where.status === 'PLANNED' ? [{ title: 'Dune 3', kind: 'MOVIE' }] : [{ title: 'Partido con amigos', kind: 'OUTING', rating: 5, minutes: 120, date: day(9) }]) },
    transaction: many([{ type: 'INCOME', amount: 3_000_000, category: 'SALARY' }, { type: 'EXPENSE', amount: 450_000, category: 'FOOD' }]),
    learningItem: many([{ title: 'Curso de inglés', currentProgress: 4, totalProgress: 10 }]),
    journalEntry: many([{ mood: 2 }, { mood: 3 }]),
    focusSession: many([{ durationMin: 25, completedAt: day(0) }]),
    antiHabit: many([{ title: 'Redes de noche', targetPerWeek: 2, logs: [{ occurred: true, amount: 3 }] }]),
    careLog: { ...empty, count: async () => 3 },
    careRoutine: { ...empty, count: async () => 2 },
    dailyCheckin: { ...empty, findFirst: async () => ({ mood: 2, energy: 4, date: day(1) }) },
    relationship: many([{ name: 'Mamá', importantDates: [{ label: 'Cumpleaños', date: '1980-10-20', isRecurring: true }] }]),
    agendaEvent: many([{ title: 'Evento de Google', googleEventId: 'g1', isCompleted: false }, { title: 'Llamar al banco', googleEventId: null, isCompleted: false }]),
  };
  await withMocks(mocks, async () => {
    const { buildLifeSnapshot, packSections, CONTEXT_BUDGET_CHARS } = await import('../src/services/life-context.service');
    const snapshot = await buildLifeSnapshot('u-1', undefined, now);
    const text = packSections(snapshot.sections);
    assert.ok(text.length <= CONTEXT_BUDGET_CHARS);
    // ≈3,5 caracteres por token: el bloque de datos no pasa de ~800 tokens.
    assert.ok(Math.ceil(text.length / 3.5) <= 800, `≈${Math.ceil(text.length / 3.5)} tokens`);
    for (const title of ['PERFIL', 'HOY', 'HÁBITOS', 'COLISEO', 'NUTRICIÓN', 'SUEÑO', 'RECREACIÓN', 'FINANZAS', 'MENTE', 'ENFOQUE', 'CONEXIONES ENTRE ZONAS']) {
      assert.ok(text.includes(`${title}`), `falta ${title}`);
    }
    assert.match(text, /Duerme menos de 6,5 h/, 'conecta sueño y entreno');
    assert.match(text, /Cumpleaños de Mamá en 7 días/);
    assert.ok(!text.includes('Evento de Google'), 'los títulos importados de Google no salen');
    assert.ok(text.includes('Llamar al banco'));
    // Con foco, la sección pedida entra entera aunque el presupuesto sea corto.
    const focused = packSections((await buildLifeSnapshot('u-1', 'finances', now)).sections, 300);
    assert.ok(focused.includes('FINANZAS'));
  });
});
