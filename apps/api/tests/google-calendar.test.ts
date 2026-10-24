import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarRedirectUri, getAllowedOrigins, isAllowedOrigin } from '../src/lib/oauth';

const KEYS = ['GOOGLE_CALENDAR_REDIRECT_URI', 'WEB_URL', 'NEXT_PUBLIC_SITE_URL', 'NEXTAUTH_URL', 'CORS_ORIGIN'] as const;

function withEnv(values: Partial<Record<(typeof KEYS)[number], string>>, run: () => void) {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  try {
    for (const key of KEYS) {
      if (values[key] === undefined) delete process.env[key];
      else process.env[key] = values[key];
    }
    run();
  } finally {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

test('Google Calendar: the configured redirect URI wins over the page the web sends, in both OAuth steps', () => {
  withEnv({ GOOGLE_CALENDAR_REDIRECT_URI: ' https://lifequest2-web.vercel.app/agenda ' }, () => {
    assert.equal(calendarRedirectUri('https://noutlife.site/agenda', 'https://noutlife.site'), 'https://lifequest2-web.vercel.app/agenda');
    assert.equal(calendarRedirectUri(undefined, undefined), 'https://lifequest2-web.vercel.app/agenda');
  });
});

test('Google Calendar: without configuration it uses the page the person connected from', () => {
  withEnv({}, () => {
    assert.equal(calendarRedirectUri('https://noutlife.site/agenda', 'https://noutlife.site'), 'https://noutlife.site/agenda');
    assert.equal(calendarRedirectUri('https://www.noutlife.site/agenda', 'https://www.noutlife.site'), 'https://www.noutlife.site/agenda');
  });
});

test('Google Calendar: never builds «undefined/agenda»; falls back to the request origin, then WEB_URL / NEXT_PUBLIC_SITE_URL / noutlife.site', () => {
  withEnv({}, () => {
    assert.equal(calendarRedirectUri(undefined, 'https://noutlife.site'), 'https://noutlife.site/agenda');
    assert.equal(calendarRedirectUri(undefined, undefined), 'https://noutlife.site/agenda');
  });
  withEnv({ WEB_URL: 'https://noutlife.site/' }, () => {
    assert.equal(calendarRedirectUri(undefined, undefined), 'https://noutlife.site/agenda');
    // Lo que no es una URL http(s) no se manda a Google.
    assert.equal(calendarRedirectUri('javascript:alert(1)', undefined), 'https://noutlife.site/agenda');
  });
  withEnv({ NEXT_PUBLIC_SITE_URL: 'https://www.noutlife.site/' }, () => {
    assert.equal(calendarRedirectUri(undefined, undefined), 'https://www.noutlife.site/agenda');
  });
});

test('OAuth origins: allows noutlife.site, www.noutlife.site and configured env origins, and rejects unknown origins', () => {
  withEnv({ CORS_ORIGIN: 'https://custom.noutlife.site/' }, () => {
    const origins = getAllowedOrigins();
    assert.ok(origins.includes('https://noutlife.site'));
    assert.ok(origins.includes('https://www.noutlife.site'));
    assert.ok(origins.includes('https://custom.noutlife.site'));
    assert.equal(isAllowedOrigin('https://noutlife.site'), true);
    assert.equal(isAllowedOrigin('https://www.noutlife.site'), true);
    assert.equal(isAllowedOrigin('https://evil.example'), false);
  });
});

test('Google Calendar: the OAuth state is bound to the person, signed and short-lived', async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-with-at-least-32-characters!!';
  const { signCalendarState, verifyCalendarState } = await import('../src/lib/oauth');
  const now = Date.now();
  const state = signCalendarState('user-a', now);
  assert.equal(verifyCalendarState(state, 'user-a', now + 60_000), true);
  // Otra persona no puede usar la vuelta de Google pedida por la primera (CSRF).
  assert.equal(verifyCalendarState(state, 'user-b', now + 60_000), false);
  // Caduca a los 10 minutos.
  assert.equal(verifyCalendarState(state, 'user-a', now + 11 * 60_000), false);
  // Firma alterada o ausente.
  assert.equal(verifyCalendarState(`${state}x`, 'user-a', now), false);
  assert.equal(verifyCalendarState(undefined, 'user-a', now), false);
  const [encoded] = state.split('.');
  const forged = `${Buffer.from(`user-a.${now.toString(36)}.00`).toString('base64url')}.${state.split('.')[1]}`;
  assert.notEqual(forged.split('.')[0], encoded);
  assert.equal(verifyCalendarState(forged, 'user-a', now), false);
});

test('Google Calendar: a page from another origin is never used as the return URL', () => {
  withEnv({ WEB_URL: 'https://noutlife.site' }, () => {
    assert.equal(calendarRedirectUri('https://evil.example/agenda', 'https://noutlife.site'), 'https://noutlife.site/agenda');
  });
});

test('Google Calendar: only the events scope is requested, with state and incremental consent', async () => {
  process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'client-id.apps.googleusercontent.com';
  const { getGoogleAuthUrl } = await import('../src/services/agenda.service');
  const url = new URL(getGoogleAuthUrl('https://noutlife.site/agenda', 'st4te', 'persona@example.com'));
  assert.equal(url.searchParams.get('scope'), 'https://www.googleapis.com/auth/calendar.events');
  assert.equal(url.searchParams.get('state'), 'st4te');
  assert.equal(url.searchParams.get('include_granted_scopes'), 'true');
  assert.equal(url.searchParams.get('login_hint'), 'persona@example.com');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://noutlife.site/agenda');
});
