// Datos de una carta, igual para la de dos amigos y la de un gremio: mensajes
// de todo tipo (texto, fotos de la cámara o la galería, notas de voz, stickers y
// minijuegos) con envío optimista, editar y borrar, reacciones y respuestas, la
// racha, el "visto" (en un gremio, quién leyó hasta dónde), quién está
// escribiendo, el fondo compartido y los mensajes más antiguos bajo demanda.
//
// En vivo: la carta abierta se suscribe al chat en vivo (lib/live), que trae lo
// nuevo y lo que cambió en cuanto pasa. Las cartas ya abiertas se guardan en
// caché: al volver a una se pinta al instante y se refresca por debajo.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { refreshUser } from '@/hooks/useAuth';
import { useToastStore } from '@/hooks/useToast';
import { Lru } from '@/lib/lru';
import { useAuthStore } from '@/store/authStore';
import { useSocialStore } from '@/store/socialStore';
import { liveHub, type LiveChatSection } from '@/lib/live';
import { primeMedia } from '@/lib/media';
import { closeSystemNotifications } from '@/lib/systemNotifications';
import {
  apiError, chatOf, deleteMessage, editMessage, getConversation, getDirectBackground, getGuild, getGuildBackground, getGuildLetter,
  leaveLetterView, playMove, postGuildMessage, reactDirect, reactGuild, reviveFriendStreak, sendMessage, setDirectBackground,
  setGuildBackground, setTyping, startGame as apiStartGame, STREAK_MIN, thumbOf,
  type BackgroundFit, type BackgroundMeta, type Conversation, type DM, type GameType, type GuildDetail, type GuildMessage,
  type GuildRead, type MessageMeta, type OutgoingBody, type Presence, type PublicUser, type ReactionCount, type ReplyRef,
  type RpsPick, type StreakView, type Typing,
} from '@/services/network.service';

export interface LetterAuthor { id: string; name: string; username?: string; avatarConfig?: unknown; avatarUrl?: string | null; nameColor?: string | null }

export interface LetterMsg {
  id: string;
  /** Id provisional con el que se creó en este dispositivo (se conserva al confirmarse). */
  localId?: string;
  mine: boolean;
  kind: string;
  content: string | null;
  meta: MessageMeta | null;
  media: { photo: boolean; audio: boolean };
  /** Lo enviado desde aquí: la foto o el audio que ya tenemos. */
  local?: { photoUrl?: string; audioUrl?: string };
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  author: LetterAuthor | null;
  replyTo: ReplyRef | null;
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
  /** La carta ya no está disponible (dejaron de ser amigos, saliste del gremio…). */
  gone: string | null;
  side: 'dm' | 'guild';
  /** Quién soy en esta carta (para saber qué mensajes son míos). */
  meId: string;
  /** "dm:<amigo>" | "guild:<gremio>": avisos de lo que llega a ella no se muestran. */
  viewKey: string;
  messages: LetterMsg[];
  hasMore: boolean;
  loadOlder: () => Promise<void>;
  streak: LetterStreak | null;
  /** Hasta qué fecha (ms) leyó tus mensajes la otra persona (0 = nada o no lo comparte). */
  seenUntil: number;
  /** En un gremio: hasta cuándo leyó cada miembro (ms). */
  reads: Map<string, number>;
  /** Quién está escribiendo ahora (sin ti). */
  typing: Typing[];
  background: BackgroundMeta | null;
  /** La foto del fondo, cuando ya llegó. */
  backgroundPhoto: string | null;
  sendText: (text: string, reply?: LetterMsg | null) => Promise<void>;
  sendPhoto: (photo: string, caption: string, localId: string, hidden: boolean, source: 'camera' | 'gallery') => Promise<void>;
  sendVoice: (audioUrl: string, durationMs: number, peaks: number[], reply?: LetterMsg | null) => Promise<void>;
  sendSticker: (hash: string, reply?: LetterMsg | null) => Promise<void>;
  startGame: (type: GameType) => Promise<void>;
  move: (messageId: string, move: number | RpsPick) => Promise<void>;
  edit: (messageId: string, content: string) => Promise<void>;
  remove: (messageId: string) => Promise<void>;
  /** Pone, cambia o quita (con la misma) tu reacción a un mensaje. */
  react: (messageId: string, emoji: string) => Promise<void>;
  reveal: (localId: string) => void;
  /** Avisa de que estás escribiendo (o de que paraste). */
  notifyTyping: (on: boolean) => void;
  saveBackground: (body: { photoUrl?: string | null; fit?: BackgroundFit }) => Promise<void>;
  revive?: () => Promise<void>;
  retry: () => void;
}

