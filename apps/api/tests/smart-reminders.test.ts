import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BREAK_TIPS, CARE_COPY, CYCLE_COPY, DEFAULT_SMART_SETTINGS, bestOneRepMax, breakSlots, categoryOfXpSource, focusCategory, hydrationSlots,
  inWindow, maxEffortSets, mergeSmartSettings, newRecords, oneRepMaxOf, parseHHMM, isAutomatic, learnedHabitTime, pickQuote, planPushes, sanitizeSmartSettings,
} from '../src/lib/smart-reminders';

test('sin ajustes guardados se usan los valores por defecto', () => {
  assert.deepEqual(sanitizeSmartSettings(undefined), DEFAULT_SMART_SETTINGS);
  assert.deepEqual(sanitizeSmartSettings(null), DEFAULT_SMART_SETTINGS);
  assert.deepEqual(sanitizeSmartSettings('no es un objeto'), DEFAULT_SMART_SETTINGS);
});

test('las horas y los intervalos inválidos vuelven al valor por defecto', () => {
  const s = sanitizeSmartSettings({
    coliseo: { time: '25:99' },
    care: { morning: '8:00', night: 'tarde' },
    hydration: { everyHours: 7, from: '9am', to: '21:00' },
    wisdom: { time: '07:30' },
  });
  assert.equal(s.coliseo.time, null);
  assert.equal(s.care.morning, DEFAULT_SMART_SETTINGS.care.morning);
  assert.equal(s.care.night, DEFAULT_SMART_SETTINGS.care.night);
  assert.equal(s.hydration.everyHours, DEFAULT_SMART_SETTINGS.hydration.everyHours);
  assert.equal(s.hydration.from, DEFAULT_SMART_SETTINGS.hydration.from);
  assert.equal(s.hydration.to, '21:00');
  assert.equal(s.wisdom.time, '07:30');
});

test('las horas de comida se ordenan, no se repiten y son como mucho cuatro', () => {
  const s = sanitizeSmartSettings({ meals: { times: ['20:00', '08:00', '20:00', 'x', '13:00', '09:00', '18:00'] } });
  assert.deepEqual(s.meals.times, ['08:00', '09:00', '13:00', '18:00']);
});

test('un cambio parcial por zona conserva el resto', () => {
  const saved = mergeSmartSettings(undefined, { hydration: { enabled: true, everyHours: 3 } });
  assert.equal(saved.hydration.enabled, true);
  assert.equal(saved.hydration.everyHours, 3);
  assert.equal(saved.hydration.from, DEFAULT_SMART_SETTINGS.hydration.from);
  assert.deepEqual(saved.care, DEFAULT_SMART_SETTINGS.care);

  const cleared = mergeSmartSettings(saved, { coliseo: { time: '18:30' } });
  assert.equal(cleared.coliseo.time, '18:30');
  assert.equal(cleared.hydration.enabled, true, 'el cambio de Coliseo no toca el agua');

  assert.equal(mergeSmartSettings(cleared, { coliseo: { time: null } }).coliseo.time, null);
});

test('parseHHMM acepta solo horas válidas', () => {
  assert.equal(parseHHMM('00:00'), 0);
  assert.equal(parseHHMM('23:59'), 1439);
  assert.equal(parseHHMM('24:00'), null);
  assert.equal(parseHHMM('7:00'), null);
  assert.equal(parseHHMM(null), null);
});

test('la ventana de avisos dura 30 minutos desde la hora objetivo', () => {
  assert.equal(inWindow(540, 540), true);
  assert.equal(inWindow(569, 540), true);
  assert.equal(inWindow(570, 540), false, 'a los 30 min ya no es ventana');
  assert.equal(inWindow(539, 540), false);
});

test('las franjas de agua van cada N horas y cruzan la medianoche', () => {
  assert.deepEqual(hydrationSlots('09:00', '21:00', 2), [540, 660, 780, 900, 1020, 1140, 1260]);
  assert.deepEqual(hydrationSlots('22:00', '02:00', 2), [1320, 0, 120]);
  assert.deepEqual(hydrationSlots('09:00', '09:00', 4), [540]);
  assert.deepEqual(hydrationSlots('bad', '21:00', 2), []);
});

test('los textos del ciclo no nombran la salud (se ven en la pantalla de bloqueo)', () => {
  const health = /ciclo|periodo|menstru|regla|ovul|f[eé]rtil|sangr|sexual|anticon/i;
  for (const copy of [CYCLE_COPY.check, CYCLE_COPY.upcoming, CYCLE_COPY.phase]) {
    assert.doesNotMatch(copy.title, health);
    assert.doesNotMatch(copy.body, health);
  }
});

test('los textos de cuidado cambian según la franja', () => {
  assert.notEqual(CARE_COPY.morning.body, CARE_COPY.night.body);
});

