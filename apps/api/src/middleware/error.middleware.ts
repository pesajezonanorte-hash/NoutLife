import { Request, Response, NextFunction } from 'express';

interface AppError extends Error {
  status?: number;
  expose?: boolean;
}

const SAFE_BUSINESS_ERRORS = new Set([
  'EMAIL_TAKEN',
  'USERNAME_TAKEN',
  'INVALID_CREDENTIALS',
  'INVALID_REFRESH_TOKEN',
  'NOT_FOUND',
  'FORBIDDEN',
  'SAGE_QUOTA_EXCEEDED',
]);

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Internal log — full detail
  console.error('[Error]', err.stack ?? err.message);

  if (res.headersSent) return;

  const status = err.status ?? 500;
  const isProd = process.env.NODE_ENV === 'production';

  // Whitelist a small set of business-error codes for the client
  if (SAFE_BUSINESS_ERRORS.has(err.message)) {
    res.status(status === 500 ? 400 : status).json({ error: err.message });
    return;
  }

  if (status >= 400 && status < 500) {
    res.status(status).json({ error: err.expose ? err.message : 'Solicitud inválida.' });
    return;
  }

  // 5xx — never leak internals in production
  res.status(500).json({
    error: '¡Algo salió mal en el reino, héroe! Inténtalo de nuevo.',
    ...(!isProd && { details: err.message }),
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: `La ruta ${req.method} ${req.path} no existe en este reino.`,
  });
}

/**
 * Message safe to send from a route's own catch block. Domain errors thrown
 * with `new Error('…')` keep their text; Prisma and runtime errors (which
 * contain table/column names and internal ids) are logged and replaced.
 */
export function publicErrorMessage(err: unknown): string {
  const e = err as Error | undefined;
  const internal = !e?.message || e.name?.startsWith('PrismaClient') || e instanceof TypeError || e instanceof ReferenceError;
  if (!internal) return e.message;
  console.error('[Error]', e?.stack ?? e);
  return 'No pudimos completar la operación. Inténtalo de nuevo.';
}
