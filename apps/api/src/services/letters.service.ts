// Lo que se puede hacer con cualquier carta (de dos amigos o de un gremio) más
// allá de escribir: editar y borrar tus mensajes, pedir la foto o el audio de un
// mensaje (no viajan con la carta), la galería con todas las fotos, los stickers
// propios, archivar o vaciar una carta y bloquear a alguien.
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { blockedWith, bump, chatPrefsOf, dmKey, guildKey, PHOTO_KINDS, storeStickerImage, touchMessage, validThumb } from './chat-live.service';
import { requireFriends, PUBLIC_USER } from './network.service';

export type ChatScope = { side: 'dm'; otherId: string; key: string } | { side: 'guild'; guildId: string; key: string };

/** "dm:<amigo>" | "guild:<gremio>" → a qué carta se refiere. */
export function scopeOf(chat: unknown): ChatScope {
  const m = typeof chat === 'string' ? /^(dm|guild):([A-Za-z0-9_-]{6,40})$/.exec(chat) : null;
  if (!m) throw new Error('Carta no válida');
  return m[1] === 'dm' ? { side: 'dm', otherId: m[2], key: dmKey(m[2]) } : { side: 'guild', guildId: m[2], key: guildKey(m[2]) };
}

async function requireMember(userId: string, guildId: string) {
  const member = await prisma.guildMember.findFirst({ where: { userId, guildId }, select: { id: true } });
  if (!member) throw new Error('No perteneces a este gremio');
}

/** Quiénes comparten la carta (y comprueba que `me` es uno de ellos). */
export async function participants(me: string, scope: ChatScope): Promise<string[]> {
  if (scope.side === 'dm') {
    await requireFriends(me, scope.otherId);
    return [me, scope.otherId];
  }
  await requireMember(me, scope.guildId);
  const rows = await prisma.guildMember.findMany({ where: { guildId: scope.guildId }, select: { userId: true } });
  return rows.map((r) => r.userId);
}

async function ownMessage(me: string, scope: ChatScope, id: string) {
  if (scope.side === 'dm') {
    const where = { id, OR: [{ senderId: me, receiverId: scope.otherId }, { senderId: scope.otherId, receiverId: me }] };
    const row = await prisma.directMessage.findFirst({ where, select: { id: true, kind: true, deletedAt: true, senderId: true } });
    if (!row) throw new Error('Mensaje no encontrado');
    if (row.senderId !== me) throw new Error('Solo puedes cambiar tus mensajes');
    return row;
  }
  const row = await prisma.guildMessage.findFirst({ where: { id, guildId: scope.guildId }, select: { id: true, kind: true, deletedAt: true, userId: true } });
  if (!row) throw new Error('Mensaje no encontrado');
  if (row.userId !== me) throw new Error('Solo puedes cambiar tus mensajes');
  return row;
}

// ─── Editar y borrar ──────────────────────────────────────────────────────────

/** Edita el texto de un mensaje tuyo (queda la marca «editado»). */
export async function editMessage(me: string, chat: unknown, messageId: string, content: unknown) {
  const scope = scopeOf(chat);
  const people = await participants(me, scope);
  const m = await ownMessage(me, scope, messageId);
  if (m.deletedAt) throw new Error('Ese mensaje ya no existe');
  if (m.kind !== 'TEXT') throw new Error('Solo se pueden editar los mensajes de texto');
  const text = typeof content === 'string' ? content.trim() : '';
  const max = scope.side === 'dm' ? 1000 : 500;
  if (!text) throw new Error('El mensaje no puede quedar vacío');
  if (text.length > max) throw new Error('Mensaje demasiado largo');
  const editedAt = new Date();
  await touchMessage(scope.side, m.id, { content: text, editedAt });
  await bump(people);
  return { id: m.id, content: text, editedAt: editedAt.toISOString() };
}

