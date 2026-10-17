// Escena 2 (4–8 s): revelación de marca. La luz que trajo la cámara se abre con
// una onda, las tres hojas del isotipo salen de ella y se posan con un rebote
// leve, un brillo las recorre, «Noutlife» sube letra a letra y después el lema.
// Al final el punto de la «i» se suelta: lo recoge la escena 3 como nodo.
import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { COLORS, FONT, SPRING, rgba } from '../theme';
import { EASE, clamp, lerp, ramp, springAt } from '../lib/anim';
import { BLADE_OFFSET, NoutLifeMark, Wordmark, type Blade, type BladeState } from '../components/Brand';
import { WordReveal } from '../components/ui';
import { BRAND, ORB } from '../layout';
import { SCENES, SEQUENCES } from '../timeline';

/** Cuándo se suelta el punto de la «i» (desde aquí lo dibuja la escena 3). */
export const I_DOT_RELEASE = 226;
/** El conjunto se va antes de que entre la primera tarjeta (f238): el corte queda limpio. */
const EXIT = { from: 220, to: 236 };

const BLADES: Array<{ k: Blade; at: number; r: number; s: number }> = [
  { k: 'b', at: 3, r: -38, s: 0.25 },
  { k: 'a', at: 6, r: 22, s: 0.3 },
  { k: 'c', at: 9, r: -28, s: 0.22 },
];

const TAGLINE_GRADIENT: React.CSSProperties = {
  fontWeight: 800,
  backgroundImage: `linear-gradient(100deg, #c4e6d4 0%, ${COLORS.jade} 55%, #5aa58c 100%)`,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
};

export const BrandRevealScene: React.FC = () => {
  const frame = useCurrentFrame() + SEQUENCES.brand.from;
  const b = frame - SCENES.brand.from;
  if (b < 0) return null;

  // La luz llega del gancho (mismo diámetro), se abre y se recoge dentro del isotipo
  const orbScale = b < 4 ? lerp(1, 1.35, ramp(b, 0, 4, EASE.out)) : lerp(1.35, 0.12, ramp(b, 4, 20, EASE.in));
  const orbOpacity = 1 - ramp(b, 12, 22);
  const shock = ramp(b, 0, 24, EASE.out);
  const flash = 1 - ramp(b, 1, 28, EASE.out);
  const backlight = 0.5 + 0.5 * flash + 0.06 * Math.sin(b / 9);

  const blades: Partial<Record<Blade, BladeState>> = {};
  for (const { k, at, r, s } of BLADES) {
    const p = springAt(b, at, SPRING.card);
    blades[k] = {
      s: lerp(s, 1, p),
      r: lerp(r, 0, p),
      x: lerp(-BLADE_OFFSET[k].x, 0, p),
      y: lerp(-BLADE_OFFSET[k].y, 0, p),
      o: clamp(p * 2.4),
    };
  }
  const sheen = ramp(b, 30, 52, EASE.inOut);
  const breathe = 1 + 0.008 * Math.sin(b / 11) * ramp(b, 30, 50);

  const exit = ramp(frame, EXIT.from, EXIT.to, EASE.in);
  const wordAt = (i: number) => 120 + 26 + i * 4;

  return (
    <AbsoluteFill>
      {/* Contraluz del isotipo */}
      <div
        style={{
          position: 'absolute',
          left: ORB.x - 520,
          top: ORB.y - 520,
          width: 1040,
          height: 1040,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${rgba(COLORS.jade, 0.34 * backlight)} 0%, ${rgba('#2a7262', 0.18 * backlight)} 32%, transparent 66%)`,
          opacity: 1 - exit,
        }}
      />
      {/* Onda expansiva */}
      <div
        style={{
          position: 'absolute',
          left: ORB.x - 450,
          top: ORB.y - 450,
          width: 900,
          height: 900,
          borderRadius: '50%',
          boxShadow: `inset 0 0 0 ${lerp(10, 1.5, shock)}px ${rgba(COLORS.jade300, 0.7 * (1 - shock))}, 0 0 40px ${rgba(COLORS.jade, 0.25 * (1 - shock))}`,
          transform: `scale(${lerp(0.17, 1.15, shock)})`,
          opacity: shock < 1 ? 1 : 0,
        }}
      />
      {/* La luz: halo y núcleo con degradados. Sin box-shadow: un desenfoque grande sobre
          un elemento escalado deja en Chrome una costura cuadrada alrededor del halo. */}
      <div
        style={{
          position: 'absolute',
          left: ORB.x - 330,
          top: ORB.y - 330,
          width: 660,
          height: 660,
          borderRadius: '50%',
          background: `radial-gradient(circle closest-side, ${rgba(COLORS.jade, 0.55)} 0%, ${rgba(COLORS.jade, 0.3)} 22%, ${rgba(COLORS.jade, 0.12)} 48%, ${rgba(COLORS.jade, 0.04)} 72%, transparent 100%)`,
          transform: `scale(${orbScale})`,
          opacity: orbOpacity,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: ORB.x - ORB.d / 2,
          top: ORB.y - ORB.d / 2,
          width: ORB.d,
          height: ORB.d,
          borderRadius: '50%',
          background: `radial-gradient(circle, #ffffff 0%, ${COLORS.jade300} 34%, ${rgba(COLORS.jade, 0.92)} 58%, ${rgba(COLORS.jade, 0.35)} 80%, ${rgba(COLORS.jade, 0)} 100%)`,
          transform: `scale(${orbScale})`,
          opacity: orbOpacity,
        }}
      />

      <AbsoluteFill
        style={{
          transformOrigin: `${ORB.x}px ${ORB.y + 200}px`,
          transform: `translateY(${-60 * exit}px) scale(${1 - 0.16 * exit})`,
          opacity: 1 - exit,
          filter: exit > 0.01 ? `blur(${exit * 8}px)` : undefined,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: ORB.x - BRAND.markWidth / 2,
            top: ORB.y - BRAND.markHeight / 2,
            transform: `scale(${breathe})`,
            filter: `drop-shadow(0 0 ${28 + 30 * flash}px ${rgba(COLORS.jade, 0.35 + 0.3 * flash)})`,
          }}
        >
          <NoutLifeMark height={BRAND.markHeight} blades={blades} sheen={sheen} />
        </div>

        <div style={{ position: 'absolute', left: ORB.x - BRAND.wordmarkWidth / 2, top: BRAND.wordmarkTop }}>
          <Wordmark
            width={BRAND.wordmarkWidth}
            hideDot={frame >= I_DOT_RELEASE}
            progress={(i) => springAt(b, 14 + i * 2.5, SPRING.smooth, 18)}
          />
        </div>

        <WordReveal
          frame={frame}
          rise={34}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: BRAND.taglineTop,
            textAlign: 'center',
            fontFamily: FONT.sans,
            fontWeight: 600,
            fontSize: 56,
            lineHeight: 1.22,
            letterSpacing: '-0.015em',
            color: COLORS.textSoft,
          }}
          lines={[
            [
              { text: 'Evoluciona', at: wordAt(0) },
              { text: 'en', at: wordAt(1) },
              { text: 'todas', at: wordAt(2) },
            ],
            [
              { text: 'tus', at: wordAt(3) },
              { text: 'áreas', at: wordAt(4) },
              { text: 'con', at: wordAt(5) + 2 },
              { text: 'NoutLife.', at: wordAt(6) + 3, style: TAGLINE_GRADIENT },
            ],
          ]}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
