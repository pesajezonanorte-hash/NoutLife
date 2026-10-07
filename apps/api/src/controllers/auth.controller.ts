import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { REFRESH_COOKIE_OPTIONS } from '../lib/jwt';
import type { AuthRequest } from '../middleware/auth.middleware';
import { reconcileUserActivityStreak } from '../services/xp.service';
import { resetAccountData } from '../services/account-reset.service';
import { oauthConfig } from '../lib/oauth';
import { prisma } from '../lib/prisma';

/** Public client ids so the web needs no extra build-time variables. */
export function providers(_req: Request, res: Response): void {
  res.json(oauthConfig());
}

export async function oauth(req: Request, res: Response): Promise<void> {
  try {
    const { user, accessToken, refreshToken } = await authService.oauthSignIn(req.body);
    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
    res.json({ user, accessToken });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'ERROR';
    if (msg === 'INVALID_OAUTH_TOKEN') {
      res.status(401).json({ error: 'No pudimos verificar tu cuenta. Inténtalo de nuevo.' });
    } else if (msg === 'OAUTH_EMAIL_UNVERIFIED') {
      res.status(403).json({ error: 'Tu cuenta no tiene un email verificado.' });
    } else if (msg === 'OAUTH_NOT_CONFIGURED') {
      res.status(503).json({ error: 'Este método de inicio de sesión no está disponible ahora mismo.' });
    } else if (/connection pool|Timed out fetching|P2024|Can.t reach database|P1001|P1002/i.test(msg)) {
      res.status(503).json({ error: 'El servidor está ocupado. Espera unos segundos e inténtalo de nuevo.' });
    } else {
      console.error('[OAUTH_ERROR]', err);
      res.status(500).json({ error: 'Error al iniciar sesión. Inténtalo de nuevo.' });
    }
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.refreshToken as string | undefined;

  if (!token) {
    res.status(401).json({ error: 'Refresh token requerido.' });
    return;
  }

  try {
    const { accessToken, refreshToken, user } = await authService.refreshAccessToken(token);
    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
    res.json({ accessToken, user });
  } catch {
    res.clearCookie('refreshToken', { path: '/api/v1' });
    res.status(401).json({ error: 'Sesión expirada. Inicia sesión de nuevo.' });
  }
}

export async function logout(req: AuthRequest, res: Response): Promise<void> {
  if (req.userId) {
    await authService.logoutUser(req.userId);
  }
  res.clearCookie('refreshToken', { path: '/api/v1' });
  res.json({ message: 'Hasta pronto, héroe.' });
}


/** Destructive self-service reset. Requires auth plus a literal confirmation. */
export async function factoryReset(req: AuthRequest, res: Response): Promise<void> {
  try {
    const summary = await resetAccountData(req.userId!);
    res.json({ message: 'Tu progreso y datos de Noutlife fueron reiniciados.', summary });
  } catch (err) {
    console.error('[FACTORY_RESET_ERROR]', err);
    res.status(500).json({ error: 'No se pudo reiniciar la cuenta. No se aplicaron cambios parciales.' });
  }
}

/**
 * Permanent account deletion (required by the App Store and Google Play). The
 * reset first unwinds shared records (guild leadership, shared challenges)
 * without touching other people's data; deleting the user cascades the rest.
 */
export async function deleteAccount(req: AuthRequest, res: Response): Promise<void> {
  try {
    await resetAccountData(req.userId!);
    await prisma.userBlock.deleteMany({ where: { OR: [{ blockerId: req.userId }, { blockedId: req.userId }] } });
    await prisma.user.delete({ where: { id: req.userId } });
    res.clearCookie('refreshToken', { path: '/api/v1' });
    res.json({ message: 'Tu cuenta y todos tus datos fueron eliminados.' });
  } catch (err) {
    console.error('[DELETE_ACCOUNT_ERROR]', err);
    res.status(500).json({ error: 'No se pudo eliminar la cuenta. Inténtalo de nuevo.' });
  }
}

export async function me(req: AuthRequest, res: Response): Promise<void> {
  try {
    await reconcileUserActivityStreak(req.userId!);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.userId },
      select: {
        id: true, email: true, username: true, displayName: true,
        level: true, xp: true, xpToNextLevel: true, gold: true,
        hp: true, maxHp: true,
        strength: true, intelligence: true, charisma: true,
        avatarConfig: true, avatarUrl: true, nameColor: true, equippedAura: true, equippedFrame: true, timezone: true, currency: true,
        language: true, relationshipStatus: true, createdAt: true,
        onboardingCompleted: true, birthDate: true,
        currentStreak: true, longestStreak: true,
      },
    });
    res.json({
      user: {
        ...user,
        createdAt: user.createdAt.toISOString(),
        birthDate: user.birthDate?.toISOString() ?? null,
      },
    });
  } catch {
    res.status(404).json({ error: 'Usuario no encontrado.' });
  }
}
