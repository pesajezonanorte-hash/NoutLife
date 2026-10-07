import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * Verifies Google and Apple ID tokens against each provider's public keys.
 * Only the provider-signed token is trusted; nothing the client says about the
 * user (email, name) is used unless it comes from the verified claims, except
 * Apple's display name, which Apple only sends to the client on first sign-in.
 */
export type OAuthProvider = 'google' | 'apple';

export interface OAuthIdentity {
  provider: OAuthProvider;
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

const list = (v: string | undefined) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);

export const oauthConfig = () => ({
  googleClientId: list(process.env.GOOGLE_CLIENT_ID)[0] ?? null,
  appleClientId: list(process.env.APPLE_CLIENT_ID)[0] ?? null,
  appleRedirectUri: process.env.APPLE_REDIRECT_URI?.trim() || null,
});

export async function verifyIdToken(provider: OAuthProvider, idToken: string): Promise<OAuthIdentity> {
  const audience = list(provider === 'google' ? process.env.GOOGLE_CLIENT_ID : process.env.APPLE_CLIENT_ID);
  if (!audience.length) throw new Error('OAUTH_NOT_CONFIGURED');

  const { payload } = await jwtVerify(idToken, provider === 'google' ? GOOGLE_JWKS : APPLE_JWKS, {
    issuer: provider === 'google' ? ['https://accounts.google.com', 'accounts.google.com'] : 'https://appleid.apple.com',
    audience,
  }).catch(() => { throw new Error('INVALID_OAUTH_TOKEN'); });

  if (!payload.sub) throw new Error('INVALID_OAUTH_TOKEN');
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : null;
  // Google sends a boolean; Apple sends "true"/"false" strings.
  const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
  return {
    provider,
    sub: payload.sub,
    email,
    emailVerified,
    name: typeof payload.name === 'string' ? payload.name : null,
  };
}
