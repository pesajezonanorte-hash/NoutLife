// Red social de Noutlife: perfiles con privacidad, presencia (en línea y zona),
// la lista de amigos con su última carta (enviada, vista o sin leer), el fondo
// compartido de cada carta, rachas entre amigos que se encienden al tercer día
// hablando, gestos que se ven en el muñequito pixel de cada amigo y el vínculo de
// pareja que comparte el jardín. Los mensajes viven en dm.service.
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { addCalendarDays, getCalendarDay } from '../lib/calendar';
import { effectiveActivityStreak } from './xp.service';
import { createNotification } from './notification.service';
import { blockedWith, bump, chatPrefsOf, dmKey, snippet, TALK_KINDS } from './chat-live.service';

export { TALK_KINDS, validPhoto } from './chat-live.service';

// ─── Privacidad y presencia ───────────────────────────────────────────────────

export type Visibility = 'public' | 'friends' | 'private';

export interface Privacy {
  /** Quién ve tu lista de amigos y tus amistades más cercanas. */
  friendsList: Visibility;
  /** Quién ve tu perfil completo (hábitos, logros, gremios). */
  profile: 'public' | 'friends';
  showOnline: boolean;
  showZone: boolean;
  readReceipts: boolean;
}

export const DEFAULT_PRIVACY: Privacy = {
  friendsList: 'friends',
  profile: 'public',
  showOnline: true,
  showZone: true,
  readReceipts: true,
};

export function privacyOf(raw: unknown): Privacy {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Partial<Privacy>;
  const vis = (v: unknown, fallback: Visibility): Visibility => (v === 'public' || v === 'friends' || v === 'private' ? v : fallback);
  return {
    friendsList: vis(p.friendsList, DEFAULT_PRIVACY.friendsList),
    profile: p.profile === 'friends' ? 'friends' : 'public',
    showOnline: typeof p.showOnline === 'boolean' ? p.showOnline : true,
    showZone: typeof p.showZone === 'boolean' ? p.showZone : true,
    readReceipts: typeof p.readReceipts === 'boolean' ? p.readReceipts : true,
  };
}

/** Se considera "en línea" a quien mandó un latido en los últimos 2,5 minutos. */
const ONLINE_MS = 150_000;

interface PresenceSource { presenceAt: Date | null; presenceZone: string | null; privacy: unknown }

export function presenceOf(u: PresenceSource, now = Date.now()) {
  const p = privacyOf(u.privacy);
  if (!p.showOnline) return { online: false, zone: null as string | null, lastSeen: null as string | null };
  const online = Boolean(u.presenceAt && now - u.presenceAt.getTime() < ONLINE_MS);
  return {
    online,
    zone: online && p.showZone ? u.presenceZone : null,
    lastSeen: u.presenceAt ? u.presenceAt.toISOString() : null,
  };
}

/** Ids de los amigos de una persona. */
export async function friendIdsOf(userId: string): Promise<string[]> {
  const rows = await prisma.friendship.findMany({
    where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { receiverId: userId }] },
    select: { requesterId: true, receiverId: true },
  });
  return rows.map((f) => (f.requesterId === userId ? f.receiverId : f.requesterId));
}

/**
 * Latido de presencia (lo manda el chat en vivo cada pocos segundos). Si cambió
 * de zona, o vuelve tras estar fuera, suena el timbre de sus amigos: su muñequito
 * aparece (o se va) al momento y su carta muestra la zona nueva.
 */
export async function touchPresence(userId: string, zone: unknown, opts: { leaving?: boolean } = {}) {
  const z = opts.leaving ? null : typeof zone === 'string' ? zone.trim().slice(0, 40) || null : null;
  const now = new Date();
  const prev = await prisma.user.findUnique({ where: { id: userId }, select: { presenceAt: true, presenceZone: true } });
  const wasOnline = Boolean(prev?.presenceAt && now.getTime() - prev.presenceAt.getTime() < ONLINE_MS);
  const changed = opts.leaving ? wasOnline : !wasOnline || prev?.presenceZone !== z;
  // Sin cambios, basta con renovar el latido de vez en cuando.
  if (!changed && prev?.presenceAt && now.getTime() - prev.presenceAt.getTime() < 30_000) return { changed: false };
  await prisma.user.update({
    where: { id: userId },
    data: opts.leaving ? { presenceAt: new Date(now.getTime() - ONLINE_MS), presenceZone: null } : { presenceAt: now, presenceZone: z },
  });
  if (changed) await bump(await friendIdsOf(userId));
  return { changed };
}

/** Colores que se pueden elegir para el nombre (claves de la paleta del cliente). */
export const NAME_COLORS = ['jade', 'bosque', 'oceano', 'cielo', 'lavanda', 'uva', 'rosa', 'coral', 'ambar', 'miel', 'tierra', 'grafito'] as const;

export async function getMySocialSettings(userId: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { bio: true, privacy: true, nameColor: true } });
  return { bio: u.bio ?? '', privacy: privacyOf(u.privacy), nameColor: u.nameColor };
}

