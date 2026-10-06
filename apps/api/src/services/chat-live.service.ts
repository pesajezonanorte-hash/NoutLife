// Piezas comunes de las cartas (la de dos amigos y la de un gremio): el timbre
// del chat en vivo, qué carta tiene abierta cada persona y quién escribe, los
// tipos de mensaje (texto, foto de la cámara o de la galería, nota de voz,
// sticker, minijuego), cómo viaja cada mensaje al cliente (las fotos y los
// audios se piden aparte: pesan), reacciones, respuestas, bloqueos y cartas
// vaciadas. Solo depende de la base de datos para que lo usen todos los servicios.
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

// ─── Timbre del chat en vivo ──────────────────────────────────────────────────

/**
 * Hace sonar el timbre de estas personas: su petición larga responde en ~1 s con
 * lo nuevo. Se llama tras cualquier cosa que deban ver al momento (mensajes,
 * reacciones, ediciones, lecturas, alguien escribiendo, un amigo que cambia de zona).
 */
export async function bump(userIds: Array<string | null | undefined>) {
  const ids = [...new Set(userIds.filter((x): x is string => Boolean(x)))];
  if (!ids.length) return;
  await prisma.$executeRaw`
    INSERT INTO "live_signals" ("userId", "seq", "at")
    SELECT id, 1, CURRENT_TIMESTAMP FROM unnest(${ids}::text[]) AS id
    ON CONFLICT ("userId") DO UPDATE SET "seq" = "live_signals"."seq" + 1, "at" = CURRENT_TIMESTAMP
  `.catch(() => undefined);
}

/** Número del timbre de una persona (0 si nunca sonó). */
export async function signalOf(userId: string): Promise<number> {
  const row = await prisma.liveSignal.findUnique({ where: { userId }, select: { seq: true } });
  return row ? Number(row.seq) : 0;
}

/** Espera máxima de una petición larga (cabe en el límite de las funciones serverless). */
export const HOLD_MS = 8_000;
const TICK_MS = 1_500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Repite `check` cada segundo hasta que devuelva algo o se acabe la espera. */
export async function holdUntil<T>(check: () => Promise<T | null>, wait: boolean, holdMs = HOLD_MS, cancelled?: () => boolean): Promise<T | null> {
  const deadline = Date.now() + (wait ? holdMs : 0);
  for (;;) {
    const found = await check();
    if (found || Date.now() >= deadline || cancelled?.()) return found;
    await sleep(TICK_MS);
  }
}

