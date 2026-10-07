import { prisma } from '../lib/prisma';
import { addCalendarDays, getCalendarDay } from '../lib/calendar';
import type { Habit } from '@prisma/client';

export async function listEvents(
  userId: string,
  opts: { from?: string; to?: string; date?: string },
) {
  let where: Record<string, unknown> = { userId };

  if (opts.date) {
    const d = new Date(opts.date);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    where = { ...where, startDate: { gte: start, lt: end } };
  } else if (opts.from || opts.to) {
    const dateFilter: Record<string, Date> = {};
    if (opts.from) dateFilter.gte = new Date(opts.from);
    if (opts.to) dateFilter.lte = new Date(opts.to);
    where = { ...where, startDate: dateFilter };
  }

  return prisma.agendaEvent.findMany({
    where,
    orderBy: { startDate: 'asc' },
  });
}

export async function getUpcoming(userId: string, limit = 5) {
  // Habits already have their own streak/completion block on the dashboard.
  // Agenda remains the source to view them, but they do not become generic events.
  return prisma.agendaEvent.findMany({
    where: {
      userId,
      startDate: { gte: new Date() },
      isCompleted: false,
      eventType: { not: 'habit' },
    },
    orderBy: { startDate: 'asc' },
    take: limit,
  });
}

export async function getEvent(userId: string, id: string) {
  return prisma.agendaEvent.findFirst({ where: { id, userId } });
}

export async function createEvent(
  userId: string,
  body: {
    title: string;
    description?: string;
    category?: string;
    startDate: string;
    endDate?: string;
    isAllDay?: boolean;
    location?: string;
    reminder?: number;
    color?: string;
  },
) {
  return prisma.agendaEvent.create({
    data: {
      userId,
      title: body.title,
      description: body.description,
      category: body.category ?? 'personal',
      startDate: new Date(body.startDate),
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      isAllDay: body.isAllDay ?? false,
      location: body.location,
      reminder: body.reminder,
      color: body.color,
    },
  });
}

async function assertEditableAgendaEvent(userId: string, id: string) {
  const event = await prisma.agendaEvent.findFirst({
    where: { id, userId },
    select: { id: true, eventType: true },
  });

  if (!event) throw new Error('AGENDA_EVENT_NOT_FOUND');
  if (event.eventType === 'habit') {
    throw new Error('HABIT_EVENT_MANAGED_IN_HABITS');
  }
}

export async function updateEvent(
  userId: string,
  id: string,
  body: Record<string, unknown>,
) {
  await assertEditableAgendaEvent(userId, id);

  const data: Record<string, unknown> = {};
  const fields = ['title', 'description', 'category', 'location', 'reminder', 'color', 'isAllDay', 'isCompleted'] as const;
  for (const field of fields) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  if (body.startDate) data.startDate = new Date(body.startDate as string);
  if (body.endDate) data.endDate = new Date(body.endDate as string);

  return prisma.agendaEvent.update({ where: { id, userId }, data });
}

export async function deleteEvent(userId: string, id: string) {
  await assertEditableAgendaEvent(userId, id);
  return prisma.agendaEvent.delete({ where: { id, userId } });
}

// ─── Google Calendar Integration ─────────────────────────────────────────────

interface GoogleCalendarConnection {
  accessToken: string;
  calendarId: string;
  timezone: string;
}

interface GoogleCalendarItem {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  recurringEventId?: string;
  recurrence?: string[];
  extendedProperties?: {
    private?: Record<string, string | undefined>;
  };
}

interface GoogleCalendarEventsResponse {
  items?: GoogleCalendarItem[];
}

const GOOGLE_CALENDAR_SCOPE = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

const GOOGLE_WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

