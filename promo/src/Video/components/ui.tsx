// Piezas de interfaz del vídeo, con el lenguaje de la app en modo oscuro:
// tarjetas de radio grande, chips de ícono con tinte, insignia PRO champán.
import type React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Gem } from 'lucide-react';
import { COLORS, FONT, SPRING, rgba } from '../theme';
import { springAt } from '../lib/anim';

/**
 * Tarjeta de cristal oscuro con borde de neón sutil y una luz que recorre el
 * borde (conic-gradient enmascarado al anillo del borde).
 */
export const GlowCard: React.FC<{
  frame: number;
  accent: string;
  width: number;
  height: number;
  radius?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ frame, accent, width, height, radius = 52, children, style }) => {
  const angle = (frame * 4.5) % 360;
  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        borderRadius: radius,
        background: `linear-gradient(165deg, ${rgba('#16251d', 0.97)} 0%, ${rgba('#0c1611', 0.98)} 55%, ${rgba('#09120d', 0.99)} 100%)`,
        boxShadow: [
          `0 0 0 1.5px ${rgba(accent, 0.3)}`,
          `0 0 34px ${rgba(accent, 0.2)}`,
          `0 0 110px ${rgba(accent, 0.1)}`,
          '0 60px 120px rgba(0, 0, 0, 0.55)',
        ].join(', '),
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Luz cenital teñida del acento */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(110% 55% at 18% 0%, ${rgba(accent, 0.16)}, transparent 62%)`,
        }}
      />
      {/* Brillo que recorre el borde */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: radius,
          padding: 2.5,
          background: `conic-gradient(from ${angle}deg, transparent 0deg, ${rgba(accent, 0)} 24deg, ${rgba(accent, 0.9)} 54deg, rgba(255, 255, 255, 0.85) 60deg, ${rgba(accent, 0)} 92deg, transparent 360deg)`,
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />
      {children}
    </div>
  );
};

export const IconChip: React.FC<{ icon: LucideIcon; color: string; size?: number; iconSize?: number; radius?: number }> = ({
  icon: Icon,
  color,
  size = 92,
  iconSize,
  radius,
}) => (
  <div
    style={{
      width: size,
      height: size,
      flexShrink: 0,
      borderRadius: radius ?? size * 0.3,
      background: rgba(color, 0.15),
      boxShadow: `inset 0 0 0 1.5px ${rgba(color, 0.35)}, 0 0 28px ${rgba(color, 0.18)}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <Icon size={iconSize ?? size * 0.5} color={color} strokeWidth={2} />
  </div>
);

/** «PRO»: las zonas que en NoutLife Lite se ven con candado. */
export const ProBadge: React.FC<{ scale?: number }> = ({ scale = 1 }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8 * scale,
      padding: `${8 * scale}px ${16 * scale}px`,
      borderRadius: 999,
      background: rgba(COLORS.gold, 0.12),
      boxShadow: `inset 0 0 0 1.5px ${rgba(COLORS.gold, 0.5)}`,
      color: COLORS.gold,
      fontFamily: FONT.mono,
      fontWeight: 700,
      fontSize: 20 * scale,
      letterSpacing: '0.18em',
    }}
  >
    <Gem size={18 * scale} strokeWidth={2.2} />
    PRO
  </div>
);

/** Cabecera común de las tarjetas de zona. */
export const ZoneHeader: React.FC<{
  icon: LucideIcon;
  accent: string;
  kicker: string;
  title: string;
  subtitle: string;
  pro?: boolean;
  titleSize?: number;
}> = ({ icon, accent, kicker, title, subtitle, pro, titleSize = 62 }) => (
  <div style={{ padding: '52px 54px 0' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
      <IconChip icon={icon} color={accent} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <div style={{ fontFamily: FONT.mono, fontSize: 20, fontWeight: 600, letterSpacing: '0.2em', color: rgba(accent, 0.9) }}>{kicker}</div>
        <div
          style={{
            fontFamily: FONT.sans,
            fontWeight: 800,
            fontSize: titleSize,
            lineHeight: 1,
            letterSpacing: '-0.025em',
            color: COLORS.text,
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </div>
      </div>
      {pro && (
        <div style={{ marginLeft: 'auto', alignSelf: 'flex-start', marginTop: 4 }}>
          <ProBadge />
        </div>
      )}
    </div>
    <div style={{ marginTop: 22, fontFamily: FONT.sans, fontWeight: 500, fontSize: 30, color: COLORS.textMuted }}>{subtitle}</div>
  </div>
);

export interface RevealWord {
  text: string;
  /** Fotograma (global) en que entra la palabra. */
  at: number;
  style?: React.CSSProperties;
}

/**
 * Texto que aparece palabra a palabra: cada palabra sube, se enfoca y se posa
 * con un muelle sin rebote.
 */
export const WordReveal: React.FC<{
  frame: number;
  lines: RevealWord[][];
  style?: React.CSSProperties;
  rise?: number;
  blur?: number;
  duration?: number;
}> = ({ frame, lines, style, rise = 46, blur = 10, duration = 16 }) => (
  <div style={style}>
    {lines.map((line, li) => (
      <div key={li} style={{ whiteSpace: 'nowrap' }}>
        {line.map((w, wi) => {
          const p = springAt(frame, w.at, SPRING.smooth, duration);
          return (
            <span
              key={wi}
              style={{
                display: 'inline-block',
                marginRight: wi < line.length - 1 ? '0.26em' : 0,
                transform: `translateY(${(1 - p) * rise}px) scale(${0.96 + 0.04 * p})`,
                opacity: p,
                filter: p < 0.99 ? `blur(${(1 - p) * blur}px)` : undefined,
                ...w.style,
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    ))}
  </div>
);
