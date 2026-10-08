// Cartas entre dos amigos: la conversación (solo lo que esa persona no vació de
// su lado), enviar cualquier tipo de mensaje (texto, foto de la cámara o de la
// galería, nota de voz, sticker o minijuego), reaccionar, el "visto", la racha
// que se enciende al tercer día hablando y lo que el chat en vivo recoge de una
// carta abierta (lo nuevo, lo que cambió, quién escribe, el visto y la presencia).
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { createNotification, markReadByKeys } from './notification.service';
import {
  advanceStreak, backgroundMeta, dayKey, letterLink, presenceOf, privacyOf, PUBLIC_USER, requireFriends, STREAK_MIN, streakView,
} from './network.service';
import {
  bump, clearedAt, DM_LIGHT, dmKey, isViewing, letterBody, markTyping, parseOutgoing, parseDate, reactionsFor,
  repliesFor, setReaction, snippet, TALK_KINDS, TYPING_MS, validReaction, validReplyTo,
  type MessageMeta, type Outgoing, type ReactionCount, type ReplyRef,
} from './chat-live.service';

type DMLight = Prisma.DirectMessageGetPayload<{ select: typeof DM_LIGHT }>;

export const pairOf = (a: string, b: string) => ({ OR: [{ senderId: a, receiverId: b }, { senderId: b, receiverId: a }] });

const toDto = (me: string, reactions: Map<string, ReactionCount[]>, replies: Map<string, ReplyRef>) => (m: DMLight) => ({
  ...letterBody(m, me),
  mine: m.senderId === me,
  habitTitle: m.habitTitle,
  replyTo: (m.replyToId && replies.get(m.replyToId)) || null,
  reactions: m.deletedAt ? [] : reactions.get(m.id) ?? [],
});

/** Mensajes listos para el cliente: con sus reacciones y el mensaje al que responden. */
export async function dmDtos(me: string, otherId: string, rows: DMLight[]) {
  const [reactions, replies] = await Promise.all([
    reactionsFor('dm', rows.map((r) => r.id), me),
    repliesFor('dm', rows, pairOf(me, otherId)),
  ]);
  return rows.map(toDto(me, reactions, replies));
}

const PRESENCE = { presenceAt: true, presenceZone: true, privacy: true } as const;

async function otherUser(id: string) {
  const u = await prisma.user.findUnique({ where: { id }, select: { ...PUBLIC_USER, ...PRESENCE } });
  if (!u) throw new Error('Usuario no encontrado');
  return u;
}

/** Lo que `me` ve de la carta: todo, o desde que la vació. */
async function visiblePair(me: string, otherId: string) {
  const cleared = await clearedAt(me, dmKey(otherId));
  return { ...pairOf(me, otherId), ...(cleared ? { createdAt: { gt: cleared } } : {}) };
}

/** Marca leído lo que te escribió y avisa a quien lo escribió (para su "visto"). */
async function markRead(me: string, otherId: string) {
  const r = await prisma.directMessage.updateMany({ where: { senderId: otherId, receiverId: me, readAt: null }, data: { readAt: new Date() } });
  if (r.count) {
    await bump([otherId]);
    // Los avisos de esta carta ya no hacen falta (en la campana ni en este dispositivo).
    void markReadByKeys(me, [`dm:${otherId}`, `dm-react:${otherId}`]);
  }
  return r.count;
}

async function seenUntilOf(me: string, otherId: string, privacy: unknown) {
  if (!privacyOf(privacy).readReceipts) return null;
  const last = await prisma.directMessage.findFirst({
    where: { senderId: me, receiverId: otherId, readAt: { not: null } }, orderBy: { createdAt: 'desc' }, select: { createdAt: true },
  });
  return last?.createdAt.toISOString() ?? null;
}

async function streakOf(f: { id: string; streakCount: number; streakBest: number; streakDay: string | null; requester: { timezone: string | null } }, me: string, otherId: string) {
  const today = dayKey(f.requester.timezone);
  const talkedToday = await prisma.directMessage.findMany({
    where: { ...pairOf(me, otherId), kind: { in: TALK_KINDS }, dayKey: today }, select: { senderId: true }, distinct: ['senderId'],
  });
  return {
    ...streakView(f.streakCount, f.streakBest, f.streakDay, today),
    mineToday: talkedToday.some((s) => s.senderId === me),
    theirsToday: talkedToday.some((s) => s.senderId === otherId),
  };
}

/** ¿Está escribiendo la otra persona en esta carta? (hasta cuándo, en ISO) */
async function typingOf(me: string, otherId: string) {
  const row = await prisma.chatView.findUnique({ where: { userId_key: { userId: otherId, key: dmKey(me) } }, select: { typingAt: true } });
  if (!row?.typingAt || Date.now() - row.typingAt.getTime() > TYPING_MS) return [];
  return [{ userId: otherId, until: new Date(row.typingAt.getTime() + TYPING_MS).toISOString() }];
}