function calendarApiUrl(calendarId: string, suffix = ''): string {
  return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}${suffix}`;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function habitCategoryToAgendaCategory(category: Habit['category']): string {
  switch (category) {
    case 'HEALTH':
    case 'FITNESS':
      return 'health';
    case 'FINANCE':
      return 'finance';
    case 'LOVE':
      return 'romantic';
    case 'SOCIAL':
      return 'social';
    case 'LEARNING':
      return 'tarea';
    default:
      return 'personal';
  }
}

function habitRecurrenceRule(frequency: Habit['frequency']): string[] {
  const value = frequency as { type?: string; days?: unknown } | null;
  if (value?.type === 'days_per_week' && Array.isArray(value.days) && value.days.length > 0) {
    const days = [...new Set(value.days)]
      .filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6)
      .sort((a, b) => a - b)
      .map((day) => GOOGLE_WEEKDAYS[day]);

    if (days.length > 0) return [`RRULE:FREQ=WEEKLY;BYDAY=${days.join(',')}`];
  }

  return ['RRULE:FREQ=DAILY'];
}

function habitGoogleEventBody(habit: Habit, timezone: string) {
  const startDay = getCalendarDay(timezone);
  const startDate = dateKey(startDay);
  const recurrence = habitRecurrenceRule(habit.frequency);
  const description = [habit.description?.trim(), 'Hábito creado y administrado desde Noutlife.']
    .filter(Boolean)
    .join('\n\n');

  const base = {
    summary: habit.title,
    description,
    recurrence,
    extendedProperties: {
      private: {
        lifequestSource: 'habit',
        lifequestHabitId: habit.id,
        lifequestHabitCategory: habit.category,
      },
    },
  };

  if (!habit.reminderTime) {
    return {
      ...base,
      start: { date: startDate },
      end: { date: dateKey(addCalendarDays(startDay, 1)) },
    };
  }

  const match = habit.reminderTime.match(/^(\d{2}):(\d{2})$/);
  const hour = match ? Number(match[1]) : 9;
  const minute = match ? Number(match[2]) : 0;
  const endMinutes = hour * 60 + minute + 30;
  const endDay = endMinutes >= 24 * 60 ? addCalendarDays(startDay, 1) : startDay;
  const endHour = Math.floor((endMinutes % (24 * 60)) / 60);
  const endMinute = endMinutes % 60;
  const pad = (value: number) => String(value).padStart(2, '0');

  return {
    ...base,
    start: { dateTime: `${startDate}T${pad(hour)}:${pad(minute)}:00`, timeZone: timezone },
    end: { dateTime: `${dateKey(endDay)}T${pad(endHour)}:${pad(endMinute)}:00`, timeZone: timezone },
    reminders: {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: 0 }],
    },
  };
}

async function getGoogleCalendarConnection(userId: string): Promise<GoogleCalendarConnection | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleAccessToken: true,
      googleRefreshToken: true,
      googleTokenExpiresAt: true,
      googleCalendarId: true,
      googleCalendarSyncEnabled: true,
      timezone: true,
    },
  });

  if (!user || !user.googleCalendarSyncEnabled) return null;

  let accessToken = user.googleAccessToken;
  if (!accessToken || (user.googleTokenExpiresAt && user.googleTokenExpiresAt <= new Date())) {
    if (!user.googleRefreshToken) {
      throw new Error('Sesión de Google expirada. Por favor vuelve a conectar Google Calendar.');
    }
    accessToken = await refreshGoogleToken(userId, user.googleRefreshToken);
  }

  return {
    accessToken,
    calendarId: user.googleCalendarId || 'primary',
    timezone: user.timezone || 'America/Bogota',
  };
}

async function googleError(response: Response, context: string): Promise<never> {
  const text = await response.text();
  throw new Error(`${context}: ${text}`);
}

async function upsertHabitGoogleCalendarEvent(
  userId: string,
  habit: Habit,
  connection: GoogleCalendarConnection,
): Promise<string> {
  const body = JSON.stringify(habitGoogleEventBody(habit, connection.timezone));
  const headers = {
    Authorization: `Bearer ${connection.accessToken}`,
    'Content-Type': 'application/json',
  };

  let response: Response | null = null;
  if (habit.googleCalendarEventId) {
    response = await fetch(
      calendarApiUrl(connection.calendarId, `/events/${encodeURIComponent(habit.googleCalendarEventId)}`),
      { method: 'PATCH', headers, body },
    );

    // A deleted Google event should be rebuilt transparently on the next save.
    if (!response.ok && response.status !== 404) {
      await googleError(response, 'No se pudo actualizar el hábito en Google Calendar');
    }
  }

  if (!response || response.status === 404) {
    response = await fetch(calendarApiUrl(connection.calendarId, '/events'), {
      method: 'POST',
      headers,
      body,
    });
    if (!response.ok) await googleError(response, 'No se pudo crear el hábito en Google Calendar');
  }

  const remoteEvent = (await response.json()) as { id?: string };
  if (!remoteEvent.id) throw new Error('Google Calendar no devolvió un identificador para el hábito.');

  await prisma.habit.update({
    where: { id: habit.id },
    data: {
      syncToGoogleCalendar: true,
      googleCalendarEventId: remoteEvent.id,
    },
  });

  return remoteEvent.id;
}

async function importGoogleCalendarEvents(
  userId: string,
  connection: GoogleCalendarConnection,
): Promise<number> {
  // Include the current calendar day too, so an all-day habit created now is
  // immediately visible in Noutlife instead of waiting for tomorrow's sync.
  const now = new Date();
  const timeMin = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '2500',
  });

  const response = await fetch(
    `${calendarApiUrl(connection.calendarId, '/events')}?${params.toString()}`,
    { headers: { Authorization: `Bearer ${connection.accessToken}` } },
  );
  if (!response.ok) await googleError(response, 'Error al consultar Google Calendar');

  const data = (await response.json()) as GoogleCalendarEventsResponse;
  const items = data.items ?? [];
  // Expanded Google recurrence instances normally inherit private properties,
  // but the series ID is also persisted as a fallback dedupe/ownership key.
  const managedHabits = await prisma.habit.findMany({
    where: {
      userId,
      isActive: true,
      syncToGoogleCalendar: true,
      googleCalendarEventId: { not: null },
    },
    select: { googleCalendarEventId: true, category: true },
  });
  const managedHabitsBySeriesId = new Map(
    managedHabits
      .filter((habit): habit is typeof habit & { googleCalendarEventId: string } => Boolean(habit.googleCalendarEventId))
      .map((habit) => [habit.googleCalendarEventId, habit]),
  );
  let syncedCount = 0;

  for (const item of items) {
    if (!item.summary) continue;

    const startStr = item.start?.dateTime || item.start?.date;
    const endStr = item.end?.dateTime || item.end?.date;
    if (!startStr) continue;

    const startDate = new Date(startStr);
    const endDate = endStr ? new Date(endStr) : new Date(startDate.getTime() + 60 * 60 * 1000);
    const isAllDay = Boolean(item.start?.date && !item.start?.dateTime);
    const privateProperties = item.extendedProperties?.private;
    const seriesId = item.recurringEventId ?? item.id;
    const linkedHabit = managedHabitsBySeriesId.get(seriesId);
    const isNoutlifeHabit = (
      privateProperties?.lifequestSource === 'habit' && Boolean(privateProperties.lifequestHabitId)
    ) || Boolean(linkedHabit);
    const habitCategory = privateProperties?.lifequestHabitCategory ?? linkedHabit?.category;
    const agendaCategory = habitCategory
      ? habitCategoryToAgendaCategory(habitCategory as Habit['category'])
      : 'personal';
    const lifecycleData = isNoutlifeHabit
      ? {
          category: agendaCategory,
          eventType: 'habit',
          googleSeriesId: seriesId,
          isRecurring: true,
          recurrenceRule: item.recurrence?.[0] ?? null,
        }
      : {};

    await prisma.agendaEvent.upsert({
      where: { googleEventId: item.id },
      create: {
        userId,
        title: item.summary,
        description: item.description ?? null,
        location: item.location ?? null,
        startDate,
        endDate,
        isAllDay,
        category: isNoutlifeHabit ? agendaCategory : 'work',
        eventType: isNoutlifeHabit ? 'habit' : 'personal',
        googleEventId: item.id,
        googleSeriesId: isNoutlifeHabit ? seriesId : null,
        isRecurring: isNoutlifeHabit,
        recurrenceRule: isNoutlifeHabit ? item.recurrence?.[0] ?? null : null,
      },
      update: {
        title: item.summary,
        description: item.description ?? null,
        location: item.location ?? null,
        startDate,
        endDate,
        isAllDay,
        ...lifecycleData,
      },
    });

    syncedCount += 1;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { googleCalendarLastSyncAt: new Date() },
  });

  return syncedCount;
}

/**
 * Creates or updates a recurring Google event for one opt-in habit, then
 * imports the same Google instances into Agenda. We deliberately do not create
 * a second local recurring master: Google instance IDs are the dedupe key.
 */
export async function syncHabitWithGoogleCalendar(userId: string, habit: Habit) {
  const connection = await getGoogleCalendarConnection(userId);
  if (!connection) {
    return { synced: false, message: 'Google Calendar no está conectado.' };
  }

  const oldSeriesId = habit.googleCalendarEventId;
  const googleEventId = await upsertHabitGoogleCalendarEvent(userId, habit, connection);

  // Remove stale local occurrences before importing the updated series.
  await prisma.agendaEvent.deleteMany({
    where: {
      userId,
      googleSeriesId: { in: [googleEventId, ...(oldSeriesId && oldSeriesId !== googleEventId ? [oldSeriesId] : [])] },
    },
  });

  const syncedCount = await importGoogleCalendarEvents(userId, connection);
  return { synced: true, googleEventId, syncedCount };
}

/** Remove the remote recurring series and its imported Noutlife Agenda rows. */
export async function removeHabitFromGoogleCalendar(userId: string, habit: Habit) {
  const googleEventId = habit.googleCalendarEventId;
  if (!googleEventId) return { removed: true };

  await prisma.agendaEvent.deleteMany({ where: { userId, googleSeriesId: googleEventId } });

  const connection = await getGoogleCalendarConnection(userId);
  if (!connection) {
    return { removed: false, message: 'Google Calendar no está conectado; el evento remoto se conserva hasta volver a vincularlo.' };
  }

  const response = await fetch(
    calendarApiUrl(connection.calendarId, `/events/${encodeURIComponent(googleEventId)}`),
    { method: 'DELETE', headers: { Authorization: `Bearer ${connection.accessToken}` } },
  );

  if (!response.ok && response.status !== 404) {
    await googleError(response, 'No se pudo eliminar el hábito de Google Calendar');
  }

  return { removed: true };
}

export function getGoogleAuthUrl(redirectUri: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(GOOGLE_CALENDAR_SCOPE)}&access_type=offline&prompt=consent`;
}

