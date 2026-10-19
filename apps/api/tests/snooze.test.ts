import assert from 'node:assert/strict';
import { test } from 'node:test';
import { snoozeSchema } from '../src/schemas/snooze.schemas';
import { SNOOZE_MINUTES, snoozeDueAt } from '../src/services/snooze.service';

test('posponer deja el aviso a 10 min exactos', () => {
  assert.equal(SNOOZE_MINUTES, 10);
  assert.equal(snoozeDueAt(new Date('2026-10-18T14:00:00.000Z')).toISOString(), '2026-10-18T14:10:00.000Z');
});

test('un aviso pospuesto solo lleva datos del aviso y enlaces de la app', () => {
  const ok = { title: 'Hora de: Leer', body: 'Márcalo cuando lo hagas.', tag: 'habit-reminder-h1-2026-10-18', link: '/habits', quick: 'habit_done', quickRef: 'h1', day: '2026-10-18' };
  assert.equal(snoozeSchema.safeParse(ok).success, true);
  assert.equal(snoozeSchema.safeParse({ ...ok, link: 'https://ejemplo.com' }).success, false);
  assert.equal(snoozeSchema.safeParse({ ...ok, userId: 'otra-persona' }).success, false);
  assert.equal(snoozeSchema.safeParse({ ...ok, title: '' }).success, false);
  assert.equal(snoozeSchema.safeParse({ ...ok, quick: 'borrar_todo' }).success, false);
  assert.equal(snoozeSchema.safeParse({ ...ok, day: '18/10/2026' }).success, false);
});
