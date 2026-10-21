import test from 'node:test';
import assert from 'node:assert/strict';
import { contextFor, habitsLine, historyLine, notebooksLine, trialNoticeDaysLeft, trialNoticeTitle, type PlanPreview } from '../../src/lib/planPreview';

const base: PlanPreview = { activeHabits: 3, habitLimit: 3, activeRoutines: 1, routineLimit: 3, notebooks: 1, notebookLimit: 2, historyDays: 4, historyLimit: 5 };

test('habits: over the limit says the rest stays, never that it is paused', () => {
  const text = habitsLine({ ...base, activeHabits: 5 });
  assert.match(text, /5 hábitos activos/);
  assert.match(text, /los demás siguen aquí/);
  assert.doesNotMatch(text, /pausa/i);
  assert.equal(habitsLine({ ...base, activeHabits: 1 }), 'Tienes 1 hábito activo. Cabe en Lite.');
});

test('history and notebooks only mention a cut when there really is one', () => {
  assert.match(historyLine({ ...base, historyDays: 23 }), /23 días guardados/);
  assert.equal(historyLine({ ...base, historyDays: 1 }), 'Tu historial de 1 día cabe en Lite.');
  assert.equal(notebooksLine(base), null);
  assert.match(notebooksLine({ ...base, notebooks: 4 }) ?? '', /4 libretas/);
});

test('context is only built for the reasons that have data', () => {
  assert.equal(contextFor('ai', base), null);
  assert.equal(contextFor('habits', null), null);
  assert.ok(contextFor('history', base));
});

test('trial notice shows on days 5 and 6 only, and only without a linked card', () => {
  const now = Date.parse('2026-10-20T12:00:00Z');
  const at = (days: number) => new Date(now + days * 864e5).toISOString();
  assert.equal(trialNoticeDaysLeft({ status: 'trialing', hasPaymentMethod: false, trialEndsAt: at(3) }, now), 3);
  assert.equal(trialNoticeDaysLeft({ status: 'trialing', hasPaymentMethod: false, trialEndsAt: at(2) }, now), 2);
  assert.equal(trialNoticeDaysLeft({ status: 'trialing', hasPaymentMethod: false, trialEndsAt: at(6) }, now), null);
  assert.equal(trialNoticeDaysLeft({ status: 'trialing', hasPaymentMethod: true, trialEndsAt: at(2) }, now), null);
  assert.equal(trialNoticeDaysLeft({ status: 'lite', hasPaymentMethod: false, trialEndsAt: at(2) }, now), null);
  assert.equal(trialNoticeTitle(2), 'En 2 días vuelves a Lite');
  assert.equal(trialNoticeTitle(1), 'Mañana vuelves a Lite');
});
