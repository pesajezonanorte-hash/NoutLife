// El teléfono que renderiza Blender (public/studio/phone/0080.png …): un PNG con fondo
// transparente por fotograma. Encima, el mismo fotograma desenfocado y en modo «screen»:
// el resplandor (bloom) de la pantalla y de los brillos del titanio, como en una lente.
import type React from 'react';
import { Img, staticFile } from 'remotion';
import { lerp, ramp } from '../../Video/lib/anim';
import { EASE } from '../motion';
import { DEVICE } from '../timeline';

const FULL: React.CSSProperties = { position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 };

export const plateSrc = (frame: number) => staticFile(`studio/phone/${String(frame).padStart(4, '0')}.png`);

export const Plate: React.FC<{ frame: number }> = ({ frame }) => {
  const [from, to] = DEVICE.render;
  if (frame < from || frame > to) return null;
  const src = plateSrc(frame);
  // Aparece en 6 fotogramas, aún lejos y pequeño, mientras el gancho se apaga: cuando se
  // acerca ya es un objeto sólido (un fundido largo lo dejaba gris, como un fantasma)
  const enter = ramp(frame, DEVICE.emerge[0], DEVICE.emerge[0] + 6, EASE.inOut);
  // Más resplandor cuando la pantalla se ilumina en jade
  const jade = ramp(frame, DEVICE.jadeRim[0], DEVICE.jadeRim[0] + 20, EASE.inOut);
  const bloom = lerp(0.2, 0.34, jade);
  return (
    <>
      <Img src={src} style={{ ...FULL, opacity: enter }} />
      <Img src={src} style={{ ...FULL, filter: 'blur(30px) saturate(1.35)', mixBlendMode: 'screen', opacity: bloom * enter }} />
    </>
  );
};
