// Tarjeta de la app (Card de apps/web: surface, borde de 1 px, rounded-2xl) con un
// velo de vidrio: deja ver la luz de la sala detrás. Entra subiendo con un muelle.
// `glow` 0→1 enciende el borde en jade para marcar de qué se está hablando.
// Sin box-shadow grande: en el render de Chrome deja costuras (ver promo/README).
import type React from 'react';
import type { LucideIcon } from 'lucide-react';
import { useCurrentFrame } from 'remotion';
import { COLORS, rgba } from '../theme';
import { SPRING, clamp, springAt } from '../lib';

export const GlassCard: React.FC<{
  /** Fotograma de entrada (sin él, ya está). */
  at?: number;
  glow?: number;
  radius?: number;
  padding?: number | string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ at, glow = 0, radius = 28, padding = 36, style, children }) => {
  const frame = useCurrentFrame();
  const p = at === undefined ? 1 : springAt(frame, at, SPRING.card);
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: radius,
        padding,
        background: rgba(COLORS.surface, 0.72),
        backdropFilter: 'blur(24px) saturate(140%)',
        WebkitBackdropFilter: 'blur(24px) saturate(140%)',
        boxShadow: `inset 0 1px 0 ${rgba('#ffffff', 0.05)}, inset 0 0 0 1px ${glow > 0 ? rgba(COLORS.jade, 0.15 + 0.4 * glow) : COLORS.border}`,
        opacity: clamp(p * 1.4),
        transform: `translateY(${(1 - p) * 48}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** IconChip de la app: ícono sobre el tinte suave de su tono (--lq-soft-alpha .16). */
export const IconChip: React.FC<{ icon: LucideIcon; color?: string; size?: number }> = ({ icon: Icon, color = COLORS.jade, size = 64 }) => (
  <div
    style={{
      flex: 'none',
      width: size,
      height: size,
      borderRadius: size * 0.29,
      display: 'grid',
      placeItems: 'center',
      background: rgba(color, 0.16),
      color,
    }}
  >
    <Icon size={size * 0.5} strokeWidth={1.75} />
  </div>
);
