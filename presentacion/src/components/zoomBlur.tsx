// Transición propia (no viene en @remotion/transitions): la diapositiva que sale
// se aleja y se desenfoca; la que entra llega desde un poco más cerca, enfocándose.
// Durante la transición el vidrio de las tarjetas pierde su desenfoque de fondo
// (un `filter` en un ancestro lo anula); a los 0,75 s vuelve.
import type React from 'react';
import type { TransitionPresentation, TransitionPresentationComponentProps } from '@remotion/transitions';
import { AbsoluteFill } from 'remotion';

type Props = Record<string, never>;

const ZoomBlur: React.FC<TransitionPresentationComponentProps<Props>> = ({ children, presentationDirection, presentationProgress: p }) => {
  const entering = presentationDirection === 'entering';
  const scale = entering ? 1.14 - 0.14 * p : 1 - 0.1 * p;
  const blur = 16 * (entering ? 1 - p : p);
  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale})`,
        filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
        opacity: entering ? p : 1 - p,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const zoomBlur = (): TransitionPresentation<Props> => ({ component: ZoomBlur, props: {} });
