// Enlaces de recompensa de un solo uso (los que el equipo envía por Instagram). Reglas puras,
// sin base de datos: formato y huella del token, y el estado de un enlace. La base vive en
// services/reward-link.service.ts.
import { createHash, randomBytes } from 'node:crypto';

/** Días de Pro que da cada enlace. */
export const REWARD_PRO_DAYS = 7;
/** Tema exclusivo que desbloquea y pone el enlace. */
export const REWARD_THEME_KEY = 'theme_calma';
/**
 * Temas que no se venden en la Tienda: solo llegan por un enlace de recompensa. La Tienda los
 * muestra únicamente a quien ya los tiene (para volver a ponérselos) y rechaza su compra.
 */
export const REWARD_ONLY_THEMES: ReadonlySet<string> = new Set([REWARD_THEME_KEY]);

/** Vigencia por defecto de un enlace nuevo, en días. */
export const REWARD_DEFAULT_EXPIRY_DAYS = 30;
/** Enlaces que se pueden crear de una vez. */
export const REWARD_MAX_BATCH = 50;

/** 32 bytes aleatorios en base64url: 43 caracteres, imposible de adivinar. */
export function generateRewardToken(): string {
  return randomBytes(32).toString('base64url');
}

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

export function isRewardToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_FORMAT.test(value);
}

/**
 * Huella SHA-256 del token. La base guarda solo la huella: quien lea la tabla no puede canjear
 * nada, y el enlace completo se ve una sola vez, al crearlo.
 */
export function hashRewardToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export type RewardLinkStatus = 'available' | 'claimed' | 'expired';

export function rewardLinkStatus(link: { claimedAt: Date | null; expiresAt: Date | null }, now = new Date()): RewardLinkStatus {
  if (link.claimedAt) return 'claimed';
  if (link.expiresAt && link.expiresAt.getTime() <= now.getTime()) return 'expired';
  return 'available';
}

/**
 * Qué hizo el canje con el plan. 'activated': no tenía Pro y empieza una prueba de regalo desde
 * hoy. 'extended': ya tenía Pro y los días se suman al final. 'complimentary': Pro de cortesía
 * sin fecha, no hay nada que sumar (sí recibe el tema).
 */
export type RewardOutcome = 'activated' | 'extended' | 'complimentary';
