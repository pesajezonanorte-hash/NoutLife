// La composición: fondo común, las cinco diapositivas enlazadas con
// <TransitionSeries> y, desde la segunda, una cabecera como la de un sitio de
// NoutLife: el lockup a la izquierda y el avance a la derecha.
import React from 'react';
import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop } from './components/Backdrop';
import { NoutLifeMark, Wordmark } from './components/Brand';
import { COLORS, FONT, rgba } from './theme';
import { EASE, TRANSITION, ramp } from './lib';
import { SLIDES, SLIDE_STARTS, slideAt } from './timeline';
import './fonts';

const Header: React.FC = () => {
  const frame = useCurrentFrame();
  const current = slideAt(frame);
  const show = ramp(frame, SLIDE_STARTS[1], SLIDE_STARTS[1] + TRANSITION);
  if (show === 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 140,
        right: 140,
        top: 56,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        opacity: show,
        transform: `translateY(${(1 - show) * -16}px)`,
      }}
    >
      <NoutLifeMark height={34} />
      <Wordmark height={22} />
      <span style={{ marginLeft: 'auto', fontSize: 19, fontWeight: 500, color: COLORS.muted }}>{SLIDES[current].title}</span>
      <span style={{ display: 'flex', gap: 6, marginLeft: 18 }}>
        {SLIDES.map((s, i) => (
          <span key={s.title} style={{ width: 26, height: 4, borderRadius: 2, background: i <= current ? COLORS.jade : rgba(COLORS.text, 0.12) }} />
        ))}
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
    <Header />
  </AbsoluteFill>
);
