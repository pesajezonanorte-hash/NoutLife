// Coliseo y Recreación como tarjetas de cristal líquido. Blender las mueve en 3D (salen de
// su baldosa, crecen y flotan delante del teléfono; en el primer plano se apartan a los
// lados y antes de la oferta salen del cuadro; ver blender/studio.py → CARDS) y exporta sus
// esquinas en cada fotograma; aquí se dibujan en ese cuadrilátero con una homografía, así
// que hacen paralaje con el teléfono cuando la cámara se mueve.
//
// Cristal claro sobre el papel, con el texto en #111111. Primero dicen «ZONA PRO» con el
// candado champán; al volver del primer plano, una luz jade las recorre, su ícono se
// enciende en jade (#10b981) y pasan a «DESBLOQUEADA». No se funden con la oferta: salen
// del cuadro moviéndose y la oferta entra después, sin capas a medio fundir.
import type React from 'react';
import { CheckCircle2, Clapperboard, Lock, Swords, type LucideIcon } from 'lucide-react';
import { clamp, ramp } from '../../Video/lib/anim';
import { FONT, rgba } from '../../Video/theme';
import { AD } from '../palette';
import { EASE } from '../motion';
import { DEVICE } from '../timeline';
import { cardQuad, quadToMatrix3d, type CardId } from '../space';
import { LiquidGlass } from './LiquidGlass';

/** Tamaño base de cada tarjeta (10 px por mm del tamaño que tiene en Blender). */
const CARDS: Record<CardId, { w: number; h: number; label: string; icon: LucideIcon; at: number }> = {
  coliseo: { w: 520, h: 195, label: 'Coliseo', icon: Swords, at: DEVICE.cards.coliseo },
  recreacion: { w: 560, h: 195, label: 'Recreación', icon: Clapperboard, at: DEVICE.cards.recreacion },
};
const RADIUS = 62;

/** El mismo muelle con que Blender saca la tarjeta de su baldosa (studio.py → card_corners). */
const liftSpring = (frame: number, at: number) => {
  if (frame <= at) return 0;
  const w = 6.64 / 44;
  const t = frame - at;
  return 1 - (1 + w * t) * Math.exp(-w * t);
};

/** Momento en que las tarjetas pasan a «DESBLOQUEADA» (al volver del primer plano). */
const SWITCH = DEVICE.cardsUnlock;

const Content: React.FC<{ card: CardId; open: number; sweep: number; swap: { out: number; in: number } }> = ({ card, open, sweep, swap }) => {
  const { w, h, label, icon: Icon } = CARDS[card];
  const chip = 118;
  // El rótulo cambia como en una keynote: el viejo sube y se va, luego el nuevo sube a su sitio
  const status = (text: string, color: string, StatusIcon: LucideIcon, opacity: number, dy: number) => (
    <div style={{ position: 'absolute', left: 0, top: 0, display: 'flex', alignItems: 'center', gap: 10, opacity, transform: `translateY(${dy}px)` }}>
      <StatusIcon size={26} color={color} strokeWidth={2.4} />
      <span style={{ fontFamily: FONT.sans, fontWeight: 700, fontSize: 23, letterSpacing: '0.16em', color, whiteSpace: 'nowrap' }}>{text}</span>
    </div>
  );
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, borderRadius: RADIUS, overflow: 'hidden' }}>
      {/* Luz jade que recorre la tarjeta al desbloquearse */}
      {sweep > 0 && sweep < 1 && (
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(105deg, transparent ${sweep * 160 - 60}%, ${rgba(AD.jade, 0.22)} ${sweep * 160 - 30}%, transparent ${sweep * 160}%)` }} />
      )}
      <div
        style={{
          position: 'absolute',
          left: 36,
          top: (h - chip) / 2,
          width: chip,
          height: chip,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // Grafito suave en el cristal; al abrirse, jade encendido
          background: `radial-gradient(circle at 50% 38%, ${rgba(AD.jadeBright, open)} 0%, ${rgba(AD.jade, open)} 70%), ${rgba(AD.inkOnPaper, 0.06 * (1 - open))}`,
          boxShadow: `inset 0 0 0 1.5px ${open > 0.5 ? rgba('#ffffff', 0.45) : rgba(AD.inkOnPaper, 0.1)}`,
        }}
      >
        <Icon size={56} color={open > 0.5 ? '#ffffff' : '#3b3833'} strokeWidth={1.75} />
      </div>
      <div style={{ position: 'absolute', left: 36 + chip + 32, top: 44, fontFamily: FONT.sans, fontWeight: 600, fontSize: 58, lineHeight: '64px', letterSpacing: '-0.01em', color: AD.inkOnPaper, whiteSpace: 'nowrap' }}>
        {label}
      </div>
      <div style={{ position: 'absolute', left: 36 + chip + 34, top: 122 }}>
        {swap.out < 1 && status('ZONA PRO', AD.goldOnPaper[0], Lock, 1 - swap.out, -12 * swap.out)}
        {swap.in > 0 && status('DESBLOQUEADA', AD.jadeOnPaper, CheckCircle2, swap.in, 12 * (1 - swap.in))}
      </div>
    </div>
  );
};

export const ZoneCards: React.FC<{ frame: number }> = ({ frame }) => {
  // Al terminar `cardsOut` ya están fuera del cuadro
  if (frame > DEVICE.cardsOut[1]) return null;
  const open = ramp(frame, SWITCH, SWITCH + 10, EASE.inOut);
  const sweep = ramp(frame, SWITCH - 2, SWITCH + 16, EASE.inOut);
  const swap = { out: ramp(frame, SWITCH, SWITCH + 6, EASE.exit), in: ramp(frame, SWITCH + 5, SWITCH + 14, EASE.text) };
  return (
    <>
      {(Object.keys(CARDS) as CardId[]).map((card) => {
        const q = cardQuad(card, frame);
        if (!q) return null;
        const { w, h, at } = CARDS[card];
        const k = liftSpring(frame, at);
        if (k <= 0.001) return null;
        const transform = quadToMatrix3d(w, h, q);
        const glass = ramp(k, 0.04, 0.4, EASE.inOut);
        const content = ramp(k, 0.55, 0.95, EASE.inOut);
        // El brillo resbala con la cámara (la esquina sup. izq. se mueve con ella)
        const sheen = clamp((q[0][0] / 1080) * 0.8 + 0.1);
        return (
          <div key={card}>
            <LiquidGlass width={w} height={h} radius={RADIUS} transform={transform} opacity={glass} sheen={sheen} jade={open} />
            {content > 0.001 && (
              <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, transformOrigin: '0 0', transform, opacity: content }}>
                <Content card={card} open={open} sweep={sweep} swap={swap} />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};
