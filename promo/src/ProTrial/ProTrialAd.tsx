// Anuncio «7 días de Pro» en 15 s, vertical 9:16, para Reels, TikTok y Shorts.
// Capas, de atrás adelante: el fondo slate con sus luces (todo el anuncio), el gancho,
// el teléfono (escenas 2 y 3), el titular de las zonas, la oferta, la viñeta, el
// cierre a negro con el logo, el grano y la banda sonora.
import type React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import '../Video/fonts';
import { FONT } from '../Video/theme';
import { Grain, Vignette } from '../Video/components/Atmosphere';
import { Guides } from '../Video/components/Guides';
import { Soundtrack, type SoundCues, type SoundtrackProps } from '../Video/audio/Soundtrack';
import { AD } from './brand';
import { Backdrop } from './components/Backdrop';
import { HookScene } from './scenes/HookScene';
import { DeviceScene } from './scenes/DeviceScene';
import { UnlockTitle } from './scenes/UnlockTitle';
import { OfferScene } from './scenes/OfferScene';
import { EndCard } from './scenes/EndCard';
import { DURATION, SEQUENCES, SFX_CUES, VO_CUES } from './timeline';

/** Los valores por defecto están en src/Root.tsx. */
export type ProTrialProps = SoundtrackProps & {
  /** Muestra las zonas seguras de las redes y la frase de locución (solo para editar). */
  showGuides: boolean;
};

const CUES: SoundCues = { duration: DURATION, sfx: SFX_CUES, vo: VO_CUES };
const seq = (s: { from: number; to: number }) => ({ from: s.from, durationInFrames: s.to - s.from });

export const ProTrialAd: React.FC<ProTrialProps> = ({ showGuides, ...sound }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: AD.slate, fontFamily: FONT.sans }}>
      <Backdrop frame={frame} />

      <Sequence name="1 · Gancho" {...seq(SEQUENCES.hook)}>
        <HookScene />
      </Sequence>
      <Sequence name="2–3 · Teléfono" {...seq(SEQUENCES.device)}>
        <DeviceScene />
      </Sequence>
      <Sequence name="2 · Titular de las zonas" {...seq(SEQUENCES.unlockTitle)}>
        <UnlockTitle />
      </Sequence>
      <Sequence name="3 · Oferta y botón" {...seq(SEQUENCES.offer)}>
        <OfferScene />
      </Sequence>

      <Vignette />
      <Sequence name="Cierre · logo" {...seq(SEQUENCES.end)}>
        <EndCard />
      </Sequence>
      <Grain frame={frame} />
      {showGuides && <Guides frame={frame} cues={VO_CUES} />}
      <Soundtrack {...sound} cues={CUES} />
    </AbsoluteFill>
  );
};
