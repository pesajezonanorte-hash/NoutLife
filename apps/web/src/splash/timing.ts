// Tiempos que comparten el hilo principal (boot.ts) y el Worker (hero.ts). El fundido del fondo se
// programa desde el principal sin esperar respuesta: montar la app traba ese hilo y un aviso del
// Worker llegaría con la escultura ya posada.

/** Lo que dura el clip hero_birth (lo comprueba tests/unit/calm3d.unit.ts). */
export const BIRTH_MS = 1300;
/** Si la app ya espera, el nacimiento va así de rápido. */
export const BIRTH_RUSH = 1.8;
/**
 * Con la app ya montada debajo, sigue respirando este tiempo: el navegador pinta la página de una vez
 * (el GPU es uno solo, y a la vez que ese pintado el vuelo daba tirones de hasta 400 ms).
 */
export const LEAVE_HOLD_MS = 450;

/** Cuánto falta para que despegue, si la orden de salir llega `sinceBirth` ms después de nacer. */
export const leaveDelay = (sinceBirth: number) => Math.max(LEAVE_HOLD_MS, (BIRTH_MS - sinceBirth) / BIRTH_RUSH);
