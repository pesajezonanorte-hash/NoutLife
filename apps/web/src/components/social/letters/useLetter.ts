// Datos de una carta, igual para la de dos amigos y la de un gremio: mensajes
// (con envío optimista), reacciones y respuestas, racha, "visto", el fondo
// compartido (la foto se pide aparte y se guarda en caché por versión) y las
// acciones de enviar texto, enviar una foto de la cámara y cambiar el fondo.
//
// En vivo: la carta abierta mantiene una petición larga con la API, que responde
// en cuanto llega un mensaje, alguien reacciona o leen lo tuyo (~1 s), y se
// vuelve a pedir enseguida. Las cartas ya abiertas se guardan en caché: al volver
// a una se pinta al instante y se refresca por debajo, sin parpadeo.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { refreshUser } from '@/hooks/useAuth';
import { useToastStore } from '@/hooks/useToast';
import { useAuthStore } from '@/store/authStore';
import { useSocialStore } from '@/store/socialStore';
import {
  apiError, getConversation, getDirectBackground, getGuild, getGuildBackground, getGuildMessagesAfter, leaveLetterView, liveConversation, liveGuild,
  postGuildSnap, postGuildText, reactDirect, reactGuild, reviveFriendStreak, sendMessage, setDirectBackground, setGuildBackground, STREAK_MIN,
  type BackgroundFit, type BackgroundMeta, type Conversation, type DM, type GuildDetail, type GuildMessage, type PublicUser, type ReactionCount,
  type ReplyRef, type StreakView,
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
  replyTo?: ReplyRef | null;
  reactions: ReactionCount[];
  pending?: boolean;
  /** Llegó con la carta abierta: se escribe (texto) o se revela (foto). */
  fresh?: boolean;
  /** Foto en vuelo desde la cámara: aún no se muestra en su sitio. */
  hidden?: boolean;
}

export type LetterStreak = StreakView & { mineToday?: boolean; theirsToday?: boolean };

export interface LetterApi {
  status: 'loading' | 'error' | 'ready';
  /** Quién soy en esta carta (para saber qué mensajes son míos). */
  meId: string;
  /** Clave de la carta ("dm:<amigo>" | "guild:<gremio>"): los avisos de lo que llega a ella no se muestran. */
  viewKey: string;
  messages: LetterMsg[];
  streak: LetterStreak | null;
  /** Hasta qué fecha (ms) leyó tus mensajes la otra persona (0 = nada o no lo comparte). */
  seenUntil: number;
  background: BackgroundMeta | null;
  /** La foto del fondo, cuando ya llegó. */
  backgroundPhoto: string | null;
  sendText: (text: string, reply?: LetterMsg | null) => Promise<void>;
  sendPhoto: (photo: string, caption: string, localId: string, hidden: boolean) => Promise<void>;
  /** Pone, cambia o quita (con la misma) tu reacción a un mensaje. */
  react: (messageId: string, emoji: string) => Promise<void>;
  reveal: (localId: string) => void;
  saveBackground: (body: { photoUrl?: string | null; fit?: BackgroundFit }) => Promise<void>;
  revive?: () => Promise<void>;
  retry: () => void;
}

/** Fotos de fondo ya descargadas, por carta y versión. */
const bgCache = new Map<string, string>();
/** Cartas ya abiertas: mensajes y datos, para pintarlas al instante al volver. */
const letterCache = new Map<string, { conv?: Conversation; guild?: GuildDetail | null; messages: LetterMsg[]; cursor?: string; seen?: string; lastAt?: string }>();

const visible = () => document.visibilityState === 'visible';
const toaster = () => useToastStore.getState();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Con la pestaña oculta el sondeo se detiene; esto espera a que vuelva (o a que la carta se cierre). */
function untilVisible(signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const done = () => { document.removeEventListener('visibilitychange', check); signal.removeEventListener('abort', done); resolve(); };
    const check = () => { if (visible()) done(); };
    document.addEventListener('visibilitychange', check);
    signal.addEventListener('abort', done);
  });
}
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