export const parseDate = (raw: unknown): Date | null => {
  if (typeof raw !== 'string' || !raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

// ─── Qué carta tiene abierta cada persona y quién escribe ─────────────────────

/** Cuánto vale un "tiene la carta abierta": el chat en vivo lo renueva cada pocos segundos. */
const VIEW_FRESH_MS = 25_000;
/** La app en primer plano: el aviso sale dentro de la app, no como push del sistema. */
const APP_FRESH_MS = 20_000;
/** Un "escribiendo…" se apaga solo si no se renueva. */
export const TYPING_MS = 6_000;
export const APP_KEY = 'app';
export const dmKey = (otherId: string) => `dm:${otherId}`;
export const guildKey = (guildId: string) => `guild:${guildId}`;

export function touchView(userId: string, key: string) {
  const at = new Date();
  return prisma.chatView.upsert({ where: { userId_key: { userId, key } }, create: { userId, key, at }, update: { at } }).catch(() => null);
}

export function clearView(userId: string, key: string) {
  return prisma.chatView.updateMany({ where: { userId, key }, data: { at: new Date(0), typingAt: null } }).catch(() => null);
}

/** De estas personas, quiénes tienen ahora esa carta abierta. */
export async function viewing(userIds: string[], key: string, ms = VIEW_FRESH_MS): Promise<Set<string>> {
  if (!userIds.length) return new Set();
  const rows = await prisma.chatView.findMany({ where: { userId: { in: userIds }, key, at: { gt: new Date(Date.now() - ms) } }, select: { userId: true } });
  return new Set(rows.map((r) => r.userId));
}

export async function isViewing(userId: string, key: string) {
  return (await viewing([userId], key)).has(userId);
}

export const appActive = async (userId: string) => (await viewing([userId], APP_KEY, APP_FRESH_MS)).has(userId);

/** Marca (o apaga) que `userId` está escribiendo en la carta `key`. */
export async function markTyping(userId: string, key: string, on: boolean) {
  const now = new Date();
  const prev = await prisma.chatView.findUnique({ where: { userId_key: { userId, key } }, select: { typingAt: true } });
  const wasOn = Boolean(prev?.typingAt && now.getTime() - prev.typingAt.getTime() < TYPING_MS);
  await prisma.chatView.upsert({
    where: { userId_key: { userId, key } },
    create: { userId, key, at: now, typingAt: on ? now : null },
    update: { at: now, typingAt: on ? now : null },
  });
  // Solo hace falta avisar cuando cambia (encendido ↔ apagado) o cada pocos segundos.
  const fresh = Boolean(prev?.typingAt && now.getTime() - prev.typingAt.getTime() < TYPING_MS / 2);
  return on ? !fresh : wasOn;
}

// ─── Bloqueos y cartas vaciadas ───────────────────────────────────────────────

/** Personas bloqueadas por `me` o que bloquearon a `me` (no se ven entre sí). */
export async function blockedWith(me: string): Promise<Set<string>> {
  const rows = await prisma.userBlock.findMany({ where: { OR: [{ blockerId: me }, { blockedId: me }] }, select: { blockerId: true, blockedId: true } });
  return new Set(rows.map((r) => (r.blockerId === me ? r.blockedId : r.blockerId)));
}

export async function isBlocked(a: string, b: string) {
  return Boolean(await prisma.userBlock.findFirst({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] }, select: { blockerId: true } }));
}

/** Desde cuándo ve `me` cada carta (lo anterior lo borró de su lado), y cuáles archivó. */
export async function chatPrefsOf(me: string) {
  const rows = await prisma.chatPref.findMany({ where: { userId: me }, select: { key: true, archivedAt: true, clearedAt: true } });
  return new Map(rows.map((r) => [r.key, r]));
}

export async function clearedAt(me: string, key: string): Promise<Date | null> {
  const row = await prisma.chatPref.findUnique({ where: { userId_key: { userId: me, key } }, select: { clearedAt: true } });
  return row?.clearedAt ?? null;
}

// ─── Tipos de mensaje ─────────────────────────────────────────────────────────

/** Mensajes que cuentan como "hablar" para la racha (los avisos de la carta no). */
export const TALK_KINDS = ['TEXT', 'SNAP', 'PHOTO', 'VOICE', 'STICKER', 'GAME'];
/** Mensajes con foto (de la cámara o de la galería). */
export const PHOTO_KINDS = ['SNAP', 'PHOTO'];

const PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const PHOTO_MAX = 600_000;
const THUMB = /^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const THUMB_MAX = 6_000;
const AUDIO = /^data:audio\/(webm|ogg|mp4|mpeg|aac|x-m4a|wav)(;s*codecs=[a-z0-9.,]+)?;base64,[A-Za-z0-9+/=]+$/i;
const AUDIO_MAX = 1_000_000;
const STICKER_IMG = /^data:image\/(webp|png);base64,[A-Za-z0-9+/=]+$/;
const STICKER_MAX = 400_000;
export const VOICE_MAX_MS = 120_000;

export function validPhoto(value: unknown): string {
  if (typeof value !== 'string' || value.length > PHOTO_MAX || !PHOTO.test(value)) {
    throw new Error('La foto debe ser una imagen JPEG, PNG o WebP de menos de 450 kB.');
  }
  return value;
}

export function validThumb(value: unknown): string | null {
  return typeof value === 'string' && value.length <= THUMB_MAX && THUMB.test(value) ? value : null;
}

/** Lo que el cliente puede mandar en `meta` (lo demás se descarta). */
export interface MessageMeta {
  thumb?: string;
  durationMs?: number;
  peaks?: number[];
  sticker?: string;
  game?: unknown;
}

