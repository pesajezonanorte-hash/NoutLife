// Piezas comunes de las pantallas del teléfono, con el lenguaje de la app en modo
// oscuro (px de pantalla: 562 × 1190; 1 pt de iPhone ≈ 1,43 px). La app de verdad
// es jade; en el vídeo cada zona lleva su acento de color.
import type React from 'react';
import {
  BatteryFull,
  CheckCircle2,
  ChevronLeft,
  Flower2,
  Home,
  Lock,
  Signal,
  Swords,
  User,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import { COLORS, FONT, SPRING, rgba } from '../theme';
import { EASE, clamp, lerp, ramp, springAt } from '../lib/anim';
import { SCREEN } from '../layout';
import { IconChip, ProBadge } from '../components/ui';

export const SW = SCREEN.w;
export const SH = SCREEN.h;
export const TABBAR_H = 128;

/** Fondo de pantalla de la app, con un velo del color de la zona arriba. */
export const ScreenBg: React.FC<{ accent?: string; children?: React.ReactNode }> = ({ accent, children }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background: accent
        ? `radial-gradient(120% 42% at 30% 0%, ${rgba(accent, 0.2)} 0%, transparent 70%), linear-gradient(180deg, #08100c 0%, ${COLORS.bg} 40%, #050a08 100%)`
        : `linear-gradient(180deg, #08100c 0%, ${COLORS.bg} 40%, #050a08 100%)`,
      fontFamily: FONT.sans,
      color: COLORS.text,
    }}
  >
    {children}
  </div>
);

export const StatusBar: React.FC = () => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: 26, height: 40, display: 'flex', alignItems: 'center', padding: '0 46px 0 62px' }}>
    <span style={{ fontFamily: FONT.sans, fontWeight: 700, fontSize: 25, letterSpacing: '-0.01em', color: COLORS.text }}>9:41</span>
    <span style={{ marginLeft: 'auto', display: 'flex', gap: 9, alignItems: 'center' }}>
      <Signal size={23} color={COLORS.text} strokeWidth={2.6} />
      <Wifi size={23} color={COLORS.text} strokeWidth={2.6} />
      <BatteryFull size={30} color={COLORS.text} strokeWidth={2} />
    </span>
  </div>
);

/** Cabecera de una zona: volver, ícono con tinte, título y la insignia PRO si toca. */
export const ZoneBar: React.FC<{ icon: LucideIcon; accent: string; title: string; kicker?: string; pro?: boolean; size?: number }> = ({
  icon,
  accent,
  title,
  kicker,
  pro,
  size = 40,
}) => (
  <div style={{ position: 'absolute', left: 18, right: 24, top: 92, height: 76, display: 'flex', alignItems: 'center', gap: 12 }}>
    <ChevronLeft size={36} color={COLORS.textMuted} strokeWidth={2.2} />
    <IconChip icon={icon} color={accent} size={58} />
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {kicker && <span style={{ fontFamily: FONT.mono, fontWeight: 600, fontSize: 15, letterSpacing: '0.2em', color: rgba(accent, 0.9) }}>{kicker}</span>}
      <span style={{ fontWeight: 800, fontSize: size, lineHeight: 1.05, letterSpacing: '-0.025em', whiteSpace: 'nowrap' }}>{title}</span>
    </div>
    {pro && (
      <div style={{ marginLeft: 'auto' }}>
        <ProBadge scale={0.85} />
      </div>
    )}
  </div>
);

const TABS: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: 'home', label: 'Inicio', icon: Home },
  { id: 'coliseo', label: 'Coliseo', icon: Swords },
  { id: 'habitos', label: 'Hábitos', icon: CheckCircle2 },
  { id: 'ciclo', label: 'Ciclo', icon: Flower2 },
  { id: 'perfil', label: 'Perfil', icon: User },
];

