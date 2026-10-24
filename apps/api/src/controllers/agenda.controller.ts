import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import { calendarRedirectUri, signCalendarState, verifyCalendarState } from '../lib/oauth';
import * as svc from '../services/agenda.service';

export async function listEvents(req: AuthRequest, res: Response) {
  const events = await svc.listEvents(req.userId!, req.query as Record<string, string>);
  res.json({ events });
}

export async function upcomingEvents(req: AuthRequest, res: Response) {
  const events = await svc.getUpcoming(req.userId!);
  res.json({ events });
}

export async function getEvent(req: AuthRequest, res: Response) {
  const event = await svc.getEvent(req.userId!, req.params.id);
  if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
  return res.json({ event });
}

export async function createEvent(req: AuthRequest, res: Response) {
  const event = await svc.createEvent(req.userId!, req.body as Parameters<typeof svc.createEvent>[1]);
  res.status(201).json({ event });
}

export async function updateEvent(req: AuthRequest, res: Response) {
  try {
    const event = await svc.updateEvent(req.userId!, req.params.id, req.body as Record<string, unknown>);
    return res.json({ event });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al actualizar el evento';
    if (message === 'HABIT_EVENT_MANAGED_IN_HABITS') {
      return res.status(409).json({ error: 'Este evento pertenece a un hábito. Edítalo desde Hábitos.' });
    }
    if (message === 'AGENDA_EVENT_NOT_FOUND') return res.status(404).json({ error: 'Evento no encontrado' });
    return res.status(500).json({ error: message });
  }
}

export async function deleteEvent(req: AuthRequest, res: Response) {
  try {
    await svc.deleteEvent(req.userId!, req.params.id);
    return res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al eliminar el evento';
    if (message === 'HABIT_EVENT_MANAGED_IN_HABITS') {
      return res.status(409).json({ error: 'Este evento pertenece a un hábito. Adminístralo desde Hábitos.' });
    }
    if (message === 'AGENDA_EVENT_NOT_FOUND') return res.status(404).json({ error: 'Evento no encontrado' });
    return res.status(500).json({ error: message });
  }
}

// ─── Google Calendar Controllers ─────────────────────────────────────────────

export async function getGoogleCalendarStatus(req: AuthRequest, res: Response) {
  try {
    const status = await svc.getGoogleCalendarStatus(req.userId!);
    return res.json(status);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al consultar el estado de Google Calendar';
    return res.status(500).json({ error: msg });
  }
}

function requestOrigin(req: AuthRequest): string | undefined {
  if (req.headers.origin) return req.headers.origin;
  if (req.headers.referer) {
    try { return new URL(req.headers.referer).origin; } catch { /* ignore */ }
  }
  return undefined;
}

export async function getGoogleAuthUrl(req: AuthRequest, res: Response) {
  try {
    const redirectUri = calendarRedirectUri(req.query.redirectUri, requestOrigin(req));
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(400).json({
        error: 'GOOGLE_CLIENT_ID no configurado en Vercel. Por favor añade GOOGLE_CLIENT_ID en las variables de entorno.',
      });
    }
    const url = svc.getGoogleAuthUrl(redirectUri, signCalendarState(req.userId!), req.userEmail);
    return res.json({ url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al obtener URL de autenticación de Google';
    return res.status(500).json({ error: msg });
  }
}

export async function handleGoogleCallback(req: AuthRequest, res: Response) {
  try {
    const { code, redirectUri, state } = req.body as { code: string; redirectUri?: string; state?: string };
    if (!code) return res.status(400).json({ error: 'Código de autorización requerido.' });
    // La vuelta de Google tiene que ser la que esta misma persona pidió hace poco.
    if (!verifyCalendarState(state, req.userId!)) {
      return res.status(400).json({ error: 'El enlace de Google Calendar no es válido o expiró. Vuelve a conectar desde la Agenda.' });
    }

    // La misma URL con la que se pidió el permiso: si difiere, Google rechaza el canje.
    const result = await svc.handleGoogleCallback(req.userId!, code, calendarRedirectUri(redirectUri, requestOrigin(req)));
    return res.json({ success: true, user: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al vincular Google Calendar';
    return res.status(500).json({ error: msg });
  }
}

export async function syncGoogleCalendar(req: AuthRequest, res: Response) {
  try {
    const result = await svc.syncGoogleCalendar(req.userId!);
    return res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al sincronizar Google Calendar';
    return res.status(500).json({ error: msg });
  }
}

export async function disconnectGoogleCalendar(req: AuthRequest, res: Response) {
  try {
    const result = await svc.disconnectGoogleCalendar(req.userId!);
    return res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al desconectar Google Calendar';
    return res.status(500).json({ error: msg });
  }
}
