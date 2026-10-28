// Anuncio «Pro Studio»: 15 s en 9:16 para Reels, TikTok y Shorts, con el lenguaje de los
// anuncios de producto de Apple, entero sobre papel crema (#FAF6F0) liso como un estudio
// claro: tipografía negra que se revela letra a letra y un teléfono fotorrealista (Blender,
// blender/studio.py) que flota sobre el papel con su sombra, con la app en modo oscuro; luz
// que resbala por el titanio y el cristal y una sola cámara que lo rodea y se acerca a las
// zonas, sin cortes.
//
// Capas, de atrás adelante: el papel (el fondo, sin nada encima que lo cambie), la sombra
// del teléfono, la oferta (detrás del teléfono: al subir, el teléfono la destapa; delante,
// su cristal dejaba ver el teléfono borroso detrás del titular), el teléfono de Blender (con
// su resplandor), las tarjetas de cristal líquido (en el espacio 3D de Blender), el gancho,
// el logo del cierre y la banda sonora (una sola pista con música y efectos).
import type React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import '../Video/fonts';
import { Guides } from '../Video/components/Guides';
import { Soundtrack, type SoundCues, type SoundtrackProps } from '../Video/audio/Soundtrack';
import { AD } from './palette';
import { DURATION, SEQUENCES } from './timeline';
import { ContactShadow } from './components/ContactShadow';
import { Plate } from './components/Plate';
import { ZoneCards } from './components/ZoneCards';
import { OfferCard } from './components/OfferCard';
import { Hook } from './scenes/Hook';
import { End } from './scenes/End';

/** Los valores por defecto están en src/Root.tsx. */
export type ProStudioProps = SoundtrackProps & {
  /** Zonas seguras de las redes (solo para editar). */
  showGuides: boolean;
};

/** La música trae los efectos mezclados (scripts/build-music-studio.mjs): aquí no hay efectos sueltos ni locución. */
const CUES: SoundCues = { duration: DURATION, sfx: [], vo: [] };
const seq = (s: { from: number; to: number }) => ({ from: s.from, durationInFrames: s.to - s.from });

/** Da a cada escena el fotograma global (las escenas usan los números de timeline.json). */
const At: React.FC<{ from: number; render: (frame: number) => React.ReactNode }> = ({ from, render }) => <>{render(useCurrentFrame() + from)}</>;

export const ProStudioAd: React.FC<ProStudioProps> = ({ showGuides, ...sound }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: AD.paper }}>
      <Sequence name="2 · Sombra del teléfono" {...seq(SEQUENCES.device)}>
        <At from={SEQUENCES.device.from} render={(f) => <ContactShadow frame={f} />} />
      </Sequence>
      <Sequence name="3 · Oferta" {...seq(SEQUENCES.offer)}>
        <At from={SEQUENCES.offer.from} render={(f) => <OfferCard frame={f} />} />
      </Sequence>
      <Sequence name="2 · Teléfono (Blender)" {...seq(SEQUENCES.device)}>
        <At from={SEQUENCES.device.from} render={(f) => <Plate frame={f} />} />
      </Sequence>
      <Sequence name="2 · Tarjetas de cristal" {...seq(SEQUENCES.device)}>
        <At from={SEQUENCES.device.from} render={(f) => <ZoneCards frame={f} />} />
      </Sequence>
      <Sequence name="1 · Gancho" {...seq(SEQUENCES.hook)}>
        <At from={SEQUENCES.hook.from} render={(f) => <Hook frame={f} />} />
      </Sequence>
      <Sequence name="Cierre · logo" {...seq(SEQUENCES.end)}>
        <At from={SEQUENCES.end.from} render={(f) => <End frame={f} />} />
      </Sequence>
      {showGuides && <Guides frame={frame} cues={[]} />}
      <Soundtrack {...sound} cues={CUES} />
    </AbsoluteFill>
  );
};
