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
    const k = (key ?? ((r) => (r as AuthRequest).userId ?? r.ip ?? 'anon'))(req);
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
  key: (r) => (r as AuthRequest).userId ?? r.ip ?? 'anon',
  message: 'Demasiadas peticiones por minuto. Espera un momento.',
});

// Login limiter — protects against brute force; keyed by IP + email
export const loginLimiter = buildLimiter({
  windowMs: 15 * 60_000,
  max: 8,
  key: (r) => `${r.ip ?? 'anon'}:${(r.body as { email?: string })?.email ?? ''}`,
  message: 'Demasiados intentos de inicio de sesión. Intenta en 15 minutos.',
});

// Registration limit — slow signup spam per IP
export const registerLimiter = buildLimiter({
  windowMs: 60 * 60_000,
  max: 5,
  key: (r) => r.ip ?? 'anon',
  message: 'Demasiados registros desde esta IP. Intenta más tarde.',
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