/** Aplica las reacciones que cambiaron (por id de mensaje). */
function withReactions(prev: LetterMsg[], reacted: Array<{ id: string; reactions: ReactionCount[] }>) {
  if (!reacted.length) return prev;
  const by = new Map(reacted.map((r) => [r.id, r.reactions]));
  return prev.map((m) => (by.has(m.id) ? { ...m, reactions: by.get(m.id)! } : m));
}

/** Tu reacción puesta de golpe, sin esperar a la API (se corrige con su respuesta). */
function toggleMine(list: ReactionCount[], emoji: string): ReactionCount[] {
  const mine = list.find((r) => r.mine);
  let next = list
    .map((r) => (r.mine ? { ...r, count: r.count - 1, mine: false } : r))
    .filter((r) => r.count > 0);
  if (mine?.emoji === emoji) return next;
  const found = next.find((r) => r.emoji === emoji);
  next = found ? next.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r)) : [...next, { emoji, count: 1, mine: true }];
  return next;
}

/** ¿Es la misma lista? (para no repintar la carta al refrescar lo que ya se ve) */
const sameList = (a: LetterMsg[], b: LetterMsg[]) =>
  a.length === b.length && a.every((m, i) => m.id === b[i].id && JSON.stringify(m.reactions) === JSON.stringify(b[i].reactions));

const replyRefOf = (m?: LetterMsg | null): ReplyRef | null => (m ? { id: m.id, authorId: m.author?.id ?? '', kind: m.kind, content: m.content } : null);

