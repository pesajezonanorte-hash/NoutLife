import { expect, test } from '@playwright/test';

const baseUrl = process.env.LIFEQUEST_E2E_BASE_URL;
const email = process.env.LIFEQUEST_E2E_EMAIL;
const password = process.env.LIFEQUEST_E2E_PASSWORD;

function url(path: string): string {
  return new URL(path, baseUrl!).toString();
}

test.describe('public auth bootstrap', () => {
  test.skip(!baseUrl, 'Set LIFEQUEST_E2E_BASE_URL to run browser verification.');

  test('a fresh login page does not request refresh without a session hint', async ({ page }) => {
    const refreshRequests: string[] = [];
    page.on('request', (request) => {
      if (/\/auth\/refresh(?:\?|$)/.test(request.url())) refreshRequests.push(request.url());
    });

    await page.goto(url('/login'), { waitUntil: 'networkidle' });
    await expect(page.getByRole('button', { name: /entrar al mundo/i })).toBeVisible();
    expect(refreshRequests).toEqual([]);
  });
});

test.describe('Food mobile layout', () => {
  test.skip(!baseUrl || !email || !password, 'Set LIFEQUEST_E2E_BASE_URL, LIFEQUEST_E2E_EMAIL and LIFEQUEST_E2E_PASSWORD.');

  test('fits at 390 px and keeps ANALIZAR fully reachable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(url('/login'), { waitUntil: 'networkidle' });
    await page.locator('input[type="email"]').fill(email!);
    await page.locator('input[type="password"]').fill(password!);
    await page.getByRole('button', { name: /entrar al mundo/i }).click();
    await page.waitForURL((location) => !location.pathname.endsWith('/login'), { timeout: 20_000 });

    await page.goto(url('/food'), { waitUntil: 'networkidle' });
    const analyze = page.getByRole('button', { name: /analizar/i });
    await expect(analyze).toBeVisible();
    await expect(analyze).toBeEnabled();

    const metrics = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth);

    const box = await analyze.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);

  });
});
