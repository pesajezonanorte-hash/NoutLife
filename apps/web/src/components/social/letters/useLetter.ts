// Datos de una carta, igual para la de dos amigos y la de un gremio: mensajes
// (con envío optimista y sondeo de lo nuevo), racha, "visto", el fondo
// compartido (la foto se pide aparte y se guarda en caché por versión) y las
// acciones de enviar texto, enviar una foto de la cámara y cambiar el fondo.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { refreshUser } from '@/hooks/useAuth';
import { useToastStore } from '@/hooks/useToast';
import { useAuthStore } from '@/store/authStore';
import { useSocialStore } from '@/store/socialStore';
import {
  apiError, getConversation, getDirectBackground, getGuild, getGuildBackground, getGuildMessagesAfter, postGuildSnap, postGuildText,
  reviveFriendStreak, sendMessage, setDirectBackground, setGuildBackground, STREAK_MIN,
  type BackgroundFit, type BackgroundMeta, type Conversation, type DM, type GuildDetail, type GuildMessage, type PublicUser, type StreakView,
} from '@/services/network.service';

export interface LetterAuthor { id: string; name: string; username?: string; avatarConfig?: unknown; avatarUrl?: string | null }

export interface LetterMsg {
  id: string;
  /** Id provisional con el que se creó en este dispositivo (se conserva al confirmarse). */
  localId?: string;
  mine: boolean;
  kind: string;
  content: string | null;
  photoUrl: string | null;
  createdAt: string;
  author: LetterAuthor | null;
  pending?: boolean;
  /** Llegó con la carta abierta: se escribe (texto) o se revela (foto). */
  fresh?: boolean;
  /** Foto en vuelo desde la cámara: aún no se muestra en su sitio. */
  hidden?: boolean;
}

export type LetterStreak = StreakView & { mineToday?: boolean; theirsToday?: boolean };

export interface LetterApi {
  status: 'loading' | 'error' | 'ready';
  messages: LetterMsg[];
  streak: LetterStreak | null;
  /** Hasta qué fecha (ms) leyó tus mensajes la otra persona (0 = nada o no lo comparte). */
  seenUntil: number;
  background: BackgroundMeta | null;
  /** La foto del fondo, cuando ya llegó. */
  backgroundPhoto: string | null;
  sendText: (text: string) => Promise<void>;
  sendPhoto: (photo: string, caption: string, localId: string, hidden: boolean) => Promise<void>;
  reveal: (localId: string) => void;
  saveBackground: (body: { photoUrl?: string | null; fit?: BackgroundFit }) => Promise<void>;
  revive?: () => Promise<void>;
  retry: () => void;
}

/** Fotos de fondo ya descargadas, por carta y versión. */
const bgCache = new Map<string, string>();

const POLL_DM = 4000;
const POLL_GUILD = 5000;
const visible = () => document.visibilityState === 'visible';
const toaster = () => useToastStore.getState();
/** Clave para reconocer el eco de un envío propio que aún está pendiente. */
const echoKey = (m: { kind: string; content: string | null; photoUrl: string | null }) => `${m.kind}|${m.content ?? ''}|${m.photoUrl?.length ?? 0}`;

/** Añade lo nuevo sin duplicar: ni lo ya conocido ni el eco de lo propio que se está enviando. */
function merge(prev: LetterMsg[], incoming: LetterMsg[]) {
  const known = new Set(prev.map((m) => m.id));
  const echoes = new Set(prev.filter((m) => m.pending).map(echoKey));
  const add = incoming.filter((m) => !known.has(m.id) && !(m.mine && echoes.has(echoKey(m))));
  return add.length ? [...prev, ...add] : prev;
}

/** Sustituye el mensaje provisional por el confirmado (o lo quita si el sondeo ya lo trajo). */
function confirm(prev: LetterMsg[], localId: string, real: LetterMsg) {
  if (prev.some((m) => m.id === real.id)) return prev.filter((m) => m.id !== localId);
  return prev.map((m) => (m.id === localId ? { ...real, localId, hidden: m.hidden } : m));
}

