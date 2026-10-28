// Escenas 2 y 3 (3–13 s): el teléfono de titanio negro. Entra desde abajo con inercia
// (y desenfoque vertical según su velocidad), se posa y flota; los anillos de oro giran
// a su alrededor (la mitad de atrás pasa por detrás de él); las zonas Pro se abren y
// salen de la pantalla; la racha se enciende; el teléfono gira 18° en Y mientras la
// pantalla se transforma en el panel de Pro, y en la escena 3 sube para la oferta.
import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { COLORS, rgba } from '../../Video/theme';
import { clamp, lerp, springAt } from '../../Video/lib/anim';
import { IPhone } from '../../Video/components/IPhone';
import { PHONE, type PhonePose } from '../../Video/layout';
import { CardPops, SH, SW } from '../../Video/screens/kit';
import { OrbitRings } from '../components/OrbitRings';
import { LiteHome, liteHomeCards } from '../screens/LiteHome';
import { ProPanel } from '../screens/ProPanel';
import { phoneFloat, phonePose } from '../pose';
import { SEQUENCES, UNLOCK } from '../timeline';

/** La transformación de la pantalla: sin rebote, ~0,5 s. */
const MORPH = { stiffness: 100, damping: 20, mass: 1 };
/** Centro del círculo que revela el panel (px de pantalla) y radio que cubre la pantalla entera. */
const MORPH_CENTER = { x: SW / 2, y: SH * 0.46 };
const MORPH_RADIUS = Math.hypot(SW / 2, SH * 0.54) + 20;

const morphAt = (frame: number) => springAt(frame, UNLOCK.morph.from, MORPH);

/** Sombras del teléfono: una ambiental detrás y una de contacto en el «suelo», que se aclara al flotar. */
const PhoneShadow: React.FC<{ pose: PhonePose; float: number }> = ({ pose, float }) => {
  const w = PHONE.w * pose.s;
  const h = PHONE.h * pose.s;
  const lift = (1 + float) / 2;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: pose.x - w * 0.8,
          top: pose.y - h * 0.44 + 70 * pose.s,
          width: w * 1.6,
          height: h * 1.06,
          borderRadius: '50%',
          background: `radial-gradient(closest-side, ${rgba('#020617', 0.6)} 0%, ${rgba('#020617', 0.28)} 55%, transparent 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: pose.x - w * (0.46 - 0.06 * lift),
          top: pose.y + h / 2 + (40 + 18 * lift) * pose.s,
          width: w * (0.92 - 0.12 * lift),
          height: 70 * pose.s,
          borderRadius: '50%',
          background: `radial-gradient(closest-side, ${rgba('#020617', 0.7 - 0.25 * lift)} 0%, transparent 100%)`,
        }}
      />
    </>
  );
};

/** Filtro SVG de desenfoque vertical (el teléfono que entra deprisa). */
const VerticalBlur: React.FC<{ sigma: number }> = ({ sigma }) => (
  <svg width={0} height={0} style={{ position: 'absolute' }}>
    <filter id="phone-motion" x="-5%" y="-20%" width="110%" height="140%" colorInterpolationFilters="sRGB">
      <feGaussianBlur stdDeviation={`0 ${sigma}`} />
    </filter>
  </svg>
);

/** La pantalla: el Inicio en Lite y, al transformarse, el panel de Pro que se abre en círculo. */
const Screen: React.FC<{ frame: number }> = ({ frame }) => {
  const m = morphAt(frame);
  const r = lerp(0, MORPH_RADIUS, clamp(m));
  return (
    <>
      {m < 0.999 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            // Se va al ritmo del círculo (fundido cruzado): si se apaga antes, la pantalla parpadea
            opacity: 1 - clamp(m),
            transform: `scale(${1 - 0.07 * m})`,
            filter: m > 0.01 ? `blur(${10 * m}px)` : undefined,
          }}
        >
          <LiteHome frame={frame} at={UNLOCK.phoneIn + 4} cards={liteHomeCards(frame)} />
        </div>
      )}
      {m > 0.001 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            clipPath: m < 0.999 ? `circle(${r}px at ${MORPH_CENTER.x}px ${MORPH_CENTER.y}px)` : undefined,
            transform: `scale(${1.06 - 0.06 * clamp(m)})`,
            filter: m < 0.95 ? `blur(${(1 - m) * 8}px)` : undefined,
          }}
        >
          {/* Su contenido entra mientras el círculo se abre: la pantalla nunca queda vacía */}
          <ProPanel frame={frame} at={UNLOCK.morph.from + 1} />
        </div>
      )}
      {/* El borde del círculo brilla en oro mientras se abre */}
      {m > 0.001 && m < 0.995 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at ${MORPH_CENTER.x}px ${MORPH_CENTER.y}px, transparent ${Math.max(0, r - 26)}px, ${rgba(COLORS.gold, 0.45 * (1 - m))} ${r - 3}px, ${rgba(COLORS.goldLight, 0.9 * (1 - m))} ${r}px, transparent ${r + 14}px)`,
          }}
        />
      )}
    </>
  );
};

export const DeviceScene: React.FC = () => {
  const frame = useCurrentFrame() + SEQUENCES.device.from;
  const pose = phonePose(frame);
  // Desenfoque de movimiento según la velocidad vertical (px por fotograma)
  const sigma = Math.min(16, Math.abs(pose.y - phonePose(frame - 1).y) * 0.12);
  const m = morphAt(frame);
  return (
    <AbsoluteFill>
      <PhoneShadow pose={pose} float={phoneFloat(frame)} />
      <OrbitRings frame={frame} cx={pose.x} cy={pose.y} layer="back" />
      <VerticalBlur sigma={sigma} />
      <AbsoluteFill style={{ filter: sigma > 0.4 ? 'url(#phone-motion)' : undefined }}>
        <IPhone
          pose={pose}
          frame={frame}
          finish="black"
          screen={<Screen frame={frame} />}
          pops={<CardPops cards={liteHomeCards(frame)} opacity={1 - clamp(m * 1.4)} />}
        />
      </AbsoluteFill>
      <OrbitRings frame={frame} cx={pose.x} cy={pose.y} layer="front" />
    </AbsoluteFill>
  );
};
