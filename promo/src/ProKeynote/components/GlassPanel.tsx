// Cristal líquido (Liquid Glass): relleno del fondo al 70 % (rgba(15, 23, 42, 0.7) en la
// paleta del brief), desenfoque de lo que hay detrás (backdrop-filter: blur(16px)), un
// borde de 1 px con un brillo sutil arriba a la izquierda y una sombra suave debajo.
// - `presence` (0–1) lo materializa: el relleno, el borde y el desenfoque crecen juntos.
// - `edge` tiñe el borde (jade cuando la zona se abre).
// - La opacidad va en cada capa y nunca en un contenedor: un antepasado con opacidad o
//   filtro corta lo que backdrop-filter puede ver y el cristal saldría vacío.
// - La sombra es un degradado: un box-shadow grande en algo que se escala deja costuras.
import type React from 'react';
import { rgba } from '../../Video/theme';
import { usePalette } from '../palette';

export const GLASS_BLUR = 16;

export const GlassPanel: React.FC<{
  width: number;
  height: number;
  radius: number;
  presence?: number;
  /** Sombra de contacto bajo el cristal (se ve a través de él: solo en piezas pequeñas). */
  shadow?: boolean;
  edge?: { color: string; amount: number };
  /** Luz dentro del cristal (recortada a su forma), p. ej. el haz. */
  light?: React.ReactNode;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ width, height, radius, presence = 1, shadow = true, edge, light, style, children }) => {
  const palette = usePalette();
  if (presence <= 0.001) return null;
  const lit = edge?.amount ?? 0;
  const tint = (alpha: number) => (lit > 0 && edge ? rgba(edge.color, alpha * lit) : 'transparent');
  return (
    <div style={{ position: 'absolute', width, height, ...style }}>
      {/* Sombra de contacto, sobre todo por debajo del cristal */}
      {shadow && (
        <div
          style={{
            position: 'absolute',
            left: -width * 0.06,
            right: -width * 0.06,
            top: height * 0.55,
            bottom: -height * 0.45,
            borderRadius: '50%',
            background: `radial-gradient(closest-side, ${rgba('#020617', 0.42)} 0%, ${rgba('#020617', 0.16)} 55%, transparent 100%)`,
            opacity: presence,
          }}
        />
      )}
      {/* El cristal */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: radius,
          overflow: 'hidden',
          background: palette.glass,
          backdropFilter: `blur(${GLASS_BLUR * presence}px) saturate(${1 + 0.4 * presence})`,
          WebkitBackdropFilter: `blur(${GLASS_BLUR * presence}px) saturate(${1 + 0.4 * presence})`,
          boxShadow: `inset 0 1px 0 ${rgba('#ffffff', 0.07)}`,
          opacity: presence,
        }}
      >
        {/* Luz que cae sobre el cristal, más arriba que abajo */}
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${rgba('#ffffff', 0.045)} 0%, transparent 46%)` }} />
        {lit > 0 && <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(90% 120% at 18% 0%, ${tint(0.16)} 0%, transparent 70%)` }} />}
        {light}
      </div>
      {/* Borde de 1 px: un anillo recortado con máscara */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: radius,
          padding: 1,
          background: `linear-gradient(145deg, ${rgba('#ffffff', 0.34)} 0%, ${rgba('#ffffff', 0.1)} 30%, ${rgba('#ffffff', 0.04)} 60%, ${rgba('#ffffff', 0.14)} 100%)`,
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          opacity: presence,
        }}
      />
      {lit > 0 && edge && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: radius,
            padding: 1,
            background: `linear-gradient(145deg, ${rgba(edge.color, 0.95)} 0%, ${rgba(edge.color, 0.35)} 45%, ${rgba(edge.color, 0.6)} 100%)`,
            WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            opacity: presence * lit,
          }}
        />
      )}
      <div style={{ position: 'absolute', inset: 0, opacity: presence }}>{children}</div>
    </div>
  );
};
