import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKeyOf, isScheduledOn, minutesOf, pendingHabitsOn, planReminders, type ReminderData } from '../../src/lib/reminderPlan';
import type { Habit } from '../../src/services/habit.service';
import type { AgendaEvent } from '../../src/services/agenda.service';
import type { Debt, RecurringTransaction } from '../../src/services/finance2.service';

/** Lunes 2 de noviembre de 2026, 08:00 hora local. */
const NOW = new Date(2026, 10, 2, 8, 0);
const KEY = dayKeyOf(NOW);

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', userId: 'u1', title: 'Leer', category: 'x', icon: 'x', color: '', xpReward: 10, goldReward: 5, currentStreak: 0, longestStreak: 0,
  frequency: { type: 'daily', days: [] }, resetTime: '00:00', reminderTime: '21:30', reminderEndTime: null, isActive: true, syncToGoogleCalendar: false,
  createsColiseoAttendance: false, createdAt: '', updatedAt: '', todayStatus: null, todayCompleted: null, ...over,
});
const event = (over: Partial<AgendaEvent> = {}): AgendaEvent => ({
  id: 'e1', userId: 'u1', title: 'Dentista', category: 'x', startDate: new Date(2026, 10, 2, 15, 0).toISOString(), isAllDay: false, reminder: 30, isCompleted: false, createdAt: '', updatedAt: '', ...over,
});
const debt = (over: Partial<Debt> = {}): Debt => ({
  id: 'd1', title: 'Préstamo', type: 'owe', originalAmount: 100, currentAmount: 100, dueDate: new Date(Date.UTC(2026, 10, 5)).toISOString(), isPaid: false, payments: [], ...over,
});
const bill = (over: Partial<RecurringTransaction> = {}): RecurringTransaction => ({ id: 'r1', type: 'EXPENSE', amount: 9, category: 'x', description: 'Internet', dayOfMonth: 4, isActive: true, ...over });
const data = (over: Partial<ReminderData> = {}): ReminderData => ({ habits: [], events: [], prefs: { reminderSettings: { habits: { enabled: false, time: '21:00' } } as never }, ...over });
const at = (r: { at: number }) => new Date(r.at);

test('hábito con hora: el aviso sale 10 min antes, con la misma etiqueta que el servidor', () => {
  const [r] = planReminders(data({ habits: [habit()] }), NOW, 'es');
  assert.equal(r.tag, `habit-reminder-h1-${KEY}`);
  assert.equal(at(r).getHours(), 21);
  assert.equal(at(r).getMinutes(), 20);
  assert.equal(r.title, 'En 10 min: Leer');
  assert.equal(r.quick, 'habit_done');
  assert.equal(r.quickRef, 'h1');
  assert.equal(r.day, KEY);
});

test('lo ya hecho hoy no suena hoy, pero sí mañana', () => {
  const done = habit({ todayCompleted: true, todayStatus: 'completed' });
  assert.equal(planReminders(data({ habits: [done] }), NOW, 'es').length, 0);
  const week = planReminders(data({ habits: [done] }), NOW, 'es', 3);
  assert.equal(week.length, 2);
  assert.equal(at(week[0]).getDate(), 3);
});

test('lo que ya pasó hoy no se programa', () => {
  const late = new Date(2026, 10, 2, 22, 0);
  assert.equal(planReminders(data({ habits: [habit()] }), late, 'es').length, 0);
});

test('una semana: respeta los días elegidos del hábito', () => {
  const weekly = habit({ frequency: { type: 'days_per_week', days: [1, 3] } }); // lunes y miércoles
  const week = planReminders(data({ habits: [weekly] }), NOW, 'es', 7);
  assert.deepEqual(week.map((r) => at(r).getDay()), [1, 3]);
  assert.equal(isScheduledOn(weekly, new Date(2026, 10, 3)), false);
});

test('hábitos pendientes: cuenta solo lo que falta hoy y usa la hora de Ajustes', () => {
  const prefs = { reminderSettings: { habits: { enabled: true, time: '20:00' } } as never };
  const habits = [habit({ id: 'a', title: 'A', reminderTime: null }), habit({ id: 'b', title: 'B', reminderTime: null, todayStatus: 'completed', todayCompleted: true }), habit({ id: 'c', title: 'C', reminderTime: null, todayStatus: 'skipped' })];
  const [r] = planReminders(data({ habits, prefs }), NOW, 'es');
  assert.equal(r.kind, 'pending');
  assert.equal(r.tag, `zone-reminder:habitos-pendientes:${KEY}`);
  assert.equal(at(r).getHours(), 20);
  assert.equal(r.title, '1 hábito pendiente');
  assert.match(r.body, /«A»/);
  assert.equal(pendingHabitsOn(habits, NOW, true).length, 1);
  assert.equal(pendingHabitsOn(habits, NOW, false).length, 3);
});

test('sin hábitos pendientes no hay aviso, y se puede apagar', () => {
  const on = { reminderSettings: { habits: { enabled: true, time: '20:00' } } as never };
  assert.equal(planReminders(data({ prefs: on }), NOW, 'es').length, 0);
  const off = { reminderSettings: { habits: { enabled: false, time: '20:00' } } as never };
  assert.equal(planReminders(data({ habits: [habit({ reminderTime: null })], prefs: off }), NOW, 'es').length, 0);
});

test('agenda: antes del evento, según su aviso; lo completado o sin aviso no suena', () => {
  const [r] = planReminders(data({ events: [event()] }), NOW, 'es');
  assert.equal(at(r).getHours(), 14);
  assert.equal(at(r).getMinutes(), 30);
  assert.equal(r.body, 'Empieza en 30 min.');
  assert.equal(r.link, '/agenda');
  assert.equal(planReminders(data({ events: [event({ isCompleted: true })] }), NOW, 'es').length, 0);
  assert.equal(planReminders(data({ events: [event({ reminder: undefined })] }), NOW, 'es').length, 0);
  assert.equal(planReminders(data({ events: [event({ eventType: 'habit' })] }), NOW, 'es').length, 0, 'los bloques de hábitos ya tienen su aviso');
});

