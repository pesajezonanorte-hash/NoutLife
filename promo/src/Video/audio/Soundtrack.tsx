// Banda sonora: la música (sintetizada por scripts/build-music.mjs), un efecto CC0
// en cada momento del guion y los huecos de la locución. Los huecos se ven como
// barras con nombre en la línea de tiempo del Studio; si se pasa `voiceoverSrc`,
// la música baja sola mientras suena cada frase. Por defecto usa el guion del
// promo de 24 s; otra composición pasa el suyo en `cues`.
import type React from 'react';
import { Html5Audio, Sequence, interpolate, staticFile } from 'remotion';
import { DURATION, SFX_CUES, VO_CUES } from '../timeline';

const resolve = (src: string) => (/^https?:\/\//.test(src) ? src : staticFile(src));
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export interface SoundCues {
  duration: number;
  sfx: ReadonlyArray<{ frame: number; file: string; volume: number; label: string }>;
  vo: ReadonlyArray<{ id: string; from: number; to: number; text: string }>;
}
const PROMO_CUES: SoundCues = { duration: DURATION, sfx: SFX_CUES, vo: VO_CUES };

/** 1 normalmente; 0,4 durante cada frase de la locución (rampas cortas). */
function voiceoverDuck(frame: number, vo: SoundCues['vo']) {
  return Math.min(1, ...vo.map((c) => interpolate(frame, [c.from - 6, c.from, c.to, c.to + 8], [1, 0.4, 0.4, 1], CLAMP)));
}

/** Los últimos 14 fotogramas bajan todo a cero (las colas no se cortan en seco). */
const tailFade = (frame: number, duration: number) => interpolate(frame, [duration - 14, duration], [1, 0], CLAMP);

// `type` y no `interface`: Remotion exige props asignables a Record<string, unknown>.
export type SoundtrackProps = {
  musicSrc: string | null;
  voiceoverSrc: string | null;
  musicVolume: number;
  sfxVolume: number;
};

export const Soundtrack: React.FC<SoundtrackProps & { cues?: SoundCues }> = ({
  musicSrc,
  voiceoverSrc,
  musicVolume,
  sfxVolume,
  cues = PROMO_CUES,
}) => (
  <>
    {musicSrc ? (
      <Html5Audio
        name="Música"
        src={resolve(musicSrc)}
        volume={(f) => musicVolume * (voiceoverSrc ? voiceoverDuck(f, cues.vo) : 1) * tailFade(f, cues.duration)}
      />
    ) : null}

    {cues.sfx.map((cue, i) => (
      <Sequence key={i} from={cue.frame} name={`SFX · ${cue.label}`} layout="none">
        <Html5Audio src={staticFile(`audio/sfx/${cue.file}`)} volume={(f) => cue.volume * sfxVolume * tailFade(cue.frame + f, cues.duration)} />
      </Sequence>
    ))}

    {/* Huecos de locución: marcadores con el texto de cada frase */}
    {cues.vo.map((cue) => (
      <Sequence key={cue.id} from={cue.from} durationInFrames={cue.to - cue.from} name={`Locución · «${cue.text}»`} layout="none">
        {null}
      </Sequence>
    ))}
    {voiceoverSrc ? <Html5Audio name="Locución" src={resolve(voiceoverSrc)} /> : null}
  </>
);
