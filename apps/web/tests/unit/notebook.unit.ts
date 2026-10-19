import assert from 'node:assert/strict';
import { test } from 'node:test';
import { simplifyPoints } from '../../src/components/notebook/paper';

test('simplifyPoints quita los puntos casi quietos, conserva el último y redondea', () => {
  // (0,0) → (0.5,0) se descarta (menos de 1.5 u) → (3,0) se queda → (3.2,0.1) es el último y se queda.
  assert.deepEqual(simplifyPoints([0, 0, 0.5, 0, 3, 0, 3.2, 0.1]), [0, 0, 3, 0, 3.2, 0.1]);
  assert.deepEqual(simplifyPoints([10.04, 20.06]), [10, 20.1], 'un punto suelto (un toque) se queda');
  assert.deepEqual(simplifyPoints([0, 0, 0, 0, 0, 0]), [0, 0, 0, 0], 'sin movimiento: inicio y fin');
});