export async function updateMySocialSettings(userId: string, body: { bio?: unknown; privacy?: unknown; nameColor?: unknown }) {
  const current = await getMySocialSettings(userId);
  const privacy = body.privacy && typeof body.privacy === 'object'
    ? privacyOf({ ...current.privacy, ...(body.privacy as object) })
    : current.privacy;
  const bio = typeof body.bio === 'string' ? body.bio.trim().slice(0, 160) : undefined;
  // El color del nombre: una clave de la paleta, o null para el color de siempre.
  let nameColor: string | null | undefined;
  if (body.nameColor !== undefined) {
    if (body.nameColor !== null && !(NAME_COLORS as readonly unknown[]).includes(body.nameColor)) throw new Error('Ese color no está en la paleta');
    nameColor = body.nameColor as string | null;
  }
  const u = await prisma.user.update({
    where: { id: userId },
    data: {
      privacy: privacy as unknown as Prisma.InputJsonValue,
      ...(bio !== undefined ? { bio: bio || null } : {}),
      ...(nameColor !== undefined ? { nameColor } : {}),
    },
    select: { bio: true, privacy: true, nameColor: true },
  });
  if (nameColor !== undefined) await bump(await friendIdsOf(userId));
  return { bio: u.bio ?? '', privacy: privacyOf(u.privacy), nameColor: u.nameColor };
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

export const PUBLIC_USER = {
  id: true, username: true, displayName: true, level: true, nameColor: true,
  avatarConfig: true, avatarUrl: true, equippedAura: true, equippedFrame: true, equippedHat: true,
} as const;
const PRESENCE = { presenceAt: true, presenceZone: true, privacy: true } as const;
const STREAK = { currentStreak: true, lastActivityDate: true, timezone: true } as const;

type PublicUser = Prisma.UserGetPayload<{ select: typeof PUBLIC_USER }>;

/** Foto de fondo enviada desde el cliente: data URL JPEG/PNG/WebP. */
const PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

/** Fondo de una carta: la foto puede ser algo más grande (se ve a pantalla completa). */
const BACKGROUND_MAX = 900_000;
function validBackground(value: unknown): string {
  if (typeof value !== 'string' || value.length > BACKGROUND_MAX || !PHOTO.test(value)) {
    throw new Error('El fondo debe ser una imagen JPEG, PNG o WebP de menos de 650 kB.');
  }
  return value;
}

/** Encuadre del fondo: foco (x, y) 0–1, zoom 1–3 e intensidad del papel 0,2–0,9. */
export interface BackgroundFit { x: number; y: number; zoom: number; paper: number }
export function fitOf(raw: unknown): BackgroundFit {
  const f = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  return { x: num(f.x, 0, 1, 0.5), y: num(f.y, 0, 1, 0.5), zoom: num(f.zoom, 1, 3, 1), paper: num(f.paper, 0.2, 0.9, 0.42) };
}

type BackgroundRow = { fit: unknown; setById: string; updatedAt: Date };
/** Lo que viaja en cada sondeo: la versión del fondo (sin la foto, que pesa). */
export const backgroundMeta = (bg: BackgroundRow | null, me: string) =>
  (bg ? { at: bg.updatedAt.toISOString(), mine: bg.setById === me, fit: fitOf(bg.fit) } : null);

/**
 * Cambia el fondo de una carta. `photoUrl`: string = foto nueva · null = quitarla ·
 * undefined = solo reencuadrar la que hay. Devuelve el aviso que se deja en la carta.
 */
export async function saveBackground(
  where: { friendshipId: string } | { guildId: string },
  me: string,
  body: { photoUrl?: unknown; fit?: unknown },
): Promise<{ row: BackgroundRow | null; event: 'bg' | 'bg-off' | null }> {
  const current = await prisma.chatBackground.findUnique({ where, select: { id: true, fit: true } });
  if (body.photoUrl === null || body.photoUrl === '') {
    if (current) await prisma.chatBackground.delete({ where: { id: current.id } });
    return { row: null, event: current ? 'bg-off' : null };
  }
  const fit = fitOf(body.fit ?? current?.fit) as unknown as Prisma.InputJsonValue;
  if (body.photoUrl === undefined) {
    if (!current) throw new Error('Esta carta todavía no tiene fondo');
    const row = await prisma.chatBackground.update({ where: { id: current.id }, data: { fit, setById: me }, select: { fit: true, setById: true, updatedAt: true } });
    return { row, event: null };
  }
  const photoUrl = validBackground(body.photoUrl);
  const row = await prisma.chatBackground.upsert({
    where,
    create: { ...where, photoUrl, fit, setById: me },
    update: { photoUrl, fit, setById: me },
    select: { fit: true, setById: true, updatedAt: true },
  });
  return { row, event: 'bg' };
}

export const dayKey = (tz: string | null | undefined, now = new Date()) => getCalendarDay(tz, now).toISOString().slice(0, 10);
export const shiftKey = (key: string, days: number) => addCalendarDays(new Date(`${key}T00:00:00.000Z`), days).toISOString().slice(0, 10);

/** Coste en oro de revivir una racha de N días (más larga = más cara). */
export const reviveCost = (days: number, base = 15, cap = 300) => Math.min(cap, base + days * 5);

/** Una racha entre amigos (o de un gremio) se enciende al tercer día seguido hablando. */
export const STREAK_MIN = 3;

export interface StreakView {
  count: number;
  best: number;
  alive: boolean;
  /** Encendida: viva y con al menos STREAK_MIN días. Antes no se muestra. */
  active: boolean;
  /** Hoy ya cuenta (los dos/todos hablaron). */
  doneToday: boolean;
  revivable: boolean;
  reviveCost: number;
  /** Días de la racha apagada que se recuperan al revivirla. */
  lost: number;
}

/** Estado vigente de una racha guardada como (contador, último día completo). */
export function streakView(count: number, best: number, lastDay: string | null, today: string): StreakView {
  const yesterday = shiftKey(today, -1);
  const alive = Boolean(lastDay && (lastDay === today || lastDay === yesterday) && count > 0);
  // Solo se revive una racha que llegó a encenderse y se apagó hace poco (1–2 días sin completar).
  const revivable = !alive && count >= STREAK_MIN && Boolean(lastDay && lastDay >= shiftKey(today, -3));
  return {
    count: alive ? count : 0, best, alive, active: alive && count >= STREAK_MIN,
    doneToday: lastDay === today, revivable, reviveCost: revivable ? reviveCost(count) : 0, lost: revivable ? count : 0,
  };
}

/** Avanza una racha cuando el día `today` se completa. */
export function advanceStreak(count: number, best: number, lastDay: string | null, today: string) {
  if (lastDay === today) return { streakCount: count, streakBest: best, streakDay: lastDay };
  const next = lastDay === shiftKey(today, -1) ? count + 1 : 1;
  return { streakCount: next, streakBest: Math.max(best, next), streakDay: today };
}

async function friendshipBetween(a: string, b: string) {
  return prisma.friendship.findFirst({
    where: { OR: [{ requesterId: a, receiverId: b }, { requesterId: b, receiverId: a }] },
    include: { requester: { select: { timezone: true } } },
  });
}

export async function requireFriends(a: string, b: string) {
  const f = await friendshipBetween(a, b);
  if (!f || f.status !== 'ACCEPTED') throw new Error('Solo puedes hacer esto con tus amigos');
  return f;
}

/** Cobra oro de forma atómica: falla si no alcanza. */
export async function spendGold(userId: string, cost: number) {
  const r = await prisma.user.updateMany({ where: { id: userId, gold: { gte: cost } }, data: { gold: { decrement: cost } } });
  if (r.count === 0) throw new Error(`Necesitas ${cost} de oro para esto`);
}

// ─── Búsqueda y amigos ────────────────────────────────────────────────────────

export async function searchUsers(viewerId: string, q: string) {
  const term = q.trim().replace(/^@/, '');
  if (term.length < 2) return [];
  const users = await prisma.user.findMany({
    where: {
      onboardingCompleted: true,
      id: { not: viewerId },
      OR: [
        { username: { contains: term, mode: 'insensitive' } },
        { displayName: { contains: term, mode: 'insensitive' } },
        { inviteCode: term },
      ],
    },
    select: PUBLIC_USER,
    take: 16,
  });
  const blocked = await blockedWith(viewerId);
  users.splice(0, users.length, ...users.filter((u) => !blocked.has(u.id)).slice(0, 12));
  const links = await prisma.friendship.findMany({
    where: { OR: [{ requesterId: viewerId, receiverId: { in: users.map((u) => u.id) } }, { receiverId: viewerId, requesterId: { in: users.map((u) => u.id) } }] },
  });
  return users.map((u) => {
    const f = links.find((l) => l.requesterId === u.id || l.receiverId === u.id);
    return { user: u, relation: relationOf(viewerId, f) };
  });
}

type FriendshipRow = { id: string; requesterId: string; receiverId: string; status: string } | null | undefined;
function relationOf(viewerId: string, f: FriendshipRow) {
  if (!f || f.status === 'REJECTED') return { status: 'NONE' as const, friendshipId: null };
  if (f.status === 'ACCEPTED') return { status: 'FRIENDS' as const, friendshipId: f.id };
  return { status: f.requesterId === viewerId ? ('PENDING_OUT' as const) : ('PENDING_IN' as const), friendshipId: f.id };
}

/** Texto corto de un mensaje para listas, avisos y el muñequito pixel. */
export function messagePreview(m: { kind: string; content: string | null; deletedAt?: Date | null; meta?: unknown }) {
  return snippet(m, 80);
}

/** Amigos con presencia, racha, cartas sin leer y el último mensaje. */
export async function getFriendsNetwork(userId: string) {
  const sel = { select: { ...PUBLIC_USER, ...PRESENCE, ...STREAK } };
  const rows = await prisma.friendship.findMany({
    where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { receiverId: userId }] },
    include: { requester: sel, receiver: sel },
  });
  const now = new Date();
  const friendIds = rows.map((f) => (f.requesterId === userId ? f.receiverId : f.requesterId));

  const todayOf = new Map(rows.map((f) => [f.id, dayKey(f.requester.timezone, now)]));
  const keys = [...new Set(todayOf.values())];
  const [prefs, receipts] = await Promise.all([
    chatPrefsOf(userId),
    prisma.user.findMany({ where: { id: { in: friendIds } }, select: { id: true, privacy: true } }),
  ]);
  const shareSeen = new Set(receipts.filter((u) => privacyOf(u.privacy).readReceipts).map((u) => u.id));
  const [talked, unread, recent] = await Promise.all([
    // Quién habló hoy con quién (cuenta para la racha).
    prisma.directMessage.findMany({
      where: { kind: { in: TALK_KINDS }, dayKey: { in: keys }, OR: [{ senderId: userId, receiverId: { in: friendIds } }, { receiverId: userId, senderId: { in: friendIds } }] },
      select: { senderId: true, receiverId: true, dayKey: true },
      distinct: ['senderId', 'receiverId', 'dayKey'],
    }),
    prisma.directMessage.groupBy({ by: ['senderId'], where: { receiverId: userId, readAt: null, senderId: { in: friendIds } }, _count: { _all: true } }),
    prisma.directMessage.findMany({
      where: { OR: [{ senderId: userId, receiverId: { in: friendIds } }, { receiverId: userId, senderId: { in: friendIds } }] },
      orderBy: { createdAt: 'desc' },
      take: 400,
      select: { senderId: true, receiverId: true, kind: true, content: true, meta: true, createdAt: true, readAt: true, deletedAt: true },
    }),
  ]);

  return rows.map((f) => {
    const other = f.requesterId === userId ? f.receiver : f.requester;
    const today = todayOf.get(f.id)!;
    const mineToday = talked.some((s) => s.senderId === userId && s.receiverId === other.id && s.dayKey === today);
    const theirsToday = talked.some((s) => s.senderId === other.id && s.receiverId === userId && s.dayKey === today);
    const pref = prefs.get(dmKey(other.id));
    const cleared = pref?.clearedAt?.getTime() ?? 0;
    const last = recent.find((m) => (m.senderId === other.id || m.receiverId === other.id) && m.createdAt.getTime() > cleared);
    const mine = last?.senderId === userId;
    const { presenceAt: _a, presenceZone: _z, privacy: _p, lastActivityDate: _l, timezone: _t, ...pub } = other;
    return {
      friendshipId: f.id,
      since: f.updatedAt.toISOString(),
      friend: { ...pub, currentStreak: effectiveActivityStreak(other, now), ...presenceOf(other, now.getTime()) },
      streak: { ...streakView(f.streakCount, f.streakBest, f.streakDay, today), mineToday, theirsToday },
      unread: unread.find((u) => u.senderId === other.id)?._count._all ?? 0,
      lastMessage: last
        ? {
          mine, kind: last.kind, preview: messagePreview(last), at: last.createdAt.toISOString(),
          /** Tu último mensaje ya lo vio (solo si esa persona comparte el "visto"). */
          seen: mine && Boolean(last.readAt) && shareSeen.has(other.id),
        }
        : null,
      archived: Boolean(pref?.archivedAt),
    };
  }).sort((a, b) => (b.lastMessage?.at ?? b.since).localeCompare(a.lastMessage?.at ?? a.since));
}

