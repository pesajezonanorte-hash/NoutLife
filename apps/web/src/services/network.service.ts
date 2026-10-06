// Cliente de la red social: amigos (libreta), perfiles (DNI), cartas con fondo
// compartido, rachas que se encienden al tercer día, gestos entre muñequitos,
// pareja, gremios múltiples y revivir rachas con oro.
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

/** Días seguidos hablando para que una racha se encienda (igual que en la API). */
export const STREAK_MIN = 3;

export interface StreakView {
  count: number; best: number; alive: boolean;
  /** Encendida: viva y con al menos STREAK_MIN días. Antes no se muestra. */
  active: boolean;
  doneToday: boolean; revivable: boolean; reviveCost: number; lost: number;
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
  user: PublicUser & { bio?: string | null; currentStreak: number; longestStreak: number; xp: number; createdAt: string; playerClass?: string | null };
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

/** TEXT · SNAP (foto tomada con la cámara) · EVENT (aviso de la carta: "bg" o "bg-off"). */
export type LetterKind = 'TEXT' | 'SNAP' | 'EVENT';

/** Reacciones que se pueden poner a un mensaje. */
export const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥'] as const;
export interface ReactionCount { emoji: string; count: number; mine: boolean }
/** El mensaje al que responde otro (de la misma carta). */
export interface ReplyRef { id: string; authorId: string; kind: string; content: string | null }

export interface DM {
  id: string; mine: boolean; kind: LetterKind | string; content: string | null; photoUrl: string | null; habitTitle?: string | null; createdAt: string;
  replyTo?: ReplyRef | null;
  reactions?: ReactionCount[];
  /** Solo en el cliente: aún enviándose. */
  pending?: boolean;
}

/** Encuadre del fondo de una carta: foco (x, y) 0–1, zoom 1–3 e intensidad del papel. */
export interface BackgroundFit { x: number; y: number; zoom: number; paper: number }
export interface BackgroundMeta { at: string; mine: boolean; fit: BackgroundFit }
export type Background = BackgroundMeta & { photoUrl: string };
export const DEFAULT_FIT: BackgroundFit = { x: 0.5, y: 0.5, zoom: 1, paper: 0.42 };

export interface Conversation {
  friend: PublicUser & Presence;
  friendshipId: string;
  messages: DM[];
  seenUntil: string | null;
  streak: StreakView & { mineToday: boolean; theirsToday: boolean };
  background: BackgroundMeta | null;
  /** Desde aquí se piden las reacciones nuevas. */
  cursor: string;
}

/** Respuesta de la carta en vivo: sin cambios, o lo nuevo (mensajes, reacciones, visto, racha). */
export type LiveConversation = { changed: false; cursor: string } | (Conversation & { changed: true; reacted: Array<{ id: string; reactions: ReactionCount[] }> });
export interface LiveGuild { changed: boolean; cursor: string; messages: GuildMessage[]; reacted: Array<{ id: string; reactions: ReactionCount[] }> }

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
export interface PendingRequest { id: string; createdAt: string; requester: PublicUser }
export const getPendingRequests = () => d<PendingRequest[]>(api.get('/social/friends/pending'));
export const reviveFriendStreak = (friendshipId: string) => d<{ streak: StreakView; gold: number }>(api.post(`/social/friends/${friendshipId}/revive`));

// Cartas (mensajes directos)
export const getUnreadMessages = () => d<{ count: number }>(api.get('/social/messages/unread'));
export const getConversation = (userId: string, after?: string) => d<Conversation>(api.get(`/social/messages/${userId}`, { params: after ? { after } : {} }));
export const liveConversation = (userId: string, params: { after?: string; since?: string; seen?: string }, signal?: AbortSignal) =>
  d<LiveConversation>(api.get(`/social/messages/${userId}/live`, { params: { ...params, wait: 1 }, signal, timeout: 20_000 }));
export const reactDirect = (userId: string, messageId: string, emoji: string | null) =>
  d<{ id: string; emoji: string | null; reactions: ReactionCount[] }>(api.put(`/social/messages/${userId}/${messageId}/reaction`, { emoji }));
export const sendMessage = (userId: string, body: { content?: string; photoUrl?: string; kind?: 'TEXT' | 'SNAP'; replyToId?: string }) =>
  d<{ message: DM; streak: StreakView & { mineToday: boolean; theirsToday: boolean }; completed: boolean }>(api.post(`/social/messages/${userId}`, body));
export const getDirectBackground = (userId: string) => d<Background | null>(api.get(`/social/messages/${userId}/background`));
export const setDirectBackground = (userId: string, body: { photoUrl?: string | null; fit?: BackgroundFit }) =>
  d<{ background: BackgroundMeta | null }>(api.put(`/social/messages/${userId}/background`, body));

// Pareja
export const invitePartner = (userId: string) => d(api.post(`/social/partner/${userId}`));
export const respondPartnerInvite = (relationshipId: string, accept: boolean) => d<{ linked: boolean }>(api.post(`/social/partner-invites/${relationshipId}`, { accept }));
export const cancelPartnerInvite = () => d(api.delete('/social/partner-invite'));
export const breakUp = () => d<{ closed: number }>(api.post('/social/breakup'));

// Gremios
export interface GuildSummary {
  id: string; name: string; emblem: string; photoUrl?: string | null; level: number; role: string;
  members: number; streak: StreakView; snappedToday: number;
  /** Tu foto de hoy ya golpeó al enemigo del día. */
  mineToday: boolean;
  talkedToday: boolean;
  unread: number;
  lastMessage: { mine: boolean; author: string; kind: string; preview: string; at: string } | null;
}
export interface GuildInvite {
  id: string; createdAt: string;
  guild: { id: string; name: string; emblem: string; photoUrl?: string | null; level: number; _count: { members: number } };
  inviter: PublicUser;
}
export interface GuildMemberRow {
  id: string; userId: string; role: string; snappedToday: boolean;
  user: PublicUser & { currentStreak: number; xp: number };
}
export interface GuildDetail {
  id: string; name: string; description?: string | null; emblem: string; photoUrl?: string | null; leaderId: string; level: number; xp: number; inviteCode: string;
  members: GuildMemberRow[];
  today: { day: string; snappedUserIds: string[]; talkedUserIds: string[]; enemy: { name: string; hp: number; maxHp: number; defeated: boolean } };
  streak: StreakView;
  background: BackgroundMeta | null;
}
export interface GuildMessage {
  id: string; content: string; createdAt: string; userId: string; kind: LetterKind | string; photoUrl?: string | null; dayKey?: string | null;
  replyTo?: ReplyRef | null;
  reactions?: ReactionCount[];
  user: { id?: string; username?: string; displayName: string; avatarConfig?: unknown; avatarUrl?: string | null };
}
export type GuildSendResult = GuildMessage & { enemyDefeated: boolean; streakCompleted: boolean; streak: StreakView };

export const getMyGuilds = () => d<GuildSummary[]>(api.get('/social/guilds'));
export const getGuild = (id: string) => d<GuildDetail>(api.get(`/social/guilds/${id}`));
export const getGuildInvites = () => d<GuildInvite[]>(api.get('/social/guild-invites'));
export const respondGuildInvite = (id: string, accept: boolean) => d<{ guildId: string; accepted: boolean }>(api.post(`/social/guild-invites/${id}`, { accept }));
export const inviteToGuild = (guildId: string, userId: string) => d(api.post(`/social/guilds/${guildId}/invite`, { userId }));
export const getGuildMessagesAfter = (guildId: string, after?: string) => d<GuildMessage[]>(api.get(`/social/guilds/${guildId}/messages`, { params: after ? { after } : {} }));
/** Solo mirar la carta (el muro de fotos del campamento) sin darla por leída. */
export const peekGuildMessages = (guildId: string) => d<GuildMessage[]>(api.get(`/social/guilds/${guildId}/messages`, { params: { peek: 1 } }));
export const postGuildText = (guildId: string, content: string, replyToId?: string) => d<GuildSendResult>(api.post(`/social/guilds/${guildId}/messages`, { content, replyToId }));
export const liveGuild = (guildId: string, params: { after?: string; since?: string }, signal?: AbortSignal) =>
  d<LiveGuild>(api.get(`/social/guilds/${guildId}/live`, { params: { ...params, wait: 1 }, signal, timeout: 20_000 }));
export const reactGuild = (guildId: string, messageId: string, emoji: string | null) =>
  d<{ id: string; emoji: string | null; reactions: ReactionCount[] }>(api.put(`/social/guilds/${guildId}/messages/${messageId}/reaction`, { emoji }));

// Avisos de mensajes en vivo
export interface InboxItem {
  type: 'dm' | 'guild'; id: string; at: string; kind: string; preview: string;
  from: PublicUser; guild: { id: string; name: string } | null;
}
export const getInbox = (since: string | undefined, signal?: AbortSignal) =>
  d<{ cursor: string; items: InboxItem[] }>(api.get('/social/inbox', { params: { ...(since ? { since } : {}), wait: 1 }, signal, timeout: 20_000 }));
/** Cerraste una carta: desde ya te vuelven a avisar de lo que llegue a ella. */
export const leaveLetterView = (key: string) => api.post('/social/view/leave', { key }).catch(() => undefined);
export const postGuildSnap = (guildId: string, photoUrl: string, content: string) =>
  d<GuildSendResult>(api.post(`/social/guilds/${guildId}/messages`, { kind: 'SNAP', photoUrl, content }));
export const getGuildBackground = (guildId: string) => d<Background | null>(api.get(`/social/guilds/${guildId}/background`));
export const setGuildBackground = (guildId: string, body: { photoUrl?: string | null; fit?: BackgroundFit }) =>
  d<{ background: BackgroundMeta | null }>(api.put(`/social/guilds/${guildId}/background`, body));

// Muñequitos en las zonas y gestos
export type GestureKind = 'wave' | 'heart' | 'dance' | 'cheer' | 'laugh' | 'highfive';
export interface ZoneVisitor extends PublicUser {
  letter: { preview: string; kind: string; at: string; count: number } | null;
}
export interface IncomingGesture {
  id: string; fromId: string; fromName: string; fromUsername: string; kind: GestureKind; zone: string | null; at: string;
}
export const getZoneVisitors = (name: string) => d<{ zone: string; visitors: ZoneVisitor[]; gestures: IncomingGesture[] }>(api.get('/social/zone', { params: { name } }));
export const sendGesture = (toUserId: string, kind: GestureKind, zone: string) => d<{ ok: boolean; throttled: boolean }>(api.post('/social/gestures', { toUserId, kind, zone }));

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

/** Reduce una imagen a `max` px (lado mayor) en JPEG: lo que viaja en los mensajes. */
export function compressPhoto(file: Blob, max = 720, quality = 0.72): Promise<string> {
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
  ['/social', 'Social'], ['/u/', 'Perfiles'], ['/habits', 'Hábitos'], ['/quests', 'Misiones'], ['/gym', 'Gimnasio'],
  ['/finances', 'Finanzas'], ['/food', 'Comida'], ['/sleep', 'Sueño'], ['/love', 'Jardín'], ['/journal', 'Diario'],
  ['/agenda', 'Agenda'], ['/learning', 'Aprendizaje'], ['/leaderboard', 'Ranking'],
  ['/season', 'Campaña'], ['/shop', 'Tienda'], ['/glow-up', 'Glow up'], ['/rituals', 'Rituales'], ['/wisdom', 'Sabiduría'],
  ['/achievements', 'Logros'], ['/stats', 'Estadísticas'], ['/profile', 'Perfil'], ['/settings', 'Ajustes'],
  ['/custom-zones', 'Mis zonas'], ['/history', 'Historial'], ['/friends', 'Social'], ['/guild', 'Social'],
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

/** Enlaces dentro de la sección Social (libreta, cartas y gremios en un solo sitio). */
export const socialLink = {
  letter: (username: string) => `/social?tab=cartas&chat=${encodeURIComponent(username)}`,
  guildLetter: (guildId: string) => `/social?tab=cartas&gchat=${encodeURIComponent(guildId)}`,
  guild: (guildId?: string) => (guildId ? `/social?tab=gremios&guild=${encodeURIComponent(guildId)}` : '/social?tab=gremios'),
  notebook: (view?: 'requests' | 'search') => (view ? `/social?tab=amigos&view=${view}` : '/social?tab=amigos'),
};
