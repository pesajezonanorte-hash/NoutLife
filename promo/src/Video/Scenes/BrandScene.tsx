// Escena 2 (6–8 s): revelación de marca. El punto de luz del gancho estalla: un
// destello, una onda de los tres colores, y las tres hojas del isotipo salen
// disparadas y se clavan en su sitio, cada una con el color de una palabra (rutina,
// cuerpo, mente). Los colores se funden en el jade de NoutLife, un brillo recorre
// las hojas y «Noutlife» sube letra a letra. Al final, el teléfono (escena 3) aparece
// encima con este mismo logo en su pantalla de arranque y toma el relevo.
import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { HOOK_TINT, rgba } from '../theme';
import { EASE, decay, lerp, ramp } from '../lib/anim';
import { BrandLockup, lockupState } from '../components/BrandLockup';
import { LOCKUP } from '../layout';
import { BRAND, SEQUENCES } from '../timeline';

export const BrandScene: React.FC = () => {
  const frame = useCurrentFrame() + SEQUENCES.brand.from;
  if (frame < BRAND.burst) return null;
  const b = frame - BRAND.burst;
  const flash = decay(frame, BRAND.burst, 5);
  const wave = ramp(b, 0, 26, EASE.out);
  // El teléfono aparece encima con el mismo logo; esta escena se quita cuando ya lo tapa
  const handoff = ramp(frame, BRAND.handoff.to - 2, BRAND.handoff.to + 1, EASE.linear);
  const { x, y } = LOCKUP.mark;
  return (
    <AbsoluteFill style={{ opacity: 1 - handoff }}>
      {/* Onda de choque con los tres colores */}
      {wave < 1 &&
        [HOOK_TINT.rutina.glow, HOOK_TINT.cuerpo.glow, HOOK_TINT.mente.glow].map((color, i) => {
          const w = ramp(b, i * 1.5, 24 + i * 1.5, EASE.out);
          return (
            <div
              key={color}
              style={{
                position: 'absolute',
                left: x - 600,
                top: y - 600,
                width: 1200,
                height: 1200,
                borderRadius: '50%',
                background: `radial-gradient(closest-side, transparent ${lerp(60, 90, w)}%, ${rgba(color, 0.55 * (1 - w))} ${lerp(80, 97, w)}%, transparent 100%)`,
                transform: `scale(${lerp(0.08, 1.15, w)})`,
              }}
            />
          );
        })}
      <BrandLockup state={lockupState(frame)} cx={LOCKUP.cx} cy={LOCKUP.cy} />
      {/* Destello del estallido */}
      {flash > 0.01 && (
        <div
          style={{
            position: 'absolute',
            left: x - 900,
            top: y - 900,
            width: 1800,
            height: 1800,
            borderRadius: '50%',
            background: `radial-gradient(closest-side, ${rgba('#ffffff', 0.95 * flash)} 0%, ${rgba('#eafff3', 0.45 * flash)} 16%, ${rgba('#bfe8d2', 0.12 * flash)} 42%, transparent 100%)`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
