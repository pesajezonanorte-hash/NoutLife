// Anuncio «Modo Pro»: 15 s en 9:16 para Reels, TikTok y Shorts, con la sobriedad de una
// keynote. Fondo mate y plano, sin grano ni partículas; todo llega sin rebote.
// Capas, de atrás adelante: el fondo, el gancho, el teléfono con sus tarjetas de cristal
// (escenas 2 y 3), la oferta, el cierre a negro con el logo y la banda sonora.
import type React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import '../Video/fonts';
import { FONT } from '../Video/theme';
import { Guides } from '../Video/components/Guides';
import { Soundtrack, type SoundCues, type SoundtrackProps } from '../Video/audio/Soundtrack';
import { PALETTES, PaletteProvider, type PaletteName } from './palette';
import { HookScene } from './scenes/HookScene';
import { DeviceScene } from './scenes/DeviceScene';
import { OfferScene } from './scenes/OfferScene';
import { EndScene } from './scenes/EndScene';
import { DURATION, SEQUENCES, SFX_CUES, VO_CUES } from './timeline';

/** Los valores por defecto están en src/Root.tsx. */
export type ProKeynoteProps = SoundtrackProps & {
  /** «brief» (slate y jade del brief) o «aurora» (los tokens reales de la app). */
  palette: PaletteName;
  /** Zonas seguras de las redes y la frase de locución (solo para editar). */
  showGuides: boolean;
};

const CUES: SoundCues = { duration: DURATION, sfx: SFX_CUES, vo: VO_CUES };
const seq = (s: { from: number; to: number }) => ({ from: s.from, durationInFrames: s.to - s.from });

export const ProKeynoteAd: React.FC<ProKeynoteProps> = ({ palette, showGuides, ...sound }) => {
  const frame = useCurrentFrame();
  const colors = PALETTES[palette] ?? PALETTES.brief;
  return (
    <PaletteProvider value={colors}>
      <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: FONT.sans }}>
        <Sequence name="1 · Gancho" {...seq(SEQUENCES.hook)}>
          <HookScene />
        </Sequence>
        <Sequence name="2–3 · Teléfono y cristal" {...seq(SEQUENCES.device)}>
          <DeviceScene />
        </Sequence>
        <Sequence name="3 · Oferta" {...seq(SEQUENCES.offer)}>
          <OfferScene />
        </Sequence>
        <Sequence name="Cierre · logo" {...seq(SEQUENCES.end)}>
          <EndScene />
        </Sequence>
        {showGuides && <Guides frame={frame} cues={VO_CUES} />}
        <Soundtrack {...sound} cues={CUES} />
      </AbsoluteFill>
    </PaletteProvider>
  );
};
