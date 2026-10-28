// Tarjeta de cristal de una zona Pro (escena 2): sale de su casilla del menú y flota
// delante del teléfono. En Lite muestra el candado champán y «ZONA PRO»; cuando el haz
// la cruza, el candado se va, entra el check jade, el rótulo pasa a «DESBLOQUEADA» y el
// borde se enciende. Medidas en px del mundo (camera.ts).
import type React from 'react';
import { Check, Lock, type LucideIcon } from 'lucide-react';
import { interpolateColors } from 'remotion';
import { rgba } from '../../Video/theme';
import { clamp, ramp, springAt } from '../../Video/lib/anim';
import { usePalette } from '../palette';
import { EASE, KEY_SPRING } from '../motion';
import { beamCrossing, beamGlow } from '../beam';
import { OutlineText, type Line } from '../type/OutlineText';
import { COPY } from '../copy';
import { BeamLight } from './BeamLight';
import { GlassPanel } from './GlassPanel';

export const CALLOUT = { w: 412, h: 136, radius: 34 };
const PAD = 22;
const CHIP = 72;
const BADGE = 48;
const TEXT_X = PAD + CHIP + 20;

export const ZoneCallout: React.FC<{
  frame: number;
  /** Centro en el mundo cuando ya está quieta (para el haz). */
  center: { x: number; y: number };
  icon: LucideIcon;
  title: Line;
  presence: number;
}> = ({ frame, center, icon: Icon, title, presence }) => {
  const palette = usePalette();
  const at = beamCrossing(center);
  const open = ramp(frame, at - 1, at + 8, EASE.inOut);
  // El rótulo cambia en dos tiempos: «ZONA PRO» se va y luego entra «DESBLOQUEADA»
  const leave = ramp(frame, at - 1, at + 4, EASE.exit);
  const arrive = ramp(frame, at + 2, at + 12, EASE.text);
  const check = springAt(frame, at + 1, KEY_SPRING.ui);
  const glow = beamGlow(frame, center);
  const tone = interpolateColors(open, [0, 1], [palette.gold, palette.jade]);
  const origin = { x: center.x - CALLOUT.w / 2, y: center.y - CALLOUT.h / 2 };
  const caption = (line: Line, color: string, o: number, dy: number) =>
    o > 0.001 && (
      <OutlineText line={line} size={18} tracking={0.12} x={TEXT_X} y={94 + dy} align="left" color={color} style={{ opacity: o }} />
    );
  return (
    <GlassPanel
      width={CALLOUT.w}
      height={CALLOUT.h}
      radius={CALLOUT.radius}
      presence={presence}
      edge={{ color: palette.jade, amount: clamp(0.45 * open + 0.8 * glow) }}
      light={<BeamLight frame={frame} origin={origin} scale={1} width={CALLOUT.w} height={CALLOUT.h} color={palette.jade} peak={0.3} />}
    >
      <div
        style={{
          position: 'absolute',
          left: PAD,
          top: (CALLOUT.h - CHIP) / 2,
          width: CHIP,
          height: CHIP,
          borderRadius: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: interpolateColors(open, [0, 1], [rgba(palette.inkMuted, 0.12), rgba(palette.jade, 0.16)]),
          boxShadow: `inset 0 0 0 1px ${interpolateColors(open, [0, 1], [rgba(palette.inkMuted, 0.18), rgba(palette.jade, 0.4)])}`,
        }}
      >
        <Icon size={36} color={interpolateColors(open, [0, 1], [palette.inkSoft, palette.jadeBright])} strokeWidth={1.75} />
      </div>
      <OutlineText line={title} size={34} x={TEXT_X} y={66} align="left" color={palette.ink} />
      {caption(COPY.callout.locked[0], palette.gold, 1 - leave, -6 * leave)}
      {caption(COPY.callout.unlocked[0], palette.jade, arrive, 6 * (1 - arrive))}
      <div
        style={{
          position: 'absolute',
          right: PAD,
          top: (CALLOUT.h - BADGE) / 2,
          width: BADGE,
          height: BADGE,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: rgba(tone, 0.12),
          boxShadow: `inset 0 0 0 1.5px ${rgba(tone, 0.7)}`,
        }}
      >
        {leave < 1 && (
          <div style={{ position: 'absolute', opacity: 1 - leave, transform: `scale(${1 - 0.3 * leave})` }}>
            <Lock size={22} color={palette.gold} strokeWidth={2} />
          </div>
        )}
        {check > 0.001 && (
          <div style={{ position: 'absolute', opacity: clamp(check * 1.6), transform: `scale(${0.6 + 0.4 * check})` }}>
            <Check size={26} color={palette.jadeBright} strokeWidth={2.6} />
          </div>
        )}
      </div>
    </GlassPanel>
  );
};