/**
 * La barra inferior de la app: Inicio, tres zonas elegidas y Perfil. `locks` pone el
 * candado de NoutLife Lite a las zonas Pro (0–1: así se puede desvanecer al desbloquear).
 */
export const TabBar: React.FC<{ active: string; accent?: string; locks?: Partial<Record<string, number>> }> = ({
  active,
  accent = COLORS.jade,
  locks = {},
}) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: TABBAR_H,
      paddingTop: 10,
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      alignItems: 'start',
      background: rgba('#0a130f', 0.92),
      borderTop: `1.5px solid ${COLORS.border}`,
    }}
  >
    {TABS.map(({ id, label, icon: Icon }) => {
      const on = id === active;
      const lock = locks[id] ?? 0;
      return (
        <div key={id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div
            style={{
              position: 'relative',
              width: 76,
              height: 44,
              borderRadius: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: on ? rgba(accent, 0.18) : 'transparent',
            }}
          >
            <Icon size={30} color={on ? accent : COLORS.textMuted} strokeWidth={1.9} />
            {lock > 0.001 && (
              <div
                style={{
                  position: 'absolute',
                  right: 12,
                  top: -2,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: COLORS.bg,
                  boxShadow: `inset 0 0 0 1.5px ${rgba(COLORS.gold, 0.6)}`,
                  opacity: lock,
                  transform: `scale(${0.6 + 0.4 * lock})`,
                }}
              >
                <Lock size={13} color={COLORS.gold} strokeWidth={2.6} />
              </div>
            )}
          </div>
          <span style={{ fontSize: 16, fontWeight: on ? 700 : 500, color: on ? accent : COLORS.textMuted }}>{label}</span>
        </div>
      );
    })}
    <div style={{ position: 'absolute', left: (SW - 186) / 2, bottom: 12, width: 186, height: 7, borderRadius: 4, background: rgba(COLORS.text, 0.85) }} />
  </div>
);

/** Rótulo pequeño en mayúsculas (como los de la app). */
export const Kicker: React.FC<{ children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({ children, color, style }) => (
  <div style={{ fontFamily: FONT.mono, fontSize: 16, fontWeight: 600, letterSpacing: '0.18em', color: color ?? COLORS.textMuted, ...style }}>{children}</div>
);

/** Tarjeta de superficie de la app (radio grande, borde fino). Opaca: al levantarse no deja ver la pantalla. */
export const surface = (accent?: string, strength = 1): React.CSSProperties => ({
  borderRadius: 30,
  background: `${accent ? `linear-gradient(165deg, ${rgba(accent, 0.12 * strength)} 0%, transparent 55%), ` : ''}linear-gradient(165deg, #131f19, #0c1511)`,
  boxShadow: `inset 0 0 0 1.5px ${accent ? rgba(accent, 0.28 * strength) : COLORS.border}`,
});

/** Aparición suave de un bloque de la pantalla. */
export const fadeUp = (frame: number, at: number, rise = 22): React.CSSProperties => {
  const p = springAt(frame, at, SPRING.smooth, 14);
  return { opacity: p, transform: `translateY(${(1 - p) * rise}px)` };
};

/** Un toque: el círculo aparece, presiona y deja una onda. */
export const Tap: React.FC<{ frame: number; at: number; x: number; y: number }> = ({ frame, at, x, y }) => {
  const show = ramp(frame, at - 12, at - 5, EASE.out) * (1 - ramp(frame, at + 6, at + 14));
  const press = ramp(frame, at - 3, at, EASE.out);
  const release = springAt(frame, at + 1, SPRING.pop);
  const ripple = ramp(frame, at, at + 18, EASE.out);
  if (show <= 0 && (ripple <= 0 || ripple >= 1)) return null;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: x - 34,
          top: y - 34,
          width: 68,
          height: 68,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.26)',
          boxShadow: 'inset 0 0 0 2.5px rgba(255, 255, 255, 0.8)',
          transform: `scale(${1.15 - 0.15 * show - 0.18 * press + 0.18 * release})`,
          opacity: show,
        }}
      />
      {ripple > 0 && ripple < 1 && (
        <div
          style={{
            position: 'absolute',
            left: x - 130,
            top: y - 130,
            width: 260,
            height: 260,
            borderRadius: '50%',
            boxShadow: `inset 0 0 0 ${lerp(5, 1.2, ripple)}px rgba(255, 255, 255, ${0.55 * (1 - ripple)})`,
            transform: `scale(${lerp(0.2, 1, ripple)})`,
          }}
        />
      )}
    </>
  );
};

