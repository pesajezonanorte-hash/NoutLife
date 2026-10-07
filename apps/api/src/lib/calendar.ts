/**
 * Noutlife stores calendar fields as stable UTC date keys (YYYY-MM-DD), while
 * interpreting those keys in the player's local calendar. Colombia is the
 * product default for records without a saved timezone; never fall back to the
 * server/Vercel timezone, which is usually UTC.
 */
export const DEFAULT_TIMEZONE = 'America/Bogota';

function calendarParts(timezone: string, now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

/**
 * Creates a stable UTC date key for a user's local calendar day. Database
 * calendar fields such as HabitLog.date use this YYYY-MM-DD representation,
 * rather than the actual instant of local midnight.
 */
export function getCalendarDay(timezone: string | null | undefined = DEFAULT_TIMEZONE, now = new Date()): Date {
  const requestedTimezone = timezone || DEFAULT_TIMEZONE;

  try {
    const { year, month, day } = calendarParts(requestedTimezone, now);
    return new Date(Date.UTC(year, month - 1, day));
  } catch {
    // Legacy profiles can contain malformed IANA timezone values. Keep their
    // calendar deterministic in the product timezone instead of inheriting the
    // API host's clock.
    const { year, month, day } = calendarParts(DEFAULT_TIMEZONE, now);
    return new Date(Date.UTC(year, month - 1, day));
  }
}

/** Parses a strict YYYY-MM-DD calendar key without Date's rollover behaviour. */
export function parseCalendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export function isValidCalendarDate(value: string): boolean {
  return parseCalendarDate(value) !== null;
}

/** Adds whole calendar days to one of the UTC date keys above. */
export function addCalendarDays(date: Date, days: number): Date {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value;
}