function voiceMeta(raw: Record<string, unknown>): MessageMeta {
  const d = typeof raw.durationMs === 'number' && Number.isFinite(raw.durationMs) ? Math.round(raw.durationMs) : 0;
  if (d < 300) throw new Error('La nota de voz es demasiado corta');
  const peaks = Array.isArray(raw.peaks)
    ? raw.peaks.slice(0, 64).map((v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.min(1, Math.max(0, v)) * 100) / 100 : 0))
    : [];
  return { durationMs: Math.min(d, VOICE_MAX_MS), peaks };
}

export interface Outgoing {
  kind: string;
  content: string;
  photoUrl: string | null;
  audioUrl: string | null;
  meta: MessageMeta | null;
}

/**
 * Valida un mensaje que llega del cliente y lo deja listo para guardar.
 * TEXT · SNAP (foto de la cámara) · PHOTO (de la galería) · VOICE · STICKER.
 */
export async function parseOutgoing(body: { kind?: unknown; content?: unknown; photoUrl?: unknown; audioUrl?: unknown; meta?: unknown }, maxText: number): Promise<Outgoing> {
  const kind = typeof body.kind === 'string' && ['SNAP', 'PHOTO', 'VOICE', 'STICKER'].includes(body.kind) ? body.kind : 'TEXT';
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const raw = (body.meta && typeof body.meta === 'object' ? body.meta : {}) as Record<string, unknown>;
  if (kind === 'TEXT') {
    if (!content) throw new Error('Mensaje vacío');
    if (content.length > maxText) throw new Error('Mensaje demasiado largo');
    return { kind, content, photoUrl: null, audioUrl: null, meta: null };
  }
  if (kind === 'SNAP' || kind === 'PHOTO') {
    if (!body.photoUrl) throw new Error('La foto no llegó. Vuelve a intentarlo.');
    const thumb = validThumb(raw.thumb);
    return { kind, content: content.slice(0, 120), photoUrl: validPhoto(body.photoUrl), audioUrl: null, meta: thumb ? { thumb } : null };
  }
  if (kind === 'VOICE') {
    if (typeof body.audioUrl !== 'string' || body.audioUrl.length > AUDIO_MAX || !AUDIO.test(body.audioUrl)) {
      throw new Error('La nota de voz no llegó bien. Grábala otra vez (máximo 2 minutos).');
    }
    return { kind, content: '', photoUrl: null, audioUrl: body.audioUrl, meta: voiceMeta(raw) };
  }
  // STICKER: solo viaja la huella de su imagen (guardada una vez).
  const hash = typeof raw.sticker === 'string' && /^[a-f0-9]{64}$/.test(raw.sticker) ? raw.sticker : null;
  if (!hash || !(await prisma.stickerImage.findUnique({ where: { hash }, select: { hash: true } }))) throw new Error('Ese sticker ya no existe');
  return { kind, content: '', photoUrl: null, audioUrl: null, meta: { sticker: hash } };
}

/** Texto corto de un mensaje para listas, avisos, citas y el muñequito pixel. */
export function snippet(m: { kind: string; content: string | null; deletedAt?: Date | string | null; meta?: unknown }, max = 120) {
  if (m.deletedAt) return 'Mensaje borrado';
  switch (m.kind) {
    case 'SNAP':
    case 'PHOTO': return (m.content ? `Foto · ${m.content}` : 'Foto').slice(0, max);
    case 'VOICE': {
      const d = (m.meta as MessageMeta | null)?.durationMs;
      return d ? `Nota de voz · ${Math.floor(d / 60000)}:${String(Math.round((d % 60000) / 1000)).padStart(2, '0')}` : 'Nota de voz';
    }
    case 'STICKER': return 'Sticker';
    case 'GAME': return gameLabel(m.meta);
    case 'EVENT': return m.content === 'bg-off' ? 'La carta volvió al papel' : m.content?.startsWith('edit:') ? 'Cambios en el gremio' : 'Nuevo fondo para la carta';
    default: return (m.content ?? '').slice(0, max);
  }
}

