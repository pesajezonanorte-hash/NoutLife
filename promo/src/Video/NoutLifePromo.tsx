// Composición principal: NoutLife en 24 s, vertical 9:16, para Reels, TikTok y Shorts.
// Capas, de atrás adelante: fondo con la luz de cada momento y polvo de luz (todo el
// vídeo), las cuatro escenas (cada una en su Sequence, con unos fotogramas de
// solape para los relevos), viñeta y grano, y la banda sonora.
import type React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import './fonts';
import { FONT } from './theme';
import { SEQUENCES } from './timeline';
import { Backdrop, Grain, Particles, Vignette } from './components/Atmosphere';
import { Guides } from './components/Guides';
import { HookScene } from './Scenes/HookScene';
import { BrandScene } from './Scenes/BrandScene';
import { DeviceScene } from './Scenes/DeviceScene';
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
    <AbsoluteFill style={{ backgroundColor: '#040706', fontFamily: FONT.sans }}>
      <Backdrop frame={frame} />
      <Particles frame={frame} />

      <Sequence name="1 · Gancho" {...seq(SEQUENCES.hook)}>
        <HookScene />
      </Sequence>
      <Sequence name="2 · Marca" {...seq(SEQUENCES.brand)}>
        <BrandScene />
      </Sequence>
      {/* El teléfono aparece encima del logo con su pantalla de arranque (el mismo logo) */}
      <Sequence name="3 · Teléfono y zonas" {...seq(SEQUENCES.device)}>
        <DeviceScene />
      </Sequence>
      <Sequence name="4 · Llamada a la acción" {...seq(SEQUENCES.cta)}>
        <CtaScene />
      </Sequence>

      <Vignette />
      <Grain frame={frame} />
      {showGuides && <Guides frame={frame} />}
      <Soundtrack {...sound} />
    </AbsoluteFill>
  );
};
