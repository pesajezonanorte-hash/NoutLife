import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WATER_PHOTO_MAX_ML, waterFromPhotoReply, waterPhotoPrompt } from '../src/lib/water-photo';
import { waterPhotoSchema } from '../src/schemas/activity.schemas';

test('el prompt pide JSON corto con ml y capacidad', () => {
  const prompt = waterPhotoPrompt();
  assert.match(prompt, /"ok":true/);
  assert.match(prompt, /"ml"/);
  assert.match(prompt, /"cap"/);
});

test('una lectura válida se redondea a 10 ml y trae la capacidad del recipiente', () => {
  assert.deepEqual(waterFromPhotoReply('{"ok":true,"ml":347,"cap":500}'), { ml: 350, containerMl: 500 });
});

test('la lectura se acepta aunque venga envuelta en un bloque de código', () => {
  assert.deepEqual(waterFromPhotoReply('```json\n{"ok":true,"ml":200,"cap":250}\n```'), { ml: 200, containerMl: 250 });
});

test('nunca se registra más agua que la capacidad que el propio modelo dijo', () => {
  assert.deepEqual(waterFromPhotoReply('{"ok":true,"ml":900,"cap":500}'), { ml: 500, containerMl: 500 });
});

test('sin capacidad, el tope de un recipiente es WATER_PHOTO_MAX_ML', () => {
  assert.deepEqual(waterFromPhotoReply('{"ok":true,"ml":99999}'), { ml: WATER_PHOTO_MAX_ML, containerMl: null });
});

test('una capacidad menor que el agua leída limita el registro a esa capacidad', () => {
  assert.deepEqual(waterFromPhotoReply('{"ok":true,"ml":400,"cap":250}'), { ml: 250, containerMl: 250 });
});

test('una capacidad que no es un número se ignora y queda el tope general', () => {
  assert.deepEqual(waterFromPhotoReply('{"ok":true,"ml":400,"cap":"grande"}'), { ml: 400, containerMl: null });
});

test('sin agua visible, con cifras inválidas o casi vacío, no hay lectura', () => {
  assert.equal(waterFromPhotoReply('{"ok":false}'), null);
  assert.equal(waterFromPhotoReply('no es json'), null);
  assert.equal(waterFromPhotoReply('{"ok":true,"ml":"mucho"}'), null);
  assert.equal(waterFromPhotoReply('{"ok":true,"ml":8}'), null, 'una gota no es un registro');
  assert.equal(waterFromPhotoReply('{"ok":true,"ml":-300}'), null);
});

test('el esquema acepta una foto reducida con fecha local y rechaza una fecha mal formada', () => {
  const image = 'A'.repeat(200);
  assert.equal(waterPhotoSchema.safeParse({ image, mimeType: 'image/jpeg', date: '2026-11-06' }).success, true);
  assert.equal(waterPhotoSchema.safeParse({ image, mimeType: 'image/jpeg' }).success, true, 'la fecha es opcional');
  assert.equal(waterPhotoSchema.safeParse({ image, mimeType: 'image/jpeg', date: '06/11/2026' }).success, false);
  assert.equal(waterPhotoSchema.safeParse({ image: 'corta', mimeType: 'image/jpeg' }).success, false);
});
