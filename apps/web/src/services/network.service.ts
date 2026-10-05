// Cliente de la red social: amigos, perfiles, mensajes, rachas, pareja,
// gremios múltiples y revivir rachas con oro.
import api from '../lib/api';

export type Visibility = 'public' | 'friends' | 'private';
export interface Privacy {
  friendsList: Visibility;
  profile: 'public' | 'friends';
  showOnline: boolean;
  showZone: boolean;
  readReceipts: boolean;
}

export interface PublicUser {
  id: string; username: string; displayName: string; level: number;
  avatarConfig?: unknown; avatarUrl?: string | null;
  equippedAura?: string | null; equippedFrame?: string | null; equippedHat?: string | null;
}
export interface Presence { online: boolean; zone: string | null; lastSeen: string | null }

export interface StreakView {
  count: number; best: number; alive: boolean; doneToday: boolean; revivable: boolean; reviveCost: number; lost: number;
  mineToday?: boolean; theirsToday?: boolean;
}

export interface FriendItem {
  friendshipId: string;
  since: string;
  friend: PublicUser & Presence & { currentStreak: number };
  streak: StreakView & { mineToday: boolean; theirsToday: boolean };
  unread: number;
  lastMessage: { mine: boolean; kind: string; preview: string; at: string } | null;
}

export type RelationStatus = 'NONE' | 'FRIENDS' | 'PENDING_OUT' | 'PENDING_IN' | 'SELF';
export interface Relation { status: RelationStatus; friendshipId: string | null }

export interface ProfileData {
  user: PublicUser & { bio?: string | null; currentStreak: number; longestStreak: number; xp: number; createdAt: string };
  presence: Presence;
  relation: Relation;
  friendStreak: StreakView | null;
  locked: boolean;
  stats?: { habits: number; habitsOnStreak: number; bestHabitStreak: number; achievements: number; friends: number };
  achievements?: Array<{ title: string; icon: string; category: string; description?: string; unlockedAt: string }>;
  guilds?: Array<{ id: string; name: string; emblem: string; photoUrl?: string | null }>;
  friendsVisible?: boolean;
  friends?: Array<PublicUser & { friendStreak: number }>;
  closeFriends?: Array<PublicUser & { friendStreak: number; best: number }>;
}

export interface DM {
  id: string; mine: boolean; kind: 'TEXT' | 'SNAP' | string; content: string | null; photoUrl: string | null; habitTitle: string | null; createdAt: string;
  /** Solo en el cliente: aún enviándose. */
  pending?: boolean;
}
export interface Conversation {
  friend: PublicUser & Presence;
  friendshipId: string;
  messages: DM[];
  seenUntil: string | null;
  streak: StreakView & { mineToday: boolean; theirsToday: boolean };
}

const d = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

// Presencia y ajustes
export const sendPresence = (zone: string) => d(api.post('/social/presence', { zone }));
export const getSocialSettings = () => d<{ bio: string; privacy: Privacy }>(api.get('/social/me/settings'));
export const updateSocialSettings = (body: { bio?: string; privacy?: Partial<Privacy> }) => d<{ bio: string; privacy: Privacy }>(api.patch('/social/me/settings', body));

// Amigos y perfiles
export const getNetwork = () => d<FriendItem[]>(api.get('/social/network'));
export const searchUsers = (q: string) => d<Array<{ user: PublicUser; relation: Relation }>>(api.get('/social/users/search', { params: { q } }));
export const getProfile = (username: string) => d<ProfileData>(api.get(`/social/users/${encodeURIComponent(username)}`));
export const sendFriendRequest = (identifier: string) => d(api.post('/social/friends', { identifier }));
export const respondFriendRequest = (id: string, accept: boolean) => d(api.patch(`/social/friends/${id}`, { accept }));
export const removeFriend = (id: string) => api.delete(`/social/friends/${id}`);
export const getPendingRequests = () => d<Array<{ id: string; createdAt: string; requester: PublicUser }>>(api.get('/social/friends/pending'));
export const reviveFriendStreak = (friendshipId: string) => d<{ streak: StreakView; gold: number }>(api.post(`/social/friends/${friendshipId}/revive`));

// Mensajes
export const getUnreadMessages = () => d<{ count: number }>(api.get('/social/messages/unread'));
export const getConversation = (userId: string, after?: string) => d<Conversation>(api.get(`/social/messages/${userId}`, { params: after ? { after } : {} }));
export const sendMessage = (userId: string, body: { content?: string; photoUrl?: string; kind?: 'TEXT' | 'SNAP'; habitTitle?: string }) =>
  d<{ message: DM; streak: StreakView; completed: boolean }>(api.post(`/social/messages/${userId}`, body));