/** Borra un mensaje tuyo para todos: queda el hueco «Mensaje borrado». */
export async function deleteMessage(me: string, chat: unknown, messageId: string) {
  const scope = scopeOf(chat);
  const people = await participants(me, scope);
  const m = await ownMessage(me, scope, messageId);
  if (m.kind === 'EVENT') throw new Error('Ese aviso no se puede borrar');
  if (m.deletedAt) return { id: m.id, deletedAt: m.deletedAt.toISOString() };
  const deletedAt = new Date();
  await touchMessage(scope.side, m.id, {
    deletedAt, content: scope.side === 'dm' ? null : '', photoUrl: null, audioUrl: null, meta: Prisma.DbNull,
  });
  await prisma.messageReaction.deleteMany({ where: scope.side === 'dm' ? { dmId: m.id } : { guildMessageId: m.id } });
  await bump(people);
  return { id: m.id, deletedAt: deletedAt.toISOString() };
}

// ─── Fotos y audios de los mensajes ───────────────────────────────────────────

async function mediaRow(me: string, side: 'dm' | 'guild', messageId: string) {
  if (side === 'dm') {
    const m = await prisma.directMessage.findFirst({
      where: { id: messageId, OR: [{ senderId: me }, { receiverId: me }] }, select: { id: true, photoUrl: true, audioUrl: true, meta: true, deletedAt: true },
    });
    if (!m) throw new Error('Mensaje no encontrado');
    return m;
  }
  const m = await prisma.guildMessage.findFirst({ where: { id: messageId }, select: { id: true, guildId: true, photoUrl: true, audioUrl: true, meta: true, deletedAt: true } });
  if (!m) throw new Error('Mensaje no encontrado');
  await requireMember(me, m.guildId);
  return m;
}

/** La foto y/o el audio de un mensaje (no cambian nunca: el cliente los guarda). */
export async function getMedia(me: string, side: unknown, messageId: string) {
  const m = await mediaRow(me, side === 'guild' ? 'guild' : 'dm', messageId);
  if (m.deletedAt) throw new Error('Ese mensaje ya no existe');
  return { id: m.id, photoUrl: m.photoUrl, audioUrl: m.audioUrl };
}

/** Guarda la miniatura de una foto antigua que no la tenía (la calcula el cliente). */
export async function saveThumb(me: string, side: unknown, messageId: string, thumb: unknown) {
  const s = side === 'guild' ? 'guild' : 'dm';
  const m = await mediaRow(me, s, messageId);
  const t = validThumb(thumb);
  if (!t || m.deletedAt || !m.photoUrl) return { ok: false };
  const meta = (m.meta && typeof m.meta === 'object' ? m.meta : {}) as Record<string, unknown>;
  if (meta.thumb) return { ok: true };
  const data = { meta: { ...meta, thumb: t } as Prisma.InputJsonValue };
  if (s === 'dm') await prisma.directMessage.update({ where: { id: m.id }, data });
  else await prisma.guildMessage.update({ where: { id: m.id }, data });
  return { ok: true };
}

// ─── Galería ──────────────────────────────────────────────────────────────────

const GALLERY_PAGE = 36;

/**
 * Todas las fotos de tus cartas (las que enviaste y las que te enviaron, con
 * amigos y en tus gremios), de la más reciente a la más antigua. Solo viaja la
 * miniatura; la foto se pide al abrirla.
 */
