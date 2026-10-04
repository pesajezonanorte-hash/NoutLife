// Personaje pixel en SVG (bordes nítidos a cualquier tamaño). Respira con un
// paso de 1 px y parpadea de vez en cuando; ambos se apagan con el ajuste
// «Reducir movimiento» de la app.
import { memo, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotionConfig } from 'framer-motion';
import { H, W, render, type PixelLook } from './engine';

export type PixelAnimation = 'idle' | 'celebrate' | 'hurt' | 'none';

/** Recortes para miniaturas: cabeza o ropa. */
export const CROPS = {
  full: `0 0 ${W} ${H}`,
  head: '3 0 26 24',
  body: '4 17 24 19',
} as const;

const Sprite = memo(function Sprite({ look, blink, viewBox }: { look: PixelLook; blink: boolean; viewBox: string }) {
  const runs = useMemo(() => render(look, { blink }), [look, blink]);
  return (
    <svg viewBox={viewBox} shapeRendering="crispEdges" className="block size-full" aria-hidden>
      {runs.map((r) => <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.c} />)}
    </svg>
  );
});

export interface PixelAvatarProps {
  look: PixelLook;
  /** Ancho en px (el alto mantiene la proporción del recorte). */
  size?: number;
  animate?: PixelAnimation;
  crop?: keyof typeof CROPS;
  /** Ánimo 1–5: cambia la boca y las cejas (≤2 triste, ≥4 contento). */
  mood?: number;
  className?: string;
}

export function PixelAvatar({ look, size = 96, animate = 'idle', crop = 'full', mood, className }: PixelAvatarProps) {
  const reduce = useReducedMotionConfig() ?? false;
  const [blink, setBlink] = useState(false);
  const live = animate !== 'none' && !reduce;

  useEffect(() => {
    if (!live) return;
    let t: number;
    const loop = () => {
      t = window.setTimeout(() => { setBlink(true); t = window.setTimeout(() => { setBlink(false); loop(); }, 140); }, 2600 + Math.random() * 3000);
    };
    loop();
    return () => window.clearTimeout(t);
  }, [live]);

  const shown = useMemo<PixelLook>(() => {
    if (mood === undefined) return look;
    if (mood <= 2) return { ...look, mouth: 'seria', brows: 'preocupadas' };
    if (mood >= 4) return { ...look, mouth: look.mouth === 'sonrisota' ? 'sonrisota' : 'sonrisa' };
    return look;
  }, [look, mood]);

  const [, , vw, vh] = CROPS[crop].split(' ').map(Number);
  const unit = size / vw;
  const motionProps =
    !live ? {} :
    animate === 'celebrate' ? { animate: { y: [0, -6 * unit, 0, -3 * unit, 0] }, transition: { duration: 0.7, repeat: 2, ease: 'easeOut' as const } } :
    animate === 'hurt' ? { animate: { x: [-3 * unit, 3 * unit, -2 * unit, 2 * unit, 0] }, transition: { duration: 0.45 } } :
    { animate: { y: [0, 0, -unit, -unit, 0] }, transition: { duration: 2.4, times: [0, 0.45, 0.5, 0.95, 1], repeat: Infinity, ease: 'linear' as const } };

  return (
    <motion.span className={className} style={{ display: 'block', width: size, height: size * (vh / vw) }} {...motionProps}>
      <Sprite look={shown} blink={blink && crop !== 'body'} viewBox={CROPS[crop]} />
    </motion.span>
  );
}