function useBackgroundPhoto(key: string, meta: BackgroundMeta | null, fetcher: () => Promise<{ photoUrl: string; at: string } | null>) {
  const at = meta?.at;
  const [photo, setPhoto] = useState<string | null>(() => (at ? bgCache.get(`${key}@${at}`) ?? null : null));
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;
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
  const viewKey = `dm:${friend.id}`;
  const cached = letterCache.get(viewKey);
  const [conv, setConv] = useState<Conversation | null>(cached?.conv ?? null);
  const [messages, setMessages] = useState<LetterMsg[]>(cached?.messages ?? []);
  const [status, setStatus] = useState<LetterApi['status']>(cached ? 'ready' : 'loading');
  const [attempt, setAttempt] = useState(0);
  const lastAt = useRef<string | undefined>(cached?.lastAt);
  const cursor = useRef<string | undefined>(cached?.cursor);
  const seen = useRef<string | undefined>(cached?.seen);
  const activity = useRef(onActivity);
  activity.current = onActivity;
  const first = friend.displayName.split(' ')[0];

  const them: LetterAuthor = useMemo(
    () => ({ id: friend.id, name: friend.displayName, username: friend.username, avatarConfig: friend.avatarConfig, avatarUrl: friend.avatarUrl }),
    [friend.id, friend.displayName, friend.username, friend.avatarConfig, friend.avatarUrl],
  );
  const toMsg = useCallback((m: DM, fresh = false): LetterMsg => ({
    id: m.id, mine: m.mine, kind: m.kind, content: m.content, photoUrl: m.photoUrl, createdAt: m.createdAt,
    author: m.mine ? me : them, fresh: fresh && !m.mine, replyTo: m.replyTo ?? null, reactions: m.reactions ?? [],
  }), [me, them]);
  const toMsgRef = useRef(toMsg);
  toMsgRef.current = toMsg;

  // Guarda lo que se ve para pintarlo al instante la próxima vez.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const convRef = useRef(conv);
  convRef.current = conv;
  useEffect(() => {
    return () => {
      letterCache.set(viewKey, {
        conv: convRef.current ?? undefined, messages: messagesRef.current.filter((m) => !m.pending).map((m) => ({ ...m, fresh: false })),
        cursor: cursor.current, seen: seen.current, lastAt: lastAt.current,
      });
    };
  }, [viewKey]);

  useEffect(() => {
    let alive = true;
    const ctl = new AbortController();
    const markNewest = (list: DM[]) => { const n = list[list.length - 1]; if (n) lastAt.current = n.createdAt; };

    const run = async () => {
      // 1) La carta entera (si ya estaba en caché, se refresca por debajo).
      try {
        const c = await getConversation(friend.id);
        if (!alive) return;
        setConv(c); setStatus('ready');
        const next = c.messages.map((m) => toMsgRef.current(m));
        setMessages((prev) => {
          const pending = prev.filter((m) => m.pending);
          if (!pending.length && sameList(prev, next)) return prev;
          return [...next, ...pending.filter((p) => !next.some((n) => n.id === p.id))];
        });
        cursor.current = c.cursor;
        seen.current = c.seenUntil ?? undefined;
        markNewest(c.messages);
        lastAt.current ??= c.cursor;
        void useSocialStore.getState().refresh();
      } catch {
        if (!alive) return;
        if (!letterCache.has(viewKey)) setStatus('error');
        return;
      }
      // 2) En vivo: la petición larga vuelve cuando hay algo nuevo.
      while (alive) {
        if (!visible()) { await untilVisible(ctl.signal); continue; }
        try {
          const r = await liveConversation(friend.id, { after: lastAt.current, since: cursor.current, seen: seen.current }, ctl.signal);
          if (!alive) return;
          cursor.current = r.cursor;
          if (!r.changed) continue;
          const { messages: incoming, reacted, changed: _c, cursor: _k, ...rest } = r;
          seen.current = r.seenUntil ?? undefined;
          setConv((c) => ({ ...(c ?? r), ...rest }));
          setMessages((prev) => withReactions(incoming.length ? merge(prev, incoming.map((m) => toMsgRef.current(m, true))) : prev, reacted));
          markNewest(incoming);
          if (incoming.some((m) => !m.mine)) activity.current?.();
        } catch {
          if (!alive || ctl.signal.aborted) return;
          await sleep(3000);
        }
      }
    };
    void run();
    return () => { alive = false; ctl.abort(); void leaveLetterView(viewKey); };
  }, [friend.id, viewKey, attempt]);

  const afterSend = useCallback((localId: string, r: Awaited<ReturnType<typeof sendMessage>>) => {
    setMessages((p) => confirm(p, localId, toMsg(r.message)));
    lastAt.current = r.message.createdAt > (lastAt.current ?? '') ? r.message.createdAt : lastAt.current;
    setConv((c) => (c ? { ...c, streak: { ...c.streak, ...r.streak } } : c));
    if (r.completed && r.streak.active && r.streak.count === STREAK_MIN) {
      toaster().success(`¡Se encendió su racha con ${first}!`, 'Tres días seguidos escribiéndose.');
    }
    activity.current?.();
  }, [first, toMsg]);

  const sendText = useCallback(async (text: string, reply?: LetterMsg | null) => {
    const localId = `tmp-${Date.now()}`;
    setMessages((p) => [...p, { id: localId, localId, mine: true, kind: 'TEXT', content: text, photoUrl: null, createdAt: new Date().toISOString(), author: me, pending: true, replyTo: replyRefOf(reply), reactions: [] }]);
    try { afterSend(localId, await sendMessage(friend.id, { content: text, replyToId: reply?.id })); }
    catch (e) { setMessages((p) => p.filter((m) => m.id !== localId)); throw new Error(apiError(e, 'No se pudo enviar')); }
  }, [afterSend, friend.id, me]);

  const sendPhoto = useCallback(async (photo: string, caption: string, localId: string, hidden: boolean) => {
    setMessages((p) => [...p, { id: localId, localId, mine: true, kind: 'SNAP', content: caption || null, photoUrl: photo, createdAt: new Date().toISOString(), author: me, pending: true, hidden, reactions: [] }]);
    try { afterSend(localId, await sendMessage(friend.id, { kind: 'SNAP', photoUrl: photo, content: caption || undefined })); }
    catch (e) { setMessages((p) => p.filter((m) => m.id !== localId)); throw new Error(apiError(e, 'No se pudo enviar la foto')); }
  }, [afterSend, friend.id, me]);

  const react = useCallback(async (messageId: string, emoji: string) => {
    setMessages((p) => p.map((m) => (m.id === messageId ? { ...m, reactions: toggleMine(m.reactions, emoji) } : m)));
    try {
      const r = await reactDirect(friend.id, messageId, emoji);
      setMessages((p) => withReactions(p, [{ id: r.id, reactions: r.reactions }]));
    } catch (e) {
      setMessages((p) => p.map((m) => (m.id === messageId ? { ...m, reactions: toggleMine(m.reactions, emoji) } : m)));
      toaster().error(apiError(e, 'No se pudo reaccionar'));
    }
  }, [friend.id]);

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
    } catch (e) { throw new Error(apiError(e, 'No se pudo guardar el fondo')); }
  }, [backgroundPhoto, friend.id]);

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
    conv, status, meId: me.id, viewKey, messages, streak: conv?.streak ?? null,
    seenUntil: conv?.seenUntil ? new Date(conv.seenUntil).getTime() : 0,
    background: conv?.background ?? null, backgroundPhoto,
    sendText, sendPhoto, react, reveal, saveBackground, revive,
    retry: () => { letterCache.delete(viewKey); setStatus('loading'); setAttempt((n) => n + 1); },
  };
}