export async function unreadMessages(userId: string) {
  return prisma.directMessage.count({ where: { receiverId: userId, readAt: null } });
}

// ─── Perfiles ─────────────────────────────────────────────────────────────────

export async function getProfile(viewerId: string, username: string) {
  const user = await prisma.user.findFirst({
    where: { username, onboardingCompleted: true },
    select: { ...PUBLIC_USER, ...PRESENCE, ...STREAK, bio: true, longestStreak: true, xp: true, createdAt: true, playerClass: true },
  });
  if (!user) throw new Error('Usuario no encontrado');
  const now = new Date();
  const isSelf = user.id === viewerId;
  // Bloqueos: quien te bloqueó no existe para ti; a quien bloqueaste solo lo ves para desbloquearlo.
  if (!isSelf) {
    const block = await prisma.userBlock.findFirst({ where: { OR: [{ blockerId: viewerId, blockedId: user.id }, { blockerId: user.id, blockedId: viewerId }] }, select: { blockerId: true } });
    if (block && block.blockerId === user.id) throw new Error('Usuario no encontrado');
    if (block) {
      const { presenceAt: _a, presenceZone: _z, privacy: _p, lastActivityDate: _l, timezone: _t, ...pub } = user;
      return {
        user: { ...pub, createdAt: user.createdAt.toISOString(), currentStreak: 0 },
        presence: { online: false, zone: null, lastSeen: null },
        relation: { status: 'BLOCKED' as const, friendshipId: null },
        friendStreak: null,
        locked: true as const,
      };
    }
  }
  const link = isSelf ? null : await friendshipBetween(viewerId, user.id);
  const relation = isSelf ? { status: 'SELF' as const, friendshipId: null } : relationOf(viewerId, link);
  const isFriend = relation.status === 'FRIENDS';
  const privacy = privacyOf(user.privacy);
  const { presenceAt: _a, presenceZone: _z, privacy: _p, lastActivityDate: _l, timezone: _t, ...pub } = user;

  const base = {
    user: { ...pub, createdAt: user.createdAt.toISOString(), currentStreak: effectiveActivityStreak(user, now) },
    presence: isSelf ? { online: true, zone: null, lastSeen: null } : presenceOf(user, now.getTime()),
    relation,
    friendStreak: link && isFriend ? streakView(link.streakCount, link.streakBest, link.streakDay, dayKey(link.requester.timezone, now)) : null,
  };
  if (!isSelf && !isFriend && privacy.profile === 'friends') return { ...base, locked: true as const };

  const canSeeFriends = isSelf || privacy.friendsList === 'public' || (privacy.friendsList === 'friends' && isFriend);
  const [habits, achievementsCount, achievements, guilds, friendRows] = await Promise.all([
    prisma.habit.findMany({ where: { userId: user.id, isActive: true }, select: { currentStreak: true, longestStreak: true } }),
    prisma.userAchievement.count({ where: { userId: user.id } }),
    prisma.userAchievement.findMany({
      where: { userId: user.id },
      include: { achievement: { select: { title: true, icon: true, category: true, description: true } } },
      orderBy: { unlockedAt: 'desc' },
      take: 8,
    }),
    prisma.guildMember.findMany({ where: { userId: user.id }, include: { guild: { select: { id: true, name: true, emblem: true, photoUrl: true } } } }),
    prisma.friendship.findMany({
      where: { status: 'ACCEPTED', OR: [{ requesterId: user.id }, { receiverId: user.id }] },
      include: { requester: { select: { ...PUBLIC_USER, timezone: true } }, receiver: { select: { ...PUBLIC_USER, timezone: true } } },
    }),
  ]);

  const friends = friendRows.map((f) => {
    const other = f.requesterId === user.id ? f.receiver : f.requester;
    const { timezone: _tz, ...o } = other;
    return { user: o, streak: streakView(f.streakCount, f.streakBest, f.streakDay, dayKey(f.requester.timezone, now)) };
  });
  // Las amistades más cercanas: las rachas encendidas primero, luego la mejor que tuvieron.
  const closest = [...friends]
    .filter((f) => f.streak.active || f.streak.best >= STREAK_MIN)
    .sort((a, b) => b.streak.count - a.streak.count || b.streak.best - a.streak.best)
    .slice(0, 3);

  return {
    ...base,
    locked: false as const,
    stats: {
      habits: habits.length,
      habitsOnStreak: habits.filter((h) => h.currentStreak > 0).length,
      bestHabitStreak: Math.max(0, ...habits.map((h) => h.currentStreak)),
      achievements: achievementsCount,
      friends: friends.length,
    },
    achievements: achievements.map((a) => ({ ...a.achievement, unlockedAt: a.unlockedAt.toISOString() })),
    guilds: guilds.map((g) => g.guild),
    friendsVisible: canSeeFriends,
    friends: canSeeFriends ? friends.map((f) => ({ ...f.user, friendStreak: f.streak.count })) : [],
    closeFriends: canSeeFriends ? closest.map((f) => ({ ...f.user, friendStreak: f.streak.count, best: f.streak.best })) : [],
  };
}