export async function gallery(me: string, q: { before?: unknown; filter?: unknown }) {
  const before = typeof q.before === 'string' && !Number.isNaN(Date.parse(q.before)) ? new Date(q.before) : null;
  const filter = q.filter === 'mine' || q.filter === 'friends' || q.filter === 'guilds' ? q.filter : 'all';
  const [blocked, prefs, memberships] = await Promise.all([
    blockedWith(me),
    chatPrefsOf(me),
    prisma.guildMember.findMany({ where: { userId: me }, select: { guildId: true, guild: { select: { name: true } } } }),
  ]);
  const at = before ? { createdAt: { lt: before } } : {};
  const sender = { select: PUBLIC_USER };
  const [dms, gms] = await Promise.all([
    filter === 'guilds' ? [] : prisma.directMessage.findMany({
      where: {
        kind: { in: PHOTO_KINDS }, deletedAt: null, ...at,
        ...(filter === 'mine' ? { senderId: me } : filter === 'friends' ? { receiverId: me } : { OR: [{ senderId: me }, { receiverId: me }] }),
      },
      orderBy: { createdAt: 'desc' }, take: GALLERY_PAGE,
      select: { id: true, kind: true, content: true, meta: true, createdAt: true, senderId: true, receiverId: true, sender, receiver: sender },
    }),
    filter === 'friends' || !memberships.length ? [] : prisma.guildMessage.findMany({
      where: { guildId: { in: memberships.map((m) => m.guildId) }, kind: { in: PHOTO_KINDS }, deletedAt: null, ...at, ...(filter === 'mine' ? { userId: me } : {}) },
      orderBy: { createdAt: 'desc' }, take: GALLERY_PAGE,
      select: { id: true, kind: true, content: true, meta: true, createdAt: true, userId: true, guildId: true, user: sender },
    }),
  ]);
  const guildName = new Map(memberships.map((m) => [m.guildId, m.guild.name]));
  const visible = (key: string, d: Date) => { const c = prefs.get(key)?.clearedAt; return !c || d > c; };
  const thumbOf = (meta: unknown) => ((meta && typeof meta === 'object' ? (meta as { thumb?: string }).thumb : undefined) ?? null);
  const items = [
    ...dms.flatMap((m) => {
      const other = m.senderId === me ? m.receiver : m.sender;
      if (blocked.has(other.id) || !visible(dmKey(other.id), m.createdAt)) return [];
      return [{
        side: 'dm' as const, id: m.id, at: m.createdAt.toISOString(), kind: m.kind, caption: m.content, thumb: thumbOf(m.meta),
        mine: m.senderId === me, author: m.sender, place: { type: 'dm' as const, user: other },
      }];
    }),
    ...gms.flatMap((m) => {
      if (blocked.has(m.userId) || !visible(guildKey(m.guildId), m.createdAt)) return [];
      return [{
        side: 'guild' as const, id: m.id, at: m.createdAt.toISOString(), kind: m.kind, caption: m.content || null, thumb: thumbOf(m.meta),
        mine: m.userId === me, author: m.user, place: { type: 'guild' as const, guild: { id: m.guildId, name: guildName.get(m.guildId) ?? '' } },
      }];
    }),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, GALLERY_PAGE);
  return { items, next: items.length === GALLERY_PAGE ? items[items.length - 1].at : null };
}

// ─── Stickers ─────────────────────────────────────────────────────────────────

const MAX_STICKERS = 120;

/** Tu colección de stickers (los que hiciste y los que guardaste). */
export async function listStickers(me: string) {
  const rows = await prisma.sticker.findMany({ where: { ownerId: me }, orderBy: { createdAt: 'desc' }, select: { id: true, hash: true, authorId: true, createdAt: true } });
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), mine: !r.authorId || r.authorId === me }));
}

async function addToCollection(me: string, hash: string, authorId: string | null) {
  const count = await prisma.sticker.count({ where: { ownerId: me } });
  if (count >= MAX_STICKERS) throw new Error(`Tu colección está llena (${MAX_STICKERS} stickers). Borra alguno para hacer sitio.`);
  const row = await prisma.sticker.upsert({
    where: { ownerId_hash: { ownerId: me, hash } },
    create: { ownerId: me, hash, authorId },
    update: {},
    select: { id: true, hash: true, authorId: true, createdAt: true },
  });
  return { ...row, createdAt: row.createdAt.toISOString(), mine: !row.authorId || row.authorId === me };
}

/** Crea un sticker con una imagen ya recortada en el cliente (WebP/PNG con transparencia). */
export async function createSticker(me: string, imageUrl: unknown) {
  const hash = await storeStickerImage(imageUrl);
  return addToCollection(me, hash, null);
}

/** Guarda en tu colección un sticker que te enviaron. */
export async function saveSticker(me: string, hash: unknown) {
  if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('Ese sticker no existe');
  const image = await prisma.stickerImage.findUnique({ where: { hash }, select: { hash: true } });
  if (!image) throw new Error('Ese sticker no existe');
  const first = await prisma.sticker.findFirst({ where: { hash }, orderBy: { createdAt: 'asc' }, select: { ownerId: true, authorId: true } });
  return addToCollection(me, hash, first ? first.authorId ?? first.ownerId : null);
}