export async function getGoogleCalendarStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleAccessToken: true,
      googleRefreshToken: true,
      googleCalendarId: true,
      googleCalendarSyncEnabled: true,
      googleCalendarLastSyncAt: true,
    },
  });

  const connected = Boolean(
    user?.googleCalendarSyncEnabled && (user.googleAccessToken || user.googleRefreshToken),
  );

  return {
    connected,
    calendarId: user?.googleCalendarId || 'primary',
    lastSyncAt: user?.googleCalendarLastSyncAt?.toISOString() ?? null,
  };
}

export async function handleGoogleCallback(userId: string, code: string, redirectUri: string) {
  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();

  if (!clientId || !clientSecret) {
    throw new Error('Las credenciales de Google OAuth (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) no están configuradas en el servidor.');
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.text();
    console.error('[GOOGLE_OAUTH_TOKEN_ERROR]', errorData);
    if (errorData.includes('invalid_grant')) {
      throw new Error('El código de autorización ya fue usado o expiró. Intenta conectar tu cuenta de Google nuevamente.');
    }
    throw new Error(`Error de autenticación con Google: ${errorData}`);
  }

  const tokens = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      googleAccessToken: tokens.access_token,
      ...(tokens.refresh_token ? { googleRefreshToken: tokens.refresh_token } : {}),
      googleTokenExpiresAt: expiresAt,
      googleCalendarSyncEnabled: true,
      googleCalendarLastSyncAt: new Date(),
    },
    select: {
      id: true,
      googleCalendarSyncEnabled: true,
      googleCalendarLastSyncAt: true,
    },
  });

  // Also exports any habits that were opted in before the account was linked.
  await syncGoogleCalendar(userId).catch((error) => {
    console.error('[GOOGLE_CALENDAR_INITIAL_SYNC_ERROR]', error);
  });

  return updatedUser;
}

