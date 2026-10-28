/**
 * Tiempo máximo para confirmar la sesión al abrir la app. Pasado este plazo la
 * petición se da por perdida y la app muestra el inicio de sesión en vez de
 * quedarse en la pantalla de carga.
 */
export const AUTH_TIMEOUT_MS = 15_000;

/** Espera `promise` como mucho `ms`; si no responde a tiempo, rechaza con `TIMEOUT`. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TIMEOUT')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error: unknown) => { clearTimeout(timer); reject(error); },
    );
  });
}
