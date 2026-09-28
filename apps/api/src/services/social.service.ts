import { prisma } from '../lib/prisma';

// ─── Friendship ───────────────────────────────────────────────────────────────

export async function sendFriendRequest(requesterId: string, identifier: string) {
  // identifier can be username or inviteCode
  const target = await prisma.user.findFirst({
    where: { OR: [{ username: identifier }, { inviteCode: identifier }] },
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
    if (existing.status === 'PENDING') throw new Error('Ya hay una solicitud pendiente');
    // REJECTED — allow resend by updating
    if (existing.status === 'REJECTED') {
      return prisma.friendship.update({
        where: { id: existing.id },
        data: { status: 'PENDING', requesterId, receiverId: target.id },
      });
    }
  }

  return prisma.friendship.create({ data: { requesterId, receiverId: target.id } });
}

export async function respondFriendRequest(userId: string, friendshipId: string, accept: boolean) {
  const f = await prisma.friendship.findUniqueOrThrow({ where: { id: friendshipId } });
  if (f.receiverId !== userId) throw new Error('No autorizado');
  if (f.status !== 'PENDING') throw new Error('Esta solicitud ya fue procesada');
  return prisma.friendship.update({
    where: { id: friendshipId },
    data: { status: accept ? 'ACCEPTED' : 'REJECTED' },
  });
}

export async function getFriends(userId: string) {
  const friendships = await prisma.friendship.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [{ requesterId: userId }, { receiverId: userId }],
    },
    include: {
      requester: { select: { id: true, username: true, displayName: true, level: true, currentStreak: true, avatarConfig: true, avatarUrl: true, inviteCode: true } },
      receiver:  { select: { id: true, username: true, displayName: true, level: true, currentStreak: true, avatarConfig: true, avatarUrl: true, inviteCode: true } },
    },
  });

  return friendships.map((f) => ({
    friendshipId: f.id,
    friend: f.requesterId === userId ? f.receiver : f.requester,
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
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true, username: true, displayName: true, level: true, xp: true,
      currentStreak: true, longestStreak: true, avatarConfig: true, inviteCode: true,
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
    ...user,
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
  category: 'xp' | 'streak' | 'gym' | 'savings',
  userId: string,
  friendsOnly = false
) {
  const friendIds = friendsOnly ? await getFriendIds(userId) : null;
  const whereClause = friendIds ? { id: { in: [...friendIds, userId] } } : {};

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
    const users = await prisma.user.findMany({
      where: whereClause,
      orderBy: { currentStreak: 'desc' },
      take: 50,
      select: { id: true, username: true, displayName: true, level: true, currentStreak: true, avatarConfig: true, avatarUrl: true, equippedAura: true, equippedFrame: true, equippedHat: true },
    });
    return users.map((u, i) => ({ rank: i + 1, ...u, value: u.currentStreak }));
  }

  if (category === 'gym') {
    // Top by total workout sessions
    const result = await prisma.workout.groupBy({
      by: ['userId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 50,
    });

    const userIds = result.map((r) => r.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, displayName: true, level: true, avatarConfig: true, avatarUrl: true, equippedAura: true, equippedFrame: true, equippedHat: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));
    return result
      .map((r, i) => ({
        rank: i + 1,
        ...userMap.get(r.userId),
        value: r._count.id,
      }))
      .filter((r) => r.username);
  }

  if (category === 'savings') {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const txs = await prisma.transaction.findMany({
      where: { date: { gte: startOfMonth } },
      select: { userId: true, type: true, amount: true },
    });

    const byUser = new Map<string, { income: number; expenses: number }>();
    for (const t of txs) {
      if (!byUser.has(t.userId)) byUser.set(t.userId, { income: 0, expenses: 0 });
      const entry = byUser.get(t.userId)!;
      if (t.type === 'INCOME') entry.income += Number(t.amount);
      else entry.expenses += Number(t.amount);
    }

    const ranked = Array.from(byUser.entries())
      .map(([uid, { income, expenses }]) => ({
        userId: uid,
        savingsPct: income > 0 ? Math.round(((income - expenses) / income) * 100) : 0,
      }))
      .filter((r) => r.savingsPct > 0)
      .sort((a, b) => b.savingsPct - a.savingsPct)
      .slice(0, 50);

    const userIds = ranked.map((r) => r.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, displayName: true, level: true, avatarConfig: true, avatarUrl: true, equippedAura: true, equippedFrame: true, equippedHat: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));
    return ranked.map((r, i) => ({
      rank: i + 1,
      ...userMap.get(r.userId),
      value: r.savingsPct,
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

// ─── Guild ────────────────────────────────────────────────────────────────────

function generateGuildCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function createGuild(
  userId: string,
  data: { name: string; description?: string; emblem?: string }
) {
  const existing = await prisma.guildMember.findUnique({ where: { userId } });
  if (existing) throw new Error('Ya perteneces a un gremio');

  return prisma.guild.create({
    data: {
      name: data.name,
      description: data.description,
      emblem: data.emblem ?? 'shield',
      leaderId: userId,
      inviteCode: generateGuildCode(),
      members: { create: { userId, role: 'LEADER' } },
    },
    include: { members: { include: { user: { select: { id: true, username: true, displayName: true, level: true } } } } },
  });
}

export async function joinGuild(userId: string, inviteCode: string) {
  const guild = await prisma.guild.findUnique({ where: { inviteCode } });
  if (!guild) throw new Error('Código de gremio inválido');

  const memberCount = await prisma.guildMember.count({ where: { guildId: guild.id } });
  if (memberCount >= 10) throw new Error('El gremio está lleno (máximo 10)');

  const existing = await prisma.guildMember.findUnique({ where: { userId } });
  if (existing) throw new Error('Ya perteneces a un gremio');

  return prisma.guildMember.create({ data: { guildId: guild.id, userId, role: 'MEMBER' } });
}

export async function getMyGuild(userId: string) {
  const membership = await prisma.guildMember.findUnique({
    where: { userId },
    include: {
      guild: {
        include: {
          members: {
            include: {
              user: { select: { id: true, username: true, displayName: true, level: true, currentStreak: true, xp: true, avatarConfig: true, avatarUrl: true, equippedAura: true, equippedFrame: true, equippedHat: true } },
            },
            orderBy: { joinedAt: 'asc' },
          },
        },
      },
    },
  });

  return membership?.guild ?? null;
}

export async function getGuildMessages(userId: string, guildId: string, limit = 50) {
  const member = await prisma.guildMember.findFirst({ where: { userId, guildId } });
  if (!member) throw new Error('No perteneces a este gremio');

  const messages = await prisma.guildMessage.findMany({
    where: { guildId },
    include: { user: { select: { id: true, username: true, displayName: true, avatarConfig: true, avatarUrl: true, equippedAura: true, equippedFrame: true, equippedHat: true } } },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  return messages.map((m) => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
  }));
}

export async function sendGuildMessage(userId: string, guildId: string, content: string) {
  const member = await prisma.guildMember.findFirst({ where: { userId, guildId } });
  if (!member) throw new Error('No perteneces a este gremio');
  if (!content.trim()) throw new Error('Mensaje vacío');
  if (content.length > 500) throw new Error('Mensaje demasiado largo');

  return prisma.guildMessage.create({
    data: { guildId, userId, content: content.trim() },
    include: { user: { select: { id: true, username: true, displayName: true, avatarConfig: true, avatarUrl: true, equippedAura: true, equippedFrame: true, equippedHat: true } } },
  });
}

export async function leaveGuild(userId: string, guildId: string) {
  const member = await prisma.guildMember.findFirst({ where: { userId, guildId } });
  if (!member) throw new Error('No perteneces a este gremio');

  const guild = await prisma.guild.findUniqueOrThrow({ where: { id: guildId } });
  if (guild.leaderId === userId) {
    const others = await prisma.guildMember.findFirst({
      where: { guildId, userId: { not: userId } },
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
