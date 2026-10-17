// Escena 3 (8–18 s): módulos y ecosistema. El punto de la «i» se vuelve un nodo
// arriba; cada zona entra como una tarjeta flotante en 3D que gira desde la
// derecha y sale por la izquierda (un carrusel), siempre unida al nodo por una
// línea de luz. Al final las cuatro vuelven en pequeño alrededor del nodo, unidas
// entre sí, y vuelan hacia el teléfono de la escena 4.
import type React from 'react';
import { CameraMotionBlur } from '@remotion/motion-blur';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { COLORS, SPRING, rgba } from '../theme';
import { EASE, clamp, lerp, mixPose, ramp, springAt, type Pose } from '../lib/anim';
import { CARD, CARD_TOP, ECO_CENTER, HUB, I_DOT_POS, PHONE_POSE_A, SLOTS, SLOT_SCALE, tileCenter } from '../layout';
import { CARD_ORDER, CARD_TIMES, ECOSYSTEM, SEQUENCES, type CardId } from '../timeline';
import { I_DOT_RELEASE } from './BrandRevealScene';
import { ColiseoCard } from './zones/ColiseoCard';
import { CicloCard } from './zones/CicloCard';
import { HabitosCard } from './zones/HabitosCard';
import { SabioCard } from './zones/SabioCard';

const CARDS: Record<CardId, React.FC<{ local: number; frame: number }>> = {
  coliseo: ColiseoCard,
  ciclo: CicloCard,
  habitos: HabitosCard,
  sabio: SabioCard,
};

const SOLO: Pose = { x: CARD.x, y: CARD.y, z: 0, rx: 3, ry: 0, rz: 0, s: 1, o: 1 };
const OFF_RIGHT: Pose = { x: CARD.x + 1000, y: CARD.y + 70, z: -360, rx: 8, ry: -64, rz: 5, s: 1, o: 0 };
const OFF_LEFT: Pose = { x: CARD.x - 1000, y: CARD.y + 70, z: -360, rx: 8, ry: 64, rz: -5, s: 1, o: 0 };
const EXIT_SPRING = { damping: 20, stiffness: 150, mass: 0.8 };
/** Cuándo vuelve cada tarjeta al ecosistema y cuándo vuela al teléfono. */
const ECO_IN: Record<CardId, number> = { sabio: ECOSYSTEM.from, coliseo: ECOSYSTEM.from + 4, ciclo: ECOSYSTEM.from + 8, habitos: ECOSYSTEM.from + 12 };
const GATHER: Record<CardId, number> = { coliseo: ECOSYSTEM.gather, ciclo: ECOSYSTEM.gather + 2, habitos: ECOSYSTEM.gather + 4, sabio: ECOSYSTEM.gather + 6 };

function cardPose(id: CardId, frame: number): Pose {
  const { enter, exit } = CARD_TIMES[id];
  const pe = springAt(frame, enter, SPRING.card);
  const px = id === 'sabio' ? 0 : springAt(frame, exit, EXIT_SPRING);
  const pk = springAt(frame, ECO_IN[id], SPRING.card);
  const pg = springAt(frame, GATHER[id], SPRING.smooth, 22);
  let pose = mixPose(OFF_RIGHT, SOLO, pe);
  // Flota mientras está sola en primer plano
  const solo = clamp(pe) * (1 - clamp(px)) * (1 - clamp(pk));
  pose = {
    ...pose,
    y: pose.y + Math.sin(frame / 20) * 9 * solo,
    ry: pose.ry + Math.sin(frame / 34) * 3 * solo,
    rx: pose.rx + Math.sin(frame / 27) * 1.6 * solo,
  };
  pose = mixPose(pose, OFF_LEFT, px);
  const slot = SLOTS[id];
  pose = mixPose(pose, { x: slot.x, y: slot.y, z: 0, rx: 0, ry: 0, rz: 0, s: SLOT_SCALE, o: 1 }, pk);
  const tile = tileCenter(id, PHONE_POSE_A);
  return mixPose(pose, { x: tile.x, y: tile.y, z: 0, rx: 0, ry: 0, rz: 0, s: 0.2, o: 0 }, pg);
}