/**
 * Conversación con un amigo (los últimos 60 mensajes, sin fotos ni audios: se
 * piden aparte). Al leerla se marcan como vistos sus mensajes; `seenUntil` es la
 * fecha del último mensaje tuyo que vio (solo si esa persona comparte el "visto").
 */
export async function getConversation(me: string, otherId: string, after?: string, before?: string) {
  const f = await requireFriends(me, otherId);
  const other = await otherUser(otherId);
  const where = await visiblePair(me, otherId);
  const cursor = new Date().toISOString();
  const since = parseDate(after);
  const until = parseDate(before);
  const rows = since
    ? await prisma.directMessage.findMany({ where: { AND: [where, { createdAt: { gt: since } }] }, orderBy: { createdAt: 'asc' }, take: 100, select: DM_LIGHT })
    : (await prisma.directMessage.findMany({ where: until ? { AND: [where, { createdAt: { lt: until } }] } : where, orderBy: { createdAt: 'desc' }, take: 60, select: DM_LIGHT })).reverse();

  await markRead(me, otherId);
  const [seenUntil, streak, bg, typing] = await Promise.all([
    seenUntilOf(me, otherId, other.privacy),
    streakOf(f, me, otherId),
    prisma.chatBackground.findUnique({ where: { friendshipId: f.id }, select: { fit: true, setById: true, updatedAt: true } }),
    typingOf(me, otherId),
  ]);
  const { presenceAt: _a, presenceZone: _z, privacy: _p, ...pub } = other;
  return {
    friend: { ...pub, ...presenceOf(other) },
    friendshipId: f.id,
    messages: await dmDtos(me, otherId, rows),
    /** ¿Hay mensajes más antiguos que estos? */
    hasMore: !since && rows.length === 60,
    /** Desde aquí se piden los cambios (reacciones, ediciones, borrados, jugadas). */
    cursor,
    seenUntil,
    streak,
    typing,
    background: backgroundMeta(bg, me),
  };
}

/**
 * Lo que el chat en vivo recoge de una carta abierta: los mensajes nuevos
 * (`after`), los que cambiaron (`changes`), el visto, quién escribe, la presencia
 * del amigo, la racha y el fondo.
 */
export async function dmChatSection(me: string, otherId: string, q: { after?: unknown; changes?: unknown }) {
  const f = await requireFriends(me, otherId);
  const stamp = new Date();
  const where = await visiblePair(me, otherId);
  const after = parseDate(q.after);
  const changes = parseDate(q.changes);
  const [fresh, changedRows, other] = await Promise.all([
    after ? prisma.directMessage.findMany({ where: { AND: [where, { createdAt: { gt: after } }] }, orderBy: { createdAt: 'asc' }, take: 100, select: DM_LIGHT }) : [],
    changes ? prisma.directMessage.findMany({ where: { AND: [where, { changedAt: { gt: changes } }] }, orderBy: { createdAt: 'asc' }, take: 100, select: DM_LIGHT }) : [],
    otherUser(otherId),
  ]);
  if (fresh.some((m) => m.senderId === otherId)) await markRead(me, otherId);
  const freshIds = new Set(fresh.map((m) => m.id));
  const [messages, changed, seenUntil, streak, bg, typing] = await Promise.all([
    dmDtos(me, otherId, fresh),
    dmDtos(me, otherId, changedRows.filter((m) => !freshIds.has(m.id))),
    seenUntilOf(me, otherId, other.privacy),
    streakOf(f, me, otherId),
    prisma.chatBackground.findUnique({ where: { friendshipId: f.id }, select: { fit: true, setById: true, updatedAt: true } }),
    typingOf(me, otherId),
  ]);
  return {
    key: dmKey(otherId),
    cursor: stamp.toISOString(),
    messages,
    changed,
    seenUntil,
    typing,
    friend: presenceOf(other),
    streak,
    background: backgroundMeta(bg, me),
  };
}

// ─── Enviar ───────────────────────────────────────────────────────────────────

/** Título del aviso según lo que se envió. */
function noticeTitle(kind: string, name: string, meta?: MessageMeta | null) {
  switch (kind) {
    case 'SNAP':
    case 'PHOTO': return `${name} te envió una foto`;
    case 'VOICE': return `${name} te mandó una nota de voz`;
    case 'VIDEO': return `${name} te mandó un video`;
    case 'STICKER': return `${name} te mandó un sticker`;
    case 'GAME': return `${name} te retó: ${snippet({ kind, content: null, meta: meta as unknown as Prisma.JsonValue })}`;
    default: return `Carta de ${name}`;
  }
}

