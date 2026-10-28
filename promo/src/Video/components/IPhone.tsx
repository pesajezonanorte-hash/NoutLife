// El teléfono: un objeto 3D de verdad dentro de su propio contexto (preserve-3d).
// - Canto de titanio: capas apiladas hacia atrás que, al girar, dibujan el grosor
//   (con los botones laterales a media profundidad).
// - Frente: aro de titanio pulido, cristal negro, pantalla con la isla dinámica y un
//   reflejo que se desliza cuando el teléfono gira.
// - `pops`: piezas de la interfaz que se levantan de la pantalla (translateZ), fuera
//   del recorte de la pantalla para poder asomar por encima del teléfono.
// - `edgeGlow`: el halo de colores que recorre el borde de la pantalla cuando habla la IA.
// - `finish`: titanio natural (por defecto) o negro.
// Nada de box-shadow con desenfoque grande: el teléfono se escala y Chrome deja
// costuras cuadradas (ver README); los brillos son degradados.
import type React from 'react';
import { ISLAND, PHONE, SCREEN, type PhonePose } from '../layout';
import { clamp } from '../lib/anim';

/** Distancia de la cámara (px): lente larga, poca deformación, como una foto de producto. */
const PERSPECTIVE = 2100;
const SLICES = 13;
/** Acabados del titanio: aro pulido del frente, canto y botones laterales. */
const FINISH = {
  natural: {
    rim: 'linear-gradient(140deg, #f4f6f5 0%, #a3a8a5 9%, #50544f 24%, #2b2e2c 46%, #545956 70%, #c9cdca 90%, #7a7f7c 100%)',
    edge: 'linear-gradient(125deg, #d2d6d3 0%, #7b807d 12%, #3a3e3c 34%, #222524 58%, #353937 82%, #9a9f9c 100%)',
    button: 'linear-gradient(90deg, #6b706d, #2a2d2c 60%, #8a8f8c)',
  },
  // Titanio negro: el mismo pulido con menos luz; los brillos se quedan en gris acero
  black: {
    rim: 'linear-gradient(140deg, #b9bec4 0%, #5d6168 8%, #2a2d32 22%, #16181b 46%, #26292e 70%, #858a91 90%, #3d4046 100%)',
    edge: 'linear-gradient(125deg, #8c9198 0%, #43474d 12%, #1f2125 34%, #121316 58%, #1d1f23 82%, #5b5f66 100%)',
    button: 'linear-gradient(90deg, #4a4e54, #17191c 60%, #61656c)',
  },
} as const;
export type PhoneFinish = keyof typeof FINISH;
/** Botones laterales: [lado, desde y, alto]. Acción, volumen +, volumen − y encendido. */
const BUTTONS: Array<[-1 | 1, number, number]> = [
  [-1, 214, 58],
  [-1, 316, 104],
  [-1, 440, 104],
  [1, 352, 158],
];

export const phoneTransform = (p: PhonePose) =>
  `perspective(${PERSPECTIVE}px) rotateX(${p.rx}deg) rotateY(${p.ry}deg) rotateZ(${p.rz}deg) scale3d(${p.s}, ${p.s}, ${p.s})`;

const Slice: React.FC<{ z: number; buttons: boolean; finish: PhoneFinish }> = ({ z, buttons, finish }) => (
  <div style={{ position: 'absolute', inset: 0, borderRadius: PHONE.r, background: FINISH[finish].edge, transform: `translateZ(${z}px)` }}>
    {buttons &&
      BUTTONS.map(([side, top, height], i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top,
            height,
            width: 9,
            [side < 0 ? 'left' : 'right']: -4,
            borderRadius: 4,
            background: FINISH[finish].button,
          }}
        />
      ))}
  </div>
);

/** Halo de la IA: un anillo de colores que gira por el borde de la pantalla. */
const EdgeGlow: React.FC<{ amount: number; frame: number; colors: string[] }> = ({ amount, frame, colors }) => {
  if (amount <= 0.001) return null;
  const angle = (frame * 5) % 360;
  const stops = [...colors, colors[0]].map((c, i, all) => `${c} ${(i / (all.length - 1)) * 360}deg`).join(', ');
  const ring = (inset: number, pad: number, blur: number, opacity: number) => (
    <div
      style={{
        position: 'absolute',
        inset,
        borderRadius: SCREEN.r - inset,
        padding: pad,
        background: `conic-gradient(from ${angle}deg, ${stops})`,
        WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
        filter: `blur(${blur}px)`,
        opacity: opacity * amount,
      }}
    />
  );
  return (
    <>
      {ring(-6, 46, 26, 0.75)}
      {ring(-2, 16, 7, 0.95)}
      {ring(0, 4, 1, 0.9)}
    </>
  );
};

