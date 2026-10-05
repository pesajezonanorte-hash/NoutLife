import { prisma } from '../lib/prisma';
import { effectiveActivityStreak } from './xp.service';
import { createNotification } from './notification.service';
import { advanceStreak, dayKey, streakView, validPhoto } from './network.service';

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
    title: 'Nueva solicitud de amistad',
    body: `${requester.displayName} (@${requester.username}) quiere ser tu amigo.`,
    icon: 'friend', link: '/friends?tab=requests',
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
      body: 'Ya son amigos. Envíale tu foto del día para empezar una racha.',
      icon: 'friend', link: `/friends?chat=${encodeURIComponent(who.username)}`,
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
// Una persona puede estar en varios gremios (como grupos). Cada día cada miembro
// envía una foto haciendo un hábito: cada foto daña al enemigo del día y, cuando
// todos envían la suya, la racha del gremio suma un día.

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

/** Tus gremios, para el selector: con su racha y cuántos enviaron foto hoy. */
export async function getMyGuilds(userId: string) {
  const memberships = await prisma.guildMember.findMany({
    where: { userId },
    include: { guild: { include: { _count: { select: { members: true } } } } },
    orderBy: { joinedAt: 'asc' },
  });
  return Promise.all(memberships.map(async ({ guild, role }) => {
    const { today, streak } = await guildDay(guild);
    const snapped = await prisma.guildMessage.findMany({ where: { guildId: guild.id, kind: 'SNAP', dayKey: today }, distinct: ['userId'], select: { userId: true } });
    return {
      id: guild.id, name: guild.name, emblem: guild.emblem, photoUrl: guild.photoUrl, level: guild.level, role,
      members: guild._count.members, streak, snappedToday: snapped.length, mineToday: snapped.some((s) => s.userId === userId),
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
  const snaps = await prisma.guildMessage.findMany({
    where: { guildId, kind: 'SNAP', dayKey: today },
    orderBy: { createdAt: 'asc' },
    select: { id: true, userId: true, photoUrl: true, content: true, createdAt: true },
  });
  const snappedIds = [...new Set(snaps.map((s) => s.userId))];
  const maxHp = Math.max(1, guild.members.length) * ENEMY_HP_PER_MEMBER;
  return {
    ...guild,
    members: guild.members.map((m) => ({ ...m, user: withLiveStreak(m.user, now), snappedToday: snappedIds.includes(m.userId) })),
    today: {
      day: today,
      snappedUserIds: snappedIds,
      enemy: { name: enemyOf(guild.id, today), maxHp, hp: Math.max(0, maxHp - snappedIds.length * ENEMY_HP_PER_MEMBER), defeated: snappedIds.length >= guild.members.length },
    },
    streak,
  };
}

/** Compatibilidad: el primer gremio de la persona (o null). */
export async function getMyGuild(userId: string) {
  const first = await prisma.guildMember.findFirst({ where: { userId }, orderBy: { joinedAt: 'asc' }, select: { guildId: true } });
  return first ? getGuild(userId, first.guildId) : null;
}

const MESSAGE_USER = { select: { id: true, username: true, displayName: true, avatarConfig: true, avatarUrl: true, equippedAura: true, equippedFrame: true, equippedHat: true } } as const;

export async function getGuildMessages(userId: string, guildId: string, limit = 50, after?: string) {
  await requireMember(userId, guildId);
  const since = after ? new Date(after) : null;
  const messages = since && !Number.isNaN(since.getTime())
    ? await prisma.guildMessage.findMany({ where: { guildId, createdAt: { gt: since } }, include: { user: MESSAGE_USER }, orderBy: { createdAt: 'asc' }, take: limit })
    : (await prisma.guildMessage.findMany({ where: { guildId }, include: { user: MESSAGE_USER }, orderBy: { createdAt: 'desc' }, take: limit })).reverse();

  return messages.map((m) => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
  }));
}

export async function sendGuildMessage(
  userId: string,
  guildId: string,
  content: string,
  extra: { kind?: unknown; photoUrl?: unknown } = {},
) {
  await requireMember(userId, guildId);
  const kind = extra.kind === 'SNAP' ? 'SNAP' : 'TEXT';
  const text = (content ?? '').trim();
  const photoUrl = extra.photoUrl ? validPhoto(extra.photoUrl) : null;
  if (kind === 'SNAP' && !photoUrl) throw new Error('La foto del día necesita una imagen');
  if (kind === 'TEXT' && !text && !photoUrl) throw new Error('Mensaje vacío');
  if (text.length > 500) throw new Error('Mensaje demasiado largo');

  const guild = await prisma.guild.findUniqueOrThrow({ where: { id: guildId }, include: { members: { select: { userId: true } } } });
  const { today } = await guildDay(guild);
  const message = await prisma.guildMessage.create({
    data: { guildId, userId, content: text, kind, photoUrl, dayKey: kind === 'SNAP' ? today : null },
    include: { user: MESSAGE_USER },
  });

  let streakCompleted = false;
  if (kind === 'SNAP' && guild.streakDay !== today) {
    const snapped = await prisma.guildMessage.findMany({ where: { guildId, kind: 'SNAP', dayKey: today }, distinct: ['userId'], select: { userId: true } });
    const all = guild.members.every((m) => snapped.some((s) => s.userId === m.userId));
    if (all) {
      const next = advanceStreak(guild.streakCount, guild.streakBest, guild.streakDay, today);
      await prisma.guild.update({ where: { id: guildId }, data: { ...next, xp: { increment: 50 * guild.members.length } } });
      streakCompleted = true;
      for (const m of guild.members) {
        createNotification(m.userId, {
          type: 'guild', category: 'SOCIAL', dedupeKey: `guild-streak:${guildId}`,
          title: `${guild.name}: ¡enemigo derrotado!`,
          body: `Todos enviaron su foto. Racha del gremio: ${next.streakCount} ${next.streakCount === 1 ? 'día' : 'días'}.`,
          icon: 'guild', link: `/guild?id=${guildId}`,
        }).catch(() => null);
      }
    }
  }

  return { ...message, createdAt: message.createdAt.toISOString(), streakCompleted };
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
    body: `${inviter.displayName} te invitó a su gremio.`,
    icon: 'guild', link: '/guild?invites=1',
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
      body: 'Ya puede enviar su foto del día con el gremio.', icon: 'guild', link: `/guild?id=${invite.guildId}`,
    }).catch(() => null);
  }
  return { guildId: invite.guildId, accepted: accept };
}
