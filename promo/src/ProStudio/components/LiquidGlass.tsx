// Cristal líquido claro, como el modo claro de Apple sobre el papel crema: desenfoca lo que
// hay detrás (backdrop-filter blur 24 px), blanco esmerilado espeso (el texto #111111 se lee
// aunque pase por encima de la pantalla oscura del teléfono), borde de cristal contrastado
// (filo blanco por dentro y un hilo oscuro muy fino por fuera), sombras ultrafinas y un
// brillo que resbala por la superficie (`sheen`, 0–1) como la luz al refractarse.
// `jade` (0–1) tiñe el canto inferior de las zonas desbloqueadas.
//
// Ojo: backdrop-filter no ve nada si un antepasado tiene opacity, filter, mask o
// mix-blend-mode (se vuelve la raíz del fondo). Por eso la opacidad va aquí, en el propio
// cristal, y nunca en un contenedor. Las sombras son finas a propósito: una box-shadow con
// mucho desenfoque en un elemento transformado deja una costura cuadrada en Chrome.
import type React from 'react';
import { rgba } from '../../Video/theme';
import { AD } from '../palette';

export interface LiquidGlassProps {
  width: number;
  height: number;
  radius: number;
  /** Transformación CSS (la homografía de la tarjeta o un rectángulo fijo). */
  transform?: string;
  left?: number;
  top?: number;
  opacity?: number;
  /** Posición del brillo que cruza el cristal (0 izquierda → 1 derecha). */
  sheen?: number;
  /** Tinte jade del canto (0–1): las zonas desbloqueadas. */
  jade?: number;
}

export const LiquidGlass: React.FC<LiquidGlassProps> = ({ width, height, radius, transform, left = 0, top = 0, opacity = 1, sheen = 0.3, jade = 0 }) => {
  if (opacity <= 0.001) return null;
  const s = sheen * 140 - 20;
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        borderRadius: radius,
        transformOrigin: '0 0',
        transform,
        opacity,
        backdropFilter: 'blur(24px) saturate(1.35) brightness(1.06)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.35) brightness(1.06)',
        background: [
          // Brillo de refracción: una banda diagonal suave
          `linear-gradient(118deg, transparent ${s - 22}%, ${rgba('#ffffff', 0.45)} ${s}%, transparent ${s + 22}%)`,
          // Luz jade que sube del canto de las zonas abiertas
          `linear-gradient(0deg, ${rgba(AD.jade, 0.1 * jade)} 0%, transparent 60%)`,
          // Cuerpo esmerilado: más blanco arriba, donde da la luz
          `linear-gradient(170deg, ${rgba('#ffffff', 0.8)} 0%, ${rgba('#ffffff', 0.58)} 45%, ${rgba('#ffffff', 0.66)} 100%)`,
        ].join(', '),
        boxShadow: [
          `inset 0 0 0 1px ${rgba('#ffffff', 0.95)}`,
          `inset 0 1px 0 #ffffff`,
          `inset 0 -1px 0 ${jade > 0 ? rgba(AD.jade, 0.25 + 0.4 * jade) : rgba('#ffffff', 0.7)}`,
          // Borde contrastado y sombras ultrafinas
          `0 0 0 1px ${rgba(AD.inkOnPaper, 0.1)}`,
          `0 1px 2px ${rgba(AD.inkOnPaper, 0.08)}`,
          `0 10px 22px -8px ${rgba('#46301a', 0.16)}`,
        ].join(', '),
      }}
    />
  );
};
