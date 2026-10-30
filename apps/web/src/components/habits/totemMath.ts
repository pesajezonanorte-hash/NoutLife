// Tótem de racha (Hábitos): cuánto crece, brilla y chispea el cristal según los días seguidos.
// Puro (sin three ni DOM): lo usan la escena 3D, la tarjeta accesible y los tests.

/** Hitos de la racha: cada uno suma un fragmento en órbita; 7, 30 y 100 suman un anillo. */
export const TOTEM_MILESTONES = [3, 7, 14, 21, 30, 60, 100, 180, 365] as const;
export const TOTEM_MAX_MOTES = 160;
export const TOTEM_MAX_SHARDS = 8;
/** Estiramiento máximo del cuerpo del cristal (unidades del modelo, alto base ≈ 1,74). */
export const TOTEM_MAX_GROW = 1.2;

export interface TotemState {
  streak: number;
  /** 0–1: crece rápido los primeros días y se modera (logarítmico), tope al año. */
  growth: number;
  /** 0–1: intensidad del neón. Sin racha queda un rescoldo. */
  energy: number;
  /** Hitos alcanzados (0–9). */
  tier: number;
  /** Motas de energía activas (0 sin racha). */
  motes: number;
  /** Anillos en órbita (0–3). */
  rings: number;
  /** Fragmentos en órbita (uno por hito, hasta 8). */
  shards: number;
  /** Hito anterior (o 0) y próximo. */
  prev: number;
  next: number;
  /** 0–1 del hito anterior al próximo. */
  toNext: number;
}

export function totemState(streak: number): TotemState {
  const s = Math.max(0, Math.floor(Number.isFinite(streak) ? streak : 0));
  const growth = Math.min(1, Math.log1p(s) / Math.log1p(365));
  const tier = TOTEM_MILESTONES.filter((m) => s >= m).length;
  const energy = s === 0 ? 0.08 : Math.min(1, 0.22 + growth * 0.78);
  const motes = s === 0 ? 0 : Math.round(10 + growth * (TOTEM_MAX_MOTES - 10));
  const rings = [7, 30, 100].filter((m) => s >= m).length;
  const prev = [...TOTEM_MILESTONES].reverse().find((m) => m <= s) ?? 0;
  // Pasado el año, cada aniversario es el siguiente hito.
  const next = TOTEM_MILESTONES.find((m) => m > s) ?? (Math.floor(s / 365) + 1) * 365;
  const from = s >= 365 ? Math.floor(s / 365) * 365 : prev;
  return { streak: s, growth, energy, tier, motes, rings, shards: Math.min(TOTEM_MAX_SHARDS, tier), prev: from, next, toNext: (s - from) / (next - from) };
}

