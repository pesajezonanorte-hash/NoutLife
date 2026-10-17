// Banda sonora: la música (sintetizada por scripts/build-music.mjs), un efecto CC0
// en cada momento del guion y los huecos de la locución. Los huecos se ven como
// barras con nombre en la línea de tiempo del Studio; si se pasa `voiceoverSrc`,
// la música baja sola mientras suena cada frase.
import type React from 'react';
import { Html5Audio, Sequence, interpolate, staticFile } from 'remotion';
import { DURATION, SFX_CUES, VO_CUES } from '../timeline';

const resolve = (src: string) => (/^https?:\/\//.test(src) ? src : staticFile(src));
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 1 normalmente; 0,4 durante cada frase de la locución (rampas cortas). */
function voiceoverDuck(frame: number) {
  return Math.min(1, ...VO_CUES.map((c) => interpolate(frame, [c.from - 6, c.from, c.to, c.to + 8], [1, 0.4, 0.4, 1], CLAMP)));
}

/** Los últimos 14 fotogramas bajan todo a cero (las colas no se cortan en seco). */
const tailFade = (frame: number) => interpolate(frame, [DURATION - 14, DURATION], [1, 0], CLAMP);

// `type` y no `interface`: Remotion exige props asignables a Record<string, unknown>.
export type SoundtrackProps = {
  musicSrc: string | null;
  voiceoverSrc: string | null;
  musicVolume: number;
  sfxVolume: number;
};

export const Soundtrack: React.FC<SoundtrackProps> = ({ musicSrc, voiceoverSrc, musicVolume, sfxVolume }) => (
  <>
    {musicSrc ? (
      <Html5Audio
        name="Música"
        src={resolve(musicSrc)}
        volume={(f) => musicVolume * (voiceoverSrc ? voiceoverDuck(f) : 1) * tailFade(f)}
      />
    ) : null}

    {SFX_CUES.map((cue, i) => (
      <Sequence key={i} from={cue.frame} name={`SFX · ${cue.label}`} layout="none">
        <Html5Audio src={staticFile(`audio/sfx/${cue.file}`)} volume={(f) => cue.volume * sfxVolume * tailFade(cue.frame + f)} />
      </Sequence>
    ))}

    {/* Huecos de locución: marcadores con el texto de cada frase */}
    {VO_CUES.map((cue) => (
      <Sequence key={cue.id} from={cue.from} durationInFrames={cue.to - cue.from} name={`Locución · «${cue.text}»`} layout="none">
        {null}
      </Sequence>
    ))}
    {voiceoverSrc ? <Html5Audio name="Locución" src={resolve(voiceoverSrc)} /> : null}
  </>
);
