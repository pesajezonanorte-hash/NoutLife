// Fondo del anuncio: slate oscuro con una luz cenital muy suave, más dos luces que
// siguen la acción: jade detrás del teléfono (y un golpe con cada zona que se abre) y
// oro champán cuando aparece lo que es Pro («modo Pro», los anillos, la oferta).
import type React from 'react';
import { AbsoluteFill } from 'remotion';
import { rgba } from '../../Video/theme';
import { EASE, clamp, flash, lerp, ramp } from '../../Video/lib/anim';
import { AD } from '../brand';
import { phonePose } from '../pose';
import { END, HOOK, OFFER, UNLOCK } from '../timeline';

/** Centro de «modo Pro?» en el gancho. */
const HOOK_FOCUS = { x: 540, y: 980 };

function lights(frame: number) {
  const unlocks = Object.values(UNLOCK.zones).reduce((sum, at) => sum + flash(frame, at, 3, 14), 0);
  const jade =
    clamp(ramp(frame, UNLOCK.phoneIn - 4, UNLOCK.phoneIn + 24, EASE.out) * (1 - 0.35 * ramp(frame, OFFER.rise, OFFER.rise + 30))) +
    0.55 * unlocks +
    0.5 * flash(frame, UNLOCK.streak, 4, 18);
  const gold =
    0.75 * ramp(frame, HOOK.flicker, HOOK.flicker + 10, EASE.out) * (1 - ramp(frame, HOOK.zoomOut.from + 6, HOOK.zoomOut.to)) +
    0.6 * ramp(frame, UNLOCK.rings.in, UNLOCK.rings.in + 30) * (1 - ramp(frame, UNLOCK.rings.out, UNLOCK.rings.out + 20)) +
    1.4 * ramp(frame, OFFER.card, OFFER.card + 30);
  // Bajo la tarjeta, una luz jade a la izquierda: el cristal tiene color que desenfocar
  const offer = ramp(frame, OFFER.card - 10, OFFER.card + 30, EASE.out);
  return { jade, gold, offer };
}

export const Backdrop: React.FC<{ frame: number }> = ({ frame }) => {
  const { jade, gold, offer } = lights(frame);
  const pose = phonePose(frame);
  // La luz jade va detrás del teléfono; la dorada, en el gancho y luego bajo la oferta
  const phone = { x: (pose.x / 1080) * 100, y: (clamp(pose.y, 0, 1920) / 1920) * 100 };
  const goldAt = frame < UNLOCK.phoneIn ? HOOK_FOCUS : { x: 540, y: lerp(1030, 1180, ramp(frame, OFFER.rise, OFFER.card + 20)) };
  const goldPos = { x: (goldAt.x / 1080) * 100, y: (goldAt.y / 1920) * 100 };
  const fadeOut = 1 - ramp(frame, END.fade.from, END.fade.to);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, #121b30 0%, ${AD.slate} 42%, #0b1222 100%)` }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 80% 38% at 50% 0%, ${rgba('#94a3b8', 0.09)} 0%, transparent 70%)` }} />
      <AbsoluteFill
        style={{ background: `radial-gradient(ellipse 58% 34% at ${phone.x}% ${phone.y}%, ${rgba(AD.jade, 0.2 * jade * fadeOut)} 0%, transparent 72%)` }}
      />
      <AbsoluteFill
        style={{ background: `radial-gradient(ellipse 62% 30% at ${goldPos.x}% ${goldPos.y}%, ${rgba(AD.gold, 0.16 * gold * fadeOut)} 0%, transparent 70%)` }}
      />
      <AbsoluteFill
        style={{ background: `radial-gradient(ellipse 46% 24% at 22% 72%, ${rgba(AD.jade, 0.22 * offer * fadeOut)} 0%, transparent 72%)` }}
      />
    </AbsoluteFill>
  );
};
