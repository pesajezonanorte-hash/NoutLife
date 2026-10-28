// La oferta: una tarjeta de cristal líquido claro que entra entera, con todo su texto sólido
// desde su primer fotograma, detrás del teléfono que se eleva y sale del cuadro (al subir,
// el teléfono la destapa). Nada se revela letra a letra ni se funde después: cristal y texto
// aparecen a la vez, en 5 fotogramas, mientras la tarjeta sube 56 px y crece del 96,5 % al
// 100 % para posarse.
//   «7 DÍAS DE PRO.» / «GRATIS.»      negro; «PRO.» en oro hondo, con un destello después
//   «Sin tarjeta de crédito.»          jade #059669 (el #10b981 no se lee sobre crema)
//   letra pequeña                      quién puede tenerlo (la regla real de la app)
//   «Empieza ahora»                    píldora oscura con filo jade; llega después y se pulsa
// Dentro, un aura muy tenue de jade y champán que el cristal desenfoca (sobre un fondo liso,
// un cristal no tendría nada que mostrar), recortada a la tarjeta para que el papel de fuera
// no cambie; debajo, su sombra suave en degradados radiales (una box-shadow grande deja una
// costura en Chrome). Al cerrar, todo se va junto. Todo el texto es vectorial.
import type React from 'react';
import { lerp, ramp, springAt } from '../../Video/lib/anim';
import { rgba } from '../../Video/theme';
import { AD } from '../palette';
import { EASE, KEY_SPRING } from '../motion';
import { END, OFFER } from '../timeline';
import { COPY } from '../copy';
import { OutlineText, RunClip, type Line } from '../type/OutlineText';
import { LiquidGlass } from './LiquidGlass';

/** Tarjeta de la oferta (px del vídeo), algo por encima del centro. */
const CARD = { x: 90, y: 560, w: 900, h: 720, radius: 64 };
const CX = 540;
const CY = CARD.y + CARD.h / 2;
const Y0 = CARD.y;
const BASE = { headline: [Y0 + 166, Y0 + 266], noCard: Y0 + 356, fine: [Y0 + 422, Y0 + 460] };
const BUTTON = { w: 520, h: 112, y: Y0 + 528 };
const SIZE = { headline: 86, noCard: 44, fine: 28, button: 38 };
const TRACKING = -0.005;

/** Una línea del titular: negra, con el tramo «pro» en oro (un rectángulo recortado por sus letras, así el degradado cruza la palabra) y el destello. */
const Headline: React.FC<{ line: Line; y: number; glint: number }> = ({ line, y, glint }) => (
  <OutlineText
    line={line}
    size={SIZE.headline}
    tracking={TRACKING}
    x={CX}
    y={y}
    color={AD.inkOnPaper}
    fill={(run) => (run.run.role === 'pro' ? 'none' : undefined)}
    defs={(layout, id) => {
      const pro = layout.runs.find((r) => r.run.role === 'pro');
      if (!pro) return null;
      const gold = AD.goldOnPaper;
      return (
        <>
          <linearGradient id={`${id}-oro`} gradientUnits="userSpaceOnUse" x1={pro.x} y1={-layout.capHeight} x2={pro.x + pro.width} y2={0}>
            <stop offset="0" stopColor={gold[0]} />
            <stop offset="0.55" stopColor={gold[1]} />
            <stop offset="1" stopColor={gold[2]} />
          </linearGradient>
          <linearGradient id={`${id}-brillo`} gradientUnits="userSpaceOnUse" x1={lerp(pro.x - 140, pro.x + pro.width, glint)} y1={0} x2={lerp(pro.x, pro.x + pro.width + 140, glint)} y2={-layout.capHeight}>
            <stop offset="0" stopColor="#fff8e6" stopOpacity={0} />
            <stop offset="0.5" stopColor="#fff8e6" stopOpacity={0.85} />
            <stop offset="1" stopColor="#fff8e6" stopOpacity={0} />
          </linearGradient>
          <RunClip id={`${id}-pro`} run={pro} k={layout.k} />
        </>
      );
    }}
    front={(layout, id) => {
      const pro = layout.runs.find((r) => r.run.role === 'pro');
      if (!pro) return null;
      const box = { x: pro.x - 6, y: -layout.ascent, width: pro.width + 12, height: layout.ascent + layout.descent };
      return (
        <>
          <rect {...box} fill={`url(#${id}-oro)`} clipPath={`url(#${id}-pro)`} />
          {glint > 0 && glint < 1 && <rect {...box} fill={`url(#${id}-brillo)`} clipPath={`url(#${id}-pro)`} opacity={Math.sin(Math.PI * glint)} />}
        </>
      );
    }}
  />
);

