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

const list = (v: string | undefined) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);

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
  if (typeof fromClient === 'string' && /^https?:\/\//.test(fromClient)) return fromClient;
  const base = (origin || process.env.WEB_URL || '').trim().replace(/\/+$/, '');
  return `${base}/agenda`;
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
