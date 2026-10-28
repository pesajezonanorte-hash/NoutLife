import type React from 'react';
import { Composition, Folder } from 'remotion';
import { NoutLifePromo } from './Video/NoutLifePromo';
import { DURATION, FPS, HEIGHT, WIDTH } from './Video/timeline';
import { ProTrialAd } from './ProTrial/ProTrialAd';
import * as PRO_TRIAL from './ProTrial/timeline';
import { ProKeynoteAd } from './ProKeynote/ProKeynoteAd';
import * as PRO_KEYNOTE from './ProKeynote/timeline';
import { ProStudioAd } from './ProStudio/ProStudioAd';
import { StudioScreen } from './ProStudio/screen/StudioScreen';
import * as PRO_STUDIO from './ProStudio/timeline';

export const RemotionRoot: React.FC = () => (
  <>
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
    {/* Anuncio de 15 s: «7 días de Pro, gratis» (prueba inversa) */}
    <Composition
      id="NoutLifeProTrial"
      component={ProTrialAd}
      durationInFrames={PRO_TRIAL.DURATION}
      fps={PRO_TRIAL.FPS}
      width={PRO_TRIAL.WIDTH}
      height={PRO_TRIAL.HEIGHT}
      defaultProps={{
        musicSrc: 'audio/pro-trial-music.wav',
        voiceoverSrc: null,
        musicVolume: 1,
        sfxVolume: 1,
        showGuides: false,
      }}
    />
    {/* Anuncio de 15 s «Modo Pro», estilo keynote: el mismo «7 días de Pro», desde cero */}
    <Composition
      id="NoutLifeProKeynote"
      component={ProKeynoteAd}
      durationInFrames={PRO_KEYNOTE.DURATION}
      fps={PRO_KEYNOTE.FPS}
      width={PRO_KEYNOTE.WIDTH}
      height={PRO_KEYNOTE.HEIGHT}
      defaultProps={{
        palette: 'brief' as const,
        musicSrc: 'audio/pro-keynote-music.wav',
        voiceoverSrc: null,
        musicVolume: 1,
        sfxVolume: 1,
        showGuides: false,
      }}
    />
    {/* Anuncio de 15 s «Pro Studio»: el mismo «7 días de Pro» con un teléfono fotorrealista hecho en Blender */}
    <Composition
      id="NoutLifeProStudio"
      component={ProStudioAd}
      durationInFrames={PRO_STUDIO.DURATION}
      fps={PRO_STUDIO.FPS}
      width={PRO_STUDIO.WIDTH}
      height={PRO_STUDIO.HEIGHT}
      defaultProps={{
        musicSrc: 'audio/pro-studio-music.wav',
        voiceoverSrc: null,
        musicVolume: 1,
        sfxVolume: 1,
        showGuides: false,
      }}
    />
    {/* Piezas del anuncio «Pro Studio» que no se publican: la pantalla del teléfono, que Blender usa como textura */}
    <Folder name="ProStudio-piezas">
      <Composition
        id="NoutLifeProStudioScreen"
        component={StudioScreen}
        durationInFrames={PRO_STUDIO.DURATION}
        fps={PRO_STUDIO.FPS}
        width={PRO_STUDIO.SCREEN.w}
        height={PRO_STUDIO.SCREEN.h}
      />
    </Folder>
  </>
);
