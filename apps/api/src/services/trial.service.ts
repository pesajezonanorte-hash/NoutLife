import { prisma } from '../lib/prisma';
import { emailKey } from '../lib/trial-keys';

export type TrialOutcome = 'granted' | 'email_used' | 'payment_used';

/** ¿Este correo aún no tuvo prueba? Pista para la interfaz: la decisión real es claimTrial. */
export async function trialAvailable(email: string): Promise<boolean> {
  return !(await prisma.usedTrial.findUnique({ where: { emailKey: emailKey(email) }, select: { id: true } }));
}

/**
 * Reclama la prueba al vincular el primer medio de pago. Una por correo y una
 * por medio de pago, para siempre: borrar la cuenta, cambiar de correo o
 * limpiar el navegador no la devuelve. Las claves únicas de used_trials deciden,
 * así que dos registros simultáneos no pueden ganar los dos. El dispositivo
 * nunca bloquea (puede ser compartido): solo queda para auditoría.
 */
export async function claimTrial(email: string, paymentKey: string, deviceId: string | null): Promise<TrialOutcome> {
  const key = emailKey(email);
  try {
    await prisma.usedTrial.create({ data: { emailKey: key, paymentKey, deviceId } });
  } catch (error) {
    if ((error as { code?: unknown }).code !== 'P2002') throw error;
    const used = await prisma.usedTrial.findFirst({ where: { OR: [{ emailKey: key }, { paymentKey }] } });
    // Mismo correo y mismo medio: esta misma reclamación llegó dos veces (doble toque).
    if (used?.emailKey === key && used.paymentKey === paymentKey) return 'granted';
    return used?.emailKey === key ? 'email_used' : 'payment_used';
  }
  if (deviceId && (await prisma.usedTrial.count({ where: { deviceId } })) > 1) {
    // Dispositivo compartido con correo y medio de pago nuevos: se permite. Auditoría:
    // SELECT * FROM used_trials WHERE "deviceId" = '<id>' (el log no lleva correos).
    console.warn('[TRIAL_SHARED_DEVICE]', deviceId);
  }
  return 'granted';
}