/** Enlace a una carta dentro de la sección Social. */
export const letterLink = (username: string) => `/social?tab=cartas&chat=${encodeURIComponent(username)}`;

// ─── Fondo de la carta ────────────────────────────────────────────────────────

/** La foto del fondo de la carta con un amigo (se pide aparte: pesa). */
export async function getDirectBackground(me: string, otherId: string) {
  const f = await requireFriends(me, otherId);
  const bg = await prisma.chatBackground.findUnique({ where: { friendshipId: f.id } });
  return bg ? { photoUrl: bg.photoUrl, ...backgroundMeta(bg, me)! } : null;
}

/** Cambia, reencuadra o quita el fondo; los dos lo ven y queda un aviso en la carta. */
export async function setDirectBackground(me: string, otherId: string, body: { photoUrl?: unknown; fit?: unknown }) {
  const f = await requireFriends(me, otherId);
  const { row, event } = await saveBackground({ friendshipId: f.id }, me, body);
  if (event) await prisma.directMessage.create({ data: { senderId: me, receiverId: otherId, kind: 'EVENT', content: event } });
  await bump([otherId, me]);
  return { background: backgroundMeta(row, me) };
}

// ─── Gestos y muñequitos en las zonas ─────────────────────────────────────────

export const GESTURES = ['wave', 'heart', 'dance', 'cheer', 'laugh', 'highfive'] as const;
export type GestureKind = (typeof GESTURES)[number];

