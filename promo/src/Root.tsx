import type React from 'react';
import { Composition } from 'remotion';
import { NoutLifePromo } from './Video/NoutLifePromo';
import { DURATION, FPS, HEIGHT, WIDTH } from './Video/timeline';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="NoutLifePromoVertical"
    component={NoutLifePromo}
    durationInFrames={DURATION}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
    // En línea (no importadas) para que el Studio pueda editarlas y guardarlas
    defaultProps={{
      musicSrc: 'audio/noutlife-music.wav',
      voiceoverSrc: null,
      musicVolume: 1,
      sfxVolume: 1,
      showGuides: false,
    }}
  />
);
