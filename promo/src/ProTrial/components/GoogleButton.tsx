// El botón final: píldora jade con la «G» de Google sobre un círculo blanco (el logo
// siempre va sobre blanco) y «Empieza ahora con 1 clic». En NoutLife se entra solo con
// Google y la cuenta nueva nace con los 7 días de Pro, así que ese clic es la prueba.
import type React from 'react';
import { FONT, rgba } from '../../Video/theme';
import { AD } from '../brand';

/** La «G» de cuatro colores de Google (botón oficial de acceso). */
export const GoogleG: React.FC<{ size: number }> = ({ size }) => (
  <svg viewBox="0 0 48 48" width={size} height={size}>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

export const GoogleButton: React.FC<{
  w: number;
  h: number;
  /** 0→1: el brillo que cruza el botón (null = sin brillo). */
  shimmer: number | null;
  /** 0→1: el anillo que late hacia fuera en cada pulso. */
  beat: number;
  /** Luz extra del toque (0–1). */
  glow: number;
}> = ({ w, h, shimmer, beat, glow }) => (
  <div style={{ position: 'relative', width: w, height: h }}>
    {/* Halo jade, como degradado (el botón se escala) */}
    <div
      style={{
        position: 'absolute',
        left: -w * 0.1,
        right: -w * 0.1,
        top: -h * 0.4,
        bottom: -h * 0.7,
        borderRadius: '50%',
        background: `radial-gradient(closest-side, ${rgba(AD.jade, 0.32 + 0.3 * glow)} 0%, ${rgba(AD.jade, 0.08)} 60%, transparent 100%)`,
      }}
    />
    {/* El pulso: un anillo que sale y se apaga */}
    <div
      style={{
        position: 'absolute',
        inset: -22 * beat,
        borderRadius: 999,
        boxShadow: `inset 0 0 0 ${2.5 * (1 - beat)}px ${rgba(AD.jadeLight, 0.55 * (1 - beat))}`,
      }}
    />
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 999,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        background: `linear-gradient(180deg, #34d399 0%, ${AD.jade} 55%, #0e9f6e 100%)`,
        boxShadow: `inset 0 2px 0 ${rgba('#ffffff', 0.45)}, inset 0 -3px 0 ${rgba('#000000', 0.14)}`,
      }}
    >
      {shimmer !== null && shimmer > 0 && shimmer < 1 && (
        <div
          style={{
            position: 'absolute',
            top: -20,
            bottom: -20,
            left: `${-30 + shimmer * 150}%`,
            width: '22%',
            transform: 'skewX(-20deg)',
            background: 'linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.55), transparent)',
          }}
        />
      )}
      <div
        style={{
          position: 'relative',
          marginLeft: (h - 80) / 2,
          width: 80,
          height: 80,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
          boxShadow: `0 2px 6px ${rgba('#022c1d', 0.25)}`,
        }}
      >
        <GoogleG size={42} />
      </div>
      <div
        style={{
          position: 'relative',
          flex: 1,
          paddingRight: (h - 80) / 2 + 40,
          textAlign: 'center',
          fontFamily: FONT.sans,
          fontWeight: 700,
          fontSize: 38,
          letterSpacing: '-0.01em',
          color: AD.jadeInk,
          whiteSpace: 'nowrap',
        }}
      >
        Empieza ahora con 1 clic
      </div>
    </div>
  </div>
);