/**
 * Guarda un mensaje en la carta de dos amigos: le pone su día (racha), suma la
 * racha si ya habló la otra persona hoy, apaga tu "escribiendo…", suena el timbre
 * de los dos y avisa a quien lo recibe (si no tiene la carta abierta).
 */
export async function createDirectMessage(me: string, otherId: string, out: Outgoing, replyRaw?: unknown) {
  const f = await requireFriends(me, otherId);
  const today = dayKey(f.requester.timezone);
  const replyToId = await validReplyTo('dm', replyRaw, pairOf(me, otherId));
  const msg = await prisma.directMessage.create({
    data: {
      senderId: me, receiverId: otherId, kind: out.kind, content: out.content || null, photoUrl: out.photoUrl, audioUrl: out.audioUrl,
      meta: out.meta ? (out.meta as Prisma.InputJsonValue) : undefined, dayKey: today, replyToId,
    },
    select: DM_LIGHT,
  });

  let streak = streakView(f.streakCount, f.streakBest, f.streakDay, today);
  let completed = false;
  const theirs = await prisma.directMessage.findFirst({ where: { senderId: otherId, receiverId: me, kind: { in: TALK_KINDS }, dayKey: today }, select: { id: true } });
  if (f.streakDay !== today && theirs) {
    const next = advanceStreak(f.streakCount, f.streakBest, f.streakDay, today);
    await prisma.friendship.update({ where: { id: f.id }, data: next });
    streak = streakView(next.streakCount, next.streakBest, next.streakDay, today);
    completed = true;
  }

  await markTyping(me, dmKey(otherId), false).catch(() => undefined);
  await bump([otherId, me]);

  const sender = await prisma.user.findUniqueOrThrow({ where: { id: me }, select: { displayName: true, username: true } });
  const lit = completed && streak.active;
  // Suprime la carta exacta en el servidor; si el aviso llega durante una carrera,
  // el service worker vuelve a comprobar ese chat. Otras conversaciones sí conservan su push.
  if (!(await isViewing(otherId, dmKey(me)))) {
    createNotification(otherId, {
      type: 'friend',
      category: 'SOCIAL',
      dedupeKey: `dm:${me}`,
      title: noticeTitle(out.kind, sender.displayName, out.meta),
      body: [
        out.kind === 'TEXT' ? out.content.slice(0, 120) : out.kind === 'SNAP' || out.kind === 'PHOTO' ? (out.content || 'Ábrela en la carta.') : snippet(msg),
        lit ? (streak.count === STREAK_MIN ? '¡Se encendió su racha!' : `Racha de ${streak.count} días.`) : null,
      ].filter(Boolean).join(' · '),
      icon: 'friend',
      link: letterLink(sender.username),
      reply: { type: 'dm', id: me },
    }).catch(() => null);
  }

  const [message] = await dmDtos(me, otherId, [msg]);
  return { message, streak: { ...streak, mineToday: true, theirsToday: Boolean(theirs) }, completed };
}

export async function sendDirectMessage(
  me: string,
  otherId: string,
  body: { content?: unknown; photoUrl?: unknown; audioUrl?: unknown; kind?: unknown; meta?: unknown; replyToId?: unknown },
) {
  await requireFriends(me, otherId);
  const out = await parseOutgoing(body, 1000);
  return createDirectMessage(me, otherId, out, body.replyToId);
}

/** Reacciona (o quita la reacción) a un mensaje de la carta con un amigo. */
export async function reactDirect(me: string, otherId: string, messageId: string, emoji: unknown) {
  await requireFriends(me, otherId);
  const wanted = validReaction(emoji);
  const m = await prisma.directMessage.findFirst({
    where: { ...pairOf(me, otherId), id: messageId, kind: { not: 'EVENT' }, deletedAt: null }, select: { id: true, senderId: true, kind: true, content: true, meta: true },
  });
  if (!m) throw new Error('Mensaje no encontrado');
  const r = await setReaction('dm', m.id, me, wanted);
  await bump([otherId, me]);
  // Si reaccionas al mensaje de otra persona, se entera (salvo que esté leyendo la carta).
  if (r.emoji && m.senderId !== me && !(await isViewing(m.senderId, dmKey(me)))) {
    const who = await prisma.user.findUnique({ where: { id: me }, select: { displayName: true, username: true } });
    if (who) {
      createNotification(m.senderId, {
        type: 'friend', category: 'SOCIAL', dedupeKey: `dm-react:${me}`,
        title: `${who.displayName} reaccionó ${r.emoji}`, body: snippet(m, 90), icon: 'friend', link: letterLink(who.username),
        chatKey: dmKey(me),
      }).catch(() => null);
    }
  }
  return { id: m.id, ...r };
}
