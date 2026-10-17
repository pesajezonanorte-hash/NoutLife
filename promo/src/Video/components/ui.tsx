// Piezas de interfaz del vídeo, con el lenguaje de la app en modo oscuro:
// chips de ícono con tinte e insignia PRO champán.
import type React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Gem } from 'lucide-react';
import { COLORS, FONT, rgba } from '../theme';

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
      background: rgba(color, 0.16),
      boxShadow: `inset 0 0 0 1.5px ${rgba(color, 0.4)}`,
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
