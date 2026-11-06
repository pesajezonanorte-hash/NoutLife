import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sageFinanceActionSchema, splitSageAction } from '../src/lib/sage-actions';

test('una respuesta sin línea ACCION sale igual, sin propuesta', () => {
  assert.deepEqual(splitSageAction('  Tu meta va bien.  '), { text: 'Tu meta va bien.', action: null });
});

test('la línea ACCION válida se separa del texto y queda como propuesta', () => {
  const raw = 'Puedes ahorrar 300 mil al mes.\nACCION: {"action":"create_goal","title":"Viaje","targetAmount":3000000,"deadline":"2027-06-30"}';
  assert.deepEqual(splitSageAction(raw), {
    text: 'Puedes ahorrar 300 mil al mes.',
    action: { action: 'create_goal', title: 'Viaje', targetAmount: 3000000, deadline: '2027-06-30' },
  });
});

test('el marcador no distingue mayúsculas y el JSON puede venir en un bloque de código', () => {
  const raw = 'Listo.\nacción: x\nAccion: ```json\n{"action":"contribute_goal","goalId":"abc","amount":50000}\n```';
  const split = splitSageAction(raw);
  assert.deepEqual(split.action, { action: 'contribute_goal', goalId: 'abc', amount: 50000 });
  assert.equal(split.text.startsWith('Listo.'), true);
});

test('una línea ACCION inválida se quita del texto y no produce propuesta', () => {
  const split = splitSageAction('Te lo explico.\nACCION: {"action":"delete_everything"}');
  assert.deepEqual(split, { text: 'Te lo explico.', action: null });
  assert.deepEqual(splitSageAction('ACCION: no es json'), { text: '', action: null });
});

test('create_goal exige título, monto positivo y fecha AAAA-MM-DD', () => {
  assert.equal(sageFinanceActionSchema.safeParse({ action: 'create_goal', title: 'Moto', targetAmount: 5000000 }).success, true);
  assert.equal(sageFinanceActionSchema.safeParse({ action: 'create_goal', title: 'Moto', targetAmount: -1 }).success, false);
  assert.equal(sageFinanceActionSchema.safeParse({ action: 'create_goal', title: '  ', targetAmount: 10 }).success, false);
  assert.equal(sageFinanceActionSchema.safeParse({ action: 'create_goal', title: 'Moto', targetAmount: 10, deadline: '30/06/2027' }).success, false);
});

test('update_goal necesita un campo que cambiar; la fecha puede quitarse con null', () => {
  assert.equal(sageFinanceActionSchema.safeParse({ action: 'update_goal', goalId: 'g1' }).success, false);
  assert.equal(sageFinanceActionSchema.safeParse({ action: 'update_goal', goalId: 'g1', targetAmount: 900 }).success, true);
  assert.equal(sageFinanceActionSchema.safeParse({ action: 'update_goal', goalId: 'g1', deadline: null }).success, true);
});

test('los campos desconocidos se rechazan (no se cuela nada que no sea de la meta)', () => {
  assert.equal(sageFinanceActionSchema.safeParse({ action: 'contribute_goal', goalId: 'g1', amount: 10, userId: 'otro' }).success, false);
});