// Pareja
export const invitePartner = (userId: string) => d(api.post(`/social/partner/${userId}`));
export const respondPartnerInvite = (relationshipId: string, accept: boolean) => d<{ linked: boolean }>(api.post(`/social/partner-invites/${relationshipId}`, { accept }));
export const cancelPartnerInvite = () => d(api.delete('/social/partner-invite'));
export const breakUp = () => d<{ closed: number }>(api.post('/social/breakup'));

// Gremios
export interface GuildSummary {
  id: string; name: string; emblem: string; photoUrl?: string | null; level: number; role: string;
  members: number; streak: StreakView; snappedToday: number; mineToday: boolean;
}
export interface GuildInvite {
  id: string; createdAt: string;
  guild: { id: string; name: string; emblem: string; photoUrl?: string | null; level: number; _count: { members: number } };
  inviter: PublicUser;
}
export const getMyGuilds = () => d<GuildSummary[]>(api.get('/social/guilds'));
export const getGuild = (id: string) => d<unknown>(api.get(`/social/guilds/${id}`));
export const getGuildInvites = () => d<GuildInvite[]>(api.get('/social/guild-invites'));
export const respondGuildInvite = (id: string, accept: boolean) => d<{ guildId: string; accepted: boolean }>(api.post(`/social/guild-invites/${id}`, { accept }));
export const inviteToGuild = (guildId: string, userId: string) => d(api.post(`/social/guilds/${guildId}/invite`, { userId }));
export const getGuildMessagesAfter = (guildId: string, after?: string) => d<unknown[]>(api.get(`/social/guilds/${guildId}/messages`, { params: after ? { after } : {} }));
export const postGuildSnap = (guildId: string, photoUrl: string, content: string) =>
  d<{ streakCompleted?: boolean }>(api.post(`/social/guilds/${guildId}/messages`, { kind: 'SNAP', photoUrl, content }));

// Rachas revivibles
export interface Revival {
  gold: number;
  activity: { lost: number; current: number; cost: number; expiresAt: string } | null;
  habits: Array<{ id: string; title: string; icon: string; color: string; lost: number; current: number; cost: number; expiresAt: string }>;
}
export const getRevival = () => d<Revival>(api.get('/social/streaks/revival'));
export const reviveActivity = () => d<{ streak: number; gold: number; cost: number }>(api.post('/social/streaks/revive/activity'));
export const reviveHabit = (id: string) => d<{ habitId: string; streak: number; gold: number; cost: number }>(api.post(`/social/streaks/revive/habit/${id}`));

/** Mensaje de error de la API (o el de respaldo). */
export const apiError = (e: unknown, fallback = 'Algo salió mal') =>
  (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error
  ?? (e as { response?: { data?: { message?: string } } })?.response?.data?.message
  ?? fallback;

/** Reduce una foto a `max` px (lado mayor) en JPEG: lo que viaja en los mensajes. */
export function compressPhoto(file: File, max = 720, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * k);
      canvas.height = Math.round(img.naturalHeight * k);
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('Sin canvas')); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la foto')); };
    img.src = url;
  });
}

/** Zona de Noutlife por ruta (lo que tus amigos ven si lo permites). */
const ZONE_NAMES: Array<[string, string]> = [
  ['/friends', 'Amigos'], ['/u/', 'Perfiles'], ['/habits', 'Hábitos'], ['/quests', 'Misiones'], ['/gym', 'Gimnasio'],
  ['/finances', 'Finanzas'], ['/food', 'Comida'], ['/sleep', 'Sueño'], ['/love', 'Jardín'], ['/journal', 'Diario'],
  ['/agenda', 'Agenda'], ['/learning', 'Aprendizaje'], ['/guild', 'Gremio'], ['/leaderboard', 'Ranking'],
  ['/season', 'Campaña'], ['/shop', 'Tienda'], ['/glow-up', 'Glow up'], ['/rituals', 'Rituales'], ['/wisdom', 'Sabiduría'],
  ['/achievements', 'Logros'], ['/stats', 'Estadísticas'], ['/profile', 'Perfil'], ['/settings', 'Ajustes'],
  ['/custom-zones', 'Mis zonas'], ['/history', 'Historial'],
];
export function zoneName(pathname: string): string {
  if (pathname === '/') return 'Inicio';
  return ZONE_NAMES.find(([p]) => pathname.startsWith(p))?.[1] ?? 'Noutlife';
}

/** "hace 5 min", "ayer"… para la última conexión. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 172800) return 'ayer';
  return `hace ${Math.floor(s / 86400)} días`;
}
