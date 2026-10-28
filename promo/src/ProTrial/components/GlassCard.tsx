// Tarjeta de cristal esmerilado (glassmorphism): desenfoca lo que tiene detrás (el pie
// del teléfono, las gemas, la luz), con un velo claro, un borde fino de oro champán que
// brilla más arriba a la izquierda y un reflejo que la cruza al aparecer.
// - La sombra es un degradado aparte: un box-shadow grande en algo que se mueve deja
//   costuras en el render.
// - `opacity` se aplica a cada capa y nunca a un contenedor: un antepasado con opacidad
//   o filtro corta lo que backdrop-filter puede ver y el cristal saldría vacío.
import type React from 'react';
import { rgba } from '../../Video/theme';
import { AD } from '../brand';

export const GlassCard: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  radius?: number;
  opacity?: number;
  /** 0→1: el reflejo que cruza el cristal (null = sin reflejo). */
  sheen?: number | null;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ x, y, w, h, radius = 56, opacity = 1, sheen = null, style, children }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, ...style }}>
    {/* Sombra de contacto y ambiente */}
    <div
      style={{
        position: 'absolute',
        left: -w * 0.12,
        right: -w * 0.12,
        top: h * 0.18,
        bottom: -h * 0.22,
        borderRadius: '50%',
        background: `radial-gradient(closest-side, ${rgba('#020617', 0.62)} 0%, ${rgba('#020617', 0.3)} 55%, transparent 100%)`,
        opacity,
      }}
    />
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: radius,
        overflow: 'hidden',
        backdropFilter: 'blur(26px) saturate(150%)',
        WebkitBackdropFilter: 'blur(26px) saturate(150%)',
        background: `linear-gradient(160deg, ${rgba('#ffffff', 0.13)} 0%, ${rgba('#ffffff', 0.05)} 42%, ${rgba(AD.slateLift, 0.35)} 100%)`,
        boxShadow: `inset 0 1.5px 0 ${rgba('#ffffff', 0.22)}, inset 0 -1px 0 ${rgba('#000000', 0.25)}`,
        opacity,
      }}
    >
      {/* Brillo cálido en la esquina, como si la luz dorada pasara por el cristal */}
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(70% 50% at 12% 0%, ${rgba(AD.gold, 0.12)} 0%, transparent 70%)` }} />
      {sheen !== null && sheen > 0 && sheen < 1 && (
        <div
          style={{
            position: 'absolute',
            top: -h * 0.2,
            bottom: -h * 0.2,
            left: `${-40 + sheen * 160}%`,
            width: '26%',
            transform: 'skewX(-20deg)',
            background: 'linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.13), transparent)',
          }}
        />
      )}
    </div>
    {/* Borde dorado: un anillo de 1,5 px recortado con máscara */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: radius,
        padding: 1.5,
        background: `linear-gradient(150deg, ${rgba(AD.goldLight, 0.95)} 0%, ${rgba(AD.gold, 0.55)} 22%, ${rgba(AD.gold, 0.12)} 50%, ${rgba(AD.gold, 0.4)} 82%, ${rgba(AD.goldLight, 0.7)} 100%)`,
        WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
        opacity,
      }}
    />
    <div style={{ position: 'absolute', inset: 0 }}>{children}</div>
  </div>
);
