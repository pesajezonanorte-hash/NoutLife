// Monumento de Misiones: una pirámide escalonada de 10 peldaños (cada uno, un 10 % de avance).
// Cada misión activa es un núcleo de energía que flota junto al peldaño de su avance; las
// cumplidas izan banderas en la cima. Puro (sin three ni DOM): lo usan la escena, la tarjeta
// y los tests.
import type { Quest } from '@noutlife/shared';
import { questProgress } from './questMeta';

export const MONUMENT_TIERS = 10;
export const MONUMENT_MAX_ORBS = 12;
export const MONUMENT_MAX_FLAGS = 6;
/** Alto de un peldaño (modelo `tier`). */
export const TIER_H = 0.14;
/** Altura de la cima (encima del último peldaño). */
export const SUMMIT_Y = MONUMENT_TIERS * TIER_H;

/** Lado del peldaño i (0 abajo): de 1 a ~0,22 en la cima. */
export const tierScale = (i: number) => 1 - i * 0.087;

/** Peldaño de un avance (0–100): 0–9 %, el primero; 90–100 %, el último. */
export const tierOf = (pct: number) => Math.min(MONUMENT_TIERS - 1, Math.max(0, Math.floor(pct / 10)));

/** Cuánto se enciende el peldaño i con un avance (0–1; el del avance actual, en parte). */
export const tierFill = (pct: number, i: number) => Math.min(1, Math.max(0, pct / 10 - i));

export interface MonumentGoal {
  id: string;
  title: string;
  pct: number;
}

export interface OrbSpot {
  id: string;
  tier: number;
  /** Ángulo alrededor del monumento (radianes, 0 = frente). */
  angle: number;
  /** Distancia al eje: justo fuera del borde de su peldaño. */
  radius: number;
  /** Altura: a media altura de su peldaño. */
  y: number;
}

/** Dónde flota cada núcleo: a la altura de su peldaño y repartidos alrededor (ángulo áureo, para
 *  que dos misiones del mismo peldaño no se tapen). */
export function orbSpots(goals: MonumentGoal[]): OrbSpot[] {
  return goals.slice(0, MONUMENT_MAX_ORBS).map((g, i) => {
    const tier = tierOf(g.pct);
    return { id: g.id, tier, angle: i * 2.39996, radius: (tierScale(tier) / 2) * Math.SQRT2 * 0.78 + 0.12, y: tier * TIER_H + TIER_H * 0.75 };
  });
}

/** Las misiones activas del mapa como núcleos: la más cercana primero (lista ya ordenada). */
export function monumentGoals(active: Quest[]): MonumentGoal[] {
  return active.map((q) => ({ id: q.id, title: q.title, pct: questProgress(q).pct }));
}