function gameLabel(meta: unknown) {
  const type = ((meta as { game?: { type?: string } } | null)?.game?.type) ?? '';
  return type === 'ttt' ? 'Tres en raya' : type === 'rps' ? 'Piedra, papel o tijera' : 'Minijuego';
}

// ─── Cómo viaja cada mensaje ──────────────────────────────────────────────────

/** Columnas de un mensaje sin la foto ni el audio (pesan: se piden aparte). */
export const DM_LIGHT = {
  id: true, senderId: true, receiverId: true, kind: true, content: true, meta: true, habitTitle: true, dayKey: true,
  readAt: true, createdAt: true, replyToId: true, changedAt: true, editedAt: true, deletedAt: true,
} as const;
export const GUILD_LIGHT = {
  id: true, guildId: true, userId: true, kind: true, content: true, meta: true, dayKey: true,
  createdAt: true, replyToId: true, changedAt: true, editedAt: true, deletedAt: true,
} as const;

interface LightRow { id: string; kind: string; content: string | null; meta: Prisma.JsonValue | null; createdAt: Date; editedAt: Date | null; deletedAt: Date | null }

/**
 * Lo que ve cada persona del `meta` de un mensaje: en un duelo de piedra, papel o
 * tijera nadie ve la elección del otro hasta que eligen los dos (solo sabe que ya eligió).
 */
export function publicMeta(meta: unknown, me: string): MessageMeta | null {
  if (!meta || typeof meta !== 'object') return null;
  const m = meta as MessageMeta & { game?: { type?: string; winner?: unknown; picks?: Record<string, string> } };
  const g = m.game;
  if (g?.type !== 'rps' || g.winner || !g.picks) return m;
  const picked = Object.keys(g.picks);
  return { ...m, game: { ...g, picks: g.picks[me] ? { [me]: g.picks[me] } : {}, picked } };
}

/** La parte común de un mensaje tal como la ve el cliente. */
export function letterBody(m: LightRow, me: string) {
  const deleted = Boolean(m.deletedAt);
  return {
    id: m.id,
    kind: m.kind,
    content: deleted ? null : m.content || null,
    meta: deleted ? null : publicMeta(m.meta, me),
    media: { photo: !deleted && PHOTO_KINDS.includes(m.kind), audio: !deleted && m.kind === 'VOICE' },
    createdAt: m.createdAt.toISOString(),
    editedAt: m.editedAt?.toISOString() ?? null,
    deletedAt: m.deletedAt?.toISOString() ?? null,
  };
}

// ─── Reacciones y respuestas ──────────────────────────────────────────────────

export const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥'] as const;

export type MessageSide = 'dm' | 'guild';
export interface ReactionCount { emoji: string; count: number; mine: boolean }
export interface ReplyRef { id: string; authorId: string; kind: string; content: string | null; deleted?: boolean }

export function validReaction(emoji: unknown): string | null {
  if (emoji === null || emoji === undefined || emoji === '') return null;
  if (typeof emoji === 'string' && (REACTIONS as readonly string[]).includes(emoji)) return emoji;
  throw new Error('Esa reacción no existe');
}

const col = (side: MessageSide) => (side === 'dm' ? 'dmId' : 'guildMessageId');

/** Reacciones agrupadas por mensaje: cuántas de cada tipo y si una es tuya. */
export async function reactionsFor(side: MessageSide, ids: string[], me: string): Promise<Map<string, ReactionCount[]>> {
  const out = new Map<string, ReactionCount[]>();
  if (!ids.length) return out;
  const rows = await prisma.messageReaction.findMany({
    where: { [col(side)]: { in: ids } },
    select: { dmId: true, guildMessageId: true, userId: true, emoji: true },
    orderBy: { createdAt: 'asc' },
  });
  for (const r of rows) {
    const id = (side === 'dm' ? r.dmId : r.guildMessageId)!;
    const list = out.get(id) ?? [];
    const found = list.find((x) => x.emoji === r.emoji);
    if (found) { found.count += 1; found.mine ||= r.userId === me; }
    else list.push({ emoji: r.emoji, count: 1, mine: r.userId === me });
    out.set(id, list);
  }
  return out;
}

