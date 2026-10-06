// El chat en vivo del cliente: una sola petición larga por pestaña (ver la API,
// live.service). Dice en qué zona estás, qué carta tienes abierta y hasta dónde
// tienes cada cosa; la API responde en cuanto algo cambia (~1 s) y aquí se
// reparte: mensajes que llegan (avisos dentro de la app), la carta abierta, quién
// escribe en cada carta, el pulso social, la campana y los amigos que pasean por
// tu zona. También es el latido de presencia. Con la pestaña oculta se detiene.
import { create } from 'zustand';
import api, { API_BASE } from './api';
import { useAuthStore } from '@/store/authStore';
import { useSocialStore, type SocialPulse } from '@/store/socialStore';
import type {
  BackgroundMeta, DM, GuildMessage, GuildRead, InboxItem, Presence, StreakView, Typing, ZoneSection,
} from '@/services/network.service';

/** Lo que llega de la carta abierta. */
export interface LiveChatSection {
  key: string;
  error?: string;
  cursor?: string;
  messages?: Array<DM | GuildMessage>;
  changed?: Array<DM | GuildMessage>;
  typing?: Typing[];
  /** Carta con un amigo. */
  seenUntil?: string | null;
  friend?: Presence;
  streak?: StreakView & { mineToday?: boolean; theirsToday?: boolean };
  background?: BackgroundMeta | null;
  /** Carta de gremio. */
  reads?: GuildRead[];
}

/** Alguien escribiendo en alguna de tus cartas. */
export interface TypingIn { chat: string; userId: string; name?: string; until: string }

interface LiveResponse {
  seq: number;
  inbox?: { cursor: string; items: InboxItem[] };
  pulse?: SocialPulse;
  notifications?: number;
  typing?: TypingIn[];
  /** Cambia cuando alguien lee lo que escribiste. */
  seen?: string;
  chat?: LiveChatSection;
  zone?: ZoneSection;
}

/** Estado compartido que la interfaz lee (el resto se reparte por suscripción). */
export const useLive = create<{ typing: TypingIn[]; zone: ZoneSection | null; notifications: number | null; online: boolean; seen: string; letters: number }>(() => ({
  typing: [], zone: null, notifications: null, online: true, seen: '', letters: 0,
}));

/** ¿Está escribiendo alguien (que no seas tú) en esta carta? */
export function typingIn(list: TypingIn[], chat: string, now = Date.now()) {
  return list.filter((t) => t.chat === chat && new Date(t.until).getTime() > now);
}

interface ChatSub {
  key: string;
  /** Hasta dónde tiene la carta: último mensaje y desde cuándo pide cambios. */
  cursors: () => { after?: string; changes?: string };
  onSection: (s: LiveChatSection) => void;
}

const inboxListeners = new Set<(items: InboxItem[]) => void>();
const zoneListeners = new Set<(z: ZoneSection) => void>();

const state = {
  running: false,
  seq: null as number | null,
  inboxCursor: undefined as string | undefined,
  zone: null as string | null,
  zoneAt: 0,
  chat: null as ChatSub | null,
  /** La próxima petición no espera (cambió la carta o la zona). */
  urgent: false,
  ctl: null as AbortController | null,
};

const visible = () => document.visibilityState === 'visible';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function untilVisible() {
  return new Promise<void>((resolve) => {
    const check = () => { if (visible() || !state.running) { document.removeEventListener('visibilitychange', check); resolve(); } };
    document.addEventListener('visibilitychange', check);
    check();
  });
}

/** Corta la petición en curso para mandar enseguida otra con lo nuevo. */
function kick(urgent = true) {
  state.urgent ||= urgent;
  state.ctl?.abort();
}