function useBackgroundPhoto(key: string, meta: BackgroundMeta | null, fetcher: () => Promise<{ photoUrl: string; at: string } | null>) {
  const [photo, setPhoto] = useState<string | null>(null);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;
  const at = meta?.at;
  useEffect(() => {
    if (!at) { setPhoto(null); return; }
    const cached = bgCache.get(`${key}@${at}`);
    if (cached) { setPhoto(cached); return; }
    let alive = true;
    fetchRef.current()
      .then((bg) => { if (!bg) return; bgCache.set(`${key}@${bg.at}`, bg.photoUrl); if (alive) setPhoto(bg.photoUrl); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [key, at]);
  return photo;
}

function useMe(): LetterAuthor {
  const me = useAuthStore((s) => s.user);
  return useMemo(() => ({ id: String(me?.id ?? ''), name: me?.displayName ?? 'Tú', username: me?.username, avatarConfig: me?.avatarConfig, avatarUrl: me?.avatarUrl }), [me]);
}

// ─── Carta entre dos amigos ───────────────────────────────────────────────────

export function useDirectLetter(friend: PublicUser, onActivity?: () => void): LetterApi & { conv: Conversation | null } {
  const me = useMe();
  const [conv, setConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<LetterMsg[]>([]);
  const [status, setStatus] = useState<LetterApi['status']>('loading');
  const lastAt = useRef<string | undefined>(undefined);
  const activity = useRef(onActivity);
  activity.current = onActivity;
  const first = friend.displayName.split(' ')[0];

  const them: LetterAuthor = useMemo(
    () => ({ id: friend.id, name: friend.displayName, username: friend.username, avatarConfig: friend.avatarConfig, avatarUrl: friend.avatarUrl }),
    [friend.id, friend.displayName, friend.username, friend.avatarConfig, friend.avatarUrl],
  );
  const toMsg = useCallback((m: DM, fresh = false): LetterMsg => ({
    id: m.id, mine: m.mine, kind: m.kind, content: m.content, photoUrl: m.photoUrl, createdAt: m.createdAt,
    author: m.mine ? me : them, fresh: fresh && !m.mine,
  }), [me, them]);

  const pull = useCallback(async (initial = false) => {
    try {
      const c = await getConversation(friend.id, initial ? undefined : lastAt.current);
      setConv(c);
      setStatus('ready');
      if (initial) {
        setMessages(c.messages.map((m) => toMsg(m)));
        void useSocialStore.getState().refresh();
      } else if (c.messages.length) {
        setMessages((prev) => merge(prev, c.messages.map((m) => toMsg(m, true))));
        if (c.messages.some((m) => !m.mine)) activity.current?.();
      }
      const newest = c.messages[c.messages.length - 1];
      if (newest) lastAt.current = newest.createdAt;
    } catch {
      if (initial) setStatus('error');
    }
  }, [friend.id, toMsg]);

  useEffect(() => {
    lastAt.current = undefined;
    setConv(null); setMessages([]); setStatus('loading');
    void pull(true);
    const id = window.setInterval(() => { if (visible()) void pull(); }, POLL_DM);
    return () => window.clearInterval(id);
  }, [pull]);

  const afterSend = useCallback((localId: string, r: Awaited<ReturnType<typeof sendMessage>>) => {
    setMessages((p) => confirm(p, localId, toMsg(r.message)));
    setConv((c) => (c ? { ...c, streak: { ...c.streak, ...r.streak } } : c));
    if (r.completed && r.streak.active && r.streak.count === STREAK_MIN) {
      toaster().success(`¡Se encendió su racha con ${first}!`, 'Tres días seguidos escribiéndose.');
    }
    activity.current?.();
  }, [first, toMsg]);

  const sendText = useCallback(async (text: string) => {
    const localId = `tmp-${Date.now()}`;
    setMessages((p) => [...p, { id: localId, localId, mine: true, kind: 'TEXT', content: text, photoUrl: null, createdAt: new Date().toISOString(), author: me, pending: true }]);
    try { afterSend(localId, await sendMessage(friend.id, { content: text })); }
    catch (e) { setMessages((p) => p.filter((m) => m.id !== localId)); throw new Error(apiError(e, 'No se pudo enviar')); }
  }, [afterSend, friend.id, me]);

  const sendPhoto = useCallback(async (photo: string, caption: string, localId: string, hidden: boolean) => {
    setMessages((p) => [...p, { id: localId, localId, mine: true, kind: 'SNAP', content: caption || null, photoUrl: photo, createdAt: new Date().toISOString(), author: me, pending: true, hidden }]);
    try { afterSend(localId, await sendMessage(friend.id, { kind: 'SNAP', photoUrl: photo, content: caption || undefined })); }
    catch (e) { setMessages((p) => p.filter((m) => m.id !== localId)); throw new Error(apiError(e, 'No se pudo enviar la foto')); }
  }, [afterSend, friend.id, me]);

  const reveal = useCallback((localId: string) => {
    setMessages((p) => p.map((m) => (m.localId === localId || m.id === localId ? { ...m, hidden: false } : m)));
  }, []);

  const backgroundPhoto = useBackgroundPhoto(`dm:${friend.id}`, conv?.background ?? null, () => getDirectBackground(friend.id));

  const saveBackground = useCallback(async (body: { photoUrl?: string | null; fit?: BackgroundFit }) => {
    try {
      const r = await setDirectBackground(friend.id, body);
      if (body.photoUrl && r.background) bgCache.set(`dm:${friend.id}@${r.background.at}`, body.photoUrl);
      if (body.photoUrl === undefined && r.background && backgroundPhoto) bgCache.set(`dm:${friend.id}@${r.background.at}`, backgroundPhoto);
      setConv((c) => (c ? { ...c, background: r.background } : c));
      void pull();
    } catch (e) { throw new Error(apiError(e, 'No se pudo guardar el fondo')); }
  }, [backgroundPhoto, friend.id, pull]);

  const revive = useCallback(async () => {
    if (!conv) return;
    try {
      const r = await reviveFriendStreak(conv.friendshipId);
      setConv((c) => (c ? { ...c, streak: { ...c.streak, ...r.streak } } : c));
      toaster().success('La racha volvió a encenderse', 'Escríbanse hoy para mantenerla.');
      void refreshUser();
      activity.current?.();
    } catch (e) { toaster().error(apiError(e, 'No se pudo revivir la racha')); }
  }, [conv]);

  return {
    conv, status, messages, streak: conv?.streak ?? null,
    seenUntil: conv?.seenUntil ? new Date(conv.seenUntil).getTime() : 0,
    background: conv?.background ?? null, backgroundPhoto,
    sendText, sendPhoto, reveal, saveBackground, revive,
    retry: () => { setStatus('loading'); void pull(true); },
  };
}

// ─── Carta de un gremio ───────────────────────────────────────────────────────

export function useGuildLetter(guildId: string, opts: { guild?: GuildDetail | null; reloadGuild?: () => void; onActivity?: () => void } = {}): LetterApi & { guild: GuildDetail | null } {
  const me = useMe();
  const controlled = opts.guild !== undefined;
  const [own, setOwn] = useState<GuildDetail | null>(null);
  const guild = controlled ? opts.guild ?? null : own;
  const [messages, setMessages] = useState<LetterMsg[]>([]);
  const [status, setStatus] = useState<LetterApi['status']>('loading');
  const lastAt = useRef<string | undefined>(undefined);
  const ext = useRef(opts);
  ext.current = opts;

  const loadGuild = useCallback(() => {
    if (ext.current.guild !== undefined) { ext.current.reloadGuild?.(); return; }
    getGuild(guildId).then(setOwn).catch(() => undefined);
  }, [guildId]);

  useEffect(() => {
    if (controlled) return;
    loadGuild();
    const id = window.setInterval(() => { if (visible()) loadGuild(); }, 30_000);
    return () => window.clearInterval(id);
  }, [controlled, loadGuild]);

  const toMsg = useCallback((m: GuildMessage, fresh = false): LetterMsg => {
    const mine = m.userId === me.id;
    return {
      id: m.id, mine, kind: m.kind, content: m.content || null, photoUrl: m.photoUrl ?? null, createdAt: m.createdAt,
      author: mine ? me : { id: m.userId, name: m.user.displayName, username: m.user.username, avatarConfig: m.user.avatarConfig, avatarUrl: m.user.avatarUrl },
      fresh: fresh && !mine,
    };
  }, [me]);

  const pull = useCallback(async (initial = false) => {
    try {
      const list = await getGuildMessagesAfter(guildId, initial ? undefined : lastAt.current);
      setStatus('ready');
      if (initial) {
        setMessages(list.map((m) => toMsg(m)));
        void useSocialStore.getState().refresh();
      } else if (list.length) {
        setMessages((prev) => merge(prev, list.map((m) => toMsg(m, true))));
        if (list.some((m) => m.kind === 'EVENT' || m.kind === 'SNAP')) loadGuild();
        if (list.some((m) => m.userId !== me.id)) ext.current.onActivity?.();
      }
      const newest = list[list.length - 1];
      if (newest) lastAt.current = newest.createdAt;
    } catch {
      if (initial) setStatus('error');
    }
  }, [guildId, loadGuild, me.id, toMsg]);

  useEffect(() => {
    lastAt.current = undefined;
    setMessages([]); setStatus('loading');
    void pull(true);
    const id = window.setInterval(() => { if (visible()) void pull(); }, POLL_GUILD);
    return () => window.clearInterval(id);
  }, [pull]);

  const afterSend = useCallback((localId: string, r: Awaited<ReturnType<typeof postGuildText>>) => {
    setMessages((p) => confirm(p, localId, toMsg(r)));
    const name = guild?.name ?? 'el gremio';
    if (r.enemyDefeated) toaster().success(`¡${guild?.today.enemy.name ?? 'El enemigo'} cayó!`, 'Todos enviaron una foto hoy.');
    else if (r.streakCompleted && r.streak.active && r.streak.count === STREAK_MIN) toaster().success(`¡Se encendió la racha de ${name}!`, 'Tres días seguidos escribiéndose todos.');
    if (r.enemyDefeated || r.streakCompleted || r.kind === 'SNAP') loadGuild();
    ext.current.onActivity?.();
  }, [guild?.name, guild?.today.enemy.name, loadGuild, toMsg]);

  const sendText = useCallback(async (text: string) => {
    const localId = `tmp-${Date.now()}`;
    setMessages((p) => [...p, { id: localId, localId, mine: true, kind: 'TEXT', content: text, photoUrl: null, createdAt: new Date().toISOString(), author: me, pending: true }]);
    try { afterSend(localId, await postGuildText(guildId, text)); }
    catch (e) { setMessages((p) => p.filter((m) => m.id !== localId)); throw new Error(apiError(e, 'No se pudo enviar')); }
  }, [afterSend, guildId, me]);

  const sendPhoto = useCallback(async (photo: string, caption: string, localId: string, hidden: boolean) => {
    setMessages((p) => [...p, { id: localId, localId, mine: true, kind: 'SNAP', content: caption || null, photoUrl: photo, createdAt: new Date().toISOString(), author: me, pending: true, hidden }]);
    try { afterSend(localId, await postGuildSnap(guildId, photo, caption)); }
    catch (e) { setMessages((p) => p.filter((m) => m.id !== localId)); throw new Error(apiError(e, 'No se pudo enviar la foto')); }
  }, [afterSend, guildId, me]);

  const reveal = useCallback((localId: string) => {
    setMessages((p) => p.map((m) => (m.localId === localId || m.id === localId ? { ...m, hidden: false } : m)));
  }, []);

  const backgroundPhoto = useBackgroundPhoto(`guild:${guildId}`, guild?.background ?? null, () => getGuildBackground(guildId));

  const saveBackground = useCallback(async (body: { photoUrl?: string | null; fit?: BackgroundFit }) => {
    try {
      const r = await setGuildBackground(guildId, body);
      if (body.photoUrl && r.background) bgCache.set(`guild:${guildId}@${r.background.at}`, body.photoUrl);
      if (body.photoUrl === undefined && r.background && backgroundPhoto) bgCache.set(`guild:${guildId}@${r.background.at}`, backgroundPhoto);
      if (!controlled) setOwn((g) => (g ? { ...g, background: r.background } : g));
      loadGuild();
      void pull();
    } catch (e) { throw new Error(apiError(e, 'No se pudo guardar el fondo')); }
  }, [backgroundPhoto, controlled, guildId, loadGuild, pull]);

  return {
    guild, status, messages, streak: guild?.streak ?? null, seenUntil: 0,
    background: guild?.background ?? null, backgroundPhoto,
    sendText, sendPhoto, reveal, saveBackground,
    retry: () => { setStatus('loading'); void pull(true); },
  };
}