test('agenda: un evento lejano entra solo con el horizonte de la semana', () => {
  const far = event({ startDate: new Date(2026, 10, 7, 15, 0).toISOString() });
  assert.equal(planReminders(data({ events: [far] }), NOW, 'es', 1).length, 0);
  assert.equal(planReminders(data({ events: [far] }), NOW, 'es', 7).length, 1);
});

test('deudas: 3 días, 1 día y el mismo día, a las 9, sin montos', () => {
  const list = planReminders(data({ debts: [debt()] }), new Date(2026, 10, 1, 8, 0), 'es', 7);
  assert.deepEqual(list.map((r) => at(r).getDate()), [2, 4, 5]);
  assert.ok(list.every((r) => at(r).getHours() === 9));
  assert.deepEqual(list.map((r) => r.title), ['Vence en 3 días', 'Vence mañana', 'Vence hoy']);
  assert.ok(list.every((r) => !/100/.test(r.body)), 'los montos no se leen en la pantalla de bloqueo');
  assert.match(list[2].body, /márcala como pagada/);
  assert.equal(list[0].tag, 'debt-due:d1:2026-11-05:3');
});

test('deudas: las pagadas, sin fecha o a favor no avisan', () => {
  const none = [debt({ isPaid: true }), debt({ type: 'owed' }), debt({ dueDate: undefined })];
  assert.equal(planReminders(data({ debts: none }), new Date(2026, 10, 1, 8, 0), 'es', 7).length, 0);
});

test('recibos: el día anterior; el del día 1 se avisa el último día del mes', () => {
  const [r] = planReminders(data({ bills: [bill()] }), NOW, 'es', 7);
  assert.equal(at(r).getDate(), 3);
  assert.equal(r.title, 'Mañana vence un recibo');
  const first = planReminders(data({ bills: [bill({ dayOfMonth: 1 })] }), new Date(2026, 10, 29, 8, 0), 'es', 7);
  assert.equal(at(first[0]).getMonth(), 10);
  assert.equal(at(first[0]).getDate(), 30);
  assert.equal(first[0].tag, 'bill-due:r1:2026-12-01:1');
  assert.equal(planReminders(data({ bills: [bill({ type: 'INCOME' })] }), NOW, 'es', 7).length, 0);
  assert.equal(planReminders(data({ bills: [bill({ isActive: false })] }), NOW, 'es', 7).length, 0);
});

test('un recibo del 31 en un mes de 30 días vence el último día', () => {
  const [r] = planReminders(data({ bills: [bill({ dayOfMonth: 31 })] }), new Date(2026, 10, 27, 8, 0), 'es', 7);
  assert.equal(at(r).getDate(), 29);
  assert.equal(r.tag, 'bill-due:r1:2026-11-30:1');
});

test('categorías apagadas y horas de silencio se respetan', () => {
  const noHabits = { categories: [{ category: 'HABITS' as const, inAppEnabled: true, pushEnabled: false }] };
  assert.equal(planReminders(data({ habits: [habit()], prefs: noHabits }), NOW, 'es').length, 0);
  const noMoney = { categories: [{ category: 'FINANCE' as const, inAppEnabled: true, pushEnabled: false }] };
  assert.equal(planReminders(data({ debts: [debt()], prefs: noMoney }), new Date(2026, 10, 1, 8, 0), 'es', 7).length, 0);
  assert.equal(planReminders(data({ habits: [habit()], prefs: { habitReminders: false, reminderSettings: { habits: { enabled: false, time: '21:00' } } as never } }), NOW, 'es').length, 0, 'los bloques se apagan aparte de los pendientes');
  const quiet = { quietHoursStart: '08:00', quietHoursEnd: '10:00', reminderSettings: { habits: { enabled: false, time: '21:00' } } as never };
  assert.equal(planReminders(data({ debts: [debt()], prefs: quiet }), new Date(2026, 10, 1, 8, 0), 'es', 7).length, 0, 'lo automático respeta el silencio');
  assert.equal(planReminders(data({ habits: [habit({ reminderTime: '09:00' })], prefs: quiet }), NOW, 'es').length, 1, 'lo que la persona agendó, no');
});

test('pausas activas: cada intervalo, sin fines de semana si así se eligió, y solo dos días', () => {
  const breaks = { enabled: true, everyMinutes: 60 as const, from: '09:00', to: '12:00', workdays: true };
  const prefs = { reminderSettings: { breaks, habits: { enabled: false, time: '21:00' } } as never };
  const today = planReminders(data({ prefs }), NOW, 'es');
  assert.deepEqual(today.map((r) => at(r).getHours()), [10, 11, 12]);
  assert.equal(today[0].tag, `break-${KEY}-600`);
  assert.equal(planReminders(data({ prefs }), new Date(2026, 10, 7, 8, 0), 'es').length, 0, 'sábado');
  assert.equal(planReminders(data({ prefs }), NOW, 'es', 7).length, 6);
});

test('en orden, y en el idioma de la persona', () => {
  const list = planReminders(data({ habits: [habit()], events: [event()] }), NOW, 'en');
  assert.deepEqual(list.map((r) => r.kind), ['agenda', 'habit']);
  assert.equal(list[1].title, 'In 10 min: Leer');
  assert.equal(minutesOf('21:30'), 1290);
  assert.equal(minutesOf('nope'), null);
});
