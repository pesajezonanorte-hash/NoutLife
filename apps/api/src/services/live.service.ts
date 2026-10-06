// El chat en vivo de Noutlife: una sola petición larga por pestaña que lo trae
// todo. El cliente dice en qué zona está, qué carta tiene abierta y hasta dónde
// tiene cada cosa; la API espera (hasta ~8 s) a que suene su timbre (LiveSignal)
// y responde con lo nuevo: mensajes que llegan (para los avisos dentro de la
// app), la carta abierta (lo nuevo, lo que cambió, el visto, quién escribe y la
// zona del amigo), quién escribe en cada carta (para la bandeja), el pulso social,
// la campana y los amigos que pasean por tu zona. Además sirve de latido de
// presencia: si cambias de zona, a tus amigos les suena el timbre.
import { prisma } from '../lib/prisma';
import {
  APP_KEY, blockedWith, bump, clearView, dmKey, guildKey, holdUntil, markTyping, parseDate, signalOf, snippet, TALK_KINDS, touchView, TYPING_MS,
} from './chat-live.service';
import { dmChatSection } from './dm.service';
import { guildChatSection } from './social.service';
import { countUnread } from './notification.service';
import { PUBLIC_USER, socialPulse, touchPresence, zoneVisitors } from './network.service';
import { participants, scopeOf } from './letters.service';

export interface LiveQuery {
  /** Último timbre que conoce el cliente (vacío en la primera petición). */
  s?: unknown;
  /** Zona en la que está ahora. */
  z?: unknown;
  /** Pide recalcular quién pasea por la zona (aunque no haya sonado el timbre). */
  zr?: unknown;
  /** Carta abierta: "dm:<amigo>" | "guild:<gremio>". */
  c?: unknown;
  /** De la carta abierta: fecha del último mensaje que tiene y desde cuándo pide cambios. */
  ca?: unknown;
  cc?: unknown;
  /** Bandeja de avisos: desde dónde. */
  ib?: unknown;
  /** Esperar (petición larga). */
  w?: unknown;
}

