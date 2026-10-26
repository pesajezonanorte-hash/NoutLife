// Regalo de 7 días de Pro (cuentas Lite actuales e invitaciones): día del regalo y la regla del
// aviso de bienvenida. Son funciones puras: lo que muestran coincide con lo que decide la API
// (giftTrial en la suscripción).
import type { Subscription } from '@noutlife/shared';
import type { Copy } from './locale';
import { isNewAccount } from './new-account';

const DAY_MS = 24 * 60 * 60_000;

export interface GiftProgress { day: number; of: number }

/** Día del regalo (1…N) o null si la cuenta no tiene un regalo de Pro vigente. */
export function giftProgress(sub: Subscription | null | undefined, now = Date.now()): GiftProgress | null {
  if (!sub || !sub.giftTrial || sub.status !== 'trialing' || sub.plan !== 'pro') return null;
  const of = sub.trialDays;
  const left = Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - now) / DAY_MS));
  return { day: Math.min(of, Math.max(1, of - left + 1)), of };
}

/** Clave de este dispositivo: la bienvenida se ve una vez por cuenta, no en cada apertura. */
export const giftWelcomeKey = (userId: string) => `lq_gift_welcome:${userId}`;

/** ¿Mostrar la bienvenida? Solo si el regalo está vigente y aún no se cerró en este dispositivo. */
export function shouldShowGiftWelcome(sub: Subscription | null | undefined, dismissed: boolean, now = Date.now()): boolean {
  return !dismissed && giftProgress(sub, now) !== null;
}

/**
 * ¿La bienvenida espera al tutorial? Solo en una cuenta nueva que aún no lo terminó: el
 * tutorial solo sale a cuentas nuevas. Una cuenta anterior que vuelve a entrar (en este u
 * otro dispositivo, sin la marca del tutorial) ve la bienvenida en el mismo momento.
 */
export function giftWelcomeWaitsForTour(tourDone: boolean, createdAt: string | null | undefined, now = Date.now()): boolean {
  return !tourDone && isNewAccount(createdAt, now);
}

/** Texto de la bienvenida. El último renglón evita la sorpresa: no hay cobro al terminar. */
export const GIFT_WELCOME: Copy<{ title: string; body: string; ending: string; plan: string; start: string }> = {
  es: {
    title: '¡Te regalamos 7 días de NoutLife Pro!',
    body: 'Disfruta de hábitos ilimitados, historial completo y todas las herramientas sin costo ni tarjeta de crédito.',
    ending: 'Al terminar, tu cuenta sigue en NoutLife Lite. No hay cobros.',
    plan: 'Ver mi plan',
    start: 'Empezar',
  },
  en: {
    title: '7 days of NoutLife Pro, on us',
    body: 'Unlimited habits, your full history and every tool, with no cost and no credit card.',
    ending: 'When it ends, your account stays on NoutLife Lite. No charges.',
    plan: 'View my plan',
    start: 'Get started',
  },
};
