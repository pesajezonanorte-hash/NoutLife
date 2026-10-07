import { expect, test, type Page } from '@playwright/test';

const baseUrl = process.env.NOUTLIFE_E2E_BASE_URL;

const user = {
  id: 'loader-qa-user',
  email: 'loader.qa@example.test',
  username: 'loader-qa',
  displayName: 'Loader QA',
  level: 12,
  xp: 320,
  xpToNextLevel: 500,
  gold: 250,
  hp: 100,
  maxHp: 100,
  mp: 60,
  maxMp: 100,
  strength: 10,
  intelligence: 10,
  charisma: 10,
  avatarConfig: {
    bodyType: 'male',
    hairStyle: 'short',
    hairColor: '#1f1f1f',
    skinColor: '#d1a07a',
    shirtColor: '#555555',
    pants: 'jeans',
    accessory: 'none',
    expression: 'normal',
    pet: null,
  },
  avatarUrl: null,
  timezone: 'America/Bogota',
  currency: 'COP',
  language: 'es',
  relationshipStatus: 'SINGLE',
  onboardingCompleted: true,
  birthDate: null,
  currentStreak: 5,
  longestStreak: 8,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function url(path: string): string {
  return new URL(path, baseUrl!).toString();
}

async function installApiMocks(page: Page, achievementDelayMs: number | null = 1_200) {
  let resolveAchievements!: () => void;
  let releaseAchievements!: () => void;
  const achievementsFinished = new Promise<void>((resolve) => { resolveAchievements = resolve; });
  const achievementsRelease = new Promise<void>((resolve) => { releaseAchievements = resolve; });

  await page.route('**/api/v1/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const json = (body: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });

    if (pathname.endsWith('/auth/refresh')) return json({ user, accessToken: 'loader-qa-token' });
    if (pathname.endsWith('/users/me')) return json(user);
    if (pathname.endsWith('/achievements')) {
      if (achievementDelayMs === null) {
        await achievementsRelease;
      } else {
        await pause(achievementDelayMs);
      }
      resolveAchievements();
      return json({ achievements: [] });
    }

    // Shell consumers either expect an array or guard their optional object keys.
    return json([]);
  });

  return { achievementsFinished, releaseAchievements };
}

async function waitForSplashToLeave(page: Page) {
  const splash = page.locator('[aria-label="Cargando Noutlife"]');
  await expect(splash).toBeVisible({ timeout: 4_000 });
  await expect(splash).toBeHidden({ timeout: 8_000 });
}

const LITERAL_LOADER = 'div.w-full.max-w-md.mx-auto.p-8';

test.describe('literal terminal loader coverage', () => {
  test.skip(!baseUrl, 'Set NOUTLIFE_E2E_BASE_URL to run browser verification.');

  test('keeps the page terminal stable through the shared minimum after a lazy route resolves', async ({ page }) => {
    let releaseLogin!: () => void;
    let resolveLoginFinished!: () => void;
    const loginRelease = new Promise<void>((resolve) => { releaseLogin = resolve; });
    const loginFinished = new Promise<void>((resolve) => { resolveLoginFinished = resolve; });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/src/pages/Login/**', async (route) => {
      await loginRelease;
      await route.continue();
      resolveLoginFinished();
    });

    await page.goto(url('/login'), { waitUntil: 'domcontentloaded' });
    await waitForSplashToLeave(page);

    const pageLoader = page.locator('div.w-full.max-w-md.mx-auto.p-8');
    await expect(pageLoader).toBeVisible({ timeout: 4_000 });
    await page.waitForTimeout(420);
    await expect(pageLoader).toBeVisible();

    const box = await pageLoader.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);

    releaseLogin();
    await loginFinished;
    await expect(pageLoader).toBeHidden({ timeout: 2_000 });
  });

  test('uses the same terminal for a first section load without mobile horizontal overflow', async ({ page }) => {
    await installApiMocks(page, 1_500);
    await page.goto(url('/achievements'), { waitUntil: 'domcontentloaded' });
    await waitForSplashToLeave(page);
    await expect(page.getByRole('heading', { name: /sala de logros/i })).toBeVisible({ timeout: 4_000 });

    const sectionLoader = page.locator(LITERAL_LOADER);
    await expect(sectionLoader).toBeVisible({ timeout: 4_000 });

    for (const width of [360, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      const metrics = await page.evaluate(() => ({ viewportWidth: window.innerWidth, documentWidth: document.documentElement.scrollWidth }));
      expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth);

      const box = await sectionLoader.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.height).toBeGreaterThanOrEqual(160);
      expect(box!.height).toBeLessThanOrEqual(420);
    }
  });

  test('keeps the same section terminal visible after a just-resolved request', async ({ page }) => {
    const { achievementsFinished, releaseAchievements } = await installApiMocks(page, null);
    await page.goto(url('/achievements'), { waitUntil: 'domcontentloaded' });
    await waitForSplashToLeave(page);
    await expect(page.getByRole('heading', { name: /sala de logros/i })).toBeVisible({ timeout: 4_000 });

    const sectionLoader = page.locator(LITERAL_LOADER);
    await expect(sectionLoader).toBeVisible({ timeout: 4_000 });
    releaseAchievements();
    await achievementsFinished;
    await page.waitForTimeout(80);
    await expect(sectionLoader).toBeVisible();
    await expect(sectionLoader).toBeHidden({ timeout: 2_000 });
  });

  test('uses the same terminal for a first section load with reduced motion enabled', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installApiMocks(page, 1_100);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(url('/achievements'), { waitUntil: 'domcontentloaded' });
    await waitForSplashToLeave(page);
    await expect(page.getByRole('heading', { name: /sala de logros/i })).toBeVisible({ timeout: 4_000 });

    const sectionLoader = page.locator(LITERAL_LOADER);
    await expect(sectionLoader).toBeVisible({ timeout: 4_000 });
    await expect(sectionLoader.locator('.text-muted-foreground.font-mono')).toBeVisible();
  });
});