/** Lo que te escribieron desde \`since\` (cartas de amigos y de tus gremios), sin bloqueados. */
async function inboxSince(me: string, since: Date) {
  const [blocked, memberships] = await Promise.all([
    blockedWith(me),
    prisma.guildMember.findMany({ where: { userId: me }, select: { guildId: true } }),
  ]);
  const guildIds = memberships.map((m) => m.guildId);
  const [dms, gms] = await Promise.all([
    prisma.directMessage.findMany({
      where: { receiverId: me, createdAt: { gt: since }, kind: { in: TALK_KINDS }, deletedAt: null },
      orderBy: { createdAt: 'asc' }, take: 20,
      select: { id: true, kind: true, content: true, meta: true, createdAt: true, deletedAt: true, sender: { select: PUBLIC_USER } },
    }),
    guildIds.length
      ? prisma.guildMessage.findMany({
        where: { guildId: { in: guildIds }, userId: { not: me }, createdAt: { gt: since }, kind: { in: TALK_KINDS }, deletedAt: null },
        orderBy: { createdAt: 'asc' }, take: 20,
        select: { id: true, kind: true, content: true, meta: true, createdAt: true, deletedAt: true, guildId: true, user: { select: PUBLIC_USER }, guild: { select: { name: true } } },
      })
      : [],
  ]);
  const items = [
    ...dms.filter((m) => !blocked.has(m.sender.id)).map((m) => ({
      type: 'dm' as const, id: m.id, at: m.createdAt.toISOString(), from: m.sender, kind: m.kind, preview: snippet(m, 140), guild: null as { id: string; name: string } | null,
    })),
    ...gms.filter((m) => !blocked.has(m.user.id)).map((m) => ({
      type: 'guild' as const, id: m.id, at: m.createdAt.toISOString(), from: m.user, kind: m.kind, preview: snippet(m, 140), guild: { id: m.guildId, name: m.guild.name } as { id: string; name: string } | null,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return items;
}

/** Quién está escribiendo ahora en cada una de tus cartas (para la bandeja). */
async function typingAll(me: string) {
  const memberships = await prisma.guildMember.findMany({ where: { userId: me }, select: { guildId: true } });
  const rows = await prisma.chatView.findMany({
    where: {
      typingAt: { gt: new Date(Date.now() - TYPING_MS) },
      userId: { not: me },
      OR: [{ key: dmKey(me) }, { key: { in: memberships.map((m) => guildKey(m.guildId)) } }],
    },
    select: { userId: true, key: true, typingAt: true },
  });
  return rows.map((r) => ({
    chat: r.key === dmKey(me) ? dmKey(r.userId) : r.key,
    userId: r.userId,
    until: new Date(r.typingAt!.getTime() + TYPING_MS).toISOString(),
  }));
}

async function chatSection(me: string, chat: string, q: LiveQuery) {
  try {
    const scope = scopeOf(chat);
    return scope.side === 'dm'
      ? await dmChatSection(me, scope.otherId, { after: q.ca, changes: q.cc })
      : await guildChatSection(me, scope.guildId, { after: q.ca, changes: q.cc });
  } catch (e) {
    // La carta ya no está disponible (dejaron de ser amigos, saliste del gremio…).
    return { key: chat, error: e instanceof Error ? e.message : 'Carta no disponible' };
  }
}

export async function live(me: string, q: LiveQuery) {
  const zone = typeof q.z === 'string' ? q.z.trim().slice(0, 40) : null;
  const chat = typeof q.c === 'string' && /^(dm|guild):[A-Za-z0-9_-]{6,40}$/.test(q.c) ? q.c : null;
  const known = typeof q.s === 'string' && /^\d+$/.test(q.s) ? Number(q.s) : null;

  // Latido: en línea, zona, app en primer plano y carta abierta (no te avisan de ella).
  await Promise.all([
    zone !== null ? touchPresence(me, zone) : null,
    touchView(me, APP_KEY),
    chat ? touchView(me, chat) : null,
  ]);

  let seq = await signalOf(me);
  if (known !== null && seq <= known && q.w === '1') {
    const rang = await holdUntil(async () => { const v = await signalOf(me); return v > known ? v : null; }, true);
    if (rang) seq = rang;
  }
  const changed = known === null || seq > known;
  const out: Record<string, unknown> = { seq };

  if (changed) {
    const since = parseDate(q.ib);
    const stamp = new Date();
    const [pulse, notifications, typing, items, letter] = await Promise.all([
      socialPulse(me),
      countUnread(me),
      typingAll(me),
      since ? inboxSince(me, since) : Promise.resolve([]),
      chat ? chatSection(me, chat, q) : Promise.resolve(null),
    ]);
    // El siguiente sondeo sigue desde el último aviso entregado (así no se repite ninguno).
    out.inbox = { cursor: items.length ? items[items.length - 1].at : stamp.toISOString(), items };
    Object.assign(out, { pulse, notifications, typing, ...(letter ? { chat: letter } : {}) });
  }
  if (zone && (changed || q.zr === '1')) out.zone = await zoneVisitors(me, zone);
  return out;
}

/** "Escribiendo…" en una carta: se enciende al teclear y se apaga al enviar o al parar. */
export async function setTyping(me: string, chat: unknown, on: unknown) {
  const scope = scopeOf(chat);
  const people = await participants(me, scope);
  const ring = await markTyping(me, scope.key, on === true);
  if (ring) await bump(people.filter((id) => id !== me));
  return { ok: true };
}

/** Cerraste la carta: desde ya te vuelven a avisar de lo que llegue a ella. */
export async function leaveView(me: string, key: unknown) {
  if (typeof key === 'string' && /^(dm|guild):[A-Za-z0-9_-]{6,40}$/.test(key)) {
    const wasTyping = await prisma.chatView.findUnique({ where: { userId_key: { userId: me, key } }, select: { typingAt: true } });
    await clearView(me, key);
    if (wasTyping?.typingAt && Date.now() - wasTyping.typingAt.getTime() < TYPING_MS) {
      const scope = scopeOf(key);
      await bump((await participants(me, scope).catch(() => [])).filter((id) => id !== me));
    }
  }
  return { ok: true };
}
