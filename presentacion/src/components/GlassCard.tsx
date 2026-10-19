// Contenedor de vidrio: desenfoca lo que tiene detrás (los halos del fondo), borde
// de luz arriba y un tinte opcional. Entra subiendo con un muelle; `glow` 0→1
// enciende el borde para marcar la tarjeta de la que se está hablando.
// Sin box-shadow grande: en el render de Chrome deja costuras (ver promo/README).
import type React from 'react';
import type { LucideIcon } from 'lucide-react';
import { useCurrentFrame } from 'remotion';
import { COLORS, rgba } from '../theme';
import { SPRING, clamp, springAt } from '../lib';

export const GlassCard: React.FC<{
  /** Fotograma de entrada (sin él, ya está). */
  at?: number;
  tint?: string;
  glow?: number;
  radius?: number;
  padding?: number | string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ at, tint = COLORS.indigo, glow = 0, radius = 28, padding = 32, style, children }) => {
  const frame = useCurrentFrame();
  const p = at === undefined ? 1 : springAt(frame, at, SPRING.card);
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: radius,
        padding,
        background: `radial-gradient(120% 90% at 0% 0%, ${rgba(tint, 0.1 + 0.08 * glow)} 0%, transparent 60%), linear-gradient(160deg, ${rgba('#ffffff', 0.07)} 0%, ${rgba('#ffffff', 0.02)} 70%)`,
        backdropFilter: 'blur(28px) saturate(150%)',
        WebkitBackdropFilter: 'blur(28px) saturate(150%)',
        boxShadow: `inset 0 1px 0 ${rgba('#ffffff', 0.14)}, inset 0 0 0 1px ${rgba(glow > 0 ? tint : '#ffffff', 0.1 + 0.45 * glow)}, 0 0 ${40 * glow}px ${rgba(tint, 0.25 * glow)}`,
        opacity: clamp(p * 1.4),
        transform: `translateY(${(1 - p) * 56}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Ícono dentro de un cuadrado redondeado con el tinte de su color. */
export const IconChip: React.FC<{ icon: LucideIcon; color: string; size?: number }> = ({ icon: Icon, color, size = 64 }) => (
  <div
    style={{
      flex: 'none',
      width: size,
      height: size,
      borderRadius: size * 0.3,
      display: 'grid',
      placeItems: 'center',
      background: rgba(color, 0.14),
      boxShadow: `inset 0 0 0 1px ${rgba(color, 0.35)}`,
    }}
  >
    <Icon size={size * 0.5} color={color} strokeWidth={2.1} />
  </div>
);
