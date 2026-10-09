import { Router } from 'express';
import authRoutes         from './auth.routes';
import questRoutes        from './quest.routes';
import userRoutes         from './user.routes';
import dashboardRoutes    from './dashboard.routes';
import habitRoutes        from './habit.routes';
import achievementRoutes  from './achievement.routes';
import historyRoutes      from './history.routes';
import notificationRoutes from './notification.routes';
import workoutRoutes      from './workout.routes';
import financeRoutes      from './finance.routes';
import sleepRoutes        from './sleep.routes';
import mealRoutes         from './meal.routes';
import learningRoutes     from './learning.routes';
import journalRoutes      from './journal.routes';
import loveRoutes         from './love.routes';
import shopRoutes         from './shop.routes';
import sageRoutes         from './sage.routes';
import socialRoutes       from './social.routes';
import networkRoutes      from './network.routes';
import statsRoutes        from './stats.routes';
import seasonRoutes       from './season.routes';
import agendaRoutes       from './agenda.routes';
import gym2Routes         from './gym2.routes';
import finance2Routes     from './finance2.routes';
import nutrition2Routes   from './nutrition2.routes';
import lifescoreRoutes    from './lifescore.routes';
// Fase 9
import goalsRoutes        from './goals.routes';
import ritualsRoutes      from './rituals.routes';
import checkinRoutes      from './checkin.routes';
import scrollsRoutes      from './scrolls.routes';
import focusRoutes        from './focus.routes';
import wisdomRoutes       from './wisdom.routes';
// Fase 10
import searchRoutes       from './search.routes';
import exportRoutes       from './export.routes';
import feedbackRoutes     from './feedback.routes';
// Espejo y cuidado personal (Bloque 3)
import mirrorRoutes       from './mirror.routes';
// Custom Zones (Bloque 4)
import customZonesRoutes  from './custom-zones.routes';
import checklistRoutes    from './checklist.routes';
import antiHabitRoutes    from './anti-habit.routes';
import sharesRoutes       from './shares.routes';
// Recordatorios disparados desde fuera (serverless)
import cronRoutes         from './cron.routes';

const router = Router();

router.use('/auth',          authRoutes);
router.use('/quests',        questRoutes);
router.use('/users',         userRoutes);
router.use('/dashboard',     dashboardRoutes);
router.use('/habits',        habitRoutes);
router.use('/achievements',  achievementRoutes);
router.use('/history',       historyRoutes);
router.use('/notifications', notificationRoutes);
router.use('/workouts',      workoutRoutes);
router.use('/finances',      financeRoutes);
router.use('/sleep',         sleepRoutes);
router.use('/meals',         mealRoutes);
router.use('/learning',      learningRoutes);
router.use('/journal',       journalRoutes);
router.use('/relationships', loveRoutes);
router.use('/shop',          shopRoutes);
router.use('/sage',          sageRoutes);
router.use('/social',        socialRoutes);
router.use('/social',        networkRoutes);
router.use('/stats',         statsRoutes);
router.use('/seasons',       seasonRoutes);
router.use('/agenda',        agendaRoutes);
router.use('/gym',           gym2Routes);
router.use('/finances',      finance2Routes);
router.use('/nutrition',     nutrition2Routes);
router.use('/life',          lifescoreRoutes);

// Fase 9 routes
router.use('/goals',        goalsRoutes);
router.use('/rituals',      ritualsRoutes);
router.use('/checkin',      checkinRoutes);
router.use('/scrolls',      scrollsRoutes);
router.use('/focus',        focusRoutes);
router.use('/wisdom',       wisdomRoutes);
// Fase 10 routes
router.use('/search',       searchRoutes);
router.use('/export',       exportRoutes);
router.use('/cron',         cronRoutes);
router.use('/feedback',     feedbackRoutes);

router.use('/mirror',       mirrorRoutes);
router.use('/custom-zones', customZonesRoutes);
router.use('/checklists',   checklistRoutes);
router.use('/anti-habits',  antiHabitRoutes);
router.use('/shares',       sharesRoutes);

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '10.0.0', timestamp: new Date().toISOString() });
});

export default router;