export const IPhone: React.FC<{
  pose: PhonePose;
  frame: number;
  /** Contenido de la pantalla, en px de pantalla (562 × 1190). */
  screen: React.ReactNode;
  /** Piezas levantadas sobre la pantalla (mismas coordenadas; usan translateZ). */
  pops?: React.ReactNode;
  edgeGlow?: number;
  glowColors?: string[];
  finish?: PhoneFinish;
  /**
   * Posición en fracciones de píxel: la parte entera en left/top y la fracción dentro de
   * la transformación. Chrome coloca el teléfono (una capa 3D) en píxeles enteros según
   * left/top, así que al moverse despacio avanza a saltos de 1 px; dentro de la
   * transformación 3D la fracción se remuestrea y el movimiento es continuo.
   */
  subpixel?: boolean;
  style?: React.CSSProperties;
}> = ({ pose, frame, screen, pops, edgeGlow = 0, glowColors = ['#7a66ff', '#5aa8ff', '#ff8aa8', '#ffb070'], finish = 'natural', subpixel = false, style }) => {
  // El canto solo se ve si el teléfono está girado
  const turned = Math.abs(pose.rx) + Math.abs(pose.ry) > 0.4;
  // El reflejo cruza la pantalla según el giro
  const glare = 50 + pose.ry * 2.4 - pose.rx * 1.2;
  const x = pose.x - PHONE.w / 2;
  const y = pose.y - PHONE.h / 2;
  const left = subpixel ? Math.floor(x) : x;
  const top = subpixel ? Math.floor(y) : y;
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: PHONE.w,
        height: PHONE.h,
        transform: subpixel ? `translate(${x - left}px, ${y - top}px) ${phoneTransform(pose)}` : phoneTransform(pose),
        transformStyle: 'preserve-3d',
        ...style,
      }}
    >
      {turned &&
        Array.from({ length: SLICES }, (_, i) => {
          const t = (i + 1) / SLICES;
          return <Slice key={i} z={-PHONE.depth * t} buttons={t > 0.3 && t < 0.75} finish={finish} />;
        })}

      {/* Frente: aro de titanio, cristal negro y pantalla */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: PHONE.r, background: FINISH[finish].rim, transform: 'translateZ(0.5px)' }}>
        <div
          style={{
            position: 'absolute',
            inset: PHONE.rim,
            borderRadius: PHONE.r - PHONE.rim,
            background: 'linear-gradient(160deg, #0b0c0c 0%, #020202 40%, #050606 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: SCREEN.x,
            top: SCREEN.y,
            width: SCREEN.w,
            height: SCREEN.h,
            borderRadius: SCREEN.r,
            overflow: 'hidden',
            background: '#000',
          }}
        >
          {screen}
          <EdgeGlow amount={edgeGlow} frame={frame} colors={glowColors} />
          {/* Isla dinámica con la lente de la cámara */}
          <div
            style={{
              position: 'absolute',
              left: (SCREEN.w - ISLAND.w) / 2,
              top: ISLAND.top,
              width: ISLAND.w,
              height: ISLAND.h,
              borderRadius: ISLAND.h / 2,
              background: '#000',
            }}
          >
            <div
              style={{
                position: 'absolute',
                right: 17,
                top: ISLAND.h / 2 - 9,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 35%, #2c3c66 0%, #101626 45%, #040507 75%)',
              }}
            />
          </div>
          {/* Reflejo del cristal */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(118deg, transparent ${glare - 26}%, rgba(255, 255, 255, 0.05) ${glare - 8}%, rgba(255, 255, 255, 0.11) ${glare}%, rgba(255, 255, 255, 0.03) ${glare + 7}%, transparent ${glare + 22}%)`,
              opacity: clamp(0.55 + Math.abs(pose.ry) / 30),
            }}
          />
        </div>
        {/* Brillo del canto pulido, arriba a la izquierda */}
        <div
          style={{
            position: 'absolute',
            inset: 1,
            borderRadius: PHONE.r - 1,
            boxShadow: 'inset 1.5px 1.5px 0 rgba(255, 255, 255, 0.55), inset -1px -1px 0 rgba(0, 0, 0, 0.6)',
          }}
        />
      </div>

      {pops && (
        <div
          style={{
            position: 'absolute',
            left: SCREEN.x,
            top: SCREEN.y,
            width: SCREEN.w,
            height: SCREEN.h,
            transformStyle: 'preserve-3d',
          }}
        >
          {pops}
        </div>
      )}
    </div>
  );
};
