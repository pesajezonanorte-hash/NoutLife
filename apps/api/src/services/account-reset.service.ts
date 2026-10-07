import { prisma } from '../lib/prisma';

export interface AccountResetSummary {
  deleted: Record<string, number>;
  sharedChallengesCancelled: number;
  guildsDeleted: number;
  guildLeadershipsTransferred: number;
  user: {
    level: number;
    xp: number;
    gold: number;
    onboardingCompleted: boolean;
  };
}

/**
 * Fully resets one authenticated account's LifeQuest data while preserving its
 * login identity (Google/Apple link) and the explicitly retained Google Calendar
 * connection. The route requires a literal confirmation because this is
 * irreversible. Blocks the user made are kept on purpose: a reset must never
 * reopen a channel to someone they blocked.
 *
 * Shared multiplayer records are handled conservatively: the caller's own
 * participation is erased, but a challenge with other participants is cancelled
 * rather than deleted. Guild leadership is transferred when possible so another
 * member's data is never removed as collateral damage.
 */
export async function resetAccountData(userId: string): Promise<AccountResetSummary> {
  return prisma.$transaction(async (tx) => {
    const deleted: Record<string, number> = {};
    const remove = async (key: string, operation: () => Promise<{ count: number }>) => {
      const result = await operation();
      deleted[key] = result.count;
    };

    const [createdChallenges, ledGuilds] = await Promise.all([
      tx.challenge.findMany({
        where: { creatorId: userId },
        select: {
          id: true,
          participants: {
            where: { userId: { not: userId } },
            select: { id: true },
            take: 1,
          },
        },
      }),
      tx.guild.findMany({
        where: { leaderId: userId },
        select: { id: true },
      }),
    ]);

    // Delete rows that reference a user-owned parent before deleting that parent.
    await remove('outfitItems', () => tx.outfitItem.deleteMany({
      where: {
        OR: [
          { outfit: { userId } },
          { clothingItem: { userId } },
        ],
      },
    }));
    await remove('workoutExercises', () => tx.workoutExercise.deleteMany({ where: { workout: { userId } } }));
    await remove('debtPayments', () => tx.debtPayment.deleteMany({ where: { debt: { userId } } }));
    await remove('goalMilestones', () => tx.goalMilestone.deleteMany({ where: { goal: { userId } } }));
    await remove('ritualSteps', () => tx.ritualStep.deleteMany({ where: { ritual: { userId } } }));
    await remove('ritualLogs', () => tx.ritualLog.deleteMany({ where: { userId } }));
    await remove('careSteps', () => tx.careStep.deleteMany({ where: { routine: { userId } } }));
    await remove('careLogs', () => tx.careLog.deleteMany({ where: { userId } }));
    await remove('questCompletions', () => tx.questCompletion.deleteMany({ where: { userId } }));
    await remove('habitLogs', () => tx.habitLog.deleteMany({ where: { userId } }));
    await remove('recoveryChallenges', () => tx.recoveryChallenge.deleteMany({ where: { userId } }));

    await remove('transactions', () => tx.transaction.deleteMany({ where: { userId } }));
    await remove('agendaEvents', () => tx.agendaEvent.deleteMany({ where: { userId } }));
    await remove('focusSessions', () => tx.focusSession.deleteMany({ where: { userId } }));
    await remove('xpEvents', () => tx.xpEvent.deleteMany({ where: { userId } }));
    await remove('weeklySummaries', () => tx.weeklySummary.deleteMany({ where: { userId } }));
    await remove('sageMemories', () => tx.sageMemory.deleteMany({ where: { userId } }));
    await remove('sageInsights', () => tx.sageInsight.deleteMany({ where: { userId } }));
    await remove('sageProactiveNotes', () => tx.sageProactiveNote.deleteMany({ where: { userId } }));
    await remove('sageScrolls', () => tx.sageScroll.deleteMany({ where: { userId } }));
    await remove('notifications', () => tx.notification.deleteMany({ where: { userId } }));
    await remove('dailyCheckins', () => tx.dailyCheckin.deleteMany({ where: { userId } }));
    await remove('seasonParticipants', () => tx.seasonParticipant.deleteMany({ where: { userId } }));
    await remove('bodyWeights', () => tx.bodyWeight.deleteMany({ where: { userId } }));
    await remove('progressPhotos', () => tx.progressPhoto.deleteMany({ where: { userId } }));
    await remove('meals', () => tx.meal.deleteMany({ where: { userId } }));
    await remove('savedMeals', () => tx.savedMeal.deleteMany({ where: { userId } }));
    await remove('nutritionGoals', () => tx.nutritionGoal.deleteMany({ where: { userId } }));
    await remove('sleepLogs', () => tx.sleepLog.deleteMany({ where: { userId } }));
    await remove('journalEntries', () => tx.journalEntry.deleteMany({ where: { userId } }));
    await remove('learningItems', () => tx.learningItem.deleteMany({ where: { userId } }));
    await remove('routines', () => tx.routine.deleteMany({ where: { userId } }));
    await remove('financialGoals', () => tx.financialGoal.deleteMany({ where: { userId } }));
    await remove('recurringTransactions', () => tx.recurringTransaction.deleteMany({ where: { userId } }));
    await remove('debts', () => tx.debt.deleteMany({ where: { userId } }));
    await remove('budgets', () => tx.budget.deleteMany({ where: { userId } }));
    await remove('giftIdeas', () => tx.giftIdea.deleteMany({ where: { userId } }));
    await remove('relationships', () => tx.relationship.deleteMany({ where: { userId } }));
    await remove('masterGoals', () => tx.masterGoal.deleteMany({ where: { userId } }));
    await remove('rituals', () => tx.ritual.deleteMany({ where: { userId } }));
    await remove('careRoutines', () => tx.careRoutine.deleteMany({ where: { userId } }));
    await remove('workouts', () => tx.workout.deleteMany({ where: { userId } }));
    // Asistencia del gimnasio (calendario y racha de gym): sin esto el Gimnasio
    // seguía mostrando los días entrenados después de reiniciar la cuenta.
    await remove('gymAttendances', () => tx.gymAttendance.deleteMany({ where: { userId } }));
    await remove('messageReactions', () => tx.messageReaction.deleteMany({ where: { userId } }));
    await remove('chatViews', () => tx.chatView.deleteMany({ where: { userId } }));
    await remove('chatPrefs', () => tx.chatPref.deleteMany({ where: { userId } }));
    await remove('stickers', () => tx.sticker.deleteMany({ where: { ownerId: userId } }));
    await remove('notificationCategoryPreferences', () => tx.notificationCategoryPreference.deleteMany({ where: { userId } }));
    await remove('directMessages', () => tx.directMessage.deleteMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } }));
    await remove('socialGestures', () => tx.socialGesture.deleteMany({ where: { OR: [{ fromId: userId }, { toId: userId }] } }));
    await remove('guildInvites', () => tx.guildInvite.deleteMany({ where: { OR: [{ inviterId: userId }, { inviteeId: userId }] } }));
    // Jardines compartidos: la otra persona conserva el suyo, ya sin vínculo.
    await tx.relationship.updateMany({ where: { partnerUserId: userId }, data: { partnerUserId: null, linkStatus: null } });
    await remove('outfits', () => tx.outfit.deleteMany({ where: { userId } }));
    await remove('clothingItems', () => tx.clothingItem.deleteMany({ where: { userId } }));
    await remove('styleWishlist', () => tx.styleWishlist.deleteMany({ where: { userId } }));
    await remove('presenceCheckins', () => tx.presenceCheckin.deleteMany({ where: { userId } }));
    await remove('feedback', () => tx.feedback.deleteMany({ where: { userId } }));
    await remove('inventoryItems', () => tx.inventoryItem.deleteMany({ where: { userId } }));
    await remove('userAchievements', () => tx.userAchievement.deleteMany({ where: { userId } }));
    await remove('pushSubscriptions', () => tx.pushSubscription.deleteMany({ where: { userId } }));
    await remove('notificationPreferences', () => tx.notificationPreferences.deleteMany({ where: { userId } }));
    await remove('friendships', () => tx.friendship.deleteMany({
      where: { OR: [{ requesterId: userId }, { receiverId: userId }] },
    }));

    // The user's own participant rows are erased. Do not delete a shared
    // challenge because that would cascade into other users' records.
    await remove('challengeParticipants', () => tx.challengeParticipant.deleteMany({ where: { userId } }));
    const soloChallengeIds = createdChallenges
      .filter((challenge) => challenge.participants.length === 0)
      .map((challenge) => challenge.id);
    const sharedChallengeIds = createdChallenges
      .filter((challenge) => challenge.participants.length > 0)
      .map((challenge) => challenge.id);
    await remove('soloChallenges', () => tx.challenge.deleteMany({ where: { id: { in: soloChallengeIds } } }));
    const sharedChallengesCancelled = sharedChallengeIds.length === 0
      ? 0
      : (await tx.challenge.updateMany({
        where: { id: { in: sharedChallengeIds } },
        data: { status: 'CANCELLED' },
      })).count;

    // Preserve other guild members rather than deleting their guild data.
    await remove('guildMessages', () => tx.guildMessage.deleteMany({ where: { userId } }));
    let guildsDeleted = 0;
    let guildLeadershipsTransferred = 0;
    for (const guild of ledGuilds) {
      const successor = await tx.guildMember.findFirst({
        where: { guildId: guild.id, userId: { not: userId } },
        orderBy: { joinedAt: 'asc' },
        select: { id: true, userId: true },
      });
      if (!successor) {
        await tx.guild.delete({ where: { id: guild.id } });
        guildsDeleted += 1;
      } else {
        await tx.guild.update({ where: { id: guild.id }, data: { leaderId: successor.userId } });
        await tx.guildMember.update({ where: { id: successor.id }, data: { role: 'LEADER' } });
        guildLeadershipsTransferred += 1;
      }
    }
    await remove('guildMemberships', () => tx.guildMember.deleteMany({ where: { userId } }));

    // Delete top-level personal planning data after child tables are gone.
    await remove('quests', () => tx.quest.deleteMany({ where: { userId } }));
    await remove('habits', () => tx.habit.deleteMany({ where: { userId } }));
    await remove('customZones', () => tx.customZone.deleteMany({ where: { userId } }));

    const user = await tx.user.update({
      where: { id: userId },
      data: {
        level: 1,
        xp: 0,
        xpToNextLevel: 100,
        gold: 0,
        hp: 100,
        maxHp: 100,
        strength: 1,
        intelligence: 1,
        charisma: 1,
        onboardingCompleted: false,
        onboardingCompletedAt: null,
        relationshipStatus: 'SINGLE',
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: null,
        sevenDayGuideCompletedDays: [],
        sevenDayGuideCompletedAt: null,
        sevenDayGuideDismissedAt: null,
        sageCallsToday: 0,
        sageCallsResetAt: new Date(),
        playerClass: null,
        classChosenAt: null,
        activeTheme: 'aurora',
        bedtimeGoal: null,
        equippedHat: null,
        equippedAura: null,
        equippedFrame: null,
        equippedTheme: null,
        morningBriefingLastSeen: null,
        lifeScore: 0,
        focusMinutesTotal: 0,
        gymPlaylistUrl: null,
        lostStreak: 0,
        lostStreakAt: null,
        bio: null,
        nameColor: null,
        presenceAt: null,
        presenceZone: null,
      },
      select: { level: true, xp: true, gold: true, onboardingCompleted: true },
    });

    return {
      deleted,
      sharedChallengesCancelled,
      guildsDeleted,
      guildLeadershipsTransferred,
      user,
    };
  });
}
