export interface SleepGapSuggestion {
  bedtime: string;
  wakeTime: string;
  durationHours: number;
}

function key(userId: string, suffix: 'lastActive' | 'sleepGap') {
  return `noutlife:${suffix}:${userId}`;
}

/**
 * Saves the last time this person was using the app. If a later visit follows
 * a long gap that overlaps the night, keep a suggestion for the sleep page.
 */
export function touchLastActive(userId: string, now = new Date()): void {
  try {
    const last = Number(localStorage.getItem(key(userId, 'lastActive')));
    const elapsed = now.getTime() - last;
    if (Number.isFinite(last) && last > 0 && elapsed >= 4 * 60 * 60_000 && elapsed <= 16 * 60 * 60_000 && overlapsNight(last, now.getTime())) {
      const suggestionKey = key(userId, 'sleepGap');
      if (!localStorage.getItem(suggestionKey)) {
        localStorage.setItem(suggestionKey, JSON.stringify({
          bedtime: new Date(last).toISOString(),
          wakeTime: now.toISOString(),
          durationHours: Math.round((elapsed / 3_600_000) * 10) / 10,
        } satisfies SleepGapSuggestion));
      }
    }
    localStorage.setItem(key(userId, 'lastActive'), String(now.getTime()));
  } catch {
    // Storage can be disabled; activity tracking must never block the app.
  }
}

export function readSleepGapSuggestion(userId: string): SleepGapSuggestion | null {
  try {
    const raw = localStorage.getItem(key(userId, 'sleepGap'));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<SleepGapSuggestion>;
    const bedtime = new Date(value.bedtime ?? '');
    const wakeTime = new Date(value.wakeTime ?? '');
    const age = Date.now() - wakeTime.getTime();
    if (!Number.isFinite(bedtime.getTime()) || !Number.isFinite(wakeTime.getTime()) ||
      age < -5 * 60_000 || age > 48 * 60 * 60_000 ||
      typeof value.durationHours !== 'number' || value.durationHours < 4 || value.durationHours > 16) {
      localStorage.removeItem(key(userId, 'sleepGap'));
      return null;
    }
    return { bedtime: bedtime.toISOString(), wakeTime: wakeTime.toISOString(), durationHours: value.durationHours };
  } catch {
    return null;
  }
}

export function dismissSleepGapSuggestion(userId: string): void {
  try { localStorage.removeItem(key(userId, 'sleepGap')); } catch { /* optional storage */ }
}

function overlapsNight(from: number, to: number): boolean {
  const start = new Date(from);
  const end = new Date(to);
  const nightStart = new Date(start);
  nightStart.setHours(21, 0, 0, 0);
  if (start.getHours() < 7) nightStart.setDate(nightStart.getDate() - 1);
  let cursor = new Date(nightStart);

  while (cursor.getTime() <= end.getTime()) {
    const nightEnd = new Date(cursor);
    nightEnd.setDate(nightEnd.getDate() + 1);
    nightEnd.setHours(7, 0, 0, 0);
    const overlap = Math.max(0, Math.min(to, nightEnd.getTime()) - Math.max(from, cursor.getTime()));
    if (overlap >= 4 * 60 * 60_000) return true;
    cursor = new Date(nightEnd);
    cursor.setHours(21, 0, 0, 0);
  }
  return false;
}