/** Fotos de fondo ya descargadas, por carta y versión. */
const bgCache = new Lru<string>(12);
interface Cached {
  conv?: Conversation; guild?: GuildDetail | null; messages: LetterMsg[]; hasMore: boolean;
  cursor?: string; lastAt?: string; reads?: Array<[string, number]>;
}
/** Cartas ya abiertas: se pintan al instante al volver. */
const letterCache = new Lru<Cached>(25);

const toaster = () => useToastStore.getState();
const tmpId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

/** Clave para reconocer el eco de un envío propio que aún está pendiente. */
const echoKey = (m: { kind: string; content: string | null; meta: MessageMeta | null }) => `${m.kind}|${m.content ?? ''}|${m.meta?.sticker ?? ''}|${m.meta?.durationMs ?? ''}`;

/** Añade lo nuevo sin duplicar: ni lo ya conocido ni el eco de lo propio que se está enviando. */
function merge(prev: LetterMsg[], incoming: LetterMsg[]) {
  const known = new Set(prev.map((m) => m.id));
  const echoes = new Set(prev.filter((m) => m.pending).map(echoKey));
  const add = incoming.filter((m) => !known.has(m.id) && !(m.mine && echoes.has(echoKey(m))));
  return add.length ? [...prev, ...add].sort((a, b) => (a.pending === b.pending ? a.createdAt.localeCompare(b.createdAt) : a.pending ? 1 : -1)) : prev;
}

/** Sustituye mensajes que cambiaron (reacción, edición, borrado o jugada) conservando lo local. */
function replaceChanged(prev: LetterMsg[], changed: LetterMsg[]) {
  if (!changed.length) return prev;
  const by = new Map(changed.map((m) => [m.id, m]));
  return prev.map((m) => { const c = by.get(m.id); return c ? { ...c, localId: m.localId, local: m.local, fresh: false } : m; });
}

/** Sustituye el mensaje provisional por el confirmado (o lo quita si el chat en vivo ya lo trajo). */
function confirm(prev: LetterMsg[], localId: string, real: LetterMsg) {
  if (prev.some((m) => m.id === real.id)) return prev.filter((m) => m.id !== localId);
  return prev.map((m) => (m.id === localId ? { ...real, localId, local: m.local, hidden: m.hidden } : m));
}

/** Tu reacción puesta de golpe, sin esperar a la API (se corrige con su respuesta). */
function toggleMine(list: ReactionCount[], emoji: string): ReactionCount[] {
  const mine = list.find((r) => r.mine);
  let next = list.map((r) => (r.mine ? { ...r, count: r.count - 1, mine: false } : r)).filter((r) => r.count > 0);
  if (mine?.emoji === emoji) return next;
  const found = next.find((r) => r.emoji === emoji);
  next = found ? next.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r)) : [...next, { emoji, count: 1, mine: true }];
  return next;
}

/** ¿Es la misma lista? (para no repintar la carta al refrescar lo que ya se ve) */
const sameList = (a: LetterMsg[], b: LetterMsg[]) =>
  a.length === b.length && a.every((m, i) => m.id === b[i].id && m.editedAt === b[i].editedAt && m.deletedAt === b[i].deletedAt
    && JSON.stringify(m.reactions) === JSON.stringify(b[i].reactions) && JSON.stringify(m.meta?.game) === JSON.stringify(b[i].meta?.game));

const replyRefOf = (m?: LetterMsg | null): ReplyRef | null => (m ? { id: m.id, authorId: m.author?.id ?? '', kind: m.kind, content: m.content } : null);