export const OfferCard: React.FC<{ frame: number }> = ({ frame }) => {
  const [a, b] = OFFER.enter;
  const out = ramp(frame, END.cardOut[0], END.cardOut[1], EASE.inOut);
  if (frame < a || out >= 1) return null;
  // Entra entera y se posa; al cerrar baja un poco, se encoge y se va (siempre todo junto)
  const settle = ramp(frame, a, b, EASE.text);
  const shown = ramp(frame, a, a + 5, EASE.inOut) * (1 - out);
  const dy = 56 * (1 - settle) + 18 * ramp(frame, END.cardOut[0], END.cardOut[1], EASE.exit);
  const scale = lerp(0.965, 1, settle) * lerp(1, 0.975, out);
  const glint = ramp(frame, OFFER.glint, OFFER.glint + 18, EASE.inOut);
  const button = springAt(frame, OFFER.button, KEY_SPRING.ui);
  // La pulsación: baja un 3,5 % en 3 fotogramas y vuelve con un muelle
  const press = ramp(frame, OFFER.press, OFFER.press + 3, EASE.inOut) - springAt(frame, OFFER.press + 3, KEY_SPRING.ui);
  const bx = CX - BUTTON.w / 2;
  /** Lo que no es el cristal va en capas a pantalla completa que se mueven con la tarjeta. */
  const layer: React.CSSProperties = { position: 'absolute', inset: 0, opacity: shown, transform: `translateY(${dy}px) scale(${scale})`, transformOrigin: `${CX}px ${CY}px` };
  return (
    <>
      <div style={layer}>
        {/* Sombra suave, cálida, bajo la tarjeta */}
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(500px 90px at ${CX}px ${Y0 + CARD.h + 18}px, ${rgba('#5a4128', 0.16)}, transparent 75%)` }} />
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(640px 260px at ${CX}px ${Y0 + CARD.h - 40}px, ${rgba('#5a4128', 0.07)}, transparent 75%)` }} />
        {/* Aura: lo que el cristal desenfoca, solo dentro de la tarjeta */}
        <div style={{ position: 'absolute', left: CARD.x, top: CARD.y, width: CARD.w, height: CARD.h, borderRadius: CARD.radius, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(420px 380px at 240px 150px, ${rgba(AD.jade, 0.16)}, transparent 70%)` }} />
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(480px 420px at 690px 560px, ${rgba(AD.gold, 0.22)}, transparent 70%)` }} />
        </div>
      </div>
      <LiquidGlass
        width={CARD.w}
        height={CARD.h}
        radius={CARD.radius}
        left={CARD.x}
        top={CARD.y}
        transform={`translate(${CARD.w / 2}px, ${CARD.h / 2 + dy}px) scale(${scale}) translate(${-CARD.w / 2}px, ${-CARD.h / 2}px)`}
        opacity={shown}
        sheen={0.3}
      />
      <div style={layer}>
        {COPY.offer.headline.map((line, i) => (
          <Headline key={i} line={line} y={BASE.headline[i]} glint={glint} />
        ))}
        <OutlineText line={COPY.offer.noCard[0]} size={SIZE.noCard} x={CX} y={BASE.noCard} color={AD.jadeOnPaper} />
        {COPY.offer.fine.map((line, i) => (
          <OutlineText key={i} line={line} size={SIZE.fine} x={CX} y={BASE.fine[i]} color={AD.mutedOnPaper} />
        ))}
        {button > 0.001 && (
          // La píldora y su rótulo llegan juntos: crecen del 94 % con un muelle
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: Math.min(1, button * 2),
              transform: `scale(${lerp(0.94, 1, button) * (1 - 0.035 * press)})`,
              transformOrigin: `${CX}px ${BUTTON.y + BUTTON.h / 2}px`,
            }}
          >
            {/* Al pulsarla, un resplandor jade alrededor */}
            {press > 0.01 && (
              <div
                style={{
                  position: 'absolute',
                  left: bx - 60,
                  top: BUTTON.y - 50,
                  width: BUTTON.w + 120,
                  height: BUTTON.h + 100,
                  background: `radial-gradient(closest-side, ${rgba(AD.jade, 0.28 * press)}, transparent)`,
                }}
              />
            )}
            <div
              style={{
                position: 'absolute',
                left: bx,
                top: BUTTON.y,
                width: BUTTON.w,
                height: BUTTON.h,
                borderRadius: BUTTON.h / 2,
                // Píldora oscura; al pulsarla se oscurece un poco
                background: `linear-gradient(${rgba('#000000', 0.25 * press)}, ${rgba('#000000', 0.25 * press)}), linear-gradient(180deg, #262626 0%, ${AD.inkOnPaper} 100%)`,
                // Filo jade por dentro, que se enciende con la pulsación
                boxShadow: `inset 0 0 0 1.5px ${rgba(AD.jade, 0.55 + 0.4 * press)}, inset 0 1px 0 ${rgba('#ffffff', 0.14)}, 0 1px 2px ${rgba(AD.inkOnPaper, 0.12)}`,
              }}
            />
            <OutlineText line={COPY.offer.button[0]} size={SIZE.button} x={CX} y={BUTTON.y + BUTTON.h / 2 + 13} color={AD.paper} />
          </div>
        )}
      </div>
    </>
  );
};
