// Piezas comunes del chat en vivo, iguales para las cartas entre amigos y las de
// gremio: reacciones, respuestas, qué carta tiene abierta cada persona (para no
// avisarle de lo que llega a esa misma carta) y la espera larga del sondeo (la
// petición se queda abierta hasta que haya algo nuevo, así lo nuevo llega en
// ~1 s sin que el navegador pregunte a cada instante).
import { prisma } from '../lib/prisma';

export const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥'] as const;

/** Cuánto vale un "tiene la carta abierta": el sondeo en vivo lo renueva cada pocos segundos. */
const VIEW_FRESH_MS = 25_000;
/** La app en primer plano: el aviso sale dentro de la app, no como push del sistema. */
const APP_FRESH_MS = 20_000;
export const APP_KEY = 'app';
export const dmKey = (otherId: string) => `dm:${otherId}`;
export const guildKey = (guildId: string) => `guild:${guildId}`;

/** Espera máxima de una petición larga (cabe en el límite de las funciones serverless). */
export const HOLD_MS = 8_000;
const TICK_MS = 1_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Repite `check` cada segundo hasta que devuelva algo o se acabe la espera. */
export async function holdUntil<T>(check: () => Promise<T | null>, wait: boolean): Promise<T | null> {
  const deadline = Date.now() + (wait ? HOLD_MS : 0);
  for (;;) {
    const found = await check();
    if (found || Date.now() >= deadline) return found;
    await sleep(TICK_MS);
  }
}

export const parseDate = (raw: unknown): Date | null => {
  if (typeof raw !== 'string' || !raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

// ─── Qué carta tiene abierta cada persona ─────────────────────────────────────

export function touchView(userId: string, key: string) {
  const at = new Date();
  return prisma.chatView.upsert({ where: { userId_key: { userId, key } }, create: { userId, key, at }, update: { at } }).catch(() => null);
}

export function clearView(userId: string, key: string) {
  return prisma.chatView.deleteMany({ where: { userId, key } }).catch(() => null);
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

// ─── Reacciones y respuestas ──────────────────────────────────────────────────

export type MessageSide = 'dm' | 'guild';
export interface ReactionCount { emoji: string; count: number; mine: boolean }
export interface ReplyRef { id: string; authorId: string; kind: string; content: string | null }

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
  const stamp = { reactedAt: new Date() };
  if (side === 'dm') await prisma.directMessage.update({ where: { id: messageId }, data: stamp });
  else await prisma.guildMessage.update({ where: { id: messageId }, data: stamp });
  return { emoji: now, reactions: (await reactionsFor(side, [messageId], me)).get(messageId) ?? [] };
}

/** Los mensajes citados por estas respuestas (solo de la misma carta). */
export async function repliesFor(side: MessageSide, rows: Array<{ replyToId: string | null }>, scope: Record<string, unknown>): Promise<Map<string, ReplyRef>> {
  const ids = [...new Set(rows.map((r) => r.replyToId).filter((x): x is string => Boolean(x)))];
  const out = new Map<string, ReplyRef>();
  if (!ids.length) return out;
  if (side === 'dm') {
    const found = await prisma.directMessage.findMany({ where: { ...scope, id: { in: ids } }, select: { id: true, senderId: true, kind: true, content: true } });
    for (const m of found) out.set(m.id, { id: m.id, authorId: m.senderId, kind: m.kind, content: m.content });
  } else {
    const found = await prisma.guildMessage.findMany({ where: { ...scope, id: { in: ids } }, select: { id: true, userId: true, kind: true, content: true } });
    for (const m of found) out.set(m.id, { id: m.id, authorId: m.userId, kind: m.kind, content: m.content });
  }
  return out;
}

/** A qué mensaje se responde: debe ser de la misma carta y no un aviso. */
export async function validReplyTo(side: MessageSide, raw: unknown, scope: Record<string, unknown>): Promise<string | null> {
  if (typeof raw !== 'string' || !raw) return null;
  const found = side === 'dm'
    ? await prisma.directMessage.findFirst({ where: { ...scope, id: raw, kind: { not: 'EVENT' } }, select: { id: true } })
    : await prisma.guildMessage.findFirst({ where: { ...scope, id: raw, kind: { not: 'EVENT' } }, select: { id: true } });
  return found?.id ?? null;
}

/** Fragmento corto de un mensaje para citarlo o avisar de él. */
export const snippet = (m: { kind: string; content: string | null }, max = 120) =>
  (m.kind === 'SNAP' ? (m.content ? `Foto · ${m.content}` : 'Foto') : (m.content ?? '')).slice(0, max);
