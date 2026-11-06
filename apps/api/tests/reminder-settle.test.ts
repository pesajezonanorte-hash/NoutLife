import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SETTLE_PREFIXES, calendarDayRange } from '../src/lib/smart-reminders';

// Las comidas y el agua se guardan con la hora del registro: el día se busca como rango.
test('el rango de un día de calendario abarca sus registros con hora y no los del día vecino', () => {
  const { gte, lt } = calendarDayRange(new Date('2026-11-06T00:00:00.000Z'));
  const inside = (iso: string) => {
    const at = new Date(iso);
    return at >= gte && at < lt;
  };
  assert.equal(inside('2026-11-06T00:00:00.000Z'), true);
  assert.equal(inside('2026-11-06T01:00:00.000Z'), true, 'el registro de las 20:00 en Bogotá queda en el día UTC siguiente');
  assert.equal(inside('2026-11-06T23:59:59.999Z'), true);
  assert.equal(inside('2026-11-05T23:59:59.999Z'), false);
  assert.equal(inside('2026-11-07T00:00:00.000Z'), false);
});

// Las claves de aviso que genera la pasada (smart-reminder.service) empiezan por estos prefijos.
test('los prefijos para anular avisos solo casan con las claves de ese día', () => {
  const hydration = 'hydration-2026-11-06-1020';
  const meal = 'meal-2026-11-06-1300';
  const habits = 'zone-reminder:habitos-pendientes:2026-11-06';
  assert.ok(hydration.startsWith(SETTLE_PREFIXES.hydration('2026-11-06')[0]));
  assert.ok(meal.startsWith(SETTLE_PREFIXES.meal('2026-11-06')[0]));
  assert.ok(habits.startsWith(SETTLE_PREFIXES.habits('2026-11-06')[0]));

  assert.equal('hydration-2026-11-16-1020'.startsWith(SETTLE_PREFIXES.hydration('2026-11-06')[0]), false, 'otro día no se anula');
  assert.equal('meal-2026-11-07-1300'.startsWith(SETTLE_PREFIXES.meal('2026-11-06')[0]), false);
  assert.equal(hydration.startsWith(SETTLE_PREFIXES.meal('2026-11-06')[0]), false, 'agua y comida son avisos distintos');
});
