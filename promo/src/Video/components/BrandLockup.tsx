// El logo apilado (isotipo + «Noutlife») con su contraluz. Lo dibujan la escena 2 y
// la pantalla de arranque del teléfono con el mismo estado, así que en el relevo
// (el teléfono con la pantalla del tamaño del lienzo) las dos imágenes coinciden.
import type React from 'react';
import { COLORS, HOOK_TINT, SPRING, rgba } from '../theme';
import { EASE, clamp, flash, lerp, ramp, springAt } from '../lib/anim';
import { LOCKUP } from '../layout';
import { BRAND } from '../timeline';
import { BLADE_OFFSET, NoutLifeMark, Wordmark, type Blade, type BladeState } from './Brand';

/** Muelle de las hojas: salen disparadas del punto y se clavan con un rebote. */
const BLADE_SPRING = { stiffness: 180, damping: 15, mass: 0.85 };
/** Cada hoja trae el color de una palabra del gancho y un giro de salida. */
const BLADES: Record<Blade, { tint: string; turn: number }> = {
  b: { tint: HOOK_TINT.rutina.glow, turn: -70 },
  a: { tint: HOOK_TINT.cuerpo.glow, turn: 40 },
  c: { tint: HOOK_TINT.mente.glow, turn: -55 },
};

export interface LockupState {
  blades: Partial<Record<Blade, BladeState>>;
  sheen: number | null;
  letters: (order: number) => number;
  /** Intensidad del contraluz (1 = en reposo). */
  glow: number;
  /** Acercamiento lento de la cámara mientras el logo está quieto. */
  push: number;
}

export function lockupState(frame: number): LockupState {
  const blades: Partial<Record<Blade, BladeState>> = {};
  const tint = 1 - ramp(frame, BRAND.tint.from, BRAND.tint.to);
  for (const k of ['b', 'a', 'c'] as const) {
    const p = springAt(frame, BRAND.blades[k], BLADE_SPRING);
    blades[k] = {
      s: lerp(0.05, 1, p),
      r: lerp(BLADES[k].turn, 0, p),
      x: lerp(-BLADE_OFFSET[k].x, 0, p),
      y: lerp(-BLADE_OFFSET[k].y, 0, p),
      o: clamp(p * 3),
      tint: { color: BLADES[k].tint, amount: tint },
    };
  }
  const sheen = ramp(frame, BRAND.sheen.from, BRAND.sheen.to, EASE.inOut);
  return {
    blades,
    sheen: sheen > 0 && sheen < 1 ? sheen : null,
    letters: (i) => springAt(frame, BRAND.wordmark + i * 2.2, SPRING.smooth, 18),
    // El halo sube sin saltos: la luz de la escena 2 ya lo envuelve al nacer el logo
    glow: 0.8 * ramp(frame, 176, 200, EASE.out) + 0.35 * flash(frame, BRAND.burst, 4, 14),
    push: 1 + 0.035 * ramp(frame, BRAND.burst, BRAND.handoff.to, EASE.linear),
  };
}

/**
 * El logo con su centro en (cx, cy). `k` es su escala: 1 en la escena 2; en la
 * pantalla del teléfono, 1 / la escala del teléfono en el relevo.
 */
export const BrandLockup: React.FC<{ state: LockupState; cx: number; cy: number; k?: number }> = ({ state, cx, cy, k = 1 }) => {
  const s = k * state.push;
  const markTop = LOCKUP.mark.y - LOCKUP.markHeight / 2 - LOCKUP.cy;
  const glow = state.glow;
  return (
    <div style={{ position: 'absolute', left: cx, top: cy, width: 0, height: 0, transform: `scale(${s})` }}>
      {/* Contraluz jade */}
      <div
        style={{
          position: 'absolute',
          left: -560,
          top: LOCKUP.mark.y - LOCKUP.cy - 560,
          width: 1120,
          height: 1120,
          borderRadius: '50%',
          background: `radial-gradient(circle closest-side, ${rgba(COLORS.jade, 0.3 * glow)} 0%, ${rgba('#2a7262', 0.16 * glow)} 38%, ${rgba('#1a5547', 0.06 * glow)} 66%, transparent 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: -LOCKUP.markWidth / 2,
          top: markTop,
          filter: `drop-shadow(0 0 ${26 + 30 * (glow - 0.8)}px ${rgba(COLORS.jade, clamp(0.3 + 0.25 * (glow - 0.8)))})`,
        }}
      >
        <NoutLifeMark height={LOCKUP.markHeight} blades={state.blades} sheen={state.sheen} />
      </div>
      <div style={{ position: 'absolute', left: -LOCKUP.wordmarkWidth / 2, top: LOCKUP.wordmarkTop - LOCKUP.cy }}>
        <Wordmark width={LOCKUP.wordmarkWidth} progress={state.letters} />
      </div>
    </div>
  );
};
