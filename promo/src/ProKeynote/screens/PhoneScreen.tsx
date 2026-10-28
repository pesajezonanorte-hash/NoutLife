// Lo que muestra la pantalla del teléfono en cada fotograma: Inicio en Lite; el menú sube
// como en la app; el haz jade lo recorre y cada candado se abre a su paso; al cerrarse
// el menú, la cabecera ya dice «Pro · Regalo 1/7».
import type React from 'react';
import { ramp, springAt } from '../../Video/lib/anim';
import { usePalette } from '../palette';
import { EASE, KEY_SPRING } from '../motion';
import { OFFER, REVEAL } from '../timeline';
import { beamGlow, unlockAt } from '../beam';
import { POSE_REVEAL, screenToWorld } from '../device';
import { BeamLight } from '../components/BeamLight';
import { HomeScreen, SystemChrome } from './HomeScreen';
import { MenuSheet, lockCenter, tileCenter } from './MenuSheet';
import { SH, SW } from './ui';

/** La hoja: sube con el muelle de la app y baja en 0,25 s acelerando, como su salida. */
export const sheetOpen = (frame: number) =>
  springAt(frame, REVEAL.sheetUp, KEY_SPRING.sheet) * (1 - ramp(frame, OFFER.sheetDown, OFFER.sheetDown + 8, EASE.exit));

const world = (p: { x: number; y: number }) => screenToWorld(POSE_REVEAL, p.x, p.y);

export const PhoneScreen: React.FC<{ frame: number }> = ({ frame }) => {
  const palette = usePalette();
  const trial = springAt(frame, OFFER.sheetDown + 6, KEY_SPRING.ui);
  return (
    <div style={{ position: 'absolute', inset: 0, width: SW, height: SH, overflow: 'hidden' }}>
      <HomeScreen frame={frame} trial={trial} />
      <MenuSheet
        open={sheetOpen(frame)}
        unlock={(id) => unlockAt(frame, world(lockCenter(id)))}
        glow={(id) => beamGlow(frame, world(tileCenter(id)))}
      />
      <BeamLight frame={frame} origin={screenToWorld(POSE_REVEAL, 0, 0)} scale={POSE_REVEAL.s} width={SW} height={SH} color={palette.jade} peak={0.34} />
      <SystemChrome />
    </div>
  );
};
