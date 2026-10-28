// Escenas 2 y 3 (3–13 s): el teléfono y las tarjetas de cristal.
// - El teléfono (titanio negro, Video/components/IPhone) sale del centro mientras la
//   cámara retrocede: se acerca, se enfoca y gira hasta quedar a 3° en Y. Su pantalla es
//   la app (screens/PhoneScreen).
// - Recreación y Coliseo salen de su casilla del menú como tarjetas de cristal y se posan
//   delante del teléfono (más cerca de la cámara: paralaje), arriba a la derecha y abajo
//   a la izquierda, solapando su canto para que el cristal lo desenfoque.
// - En la escena 3 las tarjetas se van y el teléfono sube hasta la oferta.
// Una luz de contorno muy tenue separa el titanio oscuro del fondo.
import type React from 'react';
import { Clapperboard, Swords, type LucideIcon } from 'lucide-react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { rgba } from '../../Video/theme';
import { clamp, lerp, ramp } from '../../Video/lib/anim';
import { IPhone } from '../../Video/components/IPhone';
import { PHONE } from '../../Video/layout';
import { usePalette } from '../palette';
import { EASE, KEY_SPRING, softSpring } from '../motion';
import { cameraAt, layerTransform, type Cam } from '../camera';
import { POSE_REVEAL, phonePose, phoneReveal, screenToWorld } from '../device';
import { COPY } from '../copy';
import { PhoneScreen } from '../screens/PhoneScreen';
import { tileCenter } from '../screens/MenuSheet';
import { CALLOUT, ZoneCallout } from '../components/ZoneCallout';
import { SUBPIXEL } from '../subpixel';
import type { Line } from '../type/OutlineText';
import { OFFER, REVEAL, SEQUENCES, type CalloutId } from '../timeline';

/** Profundidad de las tarjetas: un 20 % más cerca de la cámara que el teléfono. */
const CALLOUT_DEPTH = -0.2;

const CALLOUTS: Array<{ id: CalloutId; icon: LucideIcon; title: Line; at: { x: number; y: number } }> = [
  { id: 'recreacion', icon: Clapperboard, title: COPY.callout.recreacion[0], at: { x: 806, y: 552 } },
  { id: 'coliseo', icon: Swords, title: COPY.callout.coliseo[0], at: { x: 272, y: 1252 } },
];

const Callout: React.FC<{ frame: number; cam: Cam; c: (typeof CALLOUTS)[number] }> = ({ frame, cam, c }) => {
  const p = softSpring(frame, REVEAL.callouts[c.id], KEY_SPRING.glass, 4);
  if (p <= 0.001) return null;
  const out = ramp(frame, OFFER.calloutsOut, OFFER.calloutsOut + 18, EASE.exit);
  if (out >= 1) return null;
  const from = screenToWorld(POSE_REVEAL, tileCenter(c.id).x, tileCenter(c.id).y);
  // Al irse se alejan del teléfono, hacia su lado
  const away = { x: c.at.x - POSE_REVEAL.x, y: c.at.y - POSE_REVEAL.y };
  const len = Math.hypot(away.x, away.y);
  const x = lerp(from.x, c.at.x, p) + (away.x / len) * 60 * out;
  const y = lerp(from.y, c.at.y, p) + (away.y / len) * 60 * out;
  const scale = lerp(0.42, 1, p) * (1 - 0.04 * out);
  return (
    <AbsoluteFill style={{ transform: layerTransform(cam, lerp(0, CALLOUT_DEPTH, p)), transformOrigin: '0 0' }}>
      {/* La tarjeta (con backdrop-filter) es una capa compuesta: se mueve dentro de su transformación */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: CALLOUT.w,
          height: CALLOUT.h,
          transformOrigin: `${CALLOUT.w / 2}px ${CALLOUT.h / 2}px`,
          transform: `translate(${x - CALLOUT.w / 2}px, ${y - CALLOUT.h / 2}px) scale(${scale}) ${SUBPIXEL}`,
        }}
      >
        <ZoneCallout frame={frame} center={c.at} icon={c.icon} title={c.title} presence={clamp(p * 1.8) * (1 - out)} />
      </div>
    </AbsoluteFill>
  );
};

export const DeviceScene: React.FC = () => {
  const frame = useCurrentFrame() + SEQUENCES.device.from;
  const palette = usePalette();
  const cam = cameraAt(frame);
  const pose = phonePose(frame);
  const reveal = phoneReveal(frame);
  const w = PHONE.w * pose.s;
  const h = PHONE.h * pose.s;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: layerTransform(cam), transformOrigin: '0 0' }}>
        {/* Luz de contorno detrás del teléfono */}
        <div
          style={{
            position: 'absolute',
            left: pose.x - w,
            top: pose.y - h * 0.75,
            width: w * 2,
            height: h * 1.5,
            borderRadius: '50%',
            background: `radial-gradient(closest-side, ${rgba(palette.backlight, 0.09)} 0%, ${rgba(palette.backlight, 0.035)} 55%, transparent 100%)`,
            opacity: reveal.opacity,
          }}
        />
        <AbsoluteFill style={{ opacity: reveal.opacity, filter: reveal.blur > 0.05 ? `blur(${reveal.blur}px)` : undefined, transform: SUBPIXEL }}>
          <IPhone pose={pose} frame={frame} finish="black" subpixel screen={<PhoneScreen frame={frame} />} />
        </AbsoluteFill>
      </AbsoluteFill>
      {CALLOUTS.map((c) => (
        <Callout key={c.id} frame={frame} cam={cam} c={c} />
      ))}
    </AbsoluteFill>
  );
};
