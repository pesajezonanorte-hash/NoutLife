import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { effectiveActivityStreak } from './xp.service';
import { createNotification } from './notification.service';
import {
  appActive, guildKey, holdUntil, isViewing, parseDate, reactionsFor, repliesFor, setReaction, snippet, touchView, validReaction, validReplyTo, viewing,
} from './chat-live.service';
import {
  advanceStreak, backgroundMeta, dayKey, letterLink, messagePreview, saveBackground, STREAK_MIN, streakView, TALK_KINDS, validPhoto,
} from './network.service';

/** Enlaces a la sección Social (amigos, cartas y gremios en un solo sitio). */
const guildLink = (guildId?: string) => (guildId ? `/social?tab=gremios&guild=${guildId}` : '/social?tab=gremios');
/** Directo a la carta del gremio (para los avisos de mensajes). */
const guildChatLink = (guildId: string) => `/social?tab=cartas&gchat=${guildId}`;

// La racha guardada solo se corrige cuando su dueño entra; para mostrar rachas de
// otros se calcula la vigente con su última actividad y su zona horaria.
const STREAK_FIELDS = { currentStreak: true, lastActivityDate: true, timezone: true } as const;
type StreakSource = { currentStreak: number; lastActivityDate: Date | null; timezone: string | null };
function withLiveStreak<T extends StreakSource>(u: T, now = new Date()): Omit<T, 'lastActivityDate' | 'timezone'> {
  const { lastActivityDate: _l, timezone: _t, ...rest } = u;
  return { ...rest, currentStreak: effectiveActivityStreak(u, now) };
}

// ─── Friendship ───────────────────────────────────────────────────────────────

export async function sendFriendRequest(requesterId: string, identifier: string) {
  // identifier can be username or inviteCode
  const target = await prisma.user.findFirst({
    where: { onboardingCompleted: true, OR: [{ username: identifier }, { inviteCode: identifier }] },
    select: { id: true, username: true, displayName: true, level: true, avatarConfig: true },
  });
  if (!target) throw new Error('Usuario no encontrado');
  if (target.id === requesterId) throw new Error('No puedes enviarte una solicitud a ti mismo');

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId, receiverId: target.id },
        { requesterId: target.id, receiverId: requesterId },
      ],
    },
  });
  if (existing) {
    if (existing.status === 'ACCEPTED') throw new Error('Ya son amigos');
    if (existing.status === 'PENDING') {
      // Si esa persona ya te había escrito, enviarle una solicitud la acepta.
      if (existing.requesterId === target.id) return respondFriendRequest(requesterId, existing.id, true);
      throw new Error('Ya hay una solicitud pendiente');
    }
  }

  const friendship = existing
    // REJECTED — allow resend by updating
    ? await prisma.friendship.update({ where: { id: existing.id }, data: { status: 'PENDING', requesterId, receiverId: target.id } })
    : await prisma.friendship.create({ data: { requesterId, receiverId: target.id } });

  const requester = await prisma.user.findUniqueOrThrow({ where: { id: requesterId }, select: { displayName: true, username: true } });
  createNotification(target.id, {
    type: 'friend', category: 'SOCIAL', dedupeKey: `friend-request:${requesterId}`,
    title: 'Llegó una paloma mensajera',
    body: `${requester.displayName} (@${requester.username}) quiere anotarte en su libreta de amigos.`,
    icon: 'friend', link: '/social?tab=amigos&view=requests',
  }).catch(() => null);
  return friendship;
}

export async function respondFriendRequest(userId: string, friendshipId: string, accept: boolean) {
  const f = await prisma.friendship.findUniqueOrThrow({ where: { id: friendshipId } });
  if (f.receiverId !== userId) throw new Error('No autorizado');
  if (f.status !== 'PENDING') throw new Error('Esta solicitud ya fue procesada');
  const updated = await prisma.friendship.update({
    where: { id: friendshipId },
    data: { status: accept ? 'ACCEPTED' : 'REJECTED' },
  });
  if (accept) {
    const who = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { displayName: true, username: true } });
    createNotification(f.requesterId, {
      type: 'friend', category: 'SOCIAL',
      title: `${who.displayName} aceptó tu solicitud`,
      body: 'Ya son amigos. Escríbele una carta: si hablan tres días seguidos, se enciende su racha.',
      icon: 'friend', link: letterLink(who.username),
    }).catch(() => null);
  }
  return updated;
}

