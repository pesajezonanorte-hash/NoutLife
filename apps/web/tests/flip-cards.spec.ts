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

function featuredCard(page: Page) {
  return page.locator('[style*="--flip-accent"]').first().locator(':scope > .perspective-flip-card');
}

function flipLayer(page: Page) {
  return featuredCard(page).locator(':scope > .perspective-flip-card__rotor');
}

test.describe('PerspectiveFlipCard in the Biblioteca', () => {
  test.skip(!baseUrl, 'Set LIFEQUEST_E2E_BASE_URL to run browser verification.');

  test('opens from the keyboard, exposes only the active face, and Escape returns to the summary', async ({ page }) => {
    await openLearning(page, 390);

    const toggle = page.getByRole('button', { name: /clean code para héroes\. mostrar detalles/i });
    const cardRoot = featuredCard(page);
    const rotor = flipLayer(page);
    const frontFace = toggle.locator('..');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(await cardRoot.evaluate((node) => getComputedStyle(node).perspective)).toBe('2000px');
    await toggle.focus();
    await page.keyboard.press('Enter');

    const detail = page.getByLabel(/detalles de clean code para héroes/i);
    await expect(detail).toHaveAttribute('aria-hidden', 'false');
    await expect(cardRoot).toHaveAttribute('data-flipped', 'true');
    await page.waitForTimeout(750);
    expect(await rotor.evaluate((node) => getComputedStyle(node).transform)).not.toBe('none');
    await expect(frontFace).toHaveAttribute('inert', '');
    await expect(detail.getByRole('button', { name: /actualizar progreso/i })).toBeVisible();
    await expect(detail.getByRole('button', { name: /volver al resumen/i })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(detail).toHaveAttribute('aria-hidden', 'true');
    await expect(toggle).toBeFocused();
  });

  test('keeps a prefixed 3D compositor chain on desktop and 390px', async ({ page }, testInfo) => {
    for (const viewport of [
      { name: 'desktop', width: 1280, height: 900 },
      { name: 'mobile-390', width: 390, height: 844 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await installLearningMocks(page);
      await page.goto(url('/learning'), { waitUntil: 'domcontentloaded' });

      const toggle = page.getByRole('button', { name: /clean code para héroes\. mostrar detalles/i });
      const cardRoot = featuredCard(page);
      const rotor = flipLayer(page);
      const frontFace = cardRoot.locator('.perspective-flip-card__face--front');
      await expect(toggle).toBeVisible();
      await expect(cardRoot).toHaveAttribute('data-3d-supported', 'true');

      const styles = await cardRoot.evaluate((node) => {
        const rotorNode = node.querySelector<HTMLElement>('.perspective-flip-card__rotor')!;
        const faceNode = node.querySelector<HTMLElement>('.perspective-flip-card__face')!;
        const root = getComputedStyle(node);
        const rotorStyle = getComputedStyle(rotorNode);
        const faceStyle = getComputedStyle(faceNode);
        return {
          perspective: root.perspective,
          transformStyle: rotorStyle.transformStyle,
          webkitTransformStyle: rotorStyle.getPropertyValue('-webkit-transform-style'),
          backfaceVisibility: faceStyle.backfaceVisibility,
          webkitBackfaceVisibility: faceStyle.getPropertyValue('-webkit-backface-visibility'),
        };
      });
      expect(styles.perspective).toBe('2000px');
      expect(styles.transformStyle).toBe('preserve-3d');
      expect(styles.webkitTransformStyle || styles.transformStyle).toBe('preserve-3d');
      expect(styles.backfaceVisibility).toBe('hidden');
      expect(styles.webkitBackfaceVisibility || styles.backfaceVisibility).toBe('hidden');

      await toggle.click();
      await expect(cardRoot).toHaveAttribute('data-flipped', 'true');
      await page.waitForTimeout(350);
      expect(await rotor.evaluate((node) => getComputedStyle(node).transform)).not.toBe('none');
      await expect(frontFace).toHaveCSS('opacity', '1');
      await page.screenshot({ path: testInfo.outputPath(`flip-card-${viewport.name}-transition.png`) });
      await page.waitForTimeout(450);
    }
  });

  test('uses a simple cross-fade when the nested 3D gate is unavailable', async ({ page }) => {
    await openLearning(page, 390);

    const cardRoot = featuredCard(page);
    const rotor = flipLayer(page);
    await page.getByRole('button', { name: /clean code para héroes\. mostrar detalles/i }).click();
    await expect(cardRoot).toHaveAttribute('data-flipped', 'true');
    // Simulate a failed runtime feature check after React has committed the
    // interaction state; the CSS fallback must stay flat and only cross-fade.
    await cardRoot.evaluate((node) => node.setAttribute('data-3d-supported', 'false'));
    await page.waitForTimeout(200);

    const fallbackStyles = await cardRoot.evaluate((node) => {
      const rotorNode = node.querySelector<HTMLElement>('.perspective-flip-card__rotor')!;
      const frontFace = node.querySelector<HTMLElement>('.perspective-flip-card__face--front')!;
      const backFace = node.querySelector<HTMLElement>('.perspective-flip-card__face--back')!;
      const depthLayer = node.querySelector<HTMLElement>('.perspective-flip-card__depth')!;
      return {
        rotorTransform: getComputedStyle(rotorNode).transform,
        frontTransform: getComputedStyle(frontFace).transform,
        backTransform: getComputedStyle(backFace).transform,
        depthTransform: getComputedStyle(depthLayer).transform,
        frontOpacity: getComputedStyle(frontFace).opacity,
        backOpacity: getComputedStyle(backFace).opacity,
      };
    });

    expect(fallbackStyles).toEqual({
      rotorTransform: 'none',
      frontTransform: 'none',
      backTransform: 'none',
      depthTransform: 'none',
      frontOpacity: '0',
      backOpacity: '1',
    });
  });

  test('does not introduce horizontal overflow at the supported mobile widths', async ({ page }) => {
    for (const width of [360, 390, 430]) {
      await openLearning(page, width);
      const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
      expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
    }
  });

  test('uses the state-driven hover motion on a pointer device', async ({ page }) => {
    await openLearning(page, 1024);

    const cardRoot = featuredCard(page);
    const rotor = flipLayer(page);
    await cardRoot.hover();

    await expect(page.getByLabel(/detalles de clean code para héroes/i)).toHaveAttribute('aria-hidden', 'false');
    await expect(cardRoot).toHaveAttribute('data-flipped', 'true');
    await page.waitForTimeout(750);
    expect(await rotor.evaluate((node) => getComputedStyle(node).transform)).not.toBe('none');
  });

  test('uses the non-3D reduced-motion path', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openLearning(page, 390);

    const toggle = page.getByRole('button', { name: /clean code para héroes\. mostrar detalles/i });
    await toggle.focus();
    await page.keyboard.press('Enter');

    const transform = await flipLayer(page).evaluate((node) => getComputedStyle(node).transform);
    expect(transform).toBe('none');
  });
});
