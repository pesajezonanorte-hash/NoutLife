import { publicErrorMessage } from '../middleware/error.middleware';
import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import * as social from '../services/social.service';

// ─── Friends ──────────────────────────────────────────────────────────────────

export async function sendFriendRequest(req: AuthRequest, res: Response): Promise<void> {
  const { identifier } = req.body as { identifier?: string };
  if (!identifier?.trim()) { res.status(400).json({ error: 'identifier requerido' }); return; }
  try {
    const result = await social.sendFriendRequest(req.userId!, identifier.trim());
    res.status(201).json(result);
  } catch (e: unknown) { res.status(400).json({ error: publicErrorMessage(e) }); }
}

export async function respondRequest(req: AuthRequest, res: Response): Promise<void> {
  const { accept } = req.body as { accept?: boolean };
  if (accept === undefined) { res.status(400).json({ error: 'accept requerido' }); return; }
  try {
    const result = await social.respondFriendRequest(req.userId!, req.params.id, accept);
    res.json(result);
  } catch (e: unknown) { res.status(400).json({ error: publicErrorMessage(e) }); }
}

export async function listFriends(req: AuthRequest, res: Response): Promise<void> {
  const friends = await social.getFriends(req.userId!);
  res.json(friends);
}

export async function listPending(req: AuthRequest, res: Response): Promise<void> {
  const pending = await social.getPendingRequests(req.userId!);
  res.json(pending);
}

export async function removeFriend(req: AuthRequest, res: Response): Promise<void> {
  try {
    await social.removeFriend(req.userId!, req.params.id);
    res.status(204).send();
  } catch (e: unknown) { res.status(400).json({ error: publicErrorMessage(e) }); }
}

export async function publicProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const profile = await social.getPublicProfile(req.params.username, req.userId);
    res.json(profile);
  } catch (e: unknown) { res.status(404).json({ error: publicErrorMessage(e) }); }
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export async function leaderboard(req: AuthRequest, res: Response): Promise<void> {
  const category = (req.query.category as string) ?? 'xp';
  const friendsOnly = req.query.friendsOnly === 'true';
  if (!['xp', 'streak', 'gym'].includes(category)) {
    res.status(400).json({ error: 'category inválida' }); return;
  }
  const data = await social.getLeaderboard(
    category as 'xp' | 'streak' | 'gym',
    req.userId!,
    friendsOnly
  );
  res.json(data);
}

// ─── Challenges ───────────────────────────────────────────────────────────────

export async function createChallenge(req: AuthRequest, res: Response): Promise<void> {
  try {
    const c = await social.createChallenge(req.userId!, req.body);
    res.status(201).json(c);
  } catch (e: unknown) { res.status(400).json({ error: publicErrorMessage(e) }); }
}

export async function joinChallenge(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await social.joinChallenge(req.userId!, req.params.id);
    res.status(201).json(result);
  } catch (e: unknown) { res.status(400).json({ error: publicErrorMessage(e) }); }
}

export async function listChallenges(req: AuthRequest, res: Response): Promise<void> {
  const list = await social.getChallenges(req.userId!);
  res.json(list);
}

// ─── Guild ────────────────────────────────────────────────────────────────────

export async function createGuild(req: AuthRequest, res: Response): Promise<void> {
  try {
    const g = await social.createGuild(req.userId!, req.body);
    res.status(201).json(g);
  } catch (e: unknown) { res.status(400).json({ error: publicErrorMessage(e) }); }
}

export async function updateGuild(req: AuthRequest, res: Response): Promise<void> {
  try {
    const g = await social.updateGuild(req.userId!, req.params.guildId, (req.body ?? {}) as { photoUrl?: unknown });
    res.json(g);
  } catch (e: unknown) { res.status(400).json({ error: publicErrorMessage(e) }); }
}

export async function joinGuild(req: AuthRequest, res: Response): Promise<void> {
  const { inviteCode } = req.body as { inviteCode?: string };
  if (!inviteCode?.trim()) { res.status(400).json({ error: 'inviteCode requerido' }); return; }
  try {
    const result = await social.joinGuild(req.userId!, inviteCode.trim().toUpperCase());
    res.status(201).json(result);
  } catch (e: unknown) { res.status(400).json({ error: publicErrorMessage(e) }); }
}

export async function myGuild(req: AuthRequest, res: Response): Promise<void> {
  const guild = await social.getMyGuild(req.userId!);
  res.json(guild);
}

export async function guildMessages(req: AuthRequest, res: Response): Promise<void> {
  try {
    const msgs = await social.getGuildMessages(req.userId!, req.params.guildId, 50, typeof req.query.after === 'string' ? req.query.after : undefined);
    res.json(msgs);
  } catch (e: unknown) { res.status(400).json({ error: publicErrorMessage(e) }); }
}

export async function postGuildMessage(req: AuthRequest, res: Response): Promise<void> {
  const { content, kind, photoUrl } = (req.body ?? {}) as { content?: string; kind?: unknown; photoUrl?: unknown };
  if (!content?.trim() && !photoUrl) { res.status(400).json({ error: 'content requerido' }); return; }
  try {
    const msg = await social.sendGuildMessage(req.userId!, req.params.guildId, content ?? '', { kind, photoUrl });
    res.status(201).json(msg);
  } catch (e: unknown) { res.status(400).json({ error: publicErrorMessage(e) }); }
}

export async function leaveGuild(req: AuthRequest, res: Response): Promise<void> {
  try {
    await social.leaveGuild(req.userId!, req.params.guildId);
    res.status(204).send();
  } catch (e: unknown) { res.status(400).json({ error: publicErrorMessage(e) }); }
}