export async function getFriends(userId: string) {
  const friendships = await prisma.friendship.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [{ requesterId: userId }, { receiverId: userId }],
    },
    include: {
      requester: { select: { id: true, username: true, displayName: true, level: true, ...STREAK_FIELDS, avatarConfig: true, avatarUrl: true, inviteCode: true } },
      receiver:  { select: { id: true, username: true, displayName: true, level: true, ...STREAK_FIELDS, avatarConfig: true, avatarUrl: true, inviteCode: true } },
    },
  });

  return friendships.map((f) => ({
    friendshipId: f.id,
    friend: withLiveStreak(f.requesterId === userId ? f.receiver : f.requester),
    since: f.updatedAt.toISOString(),
  }));
}

export async function getPendingRequests(userId: string) {
  return prisma.friendship.findMany({
    where: { receiverId: userId, status: 'PENDING' },
    include: {
      requester: { select: { id: true, username: true, displayName: true, level: true, avatarConfig: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function removeFriend(userId: string, friendshipId: string) {
  const f = await prisma.friendship.findUniqueOrThrow({ where: { id: friendshipId } });
  if (f.requesterId !== userId && f.receiverId !== userId) throw new Error('No autorizado');
  return prisma.friendship.delete({ where: { id: friendshipId } });
}

export async function getPublicProfile(username: string, viewerId?: string) {
  const user = await prisma.user.findFirst({
    where: { username, onboardingCompleted: true },
    select: {
      id: true, username: true, displayName: true, level: true, xp: true,
      ...STREAK_FIELDS, longestStreak: true, avatarConfig: true, inviteCode: true,
      createdAt: true,
      achievements: {
        include: { achievement: { select: { title: true, icon: true, category: true } } },
        orderBy: { unlockedAt: 'desc' },
        take: 6,
      },
    },
  });
  if (!user) throw new Error('Usuario no encontrado');

  let friendshipStatus: string | null = null;
  if (viewerId && viewerId !== user.id) {
    const f = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: viewerId, receiverId: user.id },
          { requesterId: user.id, receiverId: viewerId },
        ],
      },
    });
    friendshipStatus = f?.status ?? null;
  }

  return {
    ...withLiveStreak(user),
    createdAt: user.createdAt.toISOString(),
    achievements: user.achievements.map((ua) => ({
      ...ua.achievement,
      unlockedAt: ua.unlockedAt.toISOString(),
    })),
    friendshipStatus,
  };
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export async function getLeaderboard(
  category: 'xp' | 'streak' | 'gym',
  userId: string,
  friendsOnly = false
) {
  const friendIds = friendsOnly ? await getFriendIds(userId) : null;
  // Only accounts that finished onboarding appear in rankings.
  const whereClause = friendIds
    ? { onboardingCompleted: true, id: { in: [...friendIds, userId] } }
    : { onboardingCompleted: true };

  if (category === 'xp') {
    const users = await prisma.user.findMany({
      where: whereClause,
      orderBy: [{ level: 'desc' }, { xp: 'desc' }],
      take: 50,
      select: { id: true, username: true, displayName: true, level: true, xp: true, xpToNextLevel: true, avatarConfig: true, avatarUrl: true, equippedAura: true, equippedFrame: true, equippedHat: true },
    });
    return users.map((u, i) => ({ rank: i + 1, ...u, value: u.xp }));
  }

  if (category === 'streak') {
    // Se lee una ventana amplia y se ordena por la racha vigente: la guardada de quien
    // lleva días sin entrar sigue alta hasta que vuelve a iniciar sesión.
    const now = new Date();
    const users = await prisma.user.findMany({
      where: whereClause,
      orderBy: { currentStreak: 'desc' },
      take: 500,
      select: { id: true, username: true, displayName: true, level: true, ...STREAK_FIELDS, avatarConfig: true, avatarUrl: true, equippedAura: true, equippedFrame: true, equippedHat: true },
    });
    const live = users.map((u) => withLiveStreak(u, now));
    // Las rachas caducadas se guardan a 0, como haría reconcileUserActivityStreak al entrar.
    const stale = users.filter((u, i) => u.currentStreak > 0 && live[i].currentStreak === 0).map((u) => u.id);
    if (stale.length) prisma.user.updateMany({ where: { id: { in: stale } }, data: { currentStreak: 0 } }).catch(() => {});
    return live
      .sort((x, y) => y.currentStreak - x.currentStreak || y.level - x.level)
      .slice(0, 50)
      .map((u, i) => ({ rank: i + 1, ...u, value: u.currentStreak }));
  }

  const userScope = friendIds ? { userId: { in: [...friendIds, userId] } } : {};

  if (category === 'gym') {
    // Top by total workout sessions
    const result = await prisma.workout.groupBy({
      by: ['userId'],
      where: userScope,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 50,
    });

    const userIds = result.map((r) => r.userId);
    const users = await prisma.user.findMany({
      where: { onboardingCompleted: true, id: { in: userIds } },
      select: { id: true, username: true, displayName: true, level: true, avatarConfig: true, avatarUrl: true, equippedAura: true, equippedFrame: true, equippedHat: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));
    return result
      .filter((r) => userMap.has(r.userId))
      .map((r, i) => ({
        rank: i + 1,
        ...userMap.get(r.userId),
        value: r._count.id,
      }));
  }

  return [];
}

async function getFriendIds(userId: string): Promise<string[]> {
  const friendships = await prisma.friendship.findMany({
    where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { receiverId: userId }] },
    select: { requesterId: true, receiverId: true },
  });
  return friendships.map((f) => (f.requesterId === userId ? f.receiverId : f.requesterId));
}

// ─── Challenges ───────────────────────────────────────────────────────────────

export async function createChallenge(
  userId: string,
  data: {
    title: string;
    description?: string;
    type: string;
    targetValue: number;
    goldWager?: number;
    startDate: string;
    endDate: string;
    isPublic?: boolean;
  }
) {
  return prisma.challenge.create({
    data: {
      creatorId: userId,
      title: data.title,
      description: data.description,
      type: data.type,
      targetValue: data.targetValue,
      goldWager: data.goldWager ?? 0,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      isPublic: data.isPublic ?? false,
      participants: { create: { userId, currentValue: 0 } },
    },
    include: { participants: { include: { user: { select: { id: true, username: true, displayName: true } } } } },
  });
}

export async function joinChallenge(userId: string, challengeId: string) {
  const c = await prisma.challenge.findUniqueOrThrow({ where: { id: challengeId } });
  if (c.status !== 'ACTIVE') throw new Error('El reto ya no está activo');

  const count = await prisma.challengeParticipant.count({ where: { challengeId } });
  if (count >= 10) throw new Error('El reto está lleno (máximo 10)');

  return prisma.challengeParticipant.create({ data: { challengeId, userId } });
}

export async function getChallenges(userId: string) {
  const myChallenges = await prisma.challenge.findMany({
    where: {
      OR: [
        { creatorId: userId },
        { participants: { some: { userId } } },
        { isPublic: true, status: 'ACTIVE' },
      ],
    },
    include: {
      participants: {
        include: { user: { select: { id: true, username: true, displayName: true, level: true, avatarConfig: true } } },
        orderBy: { currentValue: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return myChallenges.map((c) => ({
    ...c,
    startDate: c.startDate.toISOString(),
    endDate: c.endDate.toISOString(),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    isParticipant: c.participants.some((p) => p.userId === userId),
    myProgress: c.participants.find((p) => p.userId === userId)?.currentValue ?? null,
  }));
}

// ─── Guilds ───────────────────────────────────────────────────────────────────
//
// Una persona puede estar en varios gremios (como grupos) y cada uno tiene su
// carta compartida. La primera foto de hoy de cada miembro (tomada con la
// cámara) daña al enemigo del día; cae cuando todos enviaron la suya. La racha
// del gremio suma un día cuando todos escriben y se enciende al tercer día.

/** Gremios por persona y aventureros por gremio. */
export const MAX_GUILDS = 5;
export const MAX_MEMBERS = 10;
/** Vida que cada miembro aporta al enemigo del día (y daño de su foto). */
const ENEMY_HP_PER_MEMBER = 100;

const ENEMIES = [
  'Titán del Sofá', 'Dragón de la Pereza', 'Espectro del "Mañana"', 'Gólem de la Rutina',
  'Sirena del Scroll', 'Hidra de las Excusas', 'Lich del Desvelo', 'Ogro del Azúcar',
  'Kraken del Caos', 'Basilisco de la Duda',
];

function enemyOf(guildId: string, day: string) {
  let h = 0;
  for (const ch of `${guildId}:${day}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ENEMIES[h % ENEMIES.length];
}

function generateGuildCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/** Foto del gremio: data URL de imagen (el cliente la recorta y la reduce a 384 px). */
const GUILD_PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const GUILD_PHOTO_MAX = 400_000;

/** undefined = no cambia · null = quitar la foto · string = foto válida. */
function guildPhoto(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > GUILD_PHOTO_MAX || !GUILD_PHOTO.test(value)) {
    throw new Error('La foto debe ser una imagen JPEG, PNG o WebP de menos de 300 kB.');
  }
  return value;
}

async function assertCanJoinAnother(userId: string) {
  const count = await prisma.guildMember.count({ where: { userId } });
  if (count >= MAX_GUILDS) throw new Error(`Puedes estar en ${MAX_GUILDS} gremios como máximo`);
}

async function requireMember(userId: string, guildId: string) {
  const member = await prisma.guildMember.findFirst({ where: { userId, guildId } });
  if (!member) throw new Error('No perteneces a este gremio');
  return member;
}

export async function createGuild(
  userId: string,
  data: { name: string; description?: string; emblem?: string; photoUrl?: unknown }
) {
  await assertCanJoinAnother(userId);
  const photoUrl = guildPhoto(data.photoUrl) ?? null;

  return prisma.guild.create({
    data: {
      name: data.name,
      description: data.description,
      emblem: data.emblem ?? 'shield',
      photoUrl,
      leaderId: userId,
      inviteCode: generateGuildCode(),
      members: { create: { userId, role: 'LEADER' } },
    },
    include: { members: { include: { user: { select: { id: true, username: true, displayName: true, level: true } } } } },
  });
}

/** Cambiar o quitar la foto del gremio: solo quien lo lidera (o un oficial). */
export async function updateGuild(userId: string, guildId: string, data: { photoUrl?: unknown }) {
  const member = await prisma.guildMember.findFirst({ where: { userId, guildId }, include: { guild: { select: { leaderId: true } } } });
  if (!member) throw new Error('No perteneces a este gremio');
  if (member.guild.leaderId !== userId && member.role !== 'LEADER' && member.role !== 'OFFICER') {
    throw new Error('Solo quien lidera el gremio puede cambiar su foto');
  }
  const photoUrl = guildPhoto(data.photoUrl);
  if (photoUrl === undefined) throw new Error('No hay cambios que guardar');
  return prisma.guild.update({ where: { id: guildId }, data: { photoUrl }, select: { id: true, photoUrl: true } });
}

async function addMember(userId: string, guildId: string) {
  const already = await prisma.guildMember.findFirst({ where: { userId, guildId } });
  if (already) throw new Error('Ya perteneces a este gremio');
  await assertCanJoinAnother(userId);
  const memberCount = await prisma.guildMember.count({ where: { guildId } });
  if (memberCount >= MAX_MEMBERS) throw new Error(`El gremio está lleno (máximo ${MAX_MEMBERS})`);
  return prisma.guildMember.create({ data: { guildId, userId, role: 'MEMBER' } });
}

export async function joinGuild(userId: string, inviteCode: string) {
  const guild = await prisma.guild.findUnique({ where: { inviteCode: inviteCode.toUpperCase() } });
  if (!guild) throw new Error('Código de gremio inválido');
  return addMember(userId, guild.id);
}

/** Día del gremio (zona horaria de quien lo lidera) y estado de su racha. */
async function guildDay(guild: { id: string; leaderId: string; streakCount: number; streakBest: number; streakDay: string | null }) {
  const leader = await prisma.user.findUnique({ where: { id: guild.leaderId }, select: { timezone: true } });
  const today = dayKey(leader?.timezone);
  return { today, streak: streakView(guild.streakCount, guild.streakBest, guild.streakDay, today) };
}

/**
 * Tus gremios, para el selector y la bandeja de cartas: su racha, cuántos
 * atacaron hoy al enemigo, si ya escribiste hoy, la última carta y las sin leer.
 */
export async function getMyGuilds(userId: string) {
  const memberships = await prisma.guildMember.findMany({
    where: { userId },
    include: { guild: { include: { _count: { select: { members: true } } } } },
    orderBy: { joinedAt: 'asc' },
  });
  return Promise.all(memberships.map(async ({ guild, role, joinedAt, lastReadAt }) => {
    const { today, streak } = await guildDay(guild);
    const [snapped, talked, last, unread] = await Promise.all([
      prisma.guildMessage.findMany({ where: { guildId: guild.id, kind: 'SNAP', dayKey: today }, distinct: ['userId'], select: { userId: true } }),
      prisma.guildMessage.findFirst({ where: { guildId: guild.id, userId, kind: { in: TALK_KINDS }, dayKey: today }, select: { id: true } }),
      prisma.guildMessage.findFirst({ where: { guildId: guild.id }, orderBy: { createdAt: 'desc' }, select: { userId: true, kind: true, content: true, createdAt: true, user: { select: { displayName: true } } } }),
      prisma.guildMessage.count({ where: { guildId: guild.id, userId: { not: userId }, createdAt: { gt: lastReadAt ?? joinedAt } } }),
    ]);
    return {
      id: guild.id, name: guild.name, emblem: guild.emblem, photoUrl: guild.photoUrl, level: guild.level, role,
      members: guild._count.members, streak, snappedToday: snapped.length,
      /** Tu foto de hoy ya golpeó al enemigo. */
      mineToday: snapped.some((s) => s.userId === userId),
      talkedToday: Boolean(talked),
      unread,
      lastMessage: last
        ? { mine: last.userId === userId, author: last.user.displayName, kind: last.kind, preview: messagePreview(last), at: last.createdAt.toISOString() }
        : null,
    };
  }));
}

export async function getGuild(userId: string, guildId: string) {
  await requireMember(userId, guildId);
  const guild = await prisma.guild.findUniqueOrThrow({
    where: { id: guildId },
    include: {
      members: {
        include: {
          user: { select: { id: true, username: true, displayName: true, level: true, ...STREAK_FIELDS, xp: true, avatarConfig: true, avatarUrl: true, equippedAura: true, equippedFrame: true, equippedHat: true } },
        },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });
  const now = new Date();
  const { today, streak } = await guildDay(guild);
  const [snaps, talked, bg] = await Promise.all([
    prisma.guildMessage.findMany({ where: { guildId, kind: 'SNAP', dayKey: today }, orderBy: { createdAt: 'asc' }, select: { userId: true } }),
    prisma.guildMessage.findMany({ where: { guildId, kind: { in: TALK_KINDS }, dayKey: today }, distinct: ['userId'], select: { userId: true } }),
    prisma.chatBackground.findUnique({ where: { guildId }, select: { fit: true, setById: true, updatedAt: true } }),
  ]);
  const snappedIds = [...new Set(snaps.map((s) => s.userId))];
  const maxHp = Math.max(1, guild.members.length) * ENEMY_HP_PER_MEMBER;
  return {
    ...guild,
    members: guild.members.map((m) => ({ ...m, user: withLiveStreak(m.user, now), snappedToday: snappedIds.includes(m.userId) })),
    today: {
      day: today,
      snappedUserIds: snappedIds,
      talkedUserIds: talked.map((t) => t.userId),
      enemy: { name: enemyOf(guild.id, today), maxHp, hp: Math.max(0, maxHp - snappedIds.length * ENEMY_HP_PER_MEMBER), defeated: snappedIds.length >= guild.members.length },
    },
    streak,
    background: backgroundMeta(bg, userId),
  };
}

/** Compatibilidad: el primer gremio de la persona (o null). */
export async function getMyGuild(userId: string) {
  const first = await prisma.guildMember.findFirst({ where: { userId }, orderBy: { joinedAt: 'asc' }, select: { guildId: true } });
  return first ? getGuild(userId, first.guildId) : null;
}

const MESSAGE_USER = { select: { id: true, username: true, displayName: true, avatarConfig: true, avatarUrl: true, equippedAura: true, equippedFrame: true, equippedHat: true } } as const;

/** Marca leída la carta del gremio hasta ahora (para las cartas sin leer). */
function markGuildRead(userId: string, guildId: string) {
  return prisma.guildMember.updateMany({ where: { userId, guildId }, data: { lastReadAt: new Date() } }).catch(() => null);
}

export async function getGuildMessages(userId: string, guildId: string, limit = 50, after?: string, peek = false) {
  await requireMember(userId, guildId);
  const since = after ? new Date(after) : null;
  const polling = Boolean(since && !Number.isNaN(since.getTime()));
  const messages = polling
    ? await prisma.guildMessage.findMany({ where: { guildId, createdAt: { gt: since! } }, include: { user: MESSAGE_USER }, orderBy: { createdAt: 'asc' }, take: limit })
    : (await prisma.guildMessage.findMany({ where: { guildId }, include: { user: MESSAGE_USER }, orderBy: { createdAt: 'desc' }, take: limit })).reverse();

  // Leer la carta la deja al día: al abrirla y cuando llega algo nuevo de otros.
  if (!peek && (!polling || messages.some((m) => m.userId !== userId))) await markGuildRead(userId, guildId);

  return guildDtos(userId, guildId, messages);
}

type GuildRow = Prisma.GuildMessageGetPayload<{ include: { user: typeof MESSAGE_USER } }>;
/** Mensajes del gremio listos para el cliente: con reacciones y el mensaje al que responden. */
async function guildDtos(userId: string, guildId: string, messages: GuildRow[]) {
  const [reactions, replies] = await Promise.all([
    reactionsFor('guild', messages.map((m) => m.id), userId),
    repliesFor('guild', messages, { guildId }),
  ]);
  return messages.map(({ reactedAt: _r, replyToId, ...m }) => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
    replyTo: (replyToId && replies.get(replyToId)) || null,
    reactions: reactions.get(m.id) ?? [],
  }));
}

/** Reacciona (o quita la reacción) a un mensaje de la carta del gremio. */
export async function reactGuild(userId: string, guildId: string, messageId: string, emoji: unknown) {
  await requireMember(userId, guildId);
  const wanted = validReaction(emoji);
  const m = await prisma.guildMessage.findFirst({ where: { id: messageId, guildId, kind: { not: 'EVENT' } }, select: { id: true, userId: true, kind: true, content: true } });
  if (!m) throw new Error('Mensaje no encontrado');
  const r = await setReaction('guild', m.id, userId, wanted);
  if (r.emoji && m.userId !== userId && !(await isViewing(m.userId, guildKey(guildId)))) {
    const [who, guild] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } }),
      prisma.guild.findUnique({ where: { id: guildId }, select: { name: true } }),
    ]);
    if (who && guild) {
      const inApp = await appActive(m.userId);
      createNotification(m.userId, {
        type: 'guild', category: 'SOCIAL', dedupeKey: `guild-react:${guildId}:${userId}`,
        title: `${who.displayName} reaccionó ${r.emoji} en ${guild.name}`, body: snippet(m, 90), icon: 'guild', link: guildChatLink(guildId),
      }, { push: !inApp }).catch(() => null);
    }
  }
  return { id: m.id, ...r };
}

/** Carta del gremio en vivo: espera ~8 s y responde cuando hay mensajes o reacciones nuevas. */
export async function liveGuildMessages(userId: string, guildId: string, q: { after?: unknown; since?: unknown; wait?: boolean }) {
  await requireMember(userId, guildId);
  const after = parseDate(q.after);
  const since = parseDate(q.since) ?? new Date();
  const stamp = new Date();
  await touchView(userId, guildKey(guildId));

  const changed = await holdUntil(async () => {
    const [fresh, reacted] = await Promise.all([
      after ? prisma.guildMessage.findFirst({ where: { guildId, createdAt: { gt: after } }, select: { id: true } }) : null,
      prisma.guildMessage.findFirst({ where: { guildId, reactedAt: { gt: since } }, select: { id: true } }),
    ]);
    return fresh || reacted ? true : null;
  }, q.wait === true);
  if (!changed) return { changed: false as const, cursor: stamp.toISOString(), messages: [], reacted: [] };

  const messages = await getGuildMessages(userId, guildId, 50, after?.toISOString());
  const reactedRows = await prisma.guildMessage.findMany({ where: { guildId, reactedAt: { gt: since } }, select: { id: true } });
  const reactions = await reactionsFor('guild', reactedRows.map((r) => r.id), userId);
  return {
    changed: true as const,
    cursor: stamp.toISOString(),
    messages,
    reacted: reactedRows.map((r) => ({ id: r.id, reactions: reactions.get(r.id) ?? [] })),
  };
}

export async function sendGuildMessage(
  userId: string,
  guildId: string,
  content: string,
  extra: { kind?: unknown; photoUrl?: unknown; replyToId?: unknown } = {},
) {
  await requireMember(userId, guildId);
  // SNAP: foto tomada en el momento con la cámara.
  const kind = extra.kind === 'SNAP' ? 'SNAP' : 'TEXT';
  const text = (content ?? '').trim();
  const photoUrl = kind === 'SNAP' && extra.photoUrl ? validPhoto(extra.photoUrl) : null;
  if (kind === 'SNAP' && !photoUrl) throw new Error('La foto no llegó. Vuelve a tomarla.');
  if (kind === 'TEXT' && !text) throw new Error('Mensaje vacío');
  if (text.length > 500) throw new Error('Mensaje demasiado largo');

  const guild = await prisma.guild.findUniqueOrThrow({ where: { id: guildId }, include: { members: { select: { userId: true } } } });
  const { today } = await guildDay(guild);
  // ¿Ya había golpeado hoy al enemigo? Solo cuenta su primera foto de hoy.
  const attackedBefore = kind === 'SNAP'
    ? Boolean(await prisma.guildMessage.findFirst({ where: { guildId, userId, kind: 'SNAP', dayKey: today }, select: { id: true } }))
    : true;
  const replyToId = await validReplyTo('guild', extra.replyToId, { guildId });
  const message = await prisma.guildMessage.create({
    data: { guildId, userId, content: text, kind, photoUrl, dayKey: today, replyToId },
    include: { user: MESSAGE_USER },
  });
  void markGuildRead(userId, guildId);

  // Aviso a los demás miembros, salvo a quien tiene esta carta abierta; a quien tiene la app
  // abierta le sale dentro de ella (con respuesta rápida), no como push del sistema.
  const others = guild.members.map((m) => m.userId).filter((id) => id !== userId);
  const [reading, inApp] = await Promise.all([viewing(others, guildKey(guildId)), viewing(others, 'app', 20_000)]);
  const sender = message.user.displayName;
  for (const id of others) {
    if (reading.has(id)) continue;
    createNotification(id, {
      type: 'guild', category: 'SOCIAL', dedupeKey: `guild-msg:${guildId}`,
      title: guild.name,
      body: `${sender}: ${snippet({ kind, content: text }, 100)}`,
      icon: 'guild', link: guildChatLink(guildId),
      reply: { type: 'guild', id: guildId },
    }, { push: !inApp.has(id) }).catch(() => null);
  }

  // El enemigo cae con la última foto que faltaba: XP para el gremio.
  let enemyDefeated = false;
  if (!attackedBefore) {
    const snapped = await prisma.guildMessage.findMany({ where: { guildId, kind: 'SNAP', dayKey: today }, distinct: ['userId'], select: { userId: true } });
    if (guild.members.every((m) => snapped.some((s) => s.userId === m.userId))) {
      enemyDefeated = true;
      await prisma.guild.update({ where: { id: guildId }, data: { xp: { increment: 50 * guild.members.length } } });
      for (const m of guild.members) {
        createNotification(m.userId, {
          type: 'guild', category: 'SOCIAL', dedupeKey: `guild-enemy:${guildId}`,
          title: `${guild.name}: ¡enemigo derrotado!`,
          body: 'Todos enviaron una foto hoy. Mañana llega otro enemigo.',
          icon: 'guild', link: guildLink(guildId),
        }).catch(() => null);
      }
    }
  }

  // La racha suma cuando todos escribieron hoy; se enciende al tercer día.
  let streak = streakView(guild.streakCount, guild.streakBest, guild.streakDay, today);
  let streakCompleted = false;
  if (guild.streakDay !== today) {
    const talked = await prisma.guildMessage.findMany({ where: { guildId, kind: { in: TALK_KINDS }, dayKey: today }, distinct: ['userId'], select: { userId: true } });
    if (guild.members.every((m) => talked.some((t) => t.userId === m.userId))) {
      const next = advanceStreak(guild.streakCount, guild.streakBest, guild.streakDay, today);
      await prisma.guild.update({ where: { id: guildId }, data: next });
      streak = streakView(next.streakCount, next.streakBest, next.streakDay, today);
      streakCompleted = true;
      if (next.streakCount === STREAK_MIN) {
        for (const m of guild.members) {
          createNotification(m.userId, {
            type: 'guild', category: 'SOCIAL', dedupeKey: `guild-streak:${guildId}`,
            title: `${guild.name}: ¡se encendió su racha!`,
            body: `Llevan ${STREAK_MIN} días seguidos escribiéndose todos. Que no se apague.`,
            icon: 'guild', link: guildLink(guildId),
          }).catch(() => null);
        }
      }
    }
  }

  const [dto] = await guildDtos(userId, guildId, [message]);
  return { ...dto, enemyDefeated, streakCompleted, streak };
}

/** La foto del fondo de la carta del gremio (se pide aparte: pesa). */
export async function getGuildBackground(userId: string, guildId: string) {
  await requireMember(userId, guildId);
  const bg = await prisma.chatBackground.findUnique({ where: { guildId } });
  return bg ? { photoUrl: bg.photoUrl, ...backgroundMeta(bg, userId)! } : null;
}

/** Cualquier miembro puede cambiar el fondo; todos lo ven y queda un aviso en la carta. */
export async function setGuildBackground(userId: string, guildId: string, body: { photoUrl?: unknown; fit?: unknown }) {
  await requireMember(userId, guildId);
  const { row, event } = await saveBackground({ guildId }, userId, body);
  if (event) {
    await prisma.guildMessage.create({ data: { guildId, userId, kind: 'EVENT', content: event } });
    void markGuildRead(userId, guildId);
  }
  return { background: backgroundMeta(row, userId) };
}

export async function leaveGuild(userId: string, guildId: string) {
  const member = await requireMember(userId, guildId);

  const guild = await prisma.guild.findUniqueOrThrow({ where: { id: guildId } });
  if (guild.leaderId === userId) {
    const others = await prisma.guildMember.findFirst({
      where: { guildId, userId: { not: userId } },
      orderBy: { joinedAt: 'asc' },
    });
    if (others) {
      // Transfer leadership
      await prisma.guild.update({
        where: { id: guildId },
        data: { leaderId: others.userId },
      });
      await prisma.guildMember.update({
        where: { id: others.id },
        data: { role: 'LEADER' },
      });
    } else {
      // Last member — delete guild
      await prisma.guild.delete({ where: { id: guildId } });
      return;
    }
  }

  await prisma.guildMember.delete({ where: { id: member.id } });
}

// ─── Guild invites ────────────────────────────────────────────────────────────

export async function inviteToGuild(userId: string, guildId: string, inviteeId: string) {
  await requireMember(userId, guildId);
  const friends = await getFriendIds(userId);
  if (!friends.includes(inviteeId)) throw new Error('Solo puedes invitar a tus amigos');
  if (await prisma.guildMember.findFirst({ where: { guildId, userId: inviteeId } })) throw new Error('Ya está en el gremio');
  const guild = await prisma.guild.findUniqueOrThrow({ where: { id: guildId }, include: { _count: { select: { members: true } } } });
  if (guild._count.members >= MAX_MEMBERS) throw new Error(`El gremio está lleno (máximo ${MAX_MEMBERS})`);

  const invite = await prisma.guildInvite.upsert({
    where: { guildId_inviteeId: { guildId, inviteeId } },
    create: { guildId, inviterId: userId, inviteeId },
    update: { inviterId: userId, status: 'PENDING', createdAt: new Date() },
  });
  const inviter = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { displayName: true } });
  createNotification(inviteeId, {
    type: 'guild', category: 'SOCIAL', dedupeKey: `guild-invite:${guildId}`,
    title: `Invitación a ${guild.name}`,
    body: `${inviter.displayName} te envió una paloma: te invita a su gremio.`,
    icon: 'guild', link: guildLink(),
  }).catch(() => null);
  return invite;
}

export async function getGuildInvites(userId: string) {
  const invites = await prisma.guildInvite.findMany({
    where: { inviteeId: userId, status: 'PENDING' },
    include: {
      guild: { select: { id: true, name: true, emblem: true, photoUrl: true, level: true, _count: { select: { members: true } } } },
      inviter: { select: { id: true, username: true, displayName: true, avatarConfig: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return invites.map((i) => ({ ...i, createdAt: i.createdAt.toISOString() }));
}

export async function respondGuildInvite(userId: string, inviteId: string, accept: boolean) {
  const invite = await prisma.guildInvite.findFirst({ where: { id: inviteId, inviteeId: userId, status: 'PENDING' }, include: { guild: { select: { name: true } } } });
  if (!invite) throw new Error('Esta invitación ya no está disponible');
  if (accept) await addMember(userId, invite.guildId);
  await prisma.guildInvite.update({ where: { id: invite.id }, data: { status: accept ? 'ACCEPTED' : 'REJECTED' } });
  if (accept) {
    const who = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { displayName: true } });
    createNotification(invite.inviterId, {
      type: 'guild', category: 'SOCIAL', title: `${who.displayName} se unió a ${invite.guild.name}`,
      body: 'Ya puede escribir en la carta del gremio.', icon: 'guild', link: guildLink(invite.guildId),
    }).catch(() => null);
  }
  return { guildId: invite.guildId, accepted: accept };
}
