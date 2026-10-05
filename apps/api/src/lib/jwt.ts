import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '15m';
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET!;
const REFRESH_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN ?? '30d';

export interface JwtPayload {
  userId: string;
  email: string;
  /** Familia de sesiones del usuario (ver auth.service): la comparten sus dispositivos. */
  fid?: string;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, REFRESH_SECRET) as JwtPayload;
}

// In production the web (e.g. *.vercel.app) and the API (e.g. *.railway.app)
// live on different sites, so the refresh-token cookie must be SameSite=None
// + Secure to be sent on cross-site fetch credentials. In dev (same-site
// localhost, http) we keep SameSite=Lax which works without HTTPS.
const IS_PROD = process.env.NODE_ENV === 'production';

export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: (IS_PROD ? 'none' : 'lax') as 'none' | 'lax',
  // La cookie dura 30 días y se renueva en cada refresh: quien usa la app no vuelve a
  // iniciar sesión; solo caduca tras 30 días sin abrirla.
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: '/api/v1',
};