test('1RM estimado: peso directo con una repetición y fórmula de Epley en lo demás', () => {
  assert.equal(oneRepMaxOf(100, 1), 100);
  assert.ok(Math.abs(oneRepMaxOf(100, 5) - 116.67) < 0.01);
  assert.equal(oneRepMaxOf(0, 5), 0);
  assert.equal(oneRepMaxOf(50, 0), 0);
});

test('un récord cuenta solo si el ejercicio ya se había hecho y se supera su marca', () => {
  const best = new Map([['press', 100], ['remo', 60]]);
  const records = newRecords([
    { exerciseId: 'press', name: 'Press banca', sets: [{ weight: 105, reps: 1, completed: true }] },
    { exerciseId: 'remo', name: 'Remo', sets: [{ weight: 60, reps: 1, completed: true }] },
    { exerciseId: 'nuevo', name: 'Sentadilla', sets: [{ weight: 200, reps: 1, completed: true }] },
  ], best);
  assert.deepEqual(records, [{ name: 'Press banca', oneRepMax: 105 }]);
});

test('las series sin completar no cuentan para el récord', () => {
  assert.equal(bestOneRepMax([{ weight: 150, reps: 1, completed: false }, { weight: 80, reps: 1, completed: true }]), 80);
});

test('el esfuerzo máximo cuenta solo series completadas a RPE 10', () => {
  assert.equal(maxEffortSets([
    { sets: [{ rpe: 10, completed: true }, { rpe: 9, completed: true }, { rpe: 10, completed: false }] },
    { sets: [{ rpe: 10, completed: true }] },
  ]), 2);
});

test('la categoría de sabiduría sigue el XP de la última semana', () => {
  assert.equal(categoryOfXpSource('workout'), 'health');
  assert.equal(categoryOfXpSource('habit_completed'), 'discipline');
  assert.equal(categoryOfXpSource('pomodoro'), 'growth');
  assert.equal(categoryOfXpSource('algo_nuevo'), 'mindset');
  assert.equal(focusCategory(new Map([['workout', 100], ['habit_completed', 50]])), 'health');
  assert.equal(focusCategory(new Map()), 'discipline');
});

test('la cita del día es estable para la misma persona y día, y prefiere su categoría', () => {
  const cards = [
    { id: 'a', category: 'health', quote: 'a' },
    { id: 'b', category: 'discipline', quote: 'b' },
    { id: 'c', category: 'discipline', quote: 'c' },
  ];
  const first = pickQuote(cards, 'discipline', 'u1:2026-10-16');
  assert.equal(pickQuote(cards, 'discipline', 'u1:2026-10-16')?.id, first?.id);
  assert.equal(first?.category, 'discipline');
  assert.equal(pickQuote(cards, 'growth', 'u1:2026-10-16')?.category, 'health', 'sin citas de la categoría, cualquiera');
  assert.equal(pickQuote([], 'discipline', 'x'), null);
});

test('las pausas activas: intervalo válido, días laborables y sin aviso al empezar', () => {
  const s = sanitizeSmartSettings({ breaks: { enabled: true, everyMinutes: 50, from: '08:00', to: 'tarde', workdays: 'sí' } });
  assert.equal(s.breaks.enabled, true);
  assert.equal(s.breaks.everyMinutes, DEFAULT_SMART_SETTINGS.breaks.everyMinutes, '50 min no es un intervalo de la lista');
  assert.equal(s.breaks.from, '08:00');
  assert.equal(s.breaks.to, DEFAULT_SMART_SETTINGS.breaks.to);
  assert.equal(s.breaks.workdays, DEFAULT_SMART_SETTINGS.breaks.workdays);
  assert.equal(DEFAULT_SMART_SETTINGS.breaks.enabled, false, 'apagadas hasta que la persona las active');
  assert.deepEqual(breakSlots('09:00', '12:00', 60), [600, 660, 720]);
  assert.deepEqual(breakSlots('09:00', '10:00', 30), [570, 600]);
  assert.deepEqual(breakSlots('bad', '10:00', 30), []);
  assert.ok(BREAK_TIPS.length >= 3);
});

test('los hábitos pendientes conservan las 21:00 de antes y aceptan otra hora', () => {
  assert.deepEqual(DEFAULT_SMART_SETTINGS.habits, { enabled: true, time: '21:00', manual: false });
  const s = mergeSmartSettings(undefined, { habits: { time: '19:30' } });
  assert.deepEqual(s.habits, { enabled: true, time: '19:30', manual: true });
  assert.equal(sanitizeSmartSettings({ habits: { time: '7pm' } }).habits.time, '21:00');
});

