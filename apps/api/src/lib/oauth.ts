import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * Verifies Google ID tokens against Google's public keys.
 * Only the provider-signed token is trusted; nothing the client says about the
 * user is used unless it comes from the verified claims.
 */
export type OAuthProvider = 'google';

export interface OAuthIdentity {
  provider: 'google';
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export const DEFAULT_SITE_URL = 'https://noutlife.site';

const normalizeOrigin = (value: string): string => {
  const trimmed = value.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');
  if (!trimmed) return '';
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed;
  }
};

const list = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);

/**
 * Origen público principal configurado por variables de entorno o el dominio de
 * producción por defecto (`https://noutlife.site`).
 */
export function siteOrigin(): string {
  const configured = [
    process.env.WEB_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXTAUTH_URL,
    process.env.SITE_URL,
    process.env.VITE_SITE_URL,
    process.env.CORS_ORIGIN,
  ]
    .map((v) => (v ? normalizeOrigin(v) : ''))
    .find(Boolean);
  return configured || DEFAULT_SITE_URL;
}

/**
 * Lista de orígenes permitidos para CORS y validación de redirecciones OAuth.
 */
export function getAllowedOrigins(): string[] {
  const envOrigins = [
    process.env.CORS_ORIGIN,
    process.env.CORS_ORIGIN_2,
    process.env.WEB_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXTAUTH_URL,
    process.env.SITE_URL,
    process.env.VITE_SITE_URL,
  ]
    .flatMap((v) => list(v))
    .map(normalizeOrigin)
    .filter(Boolean);

  return Array.from(
    new Set([
      ...envOrigins,
      'https://noutlife.site',
      'https://www.noutlife.site',
      'http://localhost:5173',
      'http://localhost:3000',
      'https://tourmaline-sherbet-90125b.netlify.app',
      'https://lifequest2-web.vercel.app',
    ]),
  );
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  return getAllowedOrigins().includes(normalized);
}

export const oauthConfig = () => ({
  googleClientId: list(process.env.GOOGLE_CLIENT_ID)[0] ?? null,
});

/**
 * URL de retorno del permiso de Google Calendar. Debe ser idéntica al pedir el
 * permiso y al canjear el código, y estar registrada en Google Cloud Console
 * («URIs de redireccionamiento autorizados»); si no, Google responde
 * redirect_uri_mismatch. GOOGLE_CALENDAR_REDIRECT_URI manda; sin ella, la
 * página desde la que se conectó (la manda la web) o /agenda del origen o de WEB_URL.
 */
export function calendarRedirectUri(fromClient: unknown, origin?: string): string {
  const configured = (process.env.GOOGLE_CALENDAR_REDIRECT_URI ?? '').trim();
  if (configured) return configured;
  const effectiveOrigin = (origin || siteOrigin()).trim();
  // La página que manda la web solo vale si es del mismo origen de la petición
  // (que CORS ya validó) o un origen propio permitido: nadie puede colar otro dominio como retorno.
  if (typeof fromClient === 'string' && /^https?:\/\//.test(fromClient)) {
    try {
      const clientOrigin = new URL(fromClient).origin;
      if (effectiveOrigin && clientOrigin === new URL(effectiveOrigin).origin) return fromClient;
      if (!origin && isAllowedOrigin(clientOrigin)) return fromClient;
    } catch { /* URL inválida: se ignora */ }
  }
  const base = effectiveOrigin.replace(/\/+$/, '');
  return `${base}/agenda`;
}

/**
 * Único permiso que pide la integración: ver y editar eventos (publica hábitos,
 * misiones y tareas, e importa los eventos a la Agenda). `calendar.readonly`
 * sobraba: `calendar.events` ya permite leerlos, y cada permiso sensible extra
 * alarga la pantalla de consentimiento y la verificación de Google.
 */
export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

const STATE_TTL_MS = 10 * 60_000;

function stateMac(payload: string): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET no configurado.');
  return createHmac('sha256', secret).update(`gcal-state:${payload}`).digest();
}

/**
 * `state` del permiso de Google Calendar: firmado y atado a la persona que lo
 * pidió, con caducidad. Sin él, cualquiera podía hacer llegar a otra persona a
 * /agenda?code=… con un código suyo y enlazar la cuenta de la víctima a su
 * calendario (CSRF del flujo OAuth).
 */
export function signCalendarState(userId: string, now = Date.now()): string {
  const payload = `${userId}.${now.toString(36)}.${randomBytes(8).toString('hex')}`;
  return `${Buffer.from(payload).toString('base64url')}.${stateMac(payload).toString('base64url')}`;
}

export function verifyCalendarState(state: unknown, userId: string, now = Date.now()): boolean {
  if (typeof state !== 'string' || state.length > 512) return false;
  const [encoded, mac] = state.split('.');
  if (!encoded || !mac) return false;
  const payload = Buffer.from(encoded, 'base64url').toString();
  const expected = stateMac(payload);
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;
  const [owner, issued] = payload.split('.');
  const age = now - parseInt(issued ?? '', 36);
  return owner === userId && age >= 0 && age <= STATE_TTL_MS;
}

export async function verifyIdToken(provider: OAuthProvider, idToken: string): Promise<OAuthIdentity> {
  if (provider !== 'google') throw new Error('OAUTH_PROVIDER_NOT_SUPPORTED');
  const audience = list(process.env.GOOGLE_CLIENT_ID);
  if (!audience.length) throw new Error('OAUTH_NOT_CONFIGURED');

  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience,
  }).catch(() => { throw new Error('INVALID_OAUTH_TOKEN'); });

  if (!payload.sub) throw new Error('INVALID_OAUTH_TOKEN');
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : null;
  const emailVerified = payload.email_verified === true;
  return {
    provider,
    sub: payload.sub,
    email,
    emailVerified,
    name: typeof payload.name === 'string' ? payload.name : null,
  };
}
