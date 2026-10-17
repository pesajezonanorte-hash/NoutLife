// Composición principal: NoutLife en 25 s, vertical 9:16, para Reels, TikTok y Shorts.
// Capas, de atrás adelante: fondo y partículas (todo el vídeo), las cuatro escenas
// (cada una en su Sequence, con unos fotogramas de solape para las transiciones),
// viñeta y grano, y la banda sonora.
import type React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import './fonts';
import { COLORS, FONT } from './theme';
import { SEQUENCES } from './timeline';
import { Backdrop, Grain, Particles, Vignette } from './components/Atmosphere';
import { Guides } from './components/Guides';
import { HookScene, hookWarp } from './Scenes/HookScene';
import { BrandRevealScene } from './Scenes/BrandRevealScene';
import { ZonesScene } from './Scenes/ZonesScene';
import { CtaScene } from './Scenes/CtaScene';
import { Soundtrack, type SoundtrackProps } from './audio/Soundtrack';

/** Los valores por defecto están en src/Root.tsx. */
export type PromoProps = SoundtrackProps & {
  /** Muestra las zonas seguras de las redes y la frase de locución (solo para editar). */
  showGuides: boolean;
};

const seq = (s: { from: number; to: number }) => ({ from: s.from, durationInFrames: s.to - s.from });

export const NoutLifePromo: React.FC<PromoProps> = ({ showGuides, ...sound }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, fontFamily: FONT.sans }}>
      <Backdrop frame={frame} />
      <Particles frame={frame} warp={hookWarp(frame)} />

      <Sequence name="1 · Gancho" {...seq(SEQUENCES.hook)}>
        <HookScene />
      </Sequence>
      <Sequence name="2 · Marca" {...seq(SEQUENCES.brand)}>
        <BrandRevealScene />
      </Sequence>
      {/* Las tarjetas vuelan hacia el teléfono: la escena 3 va por encima de la 4 en el solape */}
      <Sequence name="3 · Zonas" {...seq(SEQUENCES.zones)} style={{ zIndex: 2 }}>
        <ZonesScene />
      </Sequence>
      <Sequence name="4 · Llamada a la acción" {...seq(SEQUENCES.cta)} style={{ zIndex: 1 }}>
        <CtaScene />
      </Sequence>

      <Vignette />
      <Grain frame={frame} />
      {showGuides && <Guides frame={frame} />}
      <Soundtrack {...sound} />
    </AbsoluteFill>
  );
};
