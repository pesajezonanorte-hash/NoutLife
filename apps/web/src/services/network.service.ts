// Cliente de la red social: amigos (directorio), perfiles (DNI), cartas con fondo
// compartido y todo tipo de mensajes (texto, fotos de la cámara o la galería,
// notas de voz, stickers y minijuegos), rachas que se encienden al tercer día,
// gestos entre muñequitos, pareja, gremios múltiples, bloqueos, galería y
// revivir rachas con oro. Lo que llega en vivo viaja por lib/live.
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
  /** Color del nombre en cartas y gremios (clave de la paleta, ver lib/nameColors). */
  nameColor?: string | null;
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

export interface LastLetter {
  mine: boolean; kind: string; preview: string; at: string;
  /** Tu último mensaje ya lo vio (solo si esa persona comparte el "visto"). */
  seen?: boolean;
}

export interface FriendItem {
  friendshipId: string;
  since: string;
  friend: PublicUser & Presence & { currentStreak: number };
  streak: StreakView & { mineToday: boolean; theirsToday: boolean };
  unread: number;
  lastMessage: LastLetter | null;
  archived?: boolean;
}

export type RelationStatus = 'NONE' | 'FRIENDS' | 'PENDING_OUT' | 'PENDING_IN' | 'SELF' | 'BLOCKED';
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

/**
 * TEXT · SNAP (foto de la cámara) · PHOTO (foto de la galería) · VIDEO (hasta 15 s) · VOICE (nota de voz antigua)
 * · STICKER · GAME (minijuego) · EVENT (aviso de la carta: "bg", "bg-off", "edit:…").
 */
export type LetterKind = 'TEXT' | 'SNAP' | 'PHOTO' | 'VIDEO' | 'VOICE' | 'STICKER' | 'GAME' | 'EVENT';
export const PHOTO_KINDS = ['SNAP', 'PHOTO'];

/** Reacciones que se pueden poner a un mensaje. */
export const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥'] as const;
export interface ReactionCount { emoji: string; count: number; mine: boolean }
/** El mensaje al que responde otro (de la misma carta). */
export interface ReplyRef { id: string; authorId: string; kind: string; content: string | null; deleted?: boolean }

// ─── Minijuegos ───────────────────────────────────────────────────────────────
export type Mark = 'X' | 'O';
export interface TttGame { type: 'ttt'; board: Array<Mark | ''>; players: { X: string; O: string | null }; turn: Mark; winner: Mark | 'draw' | null; line: number[] | null }
export type RpsPick = 'r' | 'p' | 's';
export interface RpsGame { type: 'rps'; players: string[]; picks: Record<string, RpsPick>; picked?: string[]; winner: string | 'draw' | null }
export type Game = TttGame | RpsGame;

/** Datos ligeros que viajan con el mensaje. */
export interface MessageMeta {
  /** Miniatura (data URL diminuto) de la foto: se ve borrosa mientras llega la foto. */
  thumb?: string;
  durationMs?: number;
  peaks?: number[];
  /** Huella de la imagen del sticker. */
  sticker?: string;
  game?: Game;
}

/** Lo que tiene un mensaje en común en cualquier carta. */
export interface LetterBody {
  id: string; kind: LetterKind | string; content: string | null; meta: MessageMeta | null;
  /** Foto o audio: se piden aparte (getMedia). */
  media: { photo: boolean; audio: boolean };
  createdAt: string; editedAt: string | null; deletedAt: string | null;
  replyTo: ReplyRef | null;
  reactions: ReactionCount[];
}

export interface DM extends LetterBody { mine: boolean; habitTitle?: string | null }

/** Encuadre del fondo de una carta: foco (x, y) 0–1, zoom 1–3 e intensidad del papel. */
export interface BackgroundFit { x: number; y: number; zoom: number; paper: number }
export interface BackgroundMeta { at: string; mine: boolean; fit: BackgroundFit }
export type Background = BackgroundMeta & { photoUrl: string };
export const DEFAULT_FIT: BackgroundFit = { x: 0.5, y: 0.5, zoom: 1, paper: 0.42 };

