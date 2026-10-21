// Detección de navegadores internos (portada) y prioridad de zonas en Lite (barra).
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromeIntent, detectInAppBrowser } from '../../src/lib/inAppBrowser';
import { usableOrder } from '../../src/lib/plan';

test('in-app browsers are detected from the user agent', () => {
  assert.equal(detectInAppBrowser('Mozilla/5.0 (iPhone) AppleWebKit Mobile/15E148 Instagram 312.0.0'), 'instagram');
  assert.equal(detectInAppBrowser('Mozilla/5.0 (Linux; Android 14) [FB_IAB/FB4A;FBAV/450.0]'), 'facebook');
  assert.equal(detectInAppBrowser('Mozilla/5.0 (Linux; Android 13) musical_ly_2023 BytedanceWebview/d8a21c6'), 'tiktok');
  assert.equal(detectInAppBrowser('Mozilla/5.0 (Linux; Android 14) Chrome/129.0 Mobile Safari/537.36'), null);
  assert.equal(detectInAppBrowser('Mozilla/5.0 (iPhone) Version/18.0 Mobile/15E148 Safari/604.1'), null);
});

test('the Android intent opens the same page in Chrome and falls back to it', () => {
  assert.equal(
    chromeIntent('https://noutlife.vercel.app/login?utm_source=tiktok'),
    'intent://noutlife.vercel.app/login?utm_source=tiktok#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fnoutlife.vercel.app%2Flogin%3Futm_source%3Dtiktok;end',
  );
});

test('Lite puts usable, visible zones first; Pro keeps the chosen order', () => {
  const order = ['/coliseo', '/finances', '/habits', '/checklists', '/libreta', '/sleep'];
  assert.deepEqual(usableOrder(order, true).slice(0, 3), ['/habits', '/checklists', '/libreta']);
  assert.deepEqual(usableOrder(order, true, ['/checklists']).slice(0, 3), ['/habits', '/libreta', '/coliseo']);
  assert.deepEqual(usableOrder(order, false), order);
});
