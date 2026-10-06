// Red social (perfiles, privacidad, presencia, mensajes, rachas entre amigos,
// pareja), gremios múltiples con invitaciones y revivir rachas con oro.
import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import { publicErrorMessage } from '../middleware/error.middleware';
import * as net from '../services/network.service';
import * as social from '../services/social.service';
import * as revival from '../services/streak-revival.service';

const router = Router();
router.use(requireAuth);

type Handler = (req: AuthRequest) => Promise<unknown>;
/** Respuesta JSON; los errores de negocio vuelven como 400 con su mensaje. */
const handle = (fn: Handler, status = 200) => async (req: AuthRequest, res: Response) => {
  try { res.status(status).json(await fn(req)); }
  catch (err) { res.status(400).json({ error: publicErrorMessage(err) }); }
};

// Presencia y privacidad
router.post('/presence', handle(async (req) => { await net.touchPresence(req.userId!, req.body?.zone); return { ok: true }; }));
router.get('/me/settings', handle((req) => net.getMySocialSettings(req.userId!)));
router.patch('/me/settings', handle((req) => net.updateMySocialSettings(req.userId!, req.body ?? {})));

// Amigos, búsqueda y perfiles
router.get('/pulse', handle((req) => net.socialPulse(req.userId!)));
router.get('/network', handle((req) => net.getFriendsNetwork(req.userId!)));
router.get('/users/search', handle((req) => net.searchUsers(req.userId!, String(req.query.q ?? ''))));
router.get('/users/:username', handle((req) => net.getProfile(req.userId!, req.params.username)));
router.post('/friends/:id/revive', handle((req) => net.reviveFriendStreak(req.userId!, req.params.id)));

// Mensajes directos
router.get('/messages/unread', handle(async (req) => ({ count: await net.unreadMessages(req.userId!) })));
router.get('/messages/:userId', handle((req) => net.getConversation(req.userId!, req.params.userId, typeof req.query.after === 'string' ? req.query.after : undefined)));
router.post('/messages/:userId', handle((req) => net.sendDirectMessage(req.userId!, req.params.userId, req.body ?? {}), 201));

// Pareja: jardín compartido
router.post('/partner/:userId', handle((req) => net.invitePartner(req.userId!, req.params.userId), 201));
router.post('/partner-invites/:id', handle((req) => net.respondPartnerInvite(req.userId!, req.params.id, req.body?.accept === true)));
router.delete('/partner-invite', handle(async (req) => { await net.cancelPartnerInvite(req.userId!); return { ok: true }; }));
router.post('/breakup', handle((req) => net.breakUp(req.userId!)));

// Gremios (varios por persona) e invitaciones
router.get('/guilds', handle((req) => social.getMyGuilds(req.userId!)));
router.get('/guild-invites', handle((req) => social.getGuildInvites(req.userId!)));
router.post('/guild-invites/:id', handle((req) => social.respondGuildInvite(req.userId!, req.params.id, req.body?.accept === true)));
router.get('/guilds/:guildId', handle((req) => social.getGuild(req.userId!, req.params.guildId)));
router.post('/guilds/:guildId/invite', handle((req) => social.inviteToGuild(req.userId!, req.params.guildId, String(req.body?.userId ?? '')), 201));

// Revivir rachas con oro
router.get('/streaks/revival', handle((req) => revival.getStreakRevival(req.userId!)));
router.post('/streaks/revive/activity', handle((req) => revival.reviveActivityStreak(req.userId!)));
router.post('/streaks/revive/habit/:id', handle((req) => revival.reviveHabitStreak(req.userId!, req.params.id)));

export default router;
