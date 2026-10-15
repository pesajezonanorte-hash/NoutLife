import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { isAdminEmail } from '../lib/admin';
import type { AuthRequest } from './auth.middleware';

/** Solo las cuentas de ADMIN_EMAILS pasan. Va después de requireAuth. */
export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { email: true } });
  if (!isAdminEmail(user?.email)) {
    res.status(403).json({ error: 'Solo para administradores' });
    return;
  }
  next();
}