/** Fotogramas con desenfoque de movimiento real: los giros rápidos de las tarjetas. */
const BLUR_WINDOWS: Array<[number, number]> = [
  ...CARD_ORDER.map((id): [number, number] => [CARD_TIMES[id].enter - 1, CARD_TIMES[id].enter + 13]),
  [ECOSYSTEM.from, ECOSYSTEM.from + 26],
  [ECOSYSTEM.gather, ECOSYSTEM.gather + 24],
];

/** Las tarjetas en su escenario 3D. Lee el fotograma ella misma para que el desenfoque la congele por submuestras. */
const CardStage: React.FC = () => {
  const frame = useCurrentFrame() + SEQUENCES.zones.from;
  return (
    <AbsoluteFill style={{ perspective: 1800, perspectiveOrigin: '50% 48%' }}>
      {CARD_ORDER.map((id) => {
        const pose = cardPose(id, frame);
        if (pose.o < 0.005) return null;
        const Card = CARDS[id];
        return (
          <div
            key={id}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: CARD.w,
              height: CARD.h,
              transform: `translate3d(${pose.x - CARD.w / 2}px, ${pose.y - CARD.h / 2}px, ${pose.z}px) rotateX(${pose.rx}deg) rotateY(${pose.ry}deg) rotateZ(${pose.rz}deg) scale(${pose.s})`,
              opacity: pose.o,
            }}
          >
            <Card local={frame - CARD_TIMES[id].enter} frame={frame} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** El nodo: sale del punto de la «i», vive arriba, baja al centro del ecosistema y enciende el teléfono. */
function hubState(frame: number) {
  const lift = springAt(frame, I_DOT_RELEASE, SPRING.snappy);
  const fly = springAt(frame, I_DOT_RELEASE + 4, SPRING.smooth, 24);
  const start = { x: I_DOT_POS.x, y: I_DOT_POS.y - 24 * lift };
  const ctrl = { x: 860, y: 640 };
  const u = 1 - fly;
  let x = u * u * start.x + 2 * u * fly * ctrl.x + fly * fly * HUB.x;
  let y = u * u * start.y + 2 * u * fly * ctrl.y + fly * fly * HUB.y;
  let r = lerp(I_DOT_POS.r * (1 + 0.45 * lift), HUB.r, fly);
  const toEco = springAt(frame, ECOSYSTEM.from, SPRING.card);
  x = lerp(x, ECO_CENTER.x, toEco);
  y = lerp(y, ECO_CENTER.y, toEco);
  r = lerp(r, 21, toEco);
  const power = ramp(frame, 540, 556, EASE.out);
  return { x, y, r: lerp(r, 70, power), o: 1 - power, color: fly, toEco };
}

const Hub: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < I_DOT_RELEASE) return null;
  const h = hubState(frame);
  // Un halo por pulso mientras el nodo está quieto
  const beatT = (frame % 15) / 15;
  const halo = frame > 256 ? 1 : 0;
  const core = h.color > 0.5 ? COLORS.jade300 : COLORS.ivory;
  return (
    <AbsoluteFill style={{ opacity: h.o }}>
      <div
        style={{
          position: 'absolute',
          left: h.x - h.r * 2.6,
          top: h.y - h.r * 2.6,
          width: h.r * 5.2,
          height: h.r * 5.2,
          borderRadius: '50%',
          boxShadow: `inset 0 0 0 2px ${rgba(COLORS.jade300, 0.55 * (1 - beatT) * halo)}`,
          transform: `scale(${0.45 + 0.55 * beatT})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: h.x - h.r,
          top: h.y - h.r,
          width: h.r * 2,
          height: h.r * 2,
          borderRadius: '50%',
          background: `radial-gradient(circle at 40% 38%, #ffffff 0%, ${core} 45%, ${COLORS.jade} 100%)`,
          boxShadow: `0 0 ${h.r * 1.6}px ${h.r * 0.5}px ${rgba(COLORS.jade, 0.6)}, 0 0 ${h.r * 5}px ${h.r * 1.4}px ${rgba(COLORS.jade, 0.22)}`,
        }}
      />
    </AbsoluteFill>
  );
};

/** Línea de luz del nodo a la tarjeta de turno, con un pulso cada vez que llega una. */
const Connector: React.FC<{ frame: number }> = ({ frame }) => {
  const presence = Math.max(
    ...CARD_ORDER.map((id) => {
      const { enter, exit } = CARD_TIMES[id];
      const pe = clamp(springAt(frame, enter + 4, SPRING.smooth, 14));
      const px = id === 'sabio' ? clamp(springAt(frame, ECOSYSTEM.from, SPRING.smooth, 10)) : clamp(springAt(frame, exit, SPRING.smooth, 8));
      return pe * (1 - px);
    }),
  );
  const visible = presence * ramp(frame, 252, 262);
  if (visible < 0.01) return null;
  const y0 = HUB.y + HUB.r + 10;
  const y1 = CARD_TOP - 4;
  const pulses = CARD_ORDER.map((id) => ramp(frame, CARD_TIMES[id].enter + 6, CARD_TIMES[id].enter + 22, EASE.inOut)).filter((t) => t > 0 && t < 1);
  return (
    <AbsoluteFill style={{ opacity: visible }}>
      <div
        style={{
          position: 'absolute',
          left: HUB.x - 1.5,
          top: y0,
          width: 3,
          height: y1 - y0,
          borderRadius: 2,
          background: `linear-gradient(180deg, ${rgba(COLORS.jade300, 0.85)}, ${rgba(COLORS.jade, 0.25)})`,
          boxShadow: `0 0 12px ${rgba(COLORS.jade, 0.5)}`,
        }}
      />
      {pulses.map((t, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: HUB.x - 7,
            top: lerp(y0, y1, t) - 7,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#ffffff',
            boxShadow: `0 0 14px 5px ${rgba(COLORS.jade300, 0.8)}`,
            opacity: Math.sin(Math.PI * t),
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

/** Ecosistema: radios del nodo a cada zona, con pulsos que viajan hacia fuera. */
const Spokes: React.FC<{ frame: number }> = ({ frame }) => {
  const fade = 1 - ramp(frame, ECOSYSTEM.gather - 2, ECOSYSTEM.gather + 8);
  if (frame < ECOSYSTEM.from + 6 || fade <= 0) return null;
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <circle
          cx={ECO_CENTER.x}
          cy={ECO_CENTER.y}
          r={118}
          fill="none"
          stroke={rgba(COLORS.jade300, 0.3)}
          strokeWidth={2}
          strokeDasharray="3 12"
          transform={`rotate(${frame * 1.2} ${ECO_CENTER.x} ${ECO_CENTER.y})`}
          opacity={ramp(frame, ECOSYSTEM.from + 10, ECOSYSTEM.from + 22)}
        />
        {CARD_ORDER.map((id, i) => {
          const slot = SLOTS[id];
          const draw = ramp(frame, ECOSYSTEM.from + 8 + i * 3, ECOSYSTEM.from + 22 + i * 3, EASE.out);
          const x2 = lerp(ECO_CENTER.x, slot.x, draw);
          const y2 = lerp(ECO_CENTER.y, slot.y, draw);
          const t = (((frame - ECOSYSTEM.from) / 20 + i * 0.25) % 1 + 1) % 1;
          return (
            <g key={id}>
              <line x1={ECO_CENTER.x} y1={ECO_CENTER.y} x2={x2} y2={y2} stroke={rgba(COLORS.jade300, 0.22)} strokeWidth={10} strokeLinecap="round" />
              <line x1={ECO_CENTER.x} y1={ECO_CENTER.y} x2={x2} y2={y2} stroke={rgba(COLORS.jade300, 0.85)} strokeWidth={2.5} strokeLinecap="round" />
              {draw >= 1 && (
                <circle
                  cx={lerp(ECO_CENTER.x, slot.x, t)}
                  cy={lerp(ECO_CENTER.y, slot.y, t)}
                  r={6}
                  fill="#ffffff"
                  opacity={Math.sin(Math.PI * t)}
                  style={{ filter: `drop-shadow(0 0 8px ${COLORS.jade300})` }}
                />
              )}
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

export const ZonesScene: React.FC = () => {
  const frame = useCurrentFrame() + SEQUENCES.zones.from;
  const blur = BLUR_WINDOWS.some(([a, b]) => frame >= a && frame <= b);
  return (
    <AbsoluteFill>
      <Connector frame={frame} />
      <Spokes frame={frame} />
      {blur ? (
        <CameraMotionBlur samples={10} shutterAngle={180}>
          <CardStage />
        </CameraMotionBlur>
      ) : (
        <CardStage />
      )}
      <Hub frame={frame} />
    </AbsoluteFill>
  );
};
