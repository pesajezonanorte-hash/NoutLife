import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import * as social from '../controllers/social.controller';

const router = Router();
router.use(requireAuth);

// Friends
router.post('/friends',                  social.sendFriendRequest);
router.get('/friends',                   social.listFriends);
router.get('/friends/pending',           social.listPending);
router.patch('/friends/:id',             social.respondRequest);
router.delete('/friends/:id',            social.removeFriend);
router.get('/profile/:username',         social.publicProfile);

// Leaderboard
router.get('/leaderboard',               social.leaderboard);

// Challenges
router.post('/challenges',               social.createChallenge);
router.get('/challenges',                social.listChallenges);
router.post('/challenges/:id/join',      social.joinChallenge);

// Guild
router.post('/guilds',                   social.createGuild);
router.post('/guilds/join',              social.joinGuild);
router.patch('/guilds/:guildId',         social.updateGuild);
router.get('/guilds/mine',               social.myGuild);
router.get('/guilds/:guildId/messages',  social.guildMessages);
router.post('/guilds/:guildId/messages', social.postGuildMessage);
router.delete('/guilds/:guildId/leave',  social.leaveGuild);

export default router;
