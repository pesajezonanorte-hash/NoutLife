// Una creación que se reenvía no se aplica dos veces. La app sin conexión reintenta lo que no recibió
// respuesta, y una respuesta puede perderse después de que la escritura ya se guardó (un túnel, un
// ascensor). Con la cabecera Idempotency-Key, el segundo intento recibe la misma respuesta del primero.
import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import type { AuthRequest } from './auth.middleware';

const KEY_FORMAT = /^[\w-]{8,64}$/;
/** Una escritura pendiente en el dispositivo rara vez tarda más: pasado esto, la clave se olvida. */
const KEEP_MS = 14 * 24 * 60 * 60_000;
/** Limpieza sin tarea programada: de vez en cuando, al registrar una clave nueva. */
const CLEAN_EVERY = 200;

const isUniqueViolation = (error: unknown) => (error as { code?: string } | null)?.code === 'P2002';

export async function idempotent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const key = req.header('idempotency-key');
  const userId = req.userId;
  if (!key || !userId || !KEY_FORMAT.test(key)) { next(); return; }

  try {
    await prisma.idempotencyKey.create({ data: { userId, key } });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      // Sin la tabla (migración pendiente) o sin base: la escritura sigue su curso, como antes de esto.
      console.error('[IDEMPOTENCY_ERROR]', error);
      next();
      return;
    }
    const seen = await prisma.idempotencyKey.findUnique({ where: { userId_key: { userId, key } } }).catch(() => null);
    if (seen?.status != null) {
      res.status(seen.status).json(seen.body);
      return;
    }
    // El primer intento aún no termina: 425 hace que el dispositivo vuelva a intentarlo más tarde.
    res.status(425).json({ error: 'Esta escritura se está procesando.' });
    return;
  }

  if (Math.floor(Math.random() * CLEAN_EVERY) === 0) {
    prisma.idempotencyKey.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_MS) } } }).catch(() => null);
  }

  // Se guarda la respuesta antes de enviarla. Una que falla olvida la clave: el reintento vuelve a intentarlo.
  const send = res.json.bind(res);
  res.json = (body: unknown) => {
    const where = { userId_key: { userId, key } };
    const saved = res.statusCode < 400
      ? prisma.idempotencyKey.update({ where, data: { status: res.statusCode, body: (body ?? null) as never } })
      : prisma.idempotencyKey.delete({ where });
    void saved.catch((error: unknown) => console.error('[IDEMPOTENCY_ERROR]', error)).finally(() => send(body));
    return res;
  };
  next();
}
