// Manejador común de las rutas de la v5 (académico, carteras, oficina, pulso): el servicio lanza un
// ApiError con el texto para la persona y su estado HTTP; cualquier otro fallo responde 500 sin detalles.
import type { RequestHandler } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import { publicErrorMessage } from '../middleware/error.middleware';

export class ApiError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export const gone = (what: string) => new ApiError(`${what} ya no existe.`, 404);

export function handle(run: (req: AuthRequest) => Promise<unknown>, status = 200): RequestHandler {
  return async (req, res) => {
    try {
      res.status(status).json(await run(req as AuthRequest));
    } catch (err) {
      if (err instanceof ApiError) res.status(err.status).json({ error: err.message });
      else res.status(500).json({ error: publicErrorMessage(err) });
    }
  };
}

/** «2026-11-14» al mediodía UTC: el mismo día del calendario en cualquier zona de América. */
export function calendarDay(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}
