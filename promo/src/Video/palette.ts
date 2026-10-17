// La luz del vídeo: tres colores que tiñen el fondo (y el halo detrás del teléfono)
// según lo que hay en pantalla. Cambian de un tono a otro en unos fotogramas, como
// una luz que se derrama, nunca de golpe.
import { interpolateColors } from 'remotion';
import { COLORS, HOOK_TINT, ZONE } from './theme';
import { clamp, ramp } from './lib/anim';
import { BRAND, CTA, DEVICE, HOOK, ZONE_TIMES } from './timeline';

export interface Light {
  /** Tres colores: arriba, abajo y detrás del centro. */
  a: string;
  b: string;
  c: string;
  /** Intensidad general (0 = negro). */
  k: number;
}

const look = (a: string, b: string, c: string, k: number): Light => ({ a, b, c, k });
const zoneLook = (z: (typeof ZONE)[keyof typeof ZONE], k = 1) => look(z.glow, z.to, z.from, k);

/** [fotograma en que empieza el cambio, duración del fundido, luz]. */
const KEYS: Array<[number, number, Light]> = [
  [0, 1, zoneLook(HOOK_TINT.rutina, 0.9)],
  [HOOK.nouns[1].at, 6, zoneLook(HOOK_TINT.cuerpo, 0.9)],
  [HOOK.nouns[2].at, 6, zoneLook(HOOK_TINT.mente, 0.9)],
  [HOOK.phrase[0].at, 18, look(HOOK_TINT.rutina.glow, HOOK_TINT.cuerpo.glow, HOOK_TINT.mente.glow, 0.85)],
  [HOOK.collapse.from, 18, look(HOOK_TINT.rutina.glow, HOOK_TINT.cuerpo.glow, HOOK_TINT.mente.glow, 0.25)],
  [BRAND.burst, 14, look(COLORS.jade, '#2a7262', COLORS.jade, 0.8)],
  // Antes del relevo al teléfono el fondo se apaga: la pantalla de arranque es casi negra
  [BRAND.handoff.from - 18, 18, look(COLORS.jade, '#2a7262', COLORS.jade, 0.2)],
  [DEVICE.pullBack.to - 6, 20, look(COLORS.jade, '#2a7262', COLORS.jade500, 0.6)],
  [ZONE_TIMES.coliseo.from + 4, 16, zoneLook(ZONE.coliseo)],
  [ZONE_TIMES.ciclo.from - 4, 14, zoneLook(ZONE.ciclo)],
  [ZONE_TIMES.habitos.from - 4, 14, zoneLook(ZONE.habitos)],
  [ZONE_TIMES.sabio.from - 4, 14, zoneLook(ZONE.sabio, 1.15)],
  [CTA.move, 24, look(COLORS.gold, COLORS.jade, COLORS.goldLight, 0.85)],
];

const mix = (from: Light, to: Light, t: number): Light => ({
  a: interpolateColors(t, [0, 1], [from.a, to.a]),
  b: interpolateColors(t, [0, 1], [from.b, to.b]),
  c: interpolateColors(t, [0, 1], [from.c, to.c]),
  k: from.k + (to.k - from.k) * t,
});

export function lightAt(frame: number): Light {
  let light = KEYS[0][2];
  for (let i = 1; i < KEYS.length; i++) {
    const [at, fade, target] = KEYS[i];
    if (frame < at) break;
    light = mix(light, target, clamp(ramp(frame, at, at + fade)));
  }
  return light;
}
