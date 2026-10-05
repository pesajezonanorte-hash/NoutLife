import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';

// Marca de actividad (lastSeenAt) como mucho una vez por hora y usuario, sin
// bloquear la petición: sirve para saber cuánta gente usa la app hoy.
const SEEN_EVERY_MS = 60 * 60_000;
const lastSeen = new Map<string, number>();
function markSeen(userId: string): void {
  const now = Date.now();
  if (now - (lastSeen.get(userId) ?? 0) < SEEN_EVERY_MS) return;
  lastSeen.set(userId, now);
  prisma.user.updateMany({ where: { id: userId }, data: { lastSeenAt: new Date(now) } }).catch(() => null);
}

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  // Try to get token from Authorization header first
  let token = '';
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.query.token && typeof req.query.token === 'string') {
    // Fallback: get token from query params for OAuth redirects
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({ error: 'Token de acceso requerido' });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    req.userEmail = payload.email;
    markSeen(payload.userId);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}