export async function refreshGoogleToken(userId: string, refreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) throw new Error('No se pudo refrescar el token de Google.');

  const data = (await response.json()) as { access_token: string; expires_in: number };
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: {
      googleAccessToken: data.access_token,
      googleTokenExpiresAt: expiresAt,
    },
  });

  return data.access_token;
}

export async function syncGoogleCalendar(userId: string) {
  const connection = await getGoogleCalendarConnection(userId);
  if (!connection) {
    return { syncedCount: 0, exportedHabitCount: 0, message: 'Google Calendar no está conectado.' };
  }

  // If a save previously happened while Google was temporarily unavailable,
  // retry the opted-in habits when the user explicitly synchronizes Agenda.
  const pendingHabits = await prisma.habit.findMany({
    where: {
      userId,
      isActive: true,
      syncToGoogleCalendar: true,
      googleCalendarEventId: null,
    },
  });

  const removedDetachedHabitCount = await cleanDetachedHabitCalendarEvents(userId, connection);

  let exportedHabitCount = 0;
  for (const habit of pendingHabits) {
    try {
      await upsertHabitGoogleCalendarEvent(userId, habit, connection);
      exportedHabitCount += 1;
    } catch (error) {
      console.error('[GOOGLE_CALENDAR_HABIT_EXPORT_ERROR]', habit.id, error);
    }
  }

  const syncedCount = await importGoogleCalendarEvents(userId, connection);
  const exportSuffix = exportedHabitCount === 1
    ? ' Se añadió 1 hábito recurrente.'
    : exportedHabitCount > 1
      ? ` Se añadieron ${exportedHabitCount} hábitos recurrentes.`
      : '';
  const cleanupSuffix = removedDetachedHabitCount > 0
    ? ` Se retiraron ${removedDetachedHabitCount} hábitos desvinculados.`
    : '';

  return {
    syncedCount,
    exportedHabitCount,
    message: `Sincronizados ${syncedCount} eventos de Google Calendar.${exportSuffix}${cleanupSuffix}`,
  };
}

