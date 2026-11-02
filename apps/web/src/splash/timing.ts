// Tiempos que comparten el hilo principal (boot.ts) y el Worker (hero.ts). El fundido del fondo se
// programa desde el principal sin esperar respuesta: montar la app traba ese hilo y un aviso del
// Worker llegaría con la N ya posada.

/** Lo que dura el clip hero_birth: las hojas arman la N (lo comprueba tests/unit/calm3d.unit.ts). */
export const BIRTH_MS = 1300;
/** Si la app ya espera, las hojas van así de rápido. */
export const BIRTH_RUSH = 1.8;
/**
 * Con la app ya montada debajo, sigue respirando este tiempo: el navegador pinta la página de una vez
 * (el GPU es uno solo, y a la vez que ese pintado el viaje daba tirones de hasta 400 ms).
 */
export const LEAVE_HOLD_MS = 450;

/** Una vez armada, la N se queda este tiempo a la vista: es el momento de la marca. */
export const N_HOLD_MS = 450;

/** Cuánto falta para que se funda, si la orden de salir llega `sinceBirth` ms después del primer fotograma. */
export const leaveDelay = (sinceBirth: number) => Math.max(LEAVE_HOLD_MS, Math.max(0, BIRTH_MS - sinceBirth) / BIRTH_RUSH + N_HOLD_MS);