/** Pone, cambia o quita (con la misma reacción, o con `null`) la reacción de `me`. */
export async function setReaction(side: MessageSide, messageId: string, me: string, emoji: string | null) {
  const where = { [col(side)]: messageId, userId: me };
  const current = await prisma.messageReaction.findFirst({ where, select: { id: true, emoji: true } });
  let now: string | null = emoji;
  if (!emoji || current?.emoji === emoji) {
    now = null;
    if (current) await prisma.messageReaction.delete({ where: { id: current.id } });
  } else if (current) await prisma.messageReaction.update({ where: { id: current.id }, data: { emoji } });
  else await prisma.messageReaction.create({ data: { ...where, emoji } });
  await touchMessage(side, messageId);
  return { emoji: now, reactions: (await reactionsFor(side, [messageId], me)).get(messageId) ?? [] };
}

/** Marca un mensaje como cambiado (lo recogen los demás en su siguiente sondeo). */
export function touchMessage(side: MessageSide, messageId: string, data: Record<string, unknown> = {}) {
  const stamp = { ...data, changedAt: new Date() };
  return side === 'dm'
    ? prisma.directMessage.update({ where: { id: messageId }, data: stamp })
    : prisma.guildMessage.update({ where: { id: messageId }, data: stamp });
}

/** Los mensajes citados por estas respuestas (solo de la misma carta). */
export async function repliesFor(side: MessageSide, rows: Array<{ replyToId: string | null }>, scope: Record<string, unknown>): Promise<Map<string, ReplyRef>> {
  const ids = [...new Set(rows.map((r) => r.replyToId).filter((x): x is string => Boolean(x)))];
  const out = new Map<string, ReplyRef>();
  if (!ids.length) return out;
  const pick = { id: true, kind: true, content: true, meta: true, deletedAt: true } as const;
  if (side === 'dm') {
    const found = await prisma.directMessage.findMany({ where: { ...scope, id: { in: ids } }, select: { ...pick, senderId: true } });
    for (const m of found) out.set(m.id, { id: m.id, authorId: m.senderId, kind: m.kind, content: m.deletedAt ? null : snippet(m, 140), deleted: Boolean(m.deletedAt) });
  } else {
    const found = await prisma.guildMessage.findMany({ where: { ...scope, id: { in: ids } }, select: { ...pick, userId: true } });
    for (const m of found) out.set(m.id, { id: m.id, authorId: m.userId, kind: m.kind, content: m.deletedAt ? null : snippet(m, 140), deleted: Boolean(m.deletedAt) });
  }
  return out;
}

/** A qué mensaje se responde: debe ser de la misma carta, no un aviso ni uno borrado. */
export async function validReplyTo(side: MessageSide, raw: unknown, scope: Record<string, unknown>): Promise<string | null> {
  if (typeof raw !== 'string' || !raw) return null;
  const where = { ...scope, id: raw, kind: { not: 'EVENT' }, deletedAt: null };
  const found = side === 'dm'
    ? await prisma.directMessage.findFirst({ where, select: { id: true } })
    : await prisma.guildMessage.findFirst({ where, select: { id: true } });
  return found?.id ?? null;
}

// ─── Stickers ─────────────────────────────────────────────────────────────────

/** Guarda (una vez) la imagen de un sticker y devuelve su huella. */
export async function storeStickerImage(imageUrl: unknown): Promise<string> {
  if (typeof imageUrl !== 'string' || imageUrl.length > STICKER_MAX || !STICKER_IMG.test(imageUrl)) {
    throw new Error('El sticker debe ser una imagen WebP o PNG de menos de 190 kB.');
  }
  const hash = createHash('sha256').update(imageUrl).digest('hex');
  await prisma.stickerImage.upsert({ where: { hash }, create: { hash, imageUrl }, update: {} });
  return hash;
}