/** Alguien escribiendo (hasta cuándo, en ISO). */
export interface Typing { userId: string; until: string }

export interface Conversation {
  friend: PublicUser & Presence;
  friendshipId: string;
  messages: DM[];
  hasMore: boolean;
  seenUntil: string | null;
  streak: StreakView & { mineToday: boolean; theirsToday: boolean };
  typing: Typing[];
  background: BackgroundMeta | null;
  /** Desde aquí se piden los cambios (reacciones, ediciones, borrados, jugadas). */
  cursor: string;
}

const d = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

// Presencia y ajustes
export const sendPresence = (zone: string, leaving = false) => d(api.post('/social/presence', { zone, leaving }));
export interface SocialSettings { bio: string; privacy: Privacy; nameColor: string | null }
export const getSocialSettings = () => d<SocialSettings>(api.get('/social/me/settings'));
export const updateSocialSettings = (body: { bio?: string; privacy?: Partial<Privacy>; nameColor?: string | null }) => d<SocialSettings>(api.patch('/social/me/settings', body));

// Amigos, perfiles y bloqueos
export const getNetwork = () => d<FriendItem[]>(api.get('/social/network'));
export const searchUsers = (q: string) => d<Array<{ user: PublicUser; relation: Relation }>>(api.get('/social/users/search', { params: { q } }));
export const getProfile = (username: string) => d<ProfileData>(api.get(`/social/users/${encodeURIComponent(username)}`));
export const sendFriendRequest = (identifier: string) => d(api.post('/social/friends', { identifier }));
export const respondFriendRequest = (id: string, accept: boolean) => d(api.patch(`/social/friends/${id}`, { accept }));
export const removeFriend = (id: string) => api.delete(`/social/friends/${id}`);
export interface PendingRequest { id: string; createdAt: string; requester: PublicUser }
export const getPendingRequests = () => d<PendingRequest[]>(api.get('/social/friends/pending'));
export const reviveFriendStreak = (friendshipId: string) => d<{ streak: StreakView; gold: number }>(api.post(`/social/friends/${friendshipId}/revive`));
export const getBlocked = () => d<Array<PublicUser & { blockedAt: string }>>(api.get('/social/blocks'));
export const blockUser = (userId: string) => d(api.post(`/social/blocks/${userId}`));
export const unblockUser = (userId: string) => d(api.delete(`/social/blocks/${userId}`));

// Cartas entre amigos
export interface OutgoingBody {
  kind?: 'TEXT' | 'SNAP' | 'PHOTO' | 'VIDEO' | 'STICKER';
  content?: string; photoUrl?: string; audioUrl?: string; meta?: MessageMeta; replyToId?: string;
}
export const getUnreadMessages = () => d<{ count: number }>(api.get('/social/messages/unread'));
export const getConversation = (userId: string, opts: { after?: string; before?: string } = {}) =>
  d<Conversation>(api.get(`/social/messages/${userId}`, { params: opts }));
export const reactDirect = (userId: string, messageId: string, emoji: string | null) =>
  d<{ id: string; emoji: string | null; reactions: ReactionCount[] }>(api.put(`/social/messages/${userId}/${messageId}/reaction`, { emoji }));
export const sendMessage = (userId: string, body: OutgoingBody) =>
  d<{ message: DM; streak: StreakView & { mineToday: boolean; theirsToday: boolean }; completed: boolean }>(api.post(`/social/messages/${userId}`, body));
export const getDirectBackground = (userId: string) => d<Background | null>(api.get(`/social/messages/${userId}/background`));
export const setDirectBackground = (userId: string, body: { photoUrl?: string | null; fit?: BackgroundFit }) =>
  d<{ background: BackgroundMeta | null }>(api.put(`/social/messages/${userId}/background`, body));

// Cualquier carta: "dm:<amigo>" | "guild:<gremio>"
export type ChatKey = string;
export const chatOf = { dm: (friendId: string) => `dm:${friendId}`, guild: (guildId: string) => `guild:${guildId}` };
export const editMessage = (chat: ChatKey, messageId: string, content: string) =>
  d<{ id: string; content: string; editedAt: string }>(api.patch(`/social/letters/message/${messageId}`, { chat, content }));