const newest = (list: Array<{ createdAt: string }>) => list.reduce<string | undefined>((a, m) => (!a || m.createdAt > a ? m.createdAt : a), undefined);

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
  const me = useAuthStore((s) => s.user) as (ReturnType<typeof useAuthStore.getState>['user'] & { nameColor?: string | null }) | null;
  return useMemo(() => ({
    id: String(me?.id ?? ''), name: me?.displayName ?? 'Tú', username: me?.username, avatarConfig: me?.avatarConfig, avatarUrl: me?.avatarUrl, nameColor: me?.nameColor ?? null,
  }), [me]);
}

/** "Escribiendo…" con freno: como mucho un aviso cada 2,5 s mientras se teclea. */
function useTypingNotifier(chat: string) {
  const last = useRef(0);
  const on = useRef(false);
  const timer = useRef(0);
  const notify = useCallback((typing: boolean) => {
    window.clearTimeout(timer.current);
    if (typing) {
      const now = Date.now();
      if (!on.current || now - last.current > 2500) { last.current = now; on.current = true; void setTyping(chat, true); }
      // Si deja de teclear, se apaga solo a los 4 s.
      timer.current = window.setTimeout(() => { if (on.current) { on.current = false; void setTyping(chat, false); } }, 4000);
    } else if (on.current) {
      on.current = false;
      void setTyping(chat, false);
    }
  }, [chat]);
  useEffect(() => () => { window.clearTimeout(timer.current); if (on.current) void setTyping(chat, false); }, [chat]);
  return notify;
}

/** Lo común a las dos cartas: lista, cursores, suscripción en vivo y acciones locales. */
function useLetterCore(viewKey: string, cached: Cached | undefined) {
  const [messages, setMessages] = useState<LetterMsg[]>(cached?.messages ?? []);
  const [hasMore, setHasMore] = useState(cached?.hasMore ?? false);
  const [status, setStatus] = useState<LetterApi['status']>(cached ? 'ready' : 'loading');
  const [gone, setGone] = useState<string | null>(null);
  const [typing, setTypingList] = useState<Typing[]>([]);
  const [attempt, setAttempt] = useState(0);
  const lastAt = useRef<string | undefined>(cached?.lastAt);
  const cursor = useRef<string | undefined>(cached?.cursor);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  return { messages, setMessages, hasMore, setHasMore, status, setStatus, gone, setGone, typing, setTypingList, attempt, setAttempt, lastAt, cursor, messagesRef };
}

// ─── Carta entre dos amigos ───────────────────────────────────────────────────

