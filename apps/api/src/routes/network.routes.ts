// Red social (perfiles, privacidad, presencia, cartas con fondo compartido,
// rachas entre amigos, gestos en las zonas, pareja), el chat en vivo, gremios
// múltiples con invitaciones, stickers, minijuegos, galería, bloqueos y revivir
// rachas con oro.
import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import { publicErrorMessage } from '../middleware/error.middleware';
import * as net from '../services/network.service';
import * as dm from '../services/dm.service';
import * as social from '../services/social.service';
import * as letters from '../services/letters.service';
import * as games from '../services/games.service';
import * as live from '../services/live.service';
import * as revival from '../services/streak-revival.service';

const router = Router();
router.use(requireAuth);

type Handler = (req: AuthRequest, res: Response) => Promise<unknown>;
/** Respuesta JSON; los errores de negocio vuelven como 400 con su mensaje. */
const handle = (fn: Handler, status = 200) => async (req: AuthRequest, res: Response) => {
  try { res.status(status).json(await fn(req, res)); }
  catch (err) { res.status(400).json({ error: publicErrorMessage(err) }); }
};
/** Igual, pero la respuesta no cambia nunca (fotos, audios, stickers): el navegador la guarda. */
const forever = (fn: Handler) => async (req: AuthRequest, res: Response) => {
  try { res.set('Cache-Control', 'private, max-age=31536000, immutable').json(await fn(req, res)); }
  catch (err) { res.status(404).json({ error: publicErrorMessage(err) }); }
};
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

// Chat en vivo: una petición larga que lo trae todo, "escribiendo…" y "cerré la carta"
router.get('/live', handle((req, res) => {
  let closed = false;
  res.on('close', () => { closed = true; });
  return live.live(req.userId!, req.query as live.LiveQuery, () => closed);
}));
router.post('/typing', handle((req) => live.setTyping(req.userId!, req.body?.chat, req.body?.on)));
router.post('/view/leave', handle((req) => live.leaveView(req.userId!, req.body?.key)));

// Presencia y privacidad
router.post('/presence', handle(async (req) => net.touchPresence(req.userId!, req.body?.zone, { leaving: req.body?.leaving === true })));
router.get('/me/settings', handle((req) => net.getMySocialSettings(req.userId!)));
router.patch('/me/settings', handle((req) => net.updateMySocialSettings(req.userId!, req.body ?? {})));

// Amigos, búsqueda, perfiles y bloqueos
router.get('/pulse', handle((req) => net.socialPulse(req.userId!)));
router.get('/network', handle((req) => net.getFriendsNetwork(req.userId!)));
router.get('/users/search', handle((req) => net.searchUsers(req.userId!, String(req.query.q ?? ''))));
router.get('/users/:username', handle((req) => net.getProfile(req.userId!, req.params.username)));
router.post('/friends/:id/revive', handle((req) => net.reviveFriendStreak(req.userId!, req.params.id)));
router.get('/blocks', handle((req) => letters.listBlocked(req.userId!)));
router.post('/blocks/:userId', handle((req) => letters.blockUser(req.userId!, req.params.userId), 201));
router.delete('/blocks/:userId', handle((req) => letters.unblockUser(req.userId!, req.params.userId)));

// Muñequitos en las zonas: amigos en tu misma zona y los gestos entre ustedes
router.get('/zone', handle((req) => net.zoneVisitors(req.userId!, req.query.name)));
router.post('/gestures', handle((req) => net.sendGesture(req.userId!, String(req.body?.toUserId ?? ''), req.body ?? {}), 201));

// Cartas entre amigos y su fondo compartido
router.get('/messages/unread', handle(async (req) => ({ count: await net.unreadMessages(req.userId!) })));
router.put('/messages/:userId/:messageId/reaction', handle((req) => dm.reactDirect(req.userId!, req.params.userId, req.params.messageId, req.body?.emoji)));
router.get('/messages/:userId/background', handle((req) => net.getDirectBackground(req.userId!, req.params.userId)));
router.put('/messages/:userId/background', handle((req) => net.setDirectBackground(req.userId!, req.params.userId, req.body ?? {})));
router.get('/messages/:userId', handle((req) => dm.getConversation(req.userId!, req.params.userId, str(req.query.after), str(req.query.before))));
router.post('/messages/:userId', handle((req) => dm.sendDirectMessage(req.userId!, req.params.userId, req.body ?? {}), 201));

// Cualquier carta (chat = "dm:<amigo>" | "guild:<gremio>"): editar, borrar, archivar o vaciar
router.patch('/letters/message/:messageId', handle((req) => letters.editMessage(req.userId!, req.body?.chat, req.params.messageId, req.body?.content)));
router.delete('/letters/message/:messageId', handle((req) => letters.deleteMessage(req.userId!, req.query.chat, req.params.messageId)));
router.put('/letters/prefs', handle((req) => letters.setChatPref(req.userId!, req.body?.chat, req.body ?? {})));
// Foto o audio de un mensaje (no viajan con la carta) y su miniatura
router.get('/media/:side/:messageId', forever((req) => letters.getMedia(req.userId!, req.params.side, req.params.messageId)));
router.put('/media/:side/:messageId/thumb', handle((req) => letters.saveThumb(req.userId!, req.params.side, req.params.messageId, req.body?.thumb)));
// Galería: todas las fotos de tus cartas
router.get('/gallery', handle((req) => letters.gallery(req.userId!, req.query)));

// Stickers propios
router.get('/stickers', handle((req) => letters.listStickers(req.userId!)));
router.post('/stickers', handle((req) => letters.createSticker(req.userId!, req.body?.imageUrl), 201));
router.post('/stickers/save', handle((req) => letters.saveSticker(req.userId!, req.body?.hash), 201));
router.delete('/stickers/:id', handle((req) => letters.deleteSticker(req.userId!, req.params.id)));
router.get('/stickers/image/:hash', forever((req) => letters.stickerImage(req.params.hash)));

// Minijuegos en las cartas
router.post('/games', handle((req) => games.startGame(req.userId!, req.body?.chat, req.body?.type), 201));
router.post('/games/:side/:messageId/move', handle((req) => games.playMove(req.userId!, req.params.side, req.params.messageId, req.body?.move)));

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
router.get('/guilds/:guildId/letter', handle((req) => social.getGuildLetter(req.userId!, req.params.guildId, str(req.query.before))));
router.post('/guilds/:guildId/invite', handle((req) => social.inviteToGuild(req.userId!, req.params.guildId, String(req.body?.userId ?? '')), 201));
router.put('/guilds/:guildId/messages/:messageId/reaction', handle((req) => social.reactGuild(req.userId!, req.params.guildId, req.params.messageId, req.body?.emoji)));
router.get('/guilds/:guildId/background', handle((req) => social.getGuildBackground(req.userId!, req.params.guildId)));
router.put('/guilds/:guildId/background', handle((req) => social.setGuildBackground(req.userId!, req.params.guildId, req.body ?? {})));

// Revivir rachas con oro
router.get('/streaks/revival', handle((req) => revival.getStreakRevival(req.userId!)));
router.post('/streaks/revive/activity', handle((req) => revival.reviveActivityStreak(req.userId!)));
router.post('/streaks/revive/habit/:id', handle((req) => revival.reviveHabitStreak(req.userId!, req.params.id)));

export default router;