export const deleteMessage = (chat: ChatKey, messageId: string) =>
  d<{ id: string; deletedAt: string }>(api.delete(`/social/letters/message/${messageId}`, { params: { chat } }));
export const setChatPref = (chat: ChatKey, body: { archived?: boolean; clear?: boolean }) =>
  d<{ key: string; archived: boolean; clearedAt: string | null }>(api.put('/social/letters/prefs', { chat, ...body }));
/** "Escribiendo…": se enciende al teclear y se apaga al enviar o al parar. */
export const setTyping = (chat: ChatKey, on: boolean) => api.post('/social/typing', { chat, on }).catch(() => undefined);
/** Cerraste una carta: desde ya te vuelven a avisar de lo que llegue a ella. */
export const leaveLetterView = (key: string) => api.post('/social/view/leave', { key }).catch(() => undefined);
/** Foto y/o audio de un mensaje (no cambian: se guardan). */
export const getMedia = (side: 'dm' | 'guild', messageId: string) =>
  d<{ id: string; photoUrl: string | null; audioUrl: string | null }>(api.get(`/social/media/${side}/${messageId}`));
export const saveThumb = (side: 'dm' | 'guild', messageId: string, thumb: string) => api.put(`/social/media/${side}/${messageId}/thumb`, { thumb }).catch(() => undefined);

// Galería
export interface GalleryItem {
  side: 'dm' | 'guild'; id: string; at: string; kind: string; caption: string | null; thumb: string | null; mine: boolean;
  author: PublicUser;
  place: { type: 'dm'; user: PublicUser } | { type: 'guild'; guild: { id: string; name: string } };
}
export type GalleryFilter = 'all' | 'mine' | 'friends' | 'guilds';
export const getGallery = (opts: { before?: string; filter?: GalleryFilter } = {}) =>
  d<{ items: GalleryItem[]; next: string | null }>(api.get('/social/gallery', { params: opts }));

// Stickers
export interface StickerRow { id: string; hash: string; authorId: string | null; createdAt: string; mine: boolean }
export const getStickers = () => d<StickerRow[]>(api.get('/social/stickers'));
export const createSticker = (imageUrl: string) => d<StickerRow>(api.post('/social/stickers', { imageUrl }));
export const saveSticker = (hash: string) => d<StickerRow>(api.post('/social/stickers/save', { hash }));
export const deleteSticker = (id: string) => d(api.delete(`/social/stickers/${id}`));
export const getStickerImage = (hash: string) => d<{ hash: string; imageUrl: string }>(api.get(`/social/stickers/image/${hash}`));

// Minijuegos
export type GameType = 'ttt' | 'rps';
export const startGame = (chat: ChatKey, type: GameType) => d<DM | GuildMessage>(api.post('/social/games', { chat, type }));
export const playMove = (side: 'dm' | 'guild', messageId: string, move: number | RpsPick) =>
  d<{ id: string; game: Game }>(api.post(`/social/games/${side}/${messageId}/move`, { move }));

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
  lastMessage: (LastLetter & { author: string; seenBy?: number }) | null;
  archived?: boolean;
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
export interface GuildMessage extends LetterBody {
  userId: string; dayKey?: string | null;
  user: PublicUser;
}
export type GuildSendResult = GuildMessage & { enemyDefeated: boolean; streakCompleted: boolean; streak: StreakView };
/** Hasta cuándo leyó cada miembro (para "visto por"). */
export interface GuildRead { userId: string; at: string }
export interface GuildLetter { messages: GuildMessage[]; hasMore: boolean; cursor: string; reads: GuildRead[]; typing: Typing[] }

export const getMyGuilds = () => d<GuildSummary[]>(api.get('/social/guilds'));
export const getGuild = (id: string) => d<GuildDetail>(api.get(`/social/guilds/${id}`));
export const updateGuildInfo = (id: string, body: { name?: string; description?: string; emblem?: string; photoUrl?: string | null }) =>
  d<{ id: string; name: string; description: string | null; emblem: string; photoUrl: string | null }>(api.patch(`/social/guilds/${id}`, body));
