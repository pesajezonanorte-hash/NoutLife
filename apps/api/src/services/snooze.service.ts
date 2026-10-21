// Posponer un aviso («Posponer 10 min» en la barra de avisos o dentro de la app):
// se guarda con su hora y el cron de recordatorios lo envía cuando llega, aunque la
// app esté cerrada. Posponer otra vez el mismo aviso cambia su hora (misma etiqueta):
// así no se acumulan.
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { SnoozeInput } from '../schemas/snooze.schemas';
import { createNotification } from './notification.service';

export const SNOOZE_MINUTES = 10;
const MAX_PENDING = 20;
const KEEP_SENT_MS = 7 * 24 * 60 * 60_000;

export class SnoozeError extends Error {}

/** Hora a la que vuelve un aviso pospuesto. */
export function snoozeDueAt(now: Date): Date {
  return new Date(now.getTime() + SNOOZE_MINUTES * 60_000);
}

/** Lo que hace falta para volver a enviar el aviso, sin los campos vacíos. */
function payloadOf(input: SnoozeInput): Prisma.InputJsonValue {
  const { title, body, link, category, quick, quickRef, day, priority } = input;
  const all = { title, body, link, category, quick, quickRef, day, priority };
  return Object.fromEntries(Object.entries(all).filter(([, value]) => value !== undefined)) as Prisma.InputJsonValue;
}

export async function snoozeReminder(userId: string, input: SnoozeInput, now = new Date()) {
  const dueAt = snoozeDueAt(now);
  const data = payloadOf(input);
  const pending = await prisma.reminderSnooze.findFirst({ where: { userId, tag: input.tag, sentAt: null }, select: { id: true } });
  if (pending) return prisma.reminderSnooze.update({ where: { id: pending.id }, data: { dueAt, data }, select: { dueAt: true } });
  if ((await prisma.reminderSnooze.count({ where: { userId, sentAt: null } })) >= MAX_PENDING) {
    throw new SnoozeError('Tienes demasiados avisos pospuestos. Espera a que suenen.');
  }
  return prisma.reminderSnooze.create({ data: { userId, tag: input.tag, data, dueAt }, select: { dueAt: true } });
}

type Stored = Omit<SnoozeInput, 'tag'>;

/** Si la acción rápida ya se hizo ese día (el hábito está marcado), el aviso ya no molesta. */
async function alreadyDone(d: Stored): Promise<boolean> {
  if (d.quick !== 'habit_done' || !d.quickRef || !d.day) return false;
  const log = await prisma.habitLog.findFirst({
    where: { habitId: d.quickRef, date: new Date(`${d.day}T00:00:00.000Z`), completed: true },
    select: { id: true },
  });
  return Boolean(log);
}

/**
 * Envía los avisos pospuestos cuya hora llegó. Cada uno se reclama antes de
 * enviarse: dos pasadas del cron no lo mandan dos veces.
 */
export async function deliverDueSnoozes(now = new Date(), limit = 100): Promise<number> {
  const due = await prisma.reminderSnooze.findMany({ where: { sentAt: null, dueAt: { lte: now } }, orderBy: { dueAt: 'asc' }, take: limit });
  let sent = 0;
  for (const row of due) {
    const claimed = await prisma.reminderSnooze.updateMany({ where: { id: row.id, sentAt: null }, data: { sentAt: now } });
    if (claimed.count === 0) continue;
    const d = row.data as unknown as Stored;
    if (await alreadyDone(d)) continue;
    await createNotification(row.userId, {
      // Lo pospuso la persona: sale a su hora, sin tope ni pausa.
      type: 'reminder', userScheduled: true, dedupeKey: row.tag, title: d.title, body: d.body, link: d.link, category: d.category,
      quick: d.quick, quickRef: d.quickRef, day: d.day, priority: d.priority,
    }, { awaitPush: true });
    sent += 1;
  }
  await prisma.reminderSnooze.deleteMany({ where: { sentAt: { lt: new Date(now.getTime() - KEEP_SENT_MS) } } });
  return sent;
}
