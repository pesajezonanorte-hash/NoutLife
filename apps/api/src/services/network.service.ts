// Red social de Noutlife: perfiles con privacidad, presencia (en línea y zona),
// mensajes directos con "visto", rachas de fotos diarias entre amigos y el
// vínculo de pareja que comparte el jardín.
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { addCalendarDays, getCalendarDay } from '../lib/calendar';
import { effectiveActivityStreak } from './xp.service';
import { createNotification } from './notification.service';

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

export async function touchPresence(userId: string, zone: unknown) {
  const z = typeof zone === 'string' ? zone.trim().slice(0, 40) : null;
  await prisma.user.update({ where: { id: userId }, data: { presenceAt: new Date(), presenceZone: z || null } });
}

export async function getMySocialSettings(userId: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { bio: true, privacy: true } });
  return { bio: u.bio ?? '', privacy: privacyOf(u.privacy) };
}

export async function updateMySocialSettings(userId: string, body: { bio?: unknown; privacy?: unknown }) {
  const current = await getMySocialSettings(userId);
  const privacy = body.privacy && typeof body.privacy === 'object'
    ? privacyOf({ ...current.privacy, ...(body.privacy as object) })
    : current.privacy;
  const bio = typeof body.bio === 'string' ? body.bio.trim().slice(0, 160) : undefined;
  const u = await prisma.user.update({
    where: { id: userId },
    data: { privacy: privacy as unknown as Prisma.InputJsonValue, ...(bio !== undefined ? { bio: bio || null } : {}) },
    select: { bio: true, privacy: true },
  });
  return { bio: u.bio ?? '', privacy: privacyOf(u.privacy) };
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

export const PUBLIC_USER = {
  id: true, username: true, displayName: true, level: true,
  avatarConfig: true, avatarUrl: true, equippedAura: true, equippedFrame: true, equippedHat: true,
} as const;
const PRESENCE = { presenceAt: true, presenceZone: true, privacy: true } as const;
const STREAK = { currentStreak: true, lastActivityDate: true, timezone: true } as const;

type PublicUser = Prisma.UserGetPayload<{ select: typeof PUBLIC_USER }>;

/** Foto enviada desde el cliente: data URL JPEG/PNG/WebP (ya reducida a ~720 px). */
const PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const PHOTO_MAX = 600_000;
export function validPhoto(value: unknown): string {
  if (typeof value !== 'string' || value.length > PHOTO_MAX || !PHOTO.test(value)) {
    throw new Error('La foto debe ser una imagen JPEG, PNG o WebP de menos de 450 kB.');
  }
  return value;
}

export const dayKey = (tz: string | null | undefined, now = new Date()) => getCalendarDay(tz, now).toISOString().slice(0, 10);
export const shiftKey = (key: string, days: number) => addCalendarDays(new Date(`${key}T00:00:00.000Z`), days).toISOString().slice(0, 10);

/** Coste en oro de revivir una racha de N días (más larga = más cara). */
export const reviveCost = (days: number, base = 15, cap = 300) => Math.min(cap, base + days * 5);

export interface StreakView {
  count: number;
  best: number;
  alive: boolean;
  /** Hoy ya cuenta (los dos/todos enviaron). */
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
  // Perdida hace poco (1–2 días enteros sin completar): se puede revivir con oro.
  const revivable = !alive && count > 1 && Boolean(lastDay && lastDay >= shiftKey(today, -3));
  return { count: alive ? count : 0, best, alive, doneToday: lastDay === today, revivable, reviveCost: revivable ? reviveCost(count) : 0, lost: revivable ? count : 0 };
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

async function requireFriends(a: string, b: string) {
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
    take: 12,
  });
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

/** Amigos con presencia, racha de fotos, mensajes sin leer y el último mensaje. */
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
  const [snaps, unread, recent] = await Promise.all([
    prisma.directMessage.findMany({
      where: { kind: 'SNAP', dayKey: { in: keys }, OR: [{ senderId: userId, receiverId: { in: friendIds } }, { receiverId: userId, senderId: { in: friendIds } }] },
      select: { senderId: true, receiverId: true, dayKey: true },
    }),
    prisma.directMessage.groupBy({ by: ['senderId'], where: { receiverId: userId, readAt: null, senderId: { in: friendIds } }, _count: { _all: true } }),
    prisma.directMessage.findMany({
      where: { OR: [{ senderId: userId, receiverId: { in: friendIds } }, { receiverId: userId, senderId: { in: friendIds } }] },
      orderBy: { createdAt: 'desc' },
      take: 400,
      select: { senderId: true, receiverId: true, kind: true, content: true, habitTitle: true, createdAt: true },
    }),
  ]);

  return rows.map((f) => {
    const other = f.requesterId === userId ? f.receiver : f.requester;
    const today = todayOf.get(f.id)!;
    const mineToday = snaps.some((s) => s.senderId === userId && s.receiverId === other.id && s.dayKey === today);
    const theirsToday = snaps.some((s) => s.senderId === other.id && s.receiverId === userId && s.dayKey === today);
    const last = recent.find((m) => m.senderId === other.id || m.receiverId === other.id);
    const { presenceAt: _a, presenceZone: _z, privacy: _p, lastActivityDate: _l, timezone: _t, ...pub } = other;
    return {
      friendshipId: f.id,
      since: f.updatedAt.toISOString(),
      friend: { ...pub, currentStreak: effectiveActivityStreak(other, now), ...presenceOf(other, now.getTime()) },
      streak: { ...streakView(f.streakCount, f.streakBest, f.streakDay, today), mineToday, theirsToday },
      unread: unread.find((u) => u.senderId === other.id)?._count._all ?? 0,
      lastMessage: last
        ? {
          mine: last.senderId === userId,
          kind: last.kind,
          preview: last.kind === 'SNAP' ? `Foto${last.habitTitle ? ` · ${last.habitTitle}` : ''}` : (last.content ?? '').slice(0, 80),
          at: last.createdAt.toISOString(),
        }
        : null,
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
    select: { ...PUBLIC_USER, ...PRESENCE, ...STREAK, bio: true, longestStreak: true, xp: true, createdAt: true },
  });
  if (!user) throw new Error('Usuario no encontrado');
  const now = new Date();
  const isSelf = user.id === viewerId;
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
  const closest = [...friends]
    .filter((f) => f.streak.count > 0 || f.streak.best > 0)
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

// ─── Mensajes directos ────────────────────────────────────────────────────────

type DMRow = Prisma.DirectMessageGetPayload<object>;
const toMessage = (me: string) => (m: DMRow) => ({
  id: m.id,
  mine: m.senderId === me,
  kind: m.kind,
  content: m.content,
  photoUrl: m.photoUrl,
  habitTitle: m.habitTitle,
  createdAt: m.createdAt.toISOString(),
});

async function otherUser(id: string) {
  const u = await prisma.user.findUnique({ where: { id }, select: { ...PUBLIC_USER, ...PRESENCE } });
  if (!u) throw new Error('Usuario no encontrado');
  return u;
}

/**
 * Conversación con un amigo. `after` (ISO) trae solo lo nuevo para el sondeo.
 * Al leerla se marcan como vistos sus mensajes; `seenUntil` es la fecha del
 * último mensaje tuyo que vio (solo si esa persona comparte el "visto").
 */
export async function getConversation(me: string, otherId: string, after?: string) {
  const f = await requireFriends(me, otherId);
  const other = await otherUser(otherId);
  const pair = { OR: [{ senderId: me, receiverId: otherId }, { senderId: otherId, receiverId: me }] };
  const since = after ? new Date(after) : null;
  const rows = since && !Number.isNaN(since.getTime())
    ? await prisma.directMessage.findMany({ where: { ...pair, createdAt: { gt: since } }, orderBy: { createdAt: 'asc' }, take: 100 })
    : (await prisma.directMessage.findMany({ where: pair, orderBy: { createdAt: 'desc' }, take: 60 })).reverse();

  await prisma.directMessage.updateMany({ where: { senderId: otherId, receiverId: me, readAt: null }, data: { readAt: new Date() } });

  const lastSeen = privacyOf(other.privacy).readReceipts
    ? await prisma.directMessage.findFirst({ where: { senderId: me, receiverId: otherId, readAt: { not: null } }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
    : null;

  const today = dayKey(f.requester.timezone);
  const snapsToday = await prisma.directMessage.findMany({ where: { ...pair, kind: 'SNAP', dayKey: today }, select: { senderId: true } });
  const { presenceAt: _a, presenceZone: _z, privacy: _p, ...pub } = other;
  return {
    friend: { ...pub, ...presenceOf(other) },
    friendshipId: f.id,
    messages: rows.map(toMessage(me)),
    seenUntil: lastSeen?.createdAt.toISOString() ?? null,
    streak: {
      ...streakView(f.streakCount, f.streakBest, f.streakDay, today),
      mineToday: snapsToday.some((s) => s.senderId === me),
      theirsToday: snapsToday.some((s) => s.senderId === otherId),
    },
  };
}

export async function sendDirectMessage(
  me: string,
  otherId: string,
  body: { content?: unknown; photoUrl?: unknown; kind?: unknown; habitTitle?: unknown },
) {
  const f = await requireFriends(me, otherId);
  const kind = body.kind === 'SNAP' ? 'SNAP' : 'TEXT';
  const content = typeof body.content === 'string' ? body.content.trim().slice(0, 1000) : '';
  const photoUrl = body.photoUrl ? validPhoto(body.photoUrl) : null;
  const habitTitle = typeof body.habitTitle === 'string' ? body.habitTitle.trim().slice(0, 80) || null : null;
  if (kind === 'SNAP' && !photoUrl) throw new Error('La racha del día necesita una foto');
  if (kind === 'TEXT' && !content && !photoUrl) throw new Error('Mensaje vacío');

  const today = dayKey(f.requester.timezone);
  const msg = await prisma.directMessage.create({
    data: { senderId: me, receiverId: otherId, kind, content: content || null, photoUrl, habitTitle, dayKey: kind === 'SNAP' ? today : null },
  });

  let streak = streakView(f.streakCount, f.streakBest, f.streakDay, today);
  let completed = false;
  if (kind === 'SNAP' && f.streakDay !== today) {
    const theirs = await prisma.directMessage.findFirst({ where: { senderId: otherId, receiverId: me, kind: 'SNAP', dayKey: today }, select: { id: true } });
    if (theirs) {
      const next = advanceStreak(f.streakCount, f.streakBest, f.streakDay, today);
      await prisma.friendship.update({ where: { id: f.id }, data: next });
      streak = streakView(next.streakCount, next.streakBest, next.streakDay, today);
      completed = true;
    }
  }

  const sender = await prisma.user.findUniqueOrThrow({ where: { id: me }, select: { displayName: true, username: true } });
  createNotification(otherId, {
    type: 'friend',
    category: 'SOCIAL',
    dedupeKey: `dm:${me}`,
    title: kind === 'SNAP' ? `${sender.displayName} te envió su foto del día` : `Mensaje de ${sender.displayName}`,
    body: completed
      ? `¡Racha de ${streak.count} ${streak.count === 1 ? 'día' : 'días'} entre los dos!`
      : kind === 'SNAP' ? `${habitTitle ? `${habitTitle}. ` : ''}Envía la tuya para mantener la racha.` : content.slice(0, 120) || 'Te envió una foto',
    icon: 'friend',
    link: `/friends?chat=${encodeURIComponent(sender.username)}`,
  }).catch(() => null);

  return { message: toMessage(me)(msg), streak: { ...streak, mineToday: kind === 'SNAP' || undefined }, completed };
}

export async function reviveFriendStreak(me: string, friendshipId: string) {
  const f = await prisma.friendship.findUnique({ where: { id: friendshipId }, include: { requester: { select: { timezone: true } } } });
  if (!f || f.status !== 'ACCEPTED' || (f.requesterId !== me && f.receiverId !== me)) throw new Error('Amistad no encontrada');
  const today = dayKey(f.requester.timezone);
  const view = streakView(f.streakCount, f.streakBest, f.streakDay, today);
  if (!view.revivable) throw new Error('Esta racha ya no se puede revivir');
  await spendGold(me, view.reviveCost);
  // Queda viva como si ayer se hubiera completado: hoy los dos siguen con su foto.
  await prisma.friendship.update({ where: { id: f.id }, data: { streakDay: shiftKey(today, -1) } });
  const otherId = f.requesterId === me ? f.receiverId : f.requesterId;
  const who = await prisma.user.findUniqueOrThrow({ where: { id: me }, select: { displayName: true, username: true, gold: true } });
  createNotification(otherId, {
    type: 'friend', category: 'SOCIAL',
    title: 'Su racha volvió a encenderse',
    body: `${who.displayName} revivió su racha de ${f.streakCount} días. Envía tu foto de hoy.`,
    icon: 'friend', link: `/friends?chat=${encodeURIComponent(who.username)}`,
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

/**
 * Pulso social ligero (cabecera y portal): mensajes sin leer, solicitudes,
 * amigos en línea y rachas de fotos que piden tu foto hoy.
 */
export async function socialPulse(userId: string) {
  const now = new Date();
  const [rows, unread, friendRequests, guildInvites, partnerInvites] = await Promise.all([
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
  ]);
  const online: Array<PublicUser & { zone: string | null }> = [];
  let streaksWaiting = 0;
  for (const f of rows) {
    const other = f.requesterId === userId ? f.receiver : f.requester;
    const p = presenceOf(other, now.getTime());
    const { presenceAt: _a, presenceZone: _z, privacy: _p, timezone: _t, ...pub } = other;
    if (p.online) online.push({ ...pub, zone: p.zone });
    const v = streakView(f.streakCount, f.streakBest, f.streakDay, dayKey(f.requester.timezone, now));
    if (v.alive && !v.doneToday) streaksWaiting += 1;
  }
  return {
    unreadMessages: unread,
    requests: friendRequests + guildInvites + partnerInvites,
    friends: rows.length,
    onlineCount: online.length,
    online: online.slice(0, 5),
    streaksWaiting,
  };
}