/** Lo quita de tu colección (los mensajes ya enviados lo siguen mostrando). */
export async function deleteSticker(me: string, id: string) {
  await prisma.sticker.deleteMany({ where: { id, ownerId: me } });
  return { ok: true };
}

/** La imagen de un sticker (por su huella: nunca cambia). */
export async function stickerImage(hash: string) {
  const row = await prisma.stickerImage.findUnique({ where: { hash }, select: { hash: true, imageUrl: true } });
  if (!row) throw new Error('Ese sticker no existe');
  return row;
}

// ─── Archivar y vaciar cartas ─────────────────────────────────────────────────

/**
 * Archiva (o saca del archivo) una carta, o la vacía: "Eliminar chat" borra el
 * historial solo para ti (los demás lo siguen viendo).
 */
export async function setChatPref(me: string, chat: unknown, body: { archived?: unknown; clear?: unknown }) {
  const scope = scopeOf(chat);
  await participants(me, scope);
  const data: { archivedAt?: Date | null; clearedAt?: Date } = {};
  if (typeof body.archived === 'boolean') data.archivedAt = body.archived ? new Date() : null;
  if (body.clear === true) data.clearedAt = new Date();
  if (!Object.keys(data).length) throw new Error('No hay cambios que guardar');
  const row = await prisma.chatPref.upsert({
    where: { userId_key: { userId: me, key: scope.key } },
    create: { userId: me, key: scope.key, ...data },
    update: data,
    select: { key: true, archivedAt: true, clearedAt: true },
  });
  // Vaciar también da por leído lo pendiente de esa carta.
  if (body.clear === true) {
    if (scope.side === 'dm') await prisma.directMessage.updateMany({ where: { senderId: scope.otherId, receiverId: me, readAt: null }, data: { readAt: new Date() } });
    else await prisma.guildMember.updateMany({ where: { userId: me, guildId: scope.guildId }, data: { lastReadAt: new Date() } });
  }
  await bump([me]);
  return { key: row.key, archived: Boolean(row.archivedAt), clearedAt: row.clearedAt?.toISOString() ?? null };
}

// ─── Bloquear ─────────────────────────────────────────────────────────────────

/**
 * Bloquea a alguien: deja de ser tu amigo (y se cancela cualquier solicitud), ya
 * no puede escribirte, enviarte palomas ni gestos, y no se ven en las zonas ni en
 * el directorio. En los gremios que comparten, sus mensajes quedan ocultos para ti.
 */
export async function blockUser(me: string, userId: string) {
  if (userId === me) throw new Error('No puedes bloquearte a ti mismo');
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!target) throw new Error('Usuario no encontrado');
  await prisma.$transaction([
    prisma.userBlock.upsert({ where: { blockerId_blockedId: { blockerId: me, blockedId: userId } }, create: { blockerId: me, blockedId: userId }, update: {} }),
    prisma.friendship.deleteMany({ where: { OR: [{ requesterId: me, receiverId: userId }, { requesterId: userId, receiverId: me }] } }),
    prisma.socialGesture.deleteMany({ where: { OR: [{ fromId: userId, toId: me }, { fromId: me, toId: userId }] } }),
    prisma.guildInvite.deleteMany({ where: { OR: [{ inviterId: userId, inviteeId: me }, { inviterId: me, inviteeId: userId }], status: 'PENDING' } }),
  ]);
  await bump([me, userId]);
  return { ok: true };
}

export async function unblockUser(me: string, userId: string) {
  await prisma.userBlock.deleteMany({ where: { blockerId: me, blockedId: userId } });
  await bump([me, userId]);
  return { ok: true };
}

/** Las personas que bloqueaste. */
export async function listBlocked(me: string) {
  const rows = await prisma.userBlock.findMany({ where: { blockerId: me }, orderBy: { createdAt: 'desc' }, select: { createdAt: true, blocked: { select: PUBLIC_USER } } });
  return rows.map((r) => ({ ...r.blocked, blockedAt: r.createdAt.toISOString() }));
}
