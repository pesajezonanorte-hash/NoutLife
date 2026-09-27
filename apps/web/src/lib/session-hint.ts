/**
 * A non-sensitive hint that a successful login/register occurred in this
 * browser. It is deliberately not an auth credential: the httpOnly refresh
 * cookie remains the only source of session authority. The hint prevents an
 * unnecessary /auth/refresh request (and its 401) on a brand-new login screen.
 */
const REFRESH_SESSION_HINT_KEY = 'lifequest.refresh-session-hint';

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function markRefreshSessionExpected(): void {
  storage()?.setItem(REFRESH_SESSION_HINT_KEY, '1');
}

export function clearRefreshSessionExpected(): void {
  storage()?.removeItem(REFRESH_SESSION_HINT_KEY);
}

export function hasRefreshSessionHint(): boolean {
  return storage()?.getItem(REFRESH_SESSION_HINT_KEY) === '1';
}

export function isPublicAuthPath(pathname: string): boolean {
  return pathname === '/login' || pathname === '/register';
}

/** A protected route still verifies the cookie; only fresh auth pages skip it. */
export function shouldBootstrapSession(pathname: string): boolean {
  return !isPublicAuthPath(pathname) || hasRefreshSessionHint();
}
