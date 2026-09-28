import { expect, test, type Page } from '@playwright/test';

const baseUrl = process.env.LIFEQUEST_E2E_BASE_URL;

const user = {
  id: 'flip-card-qa-user',
  email: 'flip.cards@example.test',
  username: 'flip-card-qa',
  displayName: 'Flip QA',
  level: 8,
  xp: 120,
  xpToNextLevel: 500,
  gold: 250,
  hp: 100,
  maxHp: 100,
  mp: 60,
  maxMp: 100,
  strength: 10,
  intelligence: 10,
  charisma: 10,
  avatarConfig: { bodyType: 'male', hairStyle: 'short', hairColor: '#1f1f1f', skinColor: '#d1a07a', shirtColor: '#555555', pants: 'jeans', accessory: 'none', expression: 'normal', pet: null },
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

const featuredLearningItem = {
  id: 'learning-flip-card',
  userId: user.id,
  type: 'BOOK',
  title: 'Clean Code para héroes',
  author: 'Robert C. Martin',
  status: 'IN_PROGRESS',
  currentProgress: 72,
  totalProgress: 464,
  rating: 5,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function url(path: string) {
  return new URL(path, baseUrl!).toString();
}

async function installLearningMocks(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const json = (body: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });

    if (pathname.endsWith('/auth/refresh')) return json({ user, accessToken: 'flip-card-qa-token' });
    if (pathname.endsWith('/users/me')) return json(user);
    if (pathname.endsWith('/learning/stats')) return json({ stats: { totalCompleted: 2, inProgress: 1, totalPages: 72, readingStreak: 3, completedThisYear: 2 } });
    if (pathname.endsWith('/learning')) return json({ items: [featuredLearningItem] });
    return json([]);
  });
}

async function openLearning(page: Page, width: number) {
  await page.setViewportSize({ width, height: 844 });
  await installLearningMocks(page);
  await page.goto(url('/learning'), { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /la biblioteca/i })).toBeVisible({ timeout: 8_000 });
  await expect(page.getByRole('button', { name: /clean code para héroes\. mostrar detalles/i })).toBeVisible({ timeout: 8_000 });
}

test.describe('PerspectiveFlipCard in the Biblioteca', () => {
  test.skip(!baseUrl, 'Set LIFEQUEST_E2E_BASE_URL to run browser verification.');

  test('opens from the keyboard, exposes only the active face, and Escape returns to the summary', async ({ page }) => {
    await openLearning(page, 390);

    const toggle = page.getByRole('button', { name: /clean code para héroes\. mostrar detalles/i });
    const cardRoot = page.locator('[style*="--flip-accent"]').first().locator(':scope > div');
    const flipLayer = cardRoot.locator(':scope > div');
    const frontFace = page.locator('button[aria-controls]').locator('..');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(await cardRoot.evaluate((node) => getComputedStyle(node).perspective)).toBe('2000px');
    await toggle.focus();
    await page.keyboard.press('Enter');

    const detail = page.getByLabel(/detalles de clean code para héroes/i);
    await expect(detail).toHaveAttribute('aria-hidden', 'false');
    await expect(flipLayer).toHaveAttribute('style', /rotateY\(180deg\)/);
    await expect(frontFace).toHaveAttribute('inert', '');
    await expect(detail.getByRole('button', { name: /actualizar progreso/i })).toBeVisible();
    await expect(detail.getByRole('button', { name: /volver al resumen/i })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(detail).toHaveAttribute('aria-hidden', 'true');
    await expect(toggle).toBeFocused();
  });

  test('does not introduce horizontal overflow at the supported mobile widths', async ({ page }) => {
    for (const width of [360, 390, 430]) {
      await openLearning(page, width);
      const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
      expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
    }
  });

  test('uses Card 14 hover motion on a pointer device', async ({ page }) => {
    await openLearning(page, 1024);

    const cardRoot = page.locator('[style*="--flip-accent"]').first().locator(':scope > div');
    const flipLayer = cardRoot.locator(':scope > div');
    await cardRoot.hover();

    await expect(page.getByLabel(/detalles de clean code para héroes/i)).toHaveAttribute('aria-hidden', 'false');
    await expect(flipLayer).toHaveAttribute('style', /rotateY\(180deg\)/);
  });

  test('uses the non-3D reduced-motion path', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openLearning(page, 390);

    const toggle = page.getByRole('button', { name: /clean code para héroes\. mostrar detalles/i });
    await toggle.focus();
    await page.keyboard.press('Enter');

    const transform = await page.locator('[style*="--flip-accent"]').first().locator(':scope > div > div').evaluate((node) => getComputedStyle(node).transform);
    expect(transform).toBe('none');
  });


});