/** Un gesto a un amigo: lo verá en tu muñequito pixel (o como aviso si no estás en su zona). */
export async function sendGesture(me: string, toId: string, body: { kind?: unknown; zone?: unknown }) {
  const kind = GESTURES.find((g) => g === body.kind);
  if (!kind) throw new Error('Ese gesto no existe');
  await requireFriends(me, toId);
  const now = Date.now();
  // Sin ráfagas: como mucho un gesto cada 2 s a la misma persona.
  const recent = await prisma.socialGesture.findFirst({ where: { fromId: me, toId, createdAt: { gt: new Date(now - 2000) } }, select: { id: true } });
  if (recent) return { ok: true, throttled: true };
  const zone = typeof body.zone === 'string' ? body.zone.trim().slice(0, 40) || null : null;
  await prisma.socialGesture.create({ data: { fromId: me, toId, kind, zone } });
  await bump([toId]);
  // Los gestos duran poco: se limpian los de hace más de dos días.
  prisma.socialGesture.deleteMany({ where: { toId, createdAt: { lt: new Date(now - 2 * 86_400_000) } } }).catch(() => null);
  return { ok: true, throttled: false };
}

/**
 * Amigos que están ahora en tu misma zona (sus muñequitos pasean por ella), con
 * su última carta sin leer; y los gestos que te enviaron (cada uno se entrega una vez).
 */
