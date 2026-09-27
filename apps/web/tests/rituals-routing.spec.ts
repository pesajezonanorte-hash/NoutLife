import { expect, test } from '@playwright/test';

const baseUrl = process.env.LIFEQUEST_E2E_BASE_URL;
const email = process.env.LIFEQUEST_E2E_EMAIL;
const password = process.env.LIFEQUEST_E2E_PASSWORD;
const permitRitualMutations = process.env.LIFEQUEST_E2E_RITUAL_MUTATIONS === '1';

function url(path: string): string {
  return new URL(path, baseUrl!).toString();
}

async function login(page: import('@playwright/test').Page) {
  await page.goto(url('/login'), { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(email!);
  await page.locator('input[type="password"]').fill(password!);
  await page.getByRole('button', { name: /entrar al mundo/i }).click();
  await page.waitForURL((location) => !location.pathname.endsWith('/login'), { timeout: 20_000 });
}

test.describe('Dedicated ritual routing', () => {
  test.skip(!baseUrl || !email || !password, 'Set LIFEQUEST_E2E_BASE_URL, LIFEQUEST_E2E_EMAIL and LIFEQUEST_E2E_PASSWORD.');

  test('CommandPalette opens the dedicated Rituals page and legacy habit query is inert', async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url('/'), { waitUntil: 'networkidle' });

    await page.getByTitle('Barra de comandos (Ctrl+K)').click();
    const commandInput = page.getByPlaceholder('Buscar o escribir un comando...');
    await expect(commandInput).toBeVisible();
    await commandInput.fill('ritual');
    await page.getByRole('button', { name: /rituales.*rutinas de vida/i }).click();

    await expect(page).toHaveURL(/\/rituals$/);
    await expect(page.getByRole('heading', { name: 'Rituales' })).toBeVisible();

    // Spanish remains a canonical alias for the same dedicated screen.
    await page.goto(url('/rituales'), { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/rituals$/);
    await expect(page.getByRole('heading', { name: 'Rituales' })).toBeVisible();

    // The old query is harmless but cannot revive System A inside Habits.
    await page.goto(url('/habits?filter=ritual'), { waitUntil: 'networkidle' });
    await expect(page.getByText('TUS HÁBITOS DIARIOS')).toBeVisible();
    await expect(page.getByText('TUS RITUALES')).toHaveCount(0);
  });
});

test.describe('Dedicated ritual execution', () => {
  test.skip(
    !baseUrl || !email || !password || !permitRitualMutations,
    'Set LIFEQUEST_E2E_BASE_URL, LIFEQUEST_E2E_EMAIL, LIFEQUEST_E2E_PASSWORD and LIFEQUEST_E2E_RITUAL_MUTATIONS=1 to run the mutation check.',
  );

  test('a seeded preset awards once through ExecutionMode and returns an idempotent second completion', async ({ page }) => {
    await login(page);

    const listResponse = page.waitForResponse((response) => (
      response.request().method() === 'GET' && /\/api\/v1\/rituals(?:\?.*)?$/.test(response.url())
    ));
    await page.goto(url('/rituals'), { waitUntil: 'networkidle' });
    const initialResponse = await listResponse;
    const initialRituals = await initialResponse.json() as Array<{ id: string }>;
    test.skip(initialRituals.length > 0, 'Use an empty, disposable E2E account before seeding presets.');

    const listUrl = initialResponse.url();
    const authorization = initialResponse.request().headers().authorization;
    expect(authorization, 'The app must authenticate the dedicated ritual request.').toBeTruthy();
    const authHeaders = { authorization: authorization! };
    const seeded: Array<{ id: string }> = [];

    try {
      const seedResponse = page.waitForResponse((response) => (
        response.request().method() === 'POST' && /\/api\/v1\/rituals\/seed-presets(?:\?.*)?$/.test(response.url())
      ));
      await page.getByRole('button', { name: /cargar rituales sugeridos/i }).click();
      const seedResult = await seedResponse;
      expect(seedResult.ok()).toBeTruthy();
      const seededRituals = await seedResult.json() as Array<{ id: string }>;
      seeded.push(...seededRituals);
      expect(seeded.length).toBeGreaterThan(0);

      const execute = page.getByRole('button', { name: /ejecutar/i }).first();
      await expect(execute).toBeVisible();

      async function completeExecution() {
        await execute.click();
        for (let step = 0; step < 12; step += 1) {
          const complete = page.getByRole('button', { name: /completar ritual/i });
          if (await complete.isVisible().catch(() => false)) {
            const completedResponse = page.waitForResponse((response) => (
              response.request().method() === 'POST' && /\/api\/v1\/rituals\/[^/]+\/complete(?:\?.*)?$/.test(response.url())
            ));
            await complete.click();
            return completedResponse;
          }
          await page.getByRole('button', { name: /^hecho/i }).click();
        }
        throw new Error('ExecutionMode did not reach the completion action.');
      }

      const first = await (await completeExecution()).json() as { alreadyDone: boolean; xpEarned: number; goldEarned: number };
      expect(first).toMatchObject({ alreadyDone: false, xpEarned: 30, goldEarned: 5 });
      await expect(page.getByRole('button', { name: /ejecutar/i }).first()).toBeVisible();

      const second = await (await completeExecution()).json() as { alreadyDone: boolean; xpEarned: number; goldEarned: number };
      expect(second).toMatchObject({ alreadyDone: true, xpEarned: 0, goldEarned: 0 });
    } finally {
      // Remove the seeded test presets. The allowed mutation test intentionally
      // leaves the one verified reward history intact for auditability.
      for (const ritual of seeded) {
        const cleanup = await page.request.delete(`${listUrl}/${ritual.id}`, { headers: authHeaders });
        expect(cleanup.ok(), `cleanup of test ritual ${ritual.id}`).toBeTruthy();
      }
    }
  });
});
