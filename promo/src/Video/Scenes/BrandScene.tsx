// Escena 2 (5–8 s): de la frase sale la luz. Mientras el texto se encoge hacia el centro
// del isotipo, tres luces de color (rutina, cuerpo, mente) giran hacia ese punto y se
// funden en un núcleo blanco; un resplandor jade lo envuelve. Desde ahí, las tres hojas
// del isotipo se posan, cada una con el color de su palabra, y se funden en el jade de
// NoutLife, y «Noutlife» sube letra a letra. Todo se encadena sin cortes: la luz sube, el
// logo la recoge y, al final, el teléfono (escena 3) toma el relevo con este mismo logo
// en su pantalla de arranque.
import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { COLORS, HOOK_TINT, rgba } from '../theme';
import { EASE, clamp, lerp, ramp } from '../lib/anim';
import { BrandLockup, lockupState } from '../components/BrandLockup';
import { LOCKUP } from '../layout';
import { BRAND, HOOK, SEQUENCES } from '../timeline';

const POINT = LOCKUP.mark;
const ORBS = [HOOK_TINT.rutina.glow, HOOK_TINT.cuerpo.glow, HOOK_TINT.mente.glow];

/**
 * Las tres luces de color: salen del tamaño del texto (440 px) y giran hacia el centro del
 * isotipo mientras la frase se encoge (`c`, 0 → 1). Se funden con la pantalla, sin saturarla.
 */
const Lights: React.FC<{ frame: number; c: number }> = ({ frame, c }) => {
  const on = ramp(frame, HOOK.collapse.from, HOOK.collapse.from + 16, EASE.inOut) * (1 - EASE.inOut(clamp((c - 0.85) / 0.15)));
  if (on <= 0.002) return null;
  const R = (1 - c) * 440;
  const size = lerp(280, 96, c);
  return (
    <AbsoluteFill style={{ mixBlendMode: 'screen' }}>
      {ORBS.map((color, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3 + c * 2.4;
        return (
          <div
            key={color}
            style={{
              position: 'absolute',
              left: POINT.x + Math.cos(a) * R - size / 2,
              top: POINT.y + Math.sin(a) * R * 0.9 - size / 2,
              width: size,
              height: size,
              borderRadius: '50%',
              background: `radial-gradient(closest-side, #ffffff 0%, ${rgba(color, 0.9)} 30%, ${rgba(color, 0)} 100%)`,
              opacity: 0.9 * on,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** El núcleo blanco: crece al converger las luces y se apaga mientras las hojas ya salen de él. */
const Core: React.FC<{ frame: number; c: number }> = ({ frame, c }) => {
  const on =
    ramp(frame, HOOK.collapse.from + 8, HOOK.collapse.from + 28, EASE.inOut) * (1 - ramp(frame, BRAND.burst + 2, BRAND.burst + 28, EASE.inOut));
  if (on <= 0.002) return null;
  const r = lerp(26, 150, c);
  return (
    <div
      style={{
        position: 'absolute',
        left: POINT.x - r,
        top: POINT.y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: '50%',
        background: `radial-gradient(closest-side, #ffffff 0%, rgba(255, 255, 255, 0.9) 22%, ${rgba('#d6ffe8', 0.35)} 52%, transparent 100%)`,
        opacity: on,
      }}
    />
  );
};

/** El resplandor jade que envuelve la luz: sube con la convergencia y se va despacio al revelarse el logo. */
const Bloom: React.FC<{ frame: number }> = ({ frame }) => {
  const on = 0.9 * ramp(frame, 158, BRAND.burst + 2, EASE.inOut) * (1 - ramp(frame, BRAND.burst + 4, BRAND.burst + 40, EASE.out));
  if (on <= 0.002) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: POINT.x - 760,
        top: POINT.y - 760,
        width: 1520,
        height: 1520,
        borderRadius: '50%',
        background: `radial-gradient(closest-side, ${rgba(COLORS.jade, 0.42)} 0%, ${rgba(COLORS.jade, 0.2)} 30%, ${rgba('#2a7262', 0.07)} 62%, transparent 100%)`,
        opacity: on,
      }}
    />
  );
};

/** Ondas que salen del isotipo al nacer, cada una con el color de una palabra. */
const Rings: React.FC<{ frame: number }> = ({ frame }) => {
  const b = frame - BRAND.burst;
  if (b < 0) return null;
  const wave = ramp(b, 0, 26, EASE.out);
  if (wave >= 1) return null;
  return (
    <>
      {ORBS.map((color, i) => {
        const w = ramp(b, i * 1.5, 24 + i * 1.5, EASE.out);
        return (
          <div
            key={color}
            style={{
              position: 'absolute',
              left: POINT.x - 600,
              top: POINT.y - 600,
              width: 1200,
              height: 1200,
              borderRadius: '50%',
              background: `radial-gradient(closest-side, transparent ${lerp(60, 90, w)}%, ${rgba(color, 0.5 * (1 - w) * ramp(b, 0, 4))} ${lerp(80, 97, w)}%, transparent 100%)`,
              transform: `scale(${lerp(0.08, 1.15, w)})`,
            }}
          />
        );
      })}
    </>
  );
};

export const BrandScene: React.FC = () => {
  const frame = useCurrentFrame() + SEQUENCES.brand.from;
  const c = ramp(frame, HOOK.collapse.from, HOOK.collapse.to, EASE.inOut); // la misma curva que la frase del gancho
  const handoff = ramp(frame, BRAND.handoff.to - 2, BRAND.handoff.to + 1, EASE.linear);
  return (
    <AbsoluteFill style={{ opacity: 1 - handoff }}>
      <Bloom frame={frame} />
      <Lights frame={frame} c={c} />
      <Core frame={frame} c={c} />
      <Rings frame={frame} />
      <BrandLockup state={lockupState(frame)} cx={LOCKUP.cx} cy={LOCKUP.cy} />
    </AbsoluteFill>
  );
};
