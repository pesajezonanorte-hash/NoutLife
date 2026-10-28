// La sombra de estudio del teléfono sobre el papel: el teléfono flota y, debajo de su canto
// inferior, el suelo invisible del estudio recibe una sombra suave en tres capas (un núcleo
// cálido y fino, una penumbra y una oclusión ancha muy tenue), hecha con degradados radiales.
// EEVEE no tiene «shadow catcher», así que sale de aquí, con la posición del teléfono que
// exporta Blender (track.json).
// Mientras el teléfono emerge, la sombra crece con él (el suelo va a su misma distancia) y
// acompaña su rebote al frenar. Cuando se eleva, el suelo se queda donde estaba: al
// separarse, la sombra se abre y se desvanece.
import type React from 'react';
import { clamp, lerp, ramp } from '../../Video/lib/anim';
import { rgba } from '../../Video/theme';
import { EASE } from '../motion';
import { DEVICE } from '../timeline';
import { phoneAt } from '../space';

/** Distancia del canto inferior del teléfono al suelo, en medios altos del teléfono. */
const HOVER = 0.15;
const INK = '#46301a';

export const ContactShadow: React.FC<{ frame: number }> = ({ frame }) => {
  const [from, to] = DEVICE.render;
  if (frame < from || frame > to) return null;
  const phone = phoneAt(frame);
  // El suelo acompaña al teléfono hasta que empieza a elevarse; después queda fijo
  const rest = phoneAt(Math.min(frame, DEVICE.rise[0]));
  const floor = rest.y + rest.h * (1 + HOVER);
  const gap = Math.max(0, floor - (phone.y + phone.h)) / rest.h;
  // Aparece con el teléfono y se apaga al elevarse (gap crece desde HOVER)
  const enter = ramp(frame, DEVICE.emerge[0] + 2, DEVICE.emerge[0] + 18, EASE.inOut);
  const lifted = clamp((gap - HOVER) / 0.9);
  const strength = enter * (1 - lifted);
  if (strength <= 0.001) return null;
  const spread = 1 + 1.4 * lifted;
  const at = `${phone.x}px ${floor}px`;
  const core = { rx: rest.h * 0.4 * spread, ry: rest.h * 0.032 * spread };
  const penumbra = { rx: rest.h * 0.62 * spread, ry: rest.h * 0.085 * spread };
  const ambient = { rx: rest.h * 0.95 * spread, ry: rest.h * 0.2 * spread };
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: strength }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(${ambient.rx}px ${ambient.ry}px at ${at}, ${rgba(INK, 0.08)} 0%, ${rgba(INK, 0.03)} 50%, transparent 100%)` }} />
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(${penumbra.rx}px ${penumbra.ry}px at ${at}, ${rgba(INK, 0.22)} 0%, ${rgba(INK, 0.08)} 55%, transparent 100%)` }} />
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(${core.rx}px ${core.ry}px at ${at}, ${rgba(INK, lerp(0.55, 0.3, lifted))} 0%, ${rgba(INK, 0.16)} 60%, transparent 100%)` }} />
    </div>
  );
};
