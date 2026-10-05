import type { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware';

interface Bucket {
  count: number;
  resetAt: number;
}

interface Options {
  windowMs: number;
  max: number;
  /** key extractor — default uses req.userId (if present) or req.ip */
  key?: (req: Request) => string;
  message?: string;
}

/**
 * IP del cliente. La web reenvía /api/v1 a la API (mismo dominio para la cookie
 * de sesión), así que la conexión llega desde el proxy: se prefiere la IP que
 * anota la plataforma. En Vercel estas cabeceras las reescribe el borde.
 */
export function clientIp(r: Request): string {
  const pick = (h: string | string[] | undefined) => (Array.isArray(h) ? h[0] : h)?.split(',')[0]?.trim();
  return pick(r.headers['x-vercel-forwarded-for']) || pick(r.headers['x-real-ip']) || pick(r.headers['x-forwarded-for']) || r.ip || 'anon';
}

/** Correo o usuario del cuerpo: separa a quienes comparten la IP del proxy. */
const who = (r: Request) => {
  const b = (r.body ?? {}) as { email?: string; username?: string };
  return String(b.email ?? b.username ?? '').toLowerCase();
};

function buildLimiter({ windowMs, max, key, message }: Options) {
  const store = new Map<string, Bucket>();

  // periodic cleanup so the map doesn't leak
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of store) {
      if (v.resetAt < now) store.delete(k);
    }
  }, Math.max(windowMs, 60_000)).unref?.();

  return (req: Request, res: Response, next: NextFunction): void => {
    const k = (key ?? ((r) => (r as AuthRequest).userId ?? clientIp(r)))(req);
    const now = Date.now();
    const b = store.get(k);
    if (!b || b.resetAt < now) {
      store.set(k, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (b.count >= max) {
      const retrySec = Math.ceil((b.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retrySec));
      res.status(429).json({ error: message ?? 'Demasiadas peticiones. Espera un momento.' });
      return;
    }
    b.count++;
    next();
  };
}

// Global limit — broad guard
export const globalLimiter = buildLimiter({
  windowMs: 60_000,
  max: 200,
  key: (r) => (r as AuthRequest).userId ?? clientIp(r),
  message: 'Demasiadas peticiones por minuto. Espera un momento.',
});

// Login limiter — protects against brute force; keyed by IP + email
export const loginLimiter = buildLimiter({
  windowMs: 15 * 60_000,
  max: 8,
  key: (r) => `${clientIp(r)}:${who(r)}`,
  message: 'Demasiados intentos de inicio de sesión. Intenta en 15 minutos.',
});

// Registration limit — slow signup spam per IP
export const registerLimiter = buildLimiter({
  windowMs: 60 * 60_000,
  max: 5,
  key: (r) => `${clientIp(r)}:${who(r)}`,
  message: 'Demasiados registros desde esta IP. Intenta más tarde.',
});

// Availability check before onboarding — limits email/username probing per IP
export const availabilityLimiter = buildLimiter({
  windowMs: 15 * 60_000,
  max: 30,
  key: (r) => `${clientIp(r)}:${who(r)}`,
  message: 'Demasiadas comprobaciones. Intenta en unos minutos.',
});

// Sage limiter — per-minute burst guard
export const sageLimiter = buildLimiter({
  windowMs: 60_000,
  max: 10,
  message: 'Demasiadas consultas al Sabio por minuto. Espera un momento.',
});

// Sage daily limiter — prevents one user from exhausting all AI tokens
export const sageDailyLimiter = buildLimiter({
  windowMs: 24 * 60 * 60_000,
  max: 20,
  message: 'Has alcanzado el límite diario de consultas al Sabio (20/día). Vuelve mañana.',
});


// A destructive reset also requires the current password and a literal
// confirmation, but limit it further to make accidental/replayed requests rare.
export const factoryResetLimiter = buildLimiter({
  windowMs: 60 * 60_000,
  max: 3,
  message: 'Demasiados intentos de reinicio. Intenta de nuevo en una hora.',
});

export { buildLimiter };