// ─── Carta de un gremio ───────────────────────────────────────────────────────

export function useGuildLetter(guildId: string, opts: { guild?: GuildDetail | null; reloadGuild?: () => void; onActivity?: () => void } = {}): LetterApi & { guild: GuildDetail | null } {
  const me = useMe();
  const viewKey = `guild:${guildId}`;
  const cached = letterCache.get(viewKey);
  const controlled = opts.guild !== undefined;
  const [own, setOwn] = useState<GuildDetail | null>(cached?.guild ?? null);
  const guild = controlled ? opts.guild ?? null : own;
  const [messages, setMessages] = useState<LetterMsg[]>(cached?.messages ?? []);
  const [status, setStatus] = useState<LetterApi['status']>(cached ? 'ready' : 'loading');
  const [attempt, setAttempt] = useState(0);
  const lastAt = useRef<string | undefined>(cached?.lastAt);
  const cursor = useRef<string | undefined>(cached?.cursor);
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
      fresh: fresh && !mine, replyTo: m.replyTo ?? null, reactions: m.reactions ?? [],
    };
  }, [me]);
  const toMsgRef = useRef(toMsg);
  toMsgRef.current = toMsg;

  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const ownRef = useRef(own);
  ownRef.current = own;
  useEffect(() => {
    return () => {
      letterCache.set(viewKey, {
        guild: ownRef.current, messages: messagesRef.current.filter((m) => !m.pending).map((m) => ({ ...m, fresh: false })),
        cursor: cursor.current, lastAt: lastAt.current,
      });
    };
  }, [viewKey]);

  useEffect(() => {
    let alive = true;
    const ctl = new AbortController();
    const markNewest = (list: GuildMessage[]) => { const n = list[list.length - 1]; if (n) lastAt.current = n.createdAt; };

    const run = async () => {
      const startedAt = new Date(Date.now() - 60_000).toISOString();
      try {
        const list = await getGuildMessagesAfter(guildId);
        if (!alive) return;
        setStatus('ready');
        const next = list.map((m) => toMsgRef.current(m));
        setMessages((prev) => {
          const pending = prev.filter((m) => m.pending);
          if (!pending.length && sameList(prev, next)) return prev;
          return [...next, ...pending.filter((p) => !next.some((n) => n.id === p.id))];
        });
        markNewest(list);
        lastAt.current ??= startedAt;
        void useSocialStore.getState().refresh();
      } catch {
        if (!alive) return;
        if (!letterCache.has(viewKey)) setStatus('error');
        return;
      }
      while (alive) {
        if (!visible()) { await untilVisible(ctl.signal); continue; }
        try {
          const r = await liveGuild(guildId, { after: lastAt.current, since: cursor.current }, ctl.signal);
          if (!alive) return;
          cursor.current = r.cursor;
          if (!r.changed) continue;
          setMessages((prev) => withReactions(r.messages.length ? merge(prev, r.messages.map((m) => toMsgRef.current(m, true))) : prev, r.reacted));
          markNewest(r.messages);
          if (r.messages.some((m) => m.kind === 'EVENT' || m.kind === 'SNAP')) loadGuild();
          if (r.messages.some((m) => m.userId !== me.id)) ext.current.onActivity?.();
        } catch {
          if (!alive || ctl.signal.aborted) return;
          await sleep(3000);
        }
      }
    };
    void run();
    return () => { alive = false; ctl.abort(); void leaveLetterView(viewKey); };
  }, [guildId, viewKey, loadGuild, me.id, attempt]);

  const afterSend = useCallback((localId: string, r: Awaited<ReturnType<typeof postGuildText>>) => {
    setMessages((p) => confirm(p, localId, toMsg(r)));
    lastAt.current = r.createdAt > (lastAt.current ?? '') ? r.createdAt : lastAt.current;
    const name = guild?.name ?? 'el gremio';
    if (r.enemyDefeated) toaster().success(`¡${guild?.today.enemy.name ?? 'El enemigo'} cayó!`, 'Todos enviaron una foto hoy.');
    else if (r.streakCompleted && r.streak.active && r.streak.count === STREAK_MIN) toaster().success(`¡Se encendió la racha de ${name}!`, 'Tres días seguidos escribiéndose todos.');
    if (r.enemyDefeated || r.streakCompleted || r.kind === 'SNAP') loadGuild();
    ext.current.onActivity?.();
  }, [guild?.name, guild?.today.enemy.name, loadGuild, toMsg]);

  const sendText = useCallback(async (text: string, reply?: LetterMsg | null) => {
    const localId = `tmp-${Date.now()}`;
    setMessages((p) => [...p, { id: localId, localId, mine: true, kind: 'TEXT', content: text, photoUrl: null, createdAt: new Date().toISOString(), author: me, pending: true, replyTo: replyRefOf(reply), reactions: [] }]);
    try { afterSend(localId, await postGuildText(guildId, text, reply?.id)); }
    catch (e) { setMessages((p) => p.filter((m) => m.id !== localId)); throw new Error(apiError(e, 'No se pudo enviar')); }
  }, [afterSend, guildId, me]);

  const sendPhoto = useCallback(async (photo: string, caption: string, localId: string, hidden: boolean) => {
    setMessages((p) => [...p, { id: localId, localId, mine: true, kind: 'SNAP', content: caption || null, photoUrl: photo, createdAt: new Date().toISOString(), author: me, pending: true, hidden, reactions: [] }]);
    try { afterSend(localId, await postGuildSnap(guildId, photo, caption)); }
    catch (e) { setMessages((p) => p.filter((m) => m.id !== localId)); throw new Error(apiError(e, 'No se pudo enviar la foto')); }
  }, [afterSend, guildId, me]);

  const react = useCallback(async (messageId: string, emoji: string) => {
    setMessages((p) => p.map((m) => (m.id === messageId ? { ...m, reactions: toggleMine(m.reactions, emoji) } : m)));
    try {
      const r = await reactGuild(guildId, messageId, emoji);
      setMessages((p) => withReactions(p, [{ id: r.id, reactions: r.reactions }]));
    } catch (e) {
      setMessages((p) => p.map((m) => (m.id === messageId ? { ...m, reactions: toggleMine(m.reactions, emoji) } : m)));
      toaster().error(apiError(e, 'No se pudo reaccionar'));
    }
  }, [guildId]);

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
    } catch (e) { throw new Error(apiError(e, 'No se pudo guardar el fondo')); }
  }, [backgroundPhoto, controlled, guildId, loadGuild]);

  return {
    guild, status, meId: me.id, viewKey, messages, streak: guild?.streak ?? null, seenUntil: 0,
    background: guild?.background ?? null, backgroundPhoto,
    sendText, sendPhoto, react, reveal, saveBackground,
    retry: () => { letterCache.delete(viewKey); setStatus('loading'); setAttempt((n) => n + 1); },
  };
}