test('push: lo programado por la persona sale siempre, sin tope, pausa, silencio ni agrupación', () => {
  const habit = { key: 'habit-reminder-h1-2026-10-20', title: 'Hora de: Leer', body: '', link: '/habits', userScheduled: true };
  const agenda = { key: 'agenda-reminder-e1-2026-10-20T15:00:00.000Z', title: 'Cita', body: '', link: '/agenda', userScheduled: true };
  const water = { key: 'hydration-2026-10-20-900', title: 'Hora de hidratarte', body: '', link: '/food', userScheduled: true };
  const day = { minutes: 15 * 60, sentToday: 0, inactive: false };
  // Aun con el tope agotado, con la app sin abrir y de noche, cada aviso programado sale.
  const many = [habit, agenda, water, { ...habit, key: 'care-r1-2026-10-20' }, { ...habit, key: 'snooze-x' }];
  const out = planPushes(many, { minutes: 23 * 60, sentToday: 9, inactive: true, ignored: true });
  assert.equal(out.send.length, 5);
  assert.equal(out.group, null);
  // Un programado nunca se convierte en el resumen agrupado, aunque haya automáticos.
  const mixed = planPushes([habit, { key: 'wisdom-2026-10-20', title: 'Sabiduría', body: '', link: '/wisdom' }, { key: 'zone-reminder:diario:2026-10-20', title: 'Diario', body: '', link: '/journal' }], day);
  assert.deepEqual(mixed.send.map((p) => p.key), [habit.key]);
  assert.equal(mixed.group?.title, '2 cosas para esta tarde');
});

test('push: un aviso automático obedece tope, silencio, pausa e ignorados', () => {
  const wisdom = { key: 'wisdom-2026-10-20', title: 'Sabiduría del día', body: '', link: '/wisdom' };
  const pending = { key: 'zone-reminder:habitos-pendientes:2026-10-20', title: '2 hábitos pendientes', body: '', link: '/habits' };
  const deadline = { key: 'deadline-q1', title: 'Vence mañana', body: '', link: '/quests' };
  const day = { minutes: 15 * 60, sentToday: 0, inactive: false };
  // Con dos ya enviados hoy, ningún automático sale.
  assert.equal(planPushes([wisdom, pending], { ...day, sentToday: 2 }).send.length, 0);
  // Tope de 2 dentro de la misma pasada: de tres salen dos, agrupados en uno.
  const three = planPushes([wisdom, pending, deadline], day);
  assert.equal(three.send.length, 0);
  assert.equal(three.group?.title, '2 cosas para esta tarde');
  // Silencio 22:00–07:00 y pausa por inactividad: ningún automático.
  assert.equal(planPushes([wisdom], { ...day, minutes: 23 * 60 }).send.length, 0);
  assert.equal(planPushes([wisdom], { ...day, minutes: 6 * 60 }).send.length, 0);
  assert.equal(planPushes([wisdom], { ...day, inactive: true }).send.length, 0);
  // Frenado por ignorados: el tope baja a 1.
  assert.equal(planPushes([wisdom, pending], { ...day, ignored: true }).send.length, 1);
  // Un solo automático que cabe sale tal cual.
  assert.equal(planPushes([pending], day).group, null);
  assert.equal(planPushes([pending], day).send.length, 1);
});

test('push: un aviso de Sabiduría que la persona programó se trata como programado', () => {
  const wisdom = { key: 'wisdom-2026-10-20', title: 'Sabiduría', body: '', link: '/wisdom', userScheduled: true };
  assert.equal(planPushes([wisdom], { minutes: 23 * 60, sentToday: 9, inactive: true }).send.length, 1);
});

test('push: la clasificación automática cubre los avisos de enganche y deja fuera lo programado', () => {
  assert.equal(isAutomatic('wisdom-2026-10-20'), true);
  assert.equal(isAutomatic('cycle-check-2026-10-20'), true);
  assert.equal(isAutomatic('zone-reminder:habitos-pendientes:2026-10-20'), true);
  assert.equal(isAutomatic('zone-reminder:sueno:2026-10-20'), false);
  assert.equal(isAutomatic('hydration-2026-10-20-900'), false);
  assert.equal(isAutomatic('care-r1-2026-10-20'), false);
  assert.equal(isAutomatic('habit-reminder-h1-2026-10-20'), false);
});

test('hora aprendida: mediana de los cumplimientos menos 30 min; sin datos suficientes no hay hora', () => {
  assert.equal(learnedHabitTime([]), null);
  assert.equal(learnedHabitTime([1200, 1230]), null);
  assert.equal(learnedHabitTime([1200, 1230, 1260]), 1200);
  assert.equal(learnedHabitTime([1200, 1260, 1320, 1380]), 1260);
  assert.equal(learnedHabitTime([30, 40, 50]), 10);
  // Cruza medianoche: 00:05–00:15 → aviso a las 23:40.
  assert.equal(learnedHabitTime([5, 10, 15]), 1420);
});