async function cleanDetachedHabitCalendarEvents(userId: string, connection: GoogleCalendarConnection): Promise<number> {
  const detachedHabits = await prisma.habit.findMany({
    where: {
      userId,
      googleCalendarEventId: { not: null },
      OR: [
        { isActive: false },
        { syncToGoogleCalendar: false },
      ],
    },
  });

  let removedCount = 0;
  for (const habit of detachedHabits) {
    if (!habit.googleCalendarEventId) continue;

    await prisma.agendaEvent.deleteMany({
      where: { userId, googleSeriesId: habit.googleCalendarEventId },
    });

    try {
      const response = await fetch(
        calendarApiUrl(connection.calendarId, `/events/${encodeURIComponent(habit.googleCalendarEventId)}`),
        { method: 'DELETE', headers: { Authorization: `Bearer ${connection.accessToken}` } },
      );
      if (!response.ok && response.status !== 404) {
        console.error('[GOOGLE_CALENDAR_DETACHED_HABIT_REMOVE_ERROR]', habit.id, await response.text());
        continue;
      }

      await prisma.habit.update({
        where: { id: habit.id },
        data: { syncToGoogleCalendar: false, googleCalendarEventId: null },
      });
      removedCount += 1;
    } catch (error) {
      console.error('[GOOGLE_CALENDAR_DETACHED_HABIT_REMOVE_ERROR]', habit.id, error);
    }
  }

  return removedCount;
}

export async function disconnectGoogleCalendar(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      googleAccessToken: null,
      googleRefreshToken: null,
      googleTokenExpiresAt: null,
      googleCalendarSyncEnabled: false,
      googleCalendarLastSyncAt: null,
    },
  });

  return { success: true };
}