export const getGuildInvites = () => d<GuildInvite[]>(api.get('/social/guild-invites'));
export const respondGuildInvite = (id: string, accept: boolean) => d<{ guildId: string; accepted: boolean }>(api.post(`/social/guild-invites/${id}`, { accept }));
export const inviteToGuild = (guildId: string, userId: string) => d(api.post(`/social/guilds/${guildId}/invite`, { userId }));
export const getGuildLetter = (guildId: string, before?: string) => d<GuildLetter>(api.get(`/social/guilds/${guildId}/letter`, { params: before ? { before } : {} }));
export const getGuildMessagesAfter = (guildId: string, after?: string) => d<GuildMessage[]>(api.get(`/social/guilds/${guildId}/messages`, { params: after ? { after } : {} }));
/** Solo mirar la carta (el muro de fotos del campamento) sin darla por leída. */
export const peekGuildMessages = (guildId: string) => d<GuildMessage[]>(api.get(`/social/guilds/${guildId}/messages`, { params: { peek: 1 } }));
export const postGuildMessage = (guildId: string, body: OutgoingBody) => d<GuildSendResult>(api.post(`/social/guilds/${guildId}/messages`, body));
export const postGuildText = (guildId: string, content: string, replyToId?: string) => postGuildMessage(guildId, { content, replyToId });
export const postGuildSnap = (guildId: string, photoUrl: string, content: string, meta?: MessageMeta) =>
  postGuildMessage(guildId, { kind: 'SNAP', photoUrl, content, meta });
export const reactGuild = (guildId: string, messageId: string, emoji: string | null) =>
  d<{ id: string; emoji: string | null; reactions: ReactionCount[] }>(api.put(`/social/guilds/${guildId}/messages/${messageId}/reaction`, { emoji }));
export const getGuildBackground = (guildId: string) => d<Background | null>(api.get(`/social/guilds/${guildId}/background`));
export const setGuildBackground = (guildId: string, body: { photoUrl?: string | null; fit?: BackgroundFit }) =>
  d<{ background: BackgroundMeta | null }>(api.put(`/social/guilds/${guildId}/background`, body));

// Avisos de mensajes (llegan por el chat en vivo)
export interface InboxItem {
  type: 'dm' | 'guild'; id: string; at: string; kind: string; preview: string;
  from: PublicUser; guild: { id: string; name: string } | null;
}

// Muñequitos en las zonas y gestos
export type GestureKind = 'wave' | 'heart' | 'dance' | 'cheer' | 'laugh' | 'highfive';
export interface ZoneVisitor extends PublicUser {
  letter: { preview: string; kind: string; at: string; count: number } | null;
}
export interface IncomingGesture {
  id: string; fromId: string; fromName: string; fromUsername: string; kind: GestureKind; zone: string | null; at: string;
}
export interface ZoneSection { zone: string; visitors: ZoneVisitor[]; gestures: IncomingGesture[] }
export const getZoneVisitors = (name: string) => d<ZoneSection>(api.get('/social/zone', { params: { name } }));
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

/** Carga una imagen (archivo o data URL) sin bloquear el hilo principal cuando se puede. */
async function loadBitmap(src: Blob | string): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof src !== 'string' && 'createImageBitmap' in window) {
    try { return await createImageBitmap(src); } catch { /* algunos formatos: con <img> */ }
  }
  return new Promise((resolve, reject) => {
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { if (typeof src !== 'string') URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { if (typeof src !== 'string') URL.revokeObjectURL(url); reject(new Error('No se pudo leer la foto')); };
    img.src = url;
  });
}
const sizeOf = (img: ImageBitmap | HTMLImageElement) => ('naturalWidth' in img ? [img.naturalWidth, img.naturalHeight] : [img.width, img.height]);

