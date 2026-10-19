// La composición: fondo común, las cinco diapositivas enlazadas con
// <TransitionSeries> y un pie con el ponente y el avance (desde la segunda).
import React from 'react';
import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop } from './components/Backdrop';
import { NoutLifeMark } from './components/Brand';
import { COLORS, FONT, rgba } from './theme';
import { EASE, TRANSITION, ramp } from './lib';
import { SLIDES, SLIDE_STARTS, slideAt } from './timeline';
import './fonts';

const Footer: React.FC = () => {
  const frame = useCurrentFrame();
  const current = slideAt(frame);
  const show = ramp(frame, SLIDE_STARTS[1], SLIDE_STARTS[1] + TRANSITION);
  if (show === 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 120,
        right: 120,
        bottom: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        fontSize: 18,
        color: COLORS.faint,
        opacity: show,
      }}
    >
      <NoutLifeMark height={22} />
      <span style={{ fontWeight: 600 }}>Miguel Ángel Romero Torres</span>
      <span>Colegio Jorge Isaacs</span>
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        {SLIDES.map((s, i) => (
          <span key={s.title} style={{ width: 30, height: 4, borderRadius: 2, background: i <= current ? COLORS.indigo : rgba(COLORS.muted, 0.25) }} />
        ))}
      </span>
      <span style={{ fontFamily: FONT.mono, minWidth: 48, textAlign: 'right' }}>
        {current + 1}/{SLIDES.length}
      </span>
    </div>
  );
};

export const Presentacion: React.FC = () => (
  <AbsoluteFill style={{ fontFamily: FONT.sans, color: COLORS.text }}>
    <Backdrop />
    <TransitionSeries>
      {SLIDES.map((s, i) => (
        <React.Fragment key={s.title}>
          {s.enter && <TransitionSeries.Transition presentation={s.enter} timing={linearTiming({ durationInFrames: TRANSITION, easing: EASE.inOut })} />}
          <TransitionSeries.Sequence durationInFrames={s.duration} name={`${i + 1}. ${s.title}`}>
            <s.component />
          </TransitionSeries.Sequence>
        </React.Fragment>
      ))}
    </TransitionSeries>
    <Footer />
  </AbsoluteFill>
);
