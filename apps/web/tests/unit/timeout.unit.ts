// Plazos de la sesión al abrir la app (src/lib/timeout.ts). Corre con: npm test --workspace=apps/web
import assert from 'node:assert/strict';
import test from 'node:test';
import { AUTH_TIMEOUT_MS, withTimeout } from '../../src/lib/timeout';

test('una respuesta a tiempo se devuelve tal cual', async () => {
  assert.equal(await withTimeout(Promise.resolve('ok'), 50), 'ok');
});

test('una petición que nunca responde rechaza con TIMEOUT en el plazo', async () => {
  const start = Date.now();
  await assert.rejects(withTimeout(new Promise<string>(() => undefined), 30), /TIMEOUT/);
  assert.ok(Date.now() - start < 1000, 'no espera más del plazo');
});

test('un error de la petición se propaga sin esperar al plazo', async () => {
  await assert.rejects(withTimeout(Promise.reject(new Error('red caída')), 5_000), /red caída/);
});

test('el plazo de la sesión deja tiempo a un arranque en frío y no pasa de 20 s', () => {
  assert.ok(AUTH_TIMEOUT_MS >= 10_000 && AUTH_TIMEOUT_MS <= 20_000);
});