/**
 * Una tarjeta que puede levantarse de la pantalla. En reposo (`lift` 0) se dibuja
 * dentro de la pantalla; levantada, la dibuja el teléfono por encima (translateZ),
 * movida `shift` y escalada `grow`, y en la pantalla queda su hueco con sombra.
 */
export interface PopCard {
  key: string;
  rect: { x: number; y: number; w: number; h: number };
  /** 0 = en la pantalla, 1 = arriba (los muelles pueden pasarse un poco). */
  lift: number;
  /** Altura sobre la pantalla con `lift` = 1 (px). */
  z: number;
  shift?: { x: number; y: number };
  grow?: number;
  /** Solo existe en el aire (un «+10 XP»): no tiene sitio ni sombra en la pantalla. */
  float?: boolean;
  node: React.ReactNode;
}

export const isLifted = (card: PopCard) => card.lift > 0.002;

/** Subida con rebote y bajada suave: 0 → ~1 desde `up`, → 0 desde `down`. */
export const liftCurve = (frame: number, up: number, down: number) =>
  springAt(frame, up, SPRING.card) * (1 - springAt(frame, down, SPRING.smooth, 14));

/** Las tarjetas en reposo, y el hueco y la sombra de las levantadas, dentro de la pantalla. */
export const CardSlots: React.FC<{ cards: PopCard[] }> = ({ cards }) => (
  <>
    {cards.map((card) => {
      const { x, y, w, h } = card.rect;
      if (card.float) return null;
      if (!isLifted(card)) {
        return (
          <div key={card.key} style={{ position: 'absolute', left: x, top: y, width: w, height: h }}>
            {card.node}
          </div>
        );
      }
      const l = clamp(card.lift);
      return (
        <div key={card.key}>
          <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 30, boxShadow: `inset 0 0 0 1.5px ${rgba(COLORS.text, 0.08 * l)}` }} />
          <div
            style={{
              position: 'absolute',
              left: x + 18 + (card.shift?.x ?? 0) * 0.3 * l,
              top: y + 30 + (card.shift?.y ?? 0) * 0.3 * l,
              width: w - 36,
              height: h - 30,
              borderRadius: 40,
              background: `rgba(0, 0, 0, ${0.55 * l})`,
              filter: `blur(${12 + 22 * l}px)`,
            }}
          />
        </div>
      );
    })}
  </>
);

/**
 * Las tarjetas levantadas, para la capa 3D del teléfono. `dx` es el desplazamiento de su
 * pantalla; `opacity`, para que se desvanezcan cuando otra pantalla tapa la suya.
 */
export const CardPops: React.FC<{ cards: PopCard[]; dx?: number; opacity?: number }> = ({ cards, dx = 0, opacity = 1 }) => (
  <>
    {cards.filter(isLifted).map((card) => {
      const { x, y, w, h } = card.rect;
      const l = card.lift;
      const grow = 1 + (card.grow ?? 0) * l;
      return (
        <div
          key={card.key}
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: w,
            height: h,
            transform: `translate3d(${dx + (card.shift?.x ?? 0) * l}px, ${(card.shift?.y ?? 0) * l}px, ${card.z * l + 1}px) scale(${grow})`,
            opacity,
          }}
        >
          {card.node}
        </div>
      );
    })}
  </>
);