export async function zoneVisitors(me: string, zoneName: unknown) {
  const zone = typeof zoneName === 'string' ? zoneName.trim().slice(0, 40) : '';
  const now = new Date();
  const sel = { select: { ...PUBLIC_USER, ...PRESENCE } };
  const rows = await prisma.friendship.findMany({
    where: { status: 'ACCEPTED', OR: [{ requesterId: me }, { receiverId: me }] },
    select: { requesterId: true, receiver: sel, requester: sel },
  });
  const blocked = await blockedWith(me);
  const friends = rows.map((f) => (f.requesterId === me ? f.receiver : f.requester)).filter((u) => !blocked.has(u.id));
  const here = zone ? friends.filter((u) => { const p = presenceOf(u, now.getTime()); return p.online && p.zone === zone; }).slice(0, 8) : [];
  const [gestures, letters] = await Promise.all([
    friends.length
      ? prisma.socialGesture.findMany({
        where: { toId: me, seenAt: null, createdAt: { gt: new Date(now.getTime() - 10 * 60_000) }, fromId: { in: friends.map((u) => u.id) } },
        orderBy: { createdAt: 'asc' }, take: 20, select: { id: true, fromId: true, kind: true, zone: true, createdAt: true },
      })
      : [],
    here.length
      ? prisma.directMessage.findMany({
        where: { receiverId: me, readAt: null, senderId: { in: here.map((u) => u.id) }, kind: { in: TALK_KINDS } },
        orderBy: { createdAt: 'desc' }, take: 40, select: { senderId: true, kind: true, content: true, createdAt: true },
      })
      : [],
  ]);
  if (gestures.length) await prisma.socialGesture.updateMany({ where: { id: { in: gestures.map((g) => g.id) } }, data: { seenAt: now } });
  const byId = new Map(friends.map((u) => [u.id, u]));
  return {
    zone,
    visitors: here.map((u) => {
      const { presenceAt: _a, presenceZone: _z, privacy: _p, ...pub } = u;
      const mine = letters.filter((l) => l.senderId === u.id);
      return {
        ...pub,
        letter: mine[0] ? { preview: messagePreview(mine[0]).slice(0, 60), kind: mine[0].kind, at: mine[0].createdAt.toISOString(), count: mine.length } : null,
      };
    }),
    gestures: gestures.map((g) => {
      const from = byId.get(g.fromId);
      return { id: g.id, fromId: g.fromId, fromName: from?.displayName ?? '', fromUsername: from?.username ?? '', kind: g.kind, zone: g.zone, at: g.createdAt.toISOString() };
    }),
  };
}

export async function reviveFriendStreak(me: string, friendshipId: string) {
  const f = await prisma.friendship.findUnique({ where: { id: friendshipId }, include: { requester: { select: { timezone: true } } } });
  if (!f || f.status !== 'ACCEPTED' || (f.requesterId !== me && f.receiverId !== me)) throw new Error('Amistad no encontrada');
  const today = dayKey(f.requester.timezone);
  const view = streakView(f.streakCount, f.streakBest, f.streakDay, today);
  if (!view.revivable) throw new Error('Esta racha ya no se puede revivir');
  await spendGold(me, view.reviveCost);
  // Queda viva como si ayer se hubiera completado: hoy los dos siguen hablando.
  await prisma.friendship.update({ where: { id: f.id }, data: { streakDay: shiftKey(today, -1) } });
  const otherId = f.requesterId === me ? f.receiverId : f.requesterId;
  const who = await prisma.user.findUniqueOrThrow({ where: { id: me }, select: { displayName: true, username: true, gold: true } });
  createNotification(otherId, {
    type: 'friend', category: 'SOCIAL',
    title: 'Su racha volvió a encenderse',
    body: `${who.displayName} revivió su racha de ${f.streakCount} días. Escríbanse hoy para mantenerla.`,
    icon: 'friend', link: letterLink(who.username),
  }).catch(() => null);
  return { streak: streakView(f.streakCount, f.streakBest, shiftKey(today, -1), today), gold: who.gold };
}