export function useDirectLetter(friend: PublicUser, onActivity?: () => void): LetterApi & { conv: Conversation | null; presence: Presence | null } {
  const me = useMe();
  const viewKey = chatOf.dm(friend.id);
  const cached = letterCache.get(viewKey);
  const core = useLetterCore(viewKey, cached);
  const { setMessages, setStatus, lastAt, cursor, messagesRef } = core;
  const [conv, setConv] = useState<Conversation | null>(cached?.conv ?? null);
  const activity = useRef(onActivity);
  activity.current = onActivity;
  const first = friend.displayName.split(' ')[0];
  const notifyTyping = useTypingNotifier(viewKey);

  const them: LetterAuthor = useMemo(
    () => ({ id: friend.id, name: friend.displayName, username: friend.username, avatarConfig: friend.avatarConfig, avatarUrl: friend.avatarUrl, nameColor: friend.nameColor }),
    [friend.id, friend.displayName, friend.username, friend.avatarConfig, friend.avatarUrl, friend.nameColor],
  );
  const toMsg = useCallback((m: DM, fresh = false): LetterMsg => ({
    id: m.id, mine: m.mine, kind: m.kind, content: m.content, meta: m.meta, media: m.media, createdAt: m.createdAt,
    editedAt: m.editedAt, deletedAt: m.deletedAt, author: m.mine ? me : them, fresh: fresh && !m.mine, replyTo: m.replyTo ?? null, reactions: m.reactions ?? [],
  }), [me, them]);
  const toMsgRef = useRef(toMsg);
  toMsgRef.current = toMsg;

  // Guarda lo que se ve para pintarlo al instante la próxima vez.
  const convRef = useRef(conv);
  convRef.current = conv;
  const hasMoreRef = useRef(core.hasMore);
  hasMoreRef.current = core.hasMore;
  useEffect(() => () => {
    letterCache.set(viewKey, {
      conv: convRef.current ?? undefined, messages: messagesRef.current.filter((m) => !m.pending).map((m) => ({ ...m, fresh: false })),
      hasMore: hasMoreRef.current, cursor: cursor.current, lastAt: lastAt.current,
    });
  }, [viewKey, messagesRef, cursor, lastAt]);

  useEffect(() => {
    let alive = true;
    closeSystemNotifications(`dm:${friend.id}`);
    getConversation(friend.id)
      .then((c) => {
        if (!alive) return;
        setConv(c); setStatus('ready'); core.setHasMore(c.hasMore);
        const next = c.messages.map((m) => toMsgRef.current(m));
        setMessages((prev) => {
          const pending = prev.filter((m) => m.pending);
          if (!pending.length && sameList(prev, next)) return prev;
          return [...next, ...pending.filter((p) => !next.some((n) => n.id === p.id))];
        });
        cursor.current = c.cursor;
        lastAt.current = newest(c.messages) ?? c.cursor;
        core.setTypingList(c.typing ?? []);
        void useSocialStore.getState().refresh();
        // Ya con los cursores: la carta pasa a estar en vivo.
        liveHub.setChat({
          key: viewKey,
          cursors: () => ({ after: lastAt.current, changes: cursor.current }),
          onSection: (s: LiveChatSection) => {
            if (s.error) { core.setGone(s.error); return; }
            if (s.cursor) cursor.current = s.cursor;
            const incoming = (s.messages ?? []) as DM[];
            const changed = (s.changed ?? []) as DM[];
            if (incoming.length || changed.length) {
              setMessages((prev) => replaceChanged(incoming.length ? merge(prev, incoming.map((m) => toMsgRef.current(m, true))) : prev, changed.map((m) => toMsgRef.current(m))));
            }
            const n = newest(incoming);
            if (n && n > (lastAt.current ?? '')) lastAt.current = n;
            core.setTypingList(s.typing ?? []);
            setConv((cv) => (cv ? {
              ...cv,
              seenUntil: s.seenUntil !== undefined ? s.seenUntil : cv.seenUntil,
              streak: s.streak ? { ...cv.streak, ...s.streak } : cv.streak,
              background: s.background !== undefined ? s.background : cv.background,
              friend: s.friend ? { ...cv.friend, ...s.friend } : cv.friend,
            } : cv));
            if (incoming.some((m) => !m.mine)) activity.current?.();
          },
        });
      })
      .catch(() => { if (alive && !letterCache.has(viewKey)) setStatus('error'); });
    return () => {
      alive = false;
      liveHub.releaseChat(viewKey);
      void leaveLetterView(viewKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friend.id, viewKey, core.attempt]);

  const afterSend = useCallback((localId: string, r: Awaited<ReturnType<typeof sendMessage>>) => {
    setMessages((p) => confirm(p, localId, toMsg(r.message)));
    if (r.message.createdAt > (lastAt.current ?? '')) lastAt.current = r.message.createdAt;
    setConv((c) => (c ? { ...c, streak: { ...c.streak, ...r.streak } } : c));
    if (r.completed && r.streak.active && r.streak.count === STREAK_MIN) {
      toaster().success(`¡Se encendió su racha con ${first}!`, 'Tres días seguidos escribiéndose.');
    }
    activity.current?.();
  }, [first, toMsg, setMessages, lastAt]);

  /** Envío optimista de cualquier tipo de mensaje. */
  const send = useCallback(async (body: OutgoingBody, draft: Partial<LetterMsg>, localId = tmpId()) => {
    notifyTyping(false);
    setMessages((p) => [...p, {
      id: localId, localId, mine: true, kind: body.kind ?? 'TEXT', content: body.content ?? null, meta: body.meta ?? null,
      media: { photo: Boolean(body.photoUrl), audio: Boolean(body.audioUrl) }, createdAt: new Date().toISOString(), editedAt: null, deletedAt: null,
      author: me, pending: true, replyTo: null, reactions: [], ...draft,
    }]);
    try {
      const r = await sendMessage(friend.id, body);
      if (body.photoUrl || body.audioUrl) primeMedia('dm', r.message.id, { photoUrl: body.photoUrl, audioUrl: body.audioUrl });
      afterSend(localId, r);
    } catch (e) {
      setMessages((p) => p.filter((m) => m.id !== localId));
      throw new Error(apiError(e, 'No se pudo enviar'));
    }
  }, [afterSend, friend.id, me, notifyTyping, setMessages]);

  return {
    ...useLetterActions({
      core, me, side: 'dm', viewKey, send, notifyTyping,
      react: (id, emoji) => reactDirect(friend.id, id, emoji),
      addMessage: (m) => toMsg(m as DM),
    }),
    conv,
    presence: conv?.friend ?? null,
    streak: conv?.streak ?? null,
    seenUntil: conv?.seenUntil ? new Date(conv.seenUntil).getTime() : 0,
    reads: new Map(),
    background: conv?.background ?? null,
    backgroundPhoto: useBackgroundPhoto(`dm:${friend.id}`, conv?.background ?? null, () => getDirectBackground(friend.id)),
    loadOlder: useCallback(async () => {
      const oldest = messagesRef.current.find((m) => !m.pending);
      if (!oldest || !core.hasMore) return;
      const c = await getConversation(friend.id, { before: oldest.createdAt });
      core.setHasMore(c.hasMore);
      setMessages((p) => { const known = new Set(p.map((m) => m.id)); return [...c.messages.filter((m) => !known.has(m.id)).map((m) => toMsgRef.current(m)), ...p]; });
    }, [core, friend.id, messagesRef, setMessages]),
    saveBackground: useCallback(async (body: { photoUrl?: string | null; fit?: BackgroundFit }) => {
      try {
        const prevPhoto = conv?.background ? bgCache.get(`dm:${friend.id}@${conv.background.at}`) : undefined;
        const r = await setDirectBackground(friend.id, body);
        if (body.photoUrl && r.background) bgCache.set(`dm:${friend.id}@${r.background.at}`, body.photoUrl);
        if (body.photoUrl === undefined && r.background && prevPhoto) bgCache.set(`dm:${friend.id}@${r.background.at}`, prevPhoto);
        setConv((c) => (c ? { ...c, background: r.background } : c));
      } catch (e) { throw new Error(apiError(e, 'No se pudo guardar el fondo')); }
    }, [conv?.background, friend.id]),
    revive: useCallback(async () => {
      if (!conv) return;
      try {
        const r = await reviveFriendStreak(conv.friendshipId);
        setConv((c) => (c ? { ...c, streak: { ...c.streak, ...r.streak } } : c));
        toaster().success('La racha volvió a encenderse', 'Escríbanse hoy para mantenerla.');
        void refreshUser();
        activity.current?.();
      } catch (e) { toaster().error(apiError(e, 'No se pudo revivir la racha')); }
    }, [conv]),
  };
}

// ─── Carta de un gremio ───────────────────────────────────────────────────────

export function useGuildLetter(guildId: string, opts: { guild?: GuildDetail | null; reloadGuild?: () => void; onActivity?: () => void } = {}): LetterApi & { guild: GuildDetail | null } {
  const me = useMe();
  const viewKey = chatOf.guild(guildId);
  const cached = letterCache.get(viewKey);
  const core = useLetterCore(viewKey, cached);
  const { setMessages, setStatus, lastAt, cursor, messagesRef } = core;
  const controlled = opts.guild !== undefined;
  const [own, setOwn] = useState<GuildDetail | null>(cached?.guild ?? null);
  const guild = controlled ? opts.guild ?? null : own;
  const [reads, setReads] = useState<Map<string, number>>(() => new Map(cached?.reads ?? []));
  const ext = useRef(opts);
  ext.current = opts;
  const notifyTyping = useTypingNotifier(viewKey);

  const loadGuild = useCallback(() => {
    if (ext.current.guild !== undefined) { ext.current.reloadGuild?.(); return; }
    getGuild(guildId).then(setOwn).catch(() => undefined);
  }, [guildId]);
  useEffect(() => { if (!controlled) loadGuild(); }, [controlled, loadGuild]);

  const toMsg = useCallback((m: GuildMessage, fresh = false): LetterMsg => {
    const mine = m.userId === me.id;
    return {
      id: m.id, mine, kind: m.kind, content: m.content || null, meta: m.meta, media: m.media, createdAt: m.createdAt,
      editedAt: m.editedAt, deletedAt: m.deletedAt,
      author: mine ? me : { id: m.userId, name: m.user.displayName, username: m.user.username, avatarConfig: m.user.avatarConfig, avatarUrl: m.user.avatarUrl, nameColor: m.user.nameColor },
      fresh: fresh && !mine, replyTo: m.replyTo ?? null, reactions: m.reactions ?? [],
    };
  }, [me]);
  const toMsgRef = useRef(toMsg);
  toMsgRef.current = toMsg;
  const applyReads = useCallback((list: GuildRead[] | undefined) => {
    if (list) setReads(new Map(list.map((r) => [r.userId, new Date(r.at).getTime()])));
  }, []);

  const ownRef = useRef(own);
  ownRef.current = own;
  const readsRef = useRef(reads);
  readsRef.current = reads;
  const hasMoreRef = useRef(core.hasMore);
  hasMoreRef.current = core.hasMore;
  useEffect(() => () => {
    letterCache.set(viewKey, {
      guild: ownRef.current, messages: messagesRef.current.filter((m) => !m.pending).map((m) => ({ ...m, fresh: false })),
      hasMore: hasMoreRef.current, cursor: cursor.current, lastAt: lastAt.current, reads: [...readsRef.current],
    });
  }, [viewKey, messagesRef, cursor, lastAt]);

  useEffect(() => {
    let alive = true;
    closeSystemNotifications(`guild-msg:${guildId}`);
    getGuildLetter(guildId)
      .then((l) => {
        if (!alive) return;
        setStatus('ready'); core.setHasMore(l.hasMore);
        const next = l.messages.map((m) => toMsgRef.current(m));
        setMessages((prev) => {
          const pending = prev.filter((m) => m.pending);
          if (!pending.length && sameList(prev, next)) return prev;
          return [...next, ...pending.filter((p) => !next.some((n) => n.id === p.id))];
        });
        cursor.current = l.cursor;
        lastAt.current = newest(l.messages) ?? l.cursor;
        applyReads(l.reads);
        core.setTypingList(l.typing ?? []);
        void useSocialStore.getState().refresh();
        liveHub.setChat({
          key: viewKey,
          cursors: () => ({ after: lastAt.current, changes: cursor.current }),
          onSection: (s: LiveChatSection) => {
            if (s.error) { core.setGone(s.error); return; }
            if (s.cursor) cursor.current = s.cursor;
            const incoming = (s.messages ?? []) as GuildMessage[];
            const changed = (s.changed ?? []) as GuildMessage[];
            if (incoming.length || changed.length) {
              setMessages((prev) => replaceChanged(incoming.length ? merge(prev, incoming.map((m) => toMsgRef.current(m, true))) : prev, changed.map((m) => toMsgRef.current(m))));
            }
            const n = newest(incoming);
            if (n && n > (lastAt.current ?? '')) lastAt.current = n;
            applyReads(s.reads);
            core.setTypingList(s.typing ?? []);
            if (incoming.some((m) => m.kind === 'EVENT' || m.kind === 'SNAP')) loadGuild();
            if (incoming.some((m) => m.userId !== me.id)) ext.current.onActivity?.();
          },
        });
      })
      .catch(() => { if (alive && !letterCache.has(viewKey)) setStatus('error'); });
    return () => {
      alive = false;
      liveHub.releaseChat(viewKey);
      void leaveLetterView(viewKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId, viewKey, core.attempt]);

  const afterSend = useCallback((localId: string, r: Awaited<ReturnType<typeof postGuildMessage>>) => {
    setMessages((p) => confirm(p, localId, toMsg(r)));
    if (r.createdAt > (lastAt.current ?? '')) lastAt.current = r.createdAt;
    const name = guild?.name ?? 'el gremio';
    if (r.enemyDefeated) toaster().success(`¡${guild?.today.enemy.name ?? 'El enemigo'} cayó!`, 'Todos enviaron una foto hoy.');
    else if (r.streakCompleted && r.streak.active && r.streak.count === STREAK_MIN) toaster().success(`¡Se encendió la racha de ${name}!`, 'Tres días seguidos escribiéndose todos.');
    if (r.enemyDefeated || r.streakCompleted || r.kind === 'SNAP') loadGuild();
    ext.current.onActivity?.();
  }, [guild?.name, guild?.today.enemy.name, loadGuild, toMsg, setMessages, lastAt]);

  const send = useCallback(async (body: OutgoingBody, draft: Partial<LetterMsg>, localId = tmpId()) => {
    notifyTyping(false);
    setMessages((p) => [...p, {
      id: localId, localId, mine: true, kind: body.kind ?? 'TEXT', content: body.content ?? null, meta: body.meta ?? null,
      media: { photo: Boolean(body.photoUrl), audio: Boolean(body.audioUrl) }, createdAt: new Date().toISOString(), editedAt: null, deletedAt: null,
      author: me, pending: true, replyTo: null, reactions: [], ...draft,
    }]);
    try {
      const r = await postGuildMessage(guildId, body);
      if (body.photoUrl || body.audioUrl) primeMedia('guild', r.id, { photoUrl: body.photoUrl, audioUrl: body.audioUrl });
      afterSend(localId, r);
    } catch (e) {
      setMessages((p) => p.filter((m) => m.id !== localId));
      throw new Error(apiError(e, 'No se pudo enviar'));
    }
  }, [afterSend, guildId, me, notifyTyping, setMessages]);

  return {
    ...useLetterActions({
      core, me, side: 'guild', viewKey, send, notifyTyping,
      react: (id, emoji) => reactGuild(guildId, id, emoji),
      addMessage: (m) => toMsg(m as GuildMessage),
    }),
    guild,
    streak: guild?.streak ?? null,
    seenUntil: 0,
    reads,
    background: guild?.background ?? null,
    backgroundPhoto: useBackgroundPhoto(`guild:${guildId}`, guild?.background ?? null, () => getGuildBackground(guildId)),
    loadOlder: useCallback(async () => {
      const oldest = messagesRef.current.find((m) => !m.pending);
      if (!oldest || !core.hasMore) return;
      const l = await getGuildLetter(guildId, oldest.createdAt);
      core.setHasMore(l.hasMore);
      setMessages((p) => { const known = new Set(p.map((m) => m.id)); return [...l.messages.filter((m) => !known.has(m.id)).map((m) => toMsgRef.current(m)), ...p]; });
    }, [core, guildId, messagesRef, setMessages]),
    saveBackground: useCallback(async (body: { photoUrl?: string | null; fit?: BackgroundFit }) => {
      try {
        const prevPhoto = guild?.background ? bgCache.get(`guild:${guildId}@${guild.background.at}`) : undefined;
        const r = await setGuildBackground(guildId, body);
        if (body.photoUrl && r.background) bgCache.set(`guild:${guildId}@${r.background.at}`, body.photoUrl);
        if (body.photoUrl === undefined && r.background && prevPhoto) bgCache.set(`guild:${guildId}@${r.background.at}`, prevPhoto);
        if (!controlled) setOwn((g) => (g ? { ...g, background: r.background } : g));
        loadGuild();
      } catch (e) { throw new Error(apiError(e, 'No se pudo guardar el fondo')); }
    }, [controlled, guild?.background, guildId, loadGuild]),
  };
}

// ─── Acciones comunes ─────────────────────────────────────────────────────────

type Core = ReturnType<typeof useLetterCore>;

function useLetterActions({ core, me, side, viewKey, send, notifyTyping, react: apiReact, addMessage }: {
  core: Core; me: LetterAuthor; side: 'dm' | 'guild'; viewKey: string;
  send: (body: OutgoingBody, draft: Partial<LetterMsg>, localId?: string) => Promise<void>;
  notifyTyping: (on: boolean) => void;
  react: (id: string, emoji: string) => Promise<{ id: string; reactions: ReactionCount[] }>;
  addMessage: (m: DM | GuildMessage) => LetterMsg;
}) {
  const { setMessages, messagesRef } = core;

  const sendText = useCallback((text: string, reply?: LetterMsg | null) =>
    send({ content: text, replyToId: reply?.id }, { replyTo: replyRefOf(reply) }), [send]);

  const sendPhoto = useCallback(async (photo: string, caption: string, localId: string, hidden: boolean, source: 'camera' | 'gallery') => {
    const thumb = await thumbOf(photo);
    return send(
      { kind: source === 'camera' ? 'SNAP' : 'PHOTO', photoUrl: photo, content: caption || undefined, meta: thumb ? { thumb } : undefined },
      { local: { photoUrl: photo }, hidden }, localId,
    );
  }, [send]);

  const sendVoice = useCallback((audioUrl: string, durationMs: number, peaks: number[], reply?: LetterMsg | null) =>
    send({ kind: 'VOICE', audioUrl, meta: { durationMs, peaks }, replyToId: reply?.id }, { local: { audioUrl }, replyTo: replyRefOf(reply) }), [send]);

  const sendSticker = useCallback((hash: string, reply?: LetterMsg | null) =>
    send({ kind: 'STICKER', meta: { sticker: hash }, replyToId: reply?.id }, { replyTo: replyRefOf(reply) }), [send]);

  const startGame = useCallback(async (type: GameType) => {
    try {
      const m = await apiStartGame(viewKey, type);
      setMessages((p) => merge(p, [addMessage(m)]));
      liveHub.refresh();
    } catch (e) { toaster().error(apiError(e, 'No se pudo empezar la partida')); }
  }, [addMessage, setMessages, viewKey]);

  const move = useCallback(async (messageId: string, mv: number | RpsPick) => {
    try {
      const r = await playMove(side, messageId, mv);
      setMessages((p) => p.map((m) => (m.id === r.id ? { ...m, meta: { ...(m.meta ?? {}), game: r.game } } : m)));
    } catch (e) { toaster().error(apiError(e, 'Esa jugada no vale')); }
  }, [setMessages, side]);

  const edit = useCallback(async (messageId: string, content: string) => {
    const before = messagesRef.current.find((m) => m.id === messageId);
    if (!before || before.content === content) return;
    setMessages((p) => p.map((m) => (m.id === messageId ? { ...m, content, editedAt: new Date().toISOString() } : m)));
    try { await editMessage(viewKey, messageId, content); }
    catch (e) {
      setMessages((p) => p.map((m) => (m.id === messageId ? before : m)));
      toaster().error(apiError(e, 'No se pudo editar'));
    }
  }, [messagesRef, setMessages, viewKey]);

  const remove = useCallback(async (messageId: string) => {
    const before = messagesRef.current.find((m) => m.id === messageId);
    if (!before) return;
    setMessages((p) => p.map((m) => (m.id === messageId ? { ...m, deletedAt: new Date().toISOString(), content: null, meta: null, media: { photo: false, audio: false }, reactions: [] } : m)));
    try { await deleteMessage(viewKey, messageId); }
    catch (e) {
      setMessages((p) => p.map((m) => (m.id === messageId ? before : m)));
      toaster().error(apiError(e, 'No se pudo borrar'));
    }
  }, [messagesRef, setMessages, viewKey]);

  const react = useCallback(async (messageId: string, emoji: string) => {
    setMessages((p) => p.map((m) => (m.id === messageId ? { ...m, reactions: toggleMine(m.reactions, emoji) } : m)));
    try {
      const r = await apiReact(messageId, emoji);
      setMessages((p) => p.map((m) => (m.id === r.id ? { ...m, reactions: r.reactions } : m)));
    } catch (e) {
      setMessages((p) => p.map((m) => (m.id === messageId ? { ...m, reactions: toggleMine(m.reactions, emoji) } : m)));
      toaster().error(apiError(e, 'No se pudo reaccionar'));
    }
  }, [apiReact, setMessages]);

  const reveal = useCallback((localId: string) => {
    setMessages((p) => p.map((m) => (m.localId === localId || m.id === localId ? { ...m, hidden: false } : m)));
  }, [setMessages]);

  return {
    status: core.status, gone: core.gone, side, meId: me.id, viewKey, messages: core.messages, hasMore: core.hasMore,
    typing: core.typing.filter((t) => t.userId !== me.id),
    sendText, sendPhoto, sendVoice, sendSticker, startGame, move, edit, remove, react, reveal, notifyTyping,
    retry: () => { letterCache.delete(viewKey); core.setStatus('loading'); core.setAttempt((n) => n + 1); },
  };
}
