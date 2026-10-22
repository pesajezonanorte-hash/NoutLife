import { createHash, timingSafeEqual } from 'node:crypto';

// Autorización del disparador de recordatorios (/api/v1/cron/tick). Reglas puras para probarlas.

export type CronAuth = 'ok' | 'unauthorized' | 'missing-secret';

/** El secreto que manda la petición: «Authorization: Bearer <secreto>» primero, «?key=<secreto>» después. */
export function givenCronSecret(authorization: string | undefined, queryKey: unknown): string | undefined {
  const header = authorization?.replace(/^Bearer\s+/i, '').trim();
  if (header) return header;
  return typeof queryKey === 'string' && queryKey ? queryKey : undefined;
}

/**
 * Compara en tiempo constante (las huellas SHA-256 miden siempre lo mismo, así que la
 * longitud del secreto tampoco se filtra). Sin CRON_SECRET en el servidor no autoriza nada.
 */
export function checkCronSecret(secret: string | undefined, given: string | undefined): CronAuth {
  if (!secret) return 'missing-secret';
  if (!given) return 'unauthorized';
  const a = createHash('sha256').update(secret).digest();
  const b = createHash('sha256').update(given).digest();
  return timingSafeEqual(a, b) ? 'ok' : 'unauthorized';
}
