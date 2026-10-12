import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarRedirectUri } from '../src/lib/oauth';

const KEYS = ['GOOGLE_CALENDAR_REDIRECT_URI', 'WEB_URL'] as const;

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
    assert.equal(calendarRedirectUri('https://noutlife.vercel.app/agenda', 'https://noutlife.vercel.app'), 'https://lifequest2-web.vercel.app/agenda');
    assert.equal(calendarRedirectUri(undefined, undefined), 'https://lifequest2-web.vercel.app/agenda');
  });
});

test('Google Calendar: without configuration it uses the page the person connected from', () => {
  withEnv({}, () => {
    assert.equal(calendarRedirectUri('https://noutlife.vercel.app/agenda', 'https://noutlife.vercel.app'), 'https://noutlife.vercel.app/agenda');
  });
});

test('Google Calendar: never builds «undefined/agenda»; falls back to the request origin, then WEB_URL', () => {
  withEnv({}, () => {
    assert.equal(calendarRedirectUri(undefined, 'https://noutlife.vercel.app'), 'https://noutlife.vercel.app/agenda');
  });
  withEnv({ WEB_URL: 'https://noutlife.vercel.app/' }, () => {
    assert.equal(calendarRedirectUri(undefined, undefined), 'https://noutlife.vercel.app/agenda');
    // Lo que no es una URL http(s) no se manda a Google.
    assert.equal(calendarRedirectUri('javascript:alert(1)', undefined), 'https://noutlife.vercel.app/agenda');
  });
});
