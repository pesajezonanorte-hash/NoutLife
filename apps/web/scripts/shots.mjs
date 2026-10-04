// Capturas de QA del rediseño con la API simulada (sin backend).
// Uso: npm run build && npx vite preview --port 4173 & node scripts/shots.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.SHOTS_BASE ?? 'http://localhost:4173';
const OUT = process.argv[2] ?? 'shots';
mkdirSync(OUT, { recursive: true });

const user = {
  id: 'u1', email: 'alex@example.com', username: 'alex', displayName: 'Alex Rivera',
  level: 12, xp: 2340, xpToNextLevel: 3000, gold: 1280, hp: 92, maxHp: 100, mp: 40, maxMp: 60,
  strength: 14, intelligence: 18, charisma: 11, avatarConfig: {}, avatarUrl: null,
  timezone: 'America/Bogota', currency: 'COP', language: 'es', relationshipStatus: 'single',
  onboardingCompleted: true, birthDate: null, currentStreak: 12, longestStreak: 30,
  activeTheme: 'aurora', createdAt: '2026-01-01T00:00:00.000Z',
};

const ROUTES = [
  '/', '/habits', '/quests', '/colosseum', '/achievements', '/finances', '/food', '/sleep', '/profile',
  '/gym', '/glow-up', '/learning', '/love', '/journal', '/agenda', '/rituals', '/wisdom', '/custom-zones',
  '/shop', '/leaderboard', '/settings', '/stats', '/guild', '/season', '/faq', '/life', '/history', '/about',
];
const DARK = ['/', '/habits', '/finances', '/sleep', '/stats', '/shop'];

async function shoot(browser, path, width, theme) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 768 ? 812 : 900 }, colorScheme: theme });
  await ctx.addInitScript((t) => {
    localStorage.setItem('lifequest.refresh-session-hint', '1');
    localStorage.setItem('lq-theme', JSON.stringify({ state: { theme: t, mode: t }, version: 0 }));
  }, theme);
  const page = await ctx.newPage();
  await page.route('**/api/v1/**', (route) => {
    const url = route.request().url();
    if (/\/auth\/(refresh|login)/.test(url)) return route.fulfill({ json: { user, accessToken: 'mock' } });
    if (/\/auth\/me/.test(url)) return route.fulfill({ json: { user } });
    if (/\/users\/me$/.test(url)) return route.fulfill({ json: user });
    return route.fulfill({ json: [] });
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {});
  await page.evaluate((t) => { document.documentElement.classList.toggle('dark', t === 'dark'); document.documentElement.classList.toggle('light', t !== 'dark'); }, theme);
  await page.waitForTimeout(2200);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const name = `${path === '/' ? 'dashboard' : path.slice(1).replace(/\//g, '-')}-${width}-${theme}.png`;
  await page.screenshot({ path: `${OUT}/${name}`, fullPage: true });
  await ctx.close();
  return { name, overflow, errors: errors.slice(0, 2) };
}

const browser = await chromium.launch();
const only = process.env.SHOTS_ONLY?.split(',');
const results = [];
for (const r of only ?? ROUTES) {
  for (const w of [375, 1440]) results.push(await shoot(browser, r, w, 'light'));
  if (DARK.includes(r) && !only) results.push(await shoot(browser, r, 1440, 'dark'));
}
if (only) for (const r of only) results.push(await shoot(browser, r, 1440, 'dark'));
await browser.close();
for (const x of results) console.log(`${x.overflow > 0 ? 'OVERFLOW ' + x.overflow + 'px ' : ''}${x.name}${x.errors.length ? ' ERR ' + x.errors.join(' | ') : ''}`);