/** Pasa un canvas a data URL sin congelar la pantalla (toBlob es asíncrono). */
function canvasToDataUrl(canvas: HTMLCanvasElement, type: string, quality: number): Promise<string> {
  return new Promise((resolve) => {
    if (!canvas.toBlob) { resolve(canvas.toDataURL(type, quality)); return; }
    canvas.toBlob((blob) => {
      if (!blob) { resolve(canvas.toDataURL(type, quality)); return; }
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => resolve(canvas.toDataURL(type, quality));
      r.readAsDataURL(blob);
    }, type, quality);
  });
}

/** Reduce una imagen a `max` px (lado mayor) en JPEG: lo que viaja en los mensajes. */
export async function compressPhoto(file: Blob | string, max = 720, quality = 0.72): Promise<string> {
  const img = await loadBitmap(file);
  const [w, h] = sizeOf(img);
  const k = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * k);
  canvas.height = Math.round(h * k);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Sin canvas');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  if ('close' in img) img.close();
  return canvasToDataUrl(canvas, 'image/jpeg', quality);
}

/** Recorta el centro en cuadrado (como la película instantánea) y lo pasa a JPEG. */
export async function squarePhoto(src: Blob | string | CanvasImageSource, side = 720, mirror = false): Promise<string> {
  const img = src instanceof Blob || typeof src === 'string' ? await loadBitmap(src) : src;
  const w = 'videoWidth' in img ? img.videoWidth : 'naturalWidth' in img ? img.naturalWidth : (img as ImageBitmap).width;
  const h = 'videoHeight' in img ? img.videoHeight : 'naturalHeight' in img ? img.naturalHeight : (img as ImageBitmap).height;
  const s = Math.min(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = side; canvas.height = side;
  const ctx = canvas.getContext('2d');
  if (!ctx || !s) throw new Error('No se pudo leer la foto');
  if (mirror) { ctx.translate(side, 0); ctx.scale(-1, 1); }
  ctx.drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, side, side);
  let url = await canvasToDataUrl(canvas, 'image/jpeg', 0.8);
  if (url.length > 560_000) url = await canvasToDataUrl(canvas, 'image/jpeg', 0.62);
  return url;
}

/** Miniatura diminuta (24 px) de una foto: se ve borrosa mientras llega la buena. */
export async function thumbOf(src: string): Promise<string | null> {
  try {
    const img = await loadBitmap(src);
    const [w, h] = sizeOf(img);
    const k = 24 / Math.max(w, h);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * k)); canvas.height = Math.max(1, Math.round(h * k));
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL('image/jpeg', 0.5);
    return url.length < 6000 ? url : null;
  } catch { return null; }
}

/** Zona de Noutlife por ruta (lo que tus amigos ven si lo permites). */
const ZONE_NAMES: Array<[string, string]> = [
  ['/social', 'Social'], ['/u/', 'Perfiles'], ['/habits', 'Hábitos'], ['/quests', 'Misiones'], ['/gym', 'Gimnasio'],
  ['/finances', 'Finanzas'], ['/food', 'Comida'], ['/sleep', 'Sueño'], ['/love', 'Jardín'], ['/journal', 'Diario'],
  ['/agenda', 'Agenda'], ['/learning', 'Aprendizaje'], ['/leaderboard', 'Ranking'], ['/gallery', 'Galería'],
  ['/season', 'Campaña'], ['/shop', 'Tienda'], ['/armario', 'Armario'], ['/glow-up', 'Armario'], ['/rituals', 'Rituales'], ['/wisdom', 'Sabiduría'],
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

/** Enlaces dentro de la sección Social (directorio, cartas y gremios en un solo sitio). */
export const socialLink = {
  letter: (username: string) => `/social?tab=cartas&chat=${encodeURIComponent(username)}`,
  guildLetter: (guildId: string) => `/social?tab=cartas&gchat=${encodeURIComponent(guildId)}`,
  guild: (guildId?: string) => (guildId ? `/social?tab=gremios&guild=${encodeURIComponent(guildId)}` : '/social?tab=gremios'),
  directory: (view?: 'requests' | 'search') => (view ? `/social?tab=directorio&view=${view}` : '/social?tab=directorio'),
  notebook: (view?: 'requests' | 'search') => (view ? `/social?tab=directorio&view=${view}` : '/social?tab=directorio'),
};