// ─── Pareja: el jardín compartido ─────────────────────────────────────────────

const PARTNER_OF = (userId: string): Prisma.RelationshipWhereInput => ({
  isPartner: true,
  OR: [{ userId }, { partnerUserId: userId, linkStatus: 'LINKED' }],
});

/** Relaciones que alguien puede ver y editar: las suyas y el jardín compartido. */
export const accessibleRelationship = (userId: string, id: string): Prisma.RelationshipWhereInput => ({
  id,
  OR: [{ userId }, { partnerUserId: userId, linkStatus: 'LINKED' }],
});

export async function invitePartner(me: string, otherId: string) {
  await requireFriends(me, otherId);
  const taken = await prisma.relationship.findFirst({
    where: { isPartner: true, linkStatus: 'LINKED', OR: [{ userId: otherId }, { partnerUserId: otherId }] },
    select: { id: true },
  });
  if (taken) throw new Error('Esa persona ya comparte su jardín con alguien');

  const [mine, other, meUser] = await Promise.all([
    prisma.relationship.findFirst({ where: PARTNER_OF(me), orderBy: { createdAt: 'asc' } }),
    prisma.user.findUniqueOrThrow({ where: { id: otherId }, select: { displayName: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: me }, select: { displayName: true } }),
  ]);
  if (mine?.linkStatus === 'LINKED') throw new Error('Ya compartes tu jardín. Ciérralo antes de invitar a otra persona.');

  const rel = mine
    ? await prisma.relationship.update({ where: { id: mine.id }, data: { partnerUserId: otherId, linkStatus: 'PENDING', name: mine.name || other.displayName } })
    : await prisma.relationship.create({
      data: {
        userId: me, name: other.displayName, type: 'romantic', isPartner: true, importantDates: [],
        partnerUserId: otherId, linkStatus: 'PENDING', notes: `startDate:${new Date().toISOString().slice(0, 10)}`,
      },
    });

  createNotification(otherId, {
    type: 'social', category: 'SOCIAL', dedupeKey: `partner:${me}`,
    title: `${meUser.displayName} quiere compartir su jardín contigo`,
    body: 'Si aceptas, los dos cuidarán el mismo jardín: fechas, flores y recuerdos.',
    icon: 'heart', link: '/love',
  }).catch(() => null);
  return rel;
}

export async function respondPartnerInvite(me: string, relationshipId: string, accept: boolean) {
  const rel = await prisma.relationship.findFirst({ where: { id: relationshipId, partnerUserId: me, linkStatus: 'PENDING' } });
  if (!rel) throw new Error('Esta invitación ya no está disponible');
  const meUser = await prisma.user.findUniqueOrThrow({ where: { id: me }, select: { displayName: true } });

  if (!accept) {
    await prisma.relationship.update({ where: { id: rel.id }, data: { partnerUserId: null, linkStatus: null } });
    createNotification(rel.userId, {
      type: 'social', category: 'SOCIAL', title: 'Invitación al jardín',
      body: `${meUser.displayName} prefirió no compartir el jardín por ahora.`, icon: 'heart', link: '/love',
    }).catch(() => null);
    return { linked: false };
  }

  // Aceptar sustituye el jardín propio por el compartido.
  const own = await prisma.relationship.findMany({ where: { userId: me, isPartner: true }, select: { id: true } });
  if (own.length) {
    await prisma.giftIdea.deleteMany({ where: { userId: me, relationshipId: { in: own.map((r) => r.id) } } });
    await prisma.relationship.deleteMany({ where: { id: { in: own.map((r) => r.id) } } });
  }
  // Las invitaciones que yo hubiera enviado a otras personas quedan sin efecto.
  await prisma.relationship.updateMany({ where: { partnerUserId: me, linkStatus: 'PENDING', id: { not: rel.id } }, data: { partnerUserId: null, linkStatus: null } });
  await prisma.relationship.update({ where: { id: rel.id }, data: { linkStatus: 'LINKED', name: rel.name } });
  createNotification(rel.userId, {
    type: 'social', category: 'SOCIAL', title: 'Ahora comparten el jardín',
    body: `${meUser.displayName} aceptó. Desde hoy cuidan el mismo jardín.`, icon: 'heart', link: '/love',
  }).catch(() => null);
  return { linked: true };
}

export async function cancelPartnerInvite(me: string) {
  await prisma.relationship.updateMany({ where: { userId: me, isPartner: true, linkStatus: 'PENDING' }, data: { partnerUserId: null, linkStatus: null } });
}

