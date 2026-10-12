import { prisma } from '../lib/prisma';
import { emailKey } from '../lib/trial-keys';

const isUnique = (error: unknown) => (error as { code?: unknown }).code === 'P2002';

/**
 * Reclama la prueba gratis de una cuenta nueva. false si el correo o el
 * dispositivo ya usaron una. Al reclamarla queda registrada para siempre.
 */
export async function claimTrial(email: string, deviceId: string | null): Promise<boolean> {
  const key = emailKey(email);
  const seen = await prisma.usedTrial.findFirst({
    where: { OR: [{ emailKey: key }, ...(deviceId ? [{ deviceId }] : [])] },
    select: { id: true },
  });
  if (seen) return false;
  try {
    await prisma.usedTrial.create({ data: { emailKey: key, deviceId } });
    return true;
  } catch (error) {
    if (isUnique(error)) return false; // otro registro simultáneo con el mismo correo
    throw error;
  }
}

/** Deshace una reclamación cuando la cuenta no llegó a crearse (la prueba nunca se activó). */
export async function releaseTrial(email: string): Promise<void> {
  await prisma.usedTrial.deleteMany({ where: { emailKey: emailKey(email) } }).catch(() => null);
}

/**
 * Asocia la tarjeta a la prueba de este correo. true si la tarjeta ya figura
 * en la prueba de OTRO correo.
 */
export async function bindCard(email: string, paymentKey: string): Promise<boolean> {
  const mine = emailKey(email);
  const other = await prisma.usedTrial.findFirst({
    where: { paymentKeys: { has: paymentKey }, NOT: { emailKey: mine } },
    select: { id: true },
  });
  const record = await prisma.usedTrial.findUnique({ where: { emailKey: mine } });
  if (!record) {
    await prisma.usedTrial.create({ data: { emailKey: mine, paymentKeys: [paymentKey] } }).catch((e) => { if (!isUnique(e)) throw e; });
  } else if (!record.paymentKeys.includes(paymentKey)) {
    await prisma.usedTrial.update({ where: { id: record.id }, data: { paymentKeys: { push: paymentKey } } });
  }
  return Boolean(other);
}