function apply(r: LiveResponse) {
  state.seq = r.seq;
  if (r.inbox) {
    const first = state.inboxCursor === undefined;
    state.inboxCursor = r.inbox.cursor;
    if (!first && r.inbox.items.length) {
      inboxListeners.forEach((fn) => fn(r.inbox!.items));
      useLive.setState((st) => ({ letters: st.letters + 1 }));
    }
  }
  if (r.pulse) useSocialStore.setState({ pulse: r.pulse });
  const patch: Partial<ReturnType<typeof useLive.getState>> = { online: true };
  if (typeof r.notifications === 'number') patch.notifications = r.notifications;
  if (r.typing) patch.typing = r.typing;
  if (typeof r.seen === 'string') patch.seen = r.seen;
  if (r.zone) {
    state.zoneAt = Date.now();
    patch.zone = r.zone;
    zoneListeners.forEach((fn) => fn(r.zone!));
  }
  useLive.setState(patch);
  if (r.chat && state.chat && r.chat.key === state.chat.key) state.chat.onSection(r.chat);
}

async function loop() {
  let failures = 0;
  while (state.running) {
    if (!visible()) { await untilVisible(); kick(); continue; }
    const ctl = new AbortController();
    state.ctl = ctl;
    const urgent = state.urgent || state.seq === null;
    state.urgent = false;
    const cur = state.chat?.cursors() ?? {};
    const params: Record<string, string> = {};
    if (state.seq !== null) params.s = String(state.seq);
    if (state.zone) params.z = state.zone;
    if (state.zone && Date.now() - state.zoneAt > 20_000) params.zr = '1';
    if (state.chat) { params.c = state.chat.key; if (cur.after) params.ca = cur.after; if (cur.changes) params.cc = cur.changes; }
    if (state.inboxCursor) params.ib = state.inboxCursor;
    if (!urgent) params.w = '1';
    try {
      const { data } = await api.get<LiveResponse>('/social/live', { params, signal: ctl.signal, timeout: 20_000 });
      if (!state.running) return;
      apply(data);
      failures = 0;
    } catch {
      if (!state.running) return;
      if (ctl.signal.aborted) continue;
      failures += 1;
      useLive.setState({ online: false });
      await sleep(Math.min(15_000, 1200 * 2 ** Math.min(failures, 4)));
    }
  }
}

export const liveHub = {
  start() {
    if (state.running) return;
    state.running = true;
    state.seq = null;
    void loop();
  },
  stop() {
    state.running = false;
    state.ctl?.abort();
    state.seq = null;
    state.inboxCursor = undefined;
  },
  /** La zona en la que estás (latido de presencia y amigos que pasean por ella). */
  setZone(zone: string | null) {
    if (state.zone === zone) return;
    state.zone = zone;
    state.zoneAt = 0;
    useLive.setState({ zone: null });
    if (state.running) kick();
  },
  /** La carta abierta (una a la vez). */
  setChat(sub: ChatSub | null) {
    state.chat = sub;
    // Sin esperar: la API marca la carta como abierta y trae lo suyo.
    state.seq = null;
    if (state.running) kick();
  },
  /** Suelta la carta (solo si sigue siendo la abierta). */
  releaseChat(key: string) {
    if (state.chat?.key !== key) return;
    state.chat = null;
    if (state.running) kick(false);
  },
  /** Pide lo nuevo ya (tras enviar algo, por ejemplo). */
  refresh() { if (state.running) kick(); },
  onInbox(fn: (items: InboxItem[]) => void) { inboxListeners.add(fn); return () => { inboxListeners.delete(fn); }; },
  onZone(fn: (z: ZoneSection) => void) { zoneListeners.add(fn); return () => { zoneListeners.delete(fn); }; },
};

/**
 * Al cerrar la pestaña o la app: "ya no estoy" (fetch keepalive, que sí lleva el
 * token; sendBeacon no puede). Tus amigos dejan de verte en su zona al momento.
 */
export function sayGoodbye() {
  const token = useAuthStore.getState().accessToken;
  if (!token) return;
  try {
    void fetch(`${API_BASE}/social/presence`, {
      method: 'POST', keepalive: true, credentials: 'include',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ leaving: true }),
    }).catch(() => undefined);
  } catch { /* sin red: caduca sola */ }
}
