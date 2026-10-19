import type React from 'react';
import { Composition } from 'remotion';
import { Presentacion } from './Presentacion';
import { FPS, HEIGHT, WIDTH } from './lib';
import { DURATION } from './timeline';

export const RemotionRoot: React.FC = () => (
  <Composition id="Presentacion" component={Presentacion} durationInFrames={DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />
);
