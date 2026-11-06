// Pro de cortesía desde /admin/recompensas: se busca la cuenta por correo o @usuario y se concede
// una cantidad de días o indefinido. Los días usan la misma regla que los enlaces de recompensa
// (extendProAccessTx): Lite pasa a prueba de regalo desde hoy y, con Pro vigente, se suman al final
// sin acortar nada. Indefinido marca users.compPro. Cada concesión queda en comp_grants, en la
// misma transacción, así que nunca hay un Pro concedido sin registro.
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { isComplimentary } from '../lib/plans';
import { COMP_MAX_DAYS, normalizeCompTarget, type CompOutcome } from '../lib/comp-grants';
import { extendProAccessTx } from './billing.service';

export class CompGrantError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'CompGrantError';
  }
}

export interface CompGrantInput {
  target: string;
  /** Días a conceder (1 a COMP_MAX_DAYS), o null para Pro indefinido. */
  days: number | null;
  note?: string | null;
}

const TARGET_SELECT = { id: true, email: true, username: true, compPro: true } satisfies Prisma.UserSelect;

async function findTarget(raw: string) {
  const target = normalizeCompTarget(raw);
  if (!target) throw new CompGrantError('Escribe un correo válido o un @usuario de 3 a 20 letras, números o guiones bajos.', 400);
  const where = target.kind === 'email'
    ? { email: target.value }
    : { username: { equals: target.value, mode: 'insensitive' as const } };
  const user = await prisma.user.findFirst({ where, select: TARGET_SELECT });
  if (!user) throw new CompGrantError('No encontramos ninguna cuenta con ese correo o @usuario.', 404);
  return user;
}

export interface CompGrantRecord {
  id: string;
  targetUsername: string;
  days: number | null;
  outcome: CompOutcome;
  /** Hasta cuándo queda el Pro (null en indefinido). */
  accessEndsAt: string | null;
  note: string | null;
  createdAt: string;
}

/**
 * Concede Pro de cortesía a la cuenta indicada. Rechaza si la cuenta ya es de cortesía con fecha
 * (no hay nada que sumar) o si el correo / @usuario no existe o no tiene formato válido.
 */
export async function grantComp(input: CompGrantInput, grantedById: string, now = new Date()): Promise<CompGrantRecord> {
  if (input.days !== null && (!Number.isInteger(input.days) || input.days < 1 || input.days > COMP_MAX_DAYS)) {
    throw new CompGrantError(`Usa entre 1 y ${COMP_MAX_DAYS} días, o indefinido.`, 400);
  }
  const found = await findTarget(input.target);
  const note = input.note?.trim() || null;

  const record = await prisma.$transaction(async (tx): Promise<CompGrantRecord> => {
    // La fila se bloquea para que dos concesiones seguidas se sumen una después de la otra.
    await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${found.id} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: found.id }, select: TARGET_SELECT });
    if (!user) throw new CompGrantError('Usuario no encontrado.', 404);
    if (isComplimentary(user)) {
      throw new CompGrantError(`@${user.username} ya tiene Pro de cortesía: no hay fecha que sumar.`, 409);
    }

    let outcome: CompOutcome;
    let accessEndsAt: Date | null;
    if (input.days === null) {
      await tx.user.update({ where: { id: user.id }, data: { compPro: true } });
      outcome = 'permanent';
      accessEndsAt = null;
    } else {
      const extended = await extendProAccessTx(tx, user.id, input.days, now);
      if (!extended || extended.outcome === 'complimentary') {
        throw new CompGrantError(`No se pudieron sumar días a @${user.username}.`, 409);
      }
      outcome = extended.outcome;
      accessEndsAt = extended.accessEndsAt;
    }

    const row = await tx.compGrant.create({
      data: { targetUserId: user.id, targetUsername: user.username, days: input.days, outcome, accessEndsAt, note, grantedById },
      select: { id: true, createdAt: true },
    });
    return {
      id: row.id,
      targetUsername: user.username,
      days: input.days,
      outcome,
      accessEndsAt: accessEndsAt?.toISOString() ?? null,
      note,
      createdAt: row.createdAt.toISOString(),
    };
  });

  console.log('[COMP_GRANT]', grantedById, record.id, record.outcome);
  return record;
}

export interface CompGrantHistoryRow extends CompGrantRecord {
  /** Admin que concedió (su @usuario), o null si su cuenta ya no existe. */
  grantedBy: string | null;
}

/** Últimas concesiones, la más reciente primero. */
export async function listCompGrants(): Promise<CompGrantHistoryRow[]> {
  const grants = await prisma.compGrant.findMany({ orderBy: { createdAt: 'desc' }, take: 300 });
  const ids = [...new Set(grants.map((grant) => grant.grantedById))];
  const admins = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, username: true } })
    : [];
  const names = new Map(admins.map((admin) => [admin.id, admin.username]));
  return grants.map((grant) => ({
    id: grant.id,
    targetUsername: grant.targetUsername,
    days: grant.days,
    outcome: grant.outcome as CompOutcome,
    accessEndsAt: grant.accessEndsAt?.toISOString() ?? null,
    note: grant.note,
    createdAt: grant.createdAt.toISOString(),
    grantedBy: names.get(grant.grantedById) ?? null,
  }));
}