/** Terminar: el jardín se reinicia por completo (para los dos si era compartido). */
export async function breakUp(me: string) {
  const rels = await prisma.relationship.findMany({ where: PARTNER_OF(me) });
  if (!rels.length) return { closed: 0 };
  const ids = rels.map((r) => r.id);
  await prisma.giftIdea.deleteMany({ where: { relationshipId: { in: ids } } });
  await prisma.relationship.deleteMany({ where: { id: { in: ids } } });

  const others = new Set(
    rels.filter((r) => r.linkStatus === 'LINKED').map((r) => (r.userId === me ? r.partnerUserId : r.userId)).filter((x): x is string => Boolean(x)),
  );
  for (const other of others) {
    createNotification(other, {
      type: 'social', category: 'SOCIAL', title: 'El jardín compartido se cerró',
      body: 'Tu jardín vuelve a ser solo tuyo y está listo para empezar de nuevo cuando quieras.',
      icon: 'heart', link: '/love',
    }).catch(() => null);
  }
  return { closed: ids.length };
}

/** Datos extra del jardín: con quién lo compartes y las invitaciones recibidas. */
export async function gardenLinks(me: string, rel: { userId: string; partnerUserId: string | null; linkStatus: string | null } | null) {
  const incoming = await prisma.relationship.findMany({
    where: { partnerUserId: me, linkStatus: 'PENDING' },
    include: { user: { select: PUBLIC_USER } },
    orderBy: { createdAt: 'desc' },
  });
  let partnerUser: (PublicUser & { online: boolean; zone: string | null; lastSeen: string | null }) | null = null;
  if (rel?.partnerUserId) {
    const otherId = rel.userId === me ? rel.partnerUserId : rel.userId;
    const u = await prisma.user.findUnique({ where: { id: otherId }, select: { ...PUBLIC_USER, ...PRESENCE } });
    if (u) {
      const { presenceAt: _a, presenceZone: _z, privacy: _p, ...pub } = u;
      partnerUser = { ...pub, ...presenceOf(u) };
    }
  }
  return {
    linkStatus: rel?.linkStatus ?? null,
    partnerUser,
    incomingInvites: incoming.map((r) => ({ relationshipId: r.id, from: r.user, createdAt: r.createdAt.toISOString() })),
  };
}

export { PARTNER_OF };

/** Cartas de gremio sin leer: lo escrito por otros después de tu última lectura. */
export async function guildUnreadCounts(userId: string) {
  const memberships = await prisma.guildMember.findMany({ where: { userId }, select: { guildId: true, joinedAt: true, lastReadAt: true } });
  return Promise.all(memberships.map(async (m) => ({
    guildId: m.guildId,
    unread: await prisma.guildMessage.count({ where: { guildId: m.guildId, userId: { not: userId }, createdAt: { gt: m.lastReadAt ?? m.joinedAt } } }),
  })));
}

/**
 * Pulso social ligero (cabecera, portal y pestañas de Social): cartas sin leer
 * (de amigos y de gremios), solicitudes, amigos en línea y rachas encendidas en
 * las que hoy todavía no escribiste.
 */
export async function socialPulse(userId: string) {
  const now = new Date();
  const [rows, unread, friendRequests, guildInvites, partnerInvites, guildUnread] = await Promise.all([
    prisma.friendship.findMany({
      where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { receiverId: userId }] },
      include: {
        requester: { select: { ...PUBLIC_USER, ...PRESENCE, timezone: true } },
        receiver: { select: { ...PUBLIC_USER, ...PRESENCE, timezone: true } },
      },
    }),
    prisma.directMessage.count({ where: { receiverId: userId, readAt: null } }),
    prisma.friendship.count({ where: { receiverId: userId, status: 'PENDING' } }),
    prisma.guildInvite.count({ where: { inviteeId: userId, status: 'PENDING' } }),
    prisma.relationship.count({ where: { partnerUserId: userId, linkStatus: 'PENDING' } }),
    guildUnreadCounts(userId),
  ]);
  const todayOf = new Map(rows.map((f) => [f.id, dayKey(f.requester.timezone, now)]));
  const mineToday = rows.length
    ? await prisma.directMessage.findMany({
      where: { senderId: userId, kind: { in: TALK_KINDS }, dayKey: { in: [...new Set(todayOf.values())] }, receiverId: { in: rows.map((f) => (f.requesterId === userId ? f.receiverId : f.requesterId)) } },
      select: { receiverId: true, dayKey: true },
      distinct: ['receiverId', 'dayKey'],
    })
    : [];
  const online: Array<PublicUser & { zone: string | null }> = [];
  let streaksWaiting = 0;
  for (const f of rows) {
    const other = f.requesterId === userId ? f.receiver : f.requester;
    const p = presenceOf(other, now.getTime());
    const { presenceAt: _a, presenceZone: _z, privacy: _p, timezone: _t, ...pub } = other;
    if (p.online) online.push({ ...pub, zone: p.zone });
    const today = todayOf.get(f.id)!;
    const v = streakView(f.streakCount, f.streakBest, f.streakDay, today);
    if (v.active && !v.doneToday && !mineToday.some((m) => m.receiverId === other.id && m.dayKey === today)) streaksWaiting += 1;
  }
  return {
    unreadMessages: unread,
    guildUnread: guildUnread.reduce((n, g) => n + g.unread, 0),
    requests: friendRequests + guildInvites + partnerInvites,
    friendRequests,
    guildInvites,
    friends: rows.length,
    onlineCount: online.length,
    online: online.slice(0, 5),
    streaksWaiting,
  };
}
