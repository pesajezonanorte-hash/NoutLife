// Revelado elástico desde el centro: la línea se abre de dentro hacia fuera (recorte),
// el interletrado se cierra de muy abierto a su sitio con un rebote (el muelle se pasa
// y vuelve) y el desenfoque se va a la vez. Lo usan el gancho, el titular de las zonas
// y el de la oferta.
import type React from 'react';
import { EASE, clamp, lerp, ramp, springAt } from '../../Video/lib/anim';
import { AD_SPRING } from '../brand';

export const Reveal: React.FC<{
  frame: number;
  at: number;
  /** Interletrado final (em). */
  tracking?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ frame, at, tracking = -0.015, style, children }) => {
  const p = springAt(frame, at, AD_SPRING.elastic);
  // El recorte se abre sin rebote; el rebote lo llevan la escala y el interletrado
  const open = ramp(frame, at, at + 11, EASE.out);
  const spacing = lerp(0.34, tracking, p);
  const side = lerp(50, -8, open);
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          whiteSpace: 'nowrap',
          letterSpacing: `${spacing}em`,
          // El interletrado también se suma tras la última letra: así la línea sigue centrada
          paddingLeft: `${spacing}em`,
          clipPath: open < 1 ? `inset(-40% ${side}% -40% ${side}%)` : undefined,
          transform: `scale(${lerp(0.86, 1, p)})`,
          filter: open < 0.98 ? `blur(${(1 - open) * 12}px)` : undefined,
          opacity: clamp(p * 2.5),
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
};
