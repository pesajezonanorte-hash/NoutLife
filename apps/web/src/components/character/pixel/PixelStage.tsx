// Escenario del estudio: el personaje grande bajo un foco, con sombra en el suelo.
// Cada cambio se anima píxel a píxel: lo que se pone cae en su sitio, lo que se
// quita se desmorona y lo que cambia de color destella, en una onda que sale de
// la zona modificada. La cámara se acerca a la cabeza o al cuerpo según la
// sección y, al guardar, el personaje salta con una explosión de píxeles.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls, useReducedMotionConfig } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { H, W, renderGrid, type PixelGrid, type PixelLook } from './engine';

export type StageFocus = 'full' | 'head' | 'body';

const FOCUS: Record<StageFocus, { scale: number; y: string }> = {
  full: { scale: 1, y: '0%' },
  head: { scale: 1.45, y: '22%' },
  body: { scale: 1.2, y: '-10%' },
};

interface Fx { gen: number; cells: Record<string, { k: 'in' | 're'; d: number }>; ghosts: { x: number; y: number; c: string; d: number }[] }

function useBlink(active: boolean) {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (!active) return;
    let t: number;
    const loop = () => { t = window.setTimeout(() => { setBlink(true); t = window.setTimeout(() => { setBlink(false); loop(); }, 140); }, 2400 + Math.random() * 2800); };
    loop();
    return () => window.clearTimeout(t);
  }, [active]);
  return blink;
}

export interface PixelStageProps {
  look: PixelLook;
  focus?: StageFocus;
  /** Cambia (se incrementa) para lanzar la celebración de guardado. */
  celebrate?: number;
  /** Texto del sello de la celebración. */
  doneLabel?: string;
  className?: string;
}

export function PixelStage({ look, focus = 'full', celebrate = 0, doneLabel = 'Guardado', className }: PixelStageProps) {
  const reduce = useReducedMotionConfig() ?? false;
  const blink = useBlink(!reduce);
  const base = useMemo(() => renderGrid(look), [look]);
  const shown = useMemo<PixelGrid>(() => (blink ? renderGrid(look, { blink: true }) : base), [blink, look, base]);

  // Diferencias con el aspecto anterior → animaciones por celda.
  const prevRef = useRef<PixelGrid | null>(null);
  const [fx, setFx] = useState<Fx>({ gen: 0, cells: {}, ghosts: [] });
  useLayoutEffect(() => {
    const prev = prevRef.current;
    prevRef.current = base;
    if (!prev || reduce) return;
    const changed: { x: number; y: number; a: string | null; b: string | null }[] = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (prev[y][x] !== base[y][x]) changed.push({ x, y, a: prev[y][x], b: base[y][x] });
    if (!changed.length) return;
    const cx = changed.reduce((s, c) => s + c.x, 0) / changed.length;
    const cy = changed.reduce((s, c) => s + c.y, 0) / changed.length;
    const cells: Fx['cells'] = {};
    const ghosts: Fx['ghosts'] = [];
    for (const c of changed) {
      const d = Math.round(Math.min(340, Math.hypot(c.x - cx, c.y - cy) * 24) + Math.random() * 50);
      if (c.b && !c.a) cells[`${c.x}-${c.y}`] = { k: 'in', d };
      else if (c.b) cells[`${c.x}-${c.y}`] = { k: 're', d };
      else if (c.a) ghosts.push({ x: c.x, y: c.y, c: c.a, d: Math.round(d * 0.6) });
    }
    setFx((f) => ({ gen: f.gen + 1, cells, ghosts }));
  }, [base, reduce]);
  // Al terminar, los píxeles animados vuelven a la imagen quieta.
  useEffect(() => {
    if (!fx.ghosts.length && !Object.keys(fx.cells).length) return;
    const gen = fx.gen;
    const t = window.setTimeout(() => setFx((f) => (f.gen === gen ? { ...f, cells: {}, ghosts: [] } : f)), 950);
    return () => window.clearTimeout(t);
  }, [fx]);

  // Celebración al guardar: salto + estallido de píxeles + sello «Guardado».
  const jump = useAnimationControls();
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (!celebrate) return;
    setBurst(celebrate);
    void jump.start({ y: ['0%', '-14%', '0%', '-6%', '0%'], transition: { duration: 0.75, ease: 'easeOut' } });
    const t = window.setTimeout(() => setBurst(0), 1400);
    return () => window.clearTimeout(t);
  }, [celebrate, jump]);
  const particles = useMemo(() => {
    const palette = [look.hairColor, look.topColor, look.extraColor, look.eyeColor, '#f2c14e'];
    return Array.from({ length: 18 }, (_, i) => {
      const a = (i / 18) * Math.PI * 2 + Math.random() * 0.3;
      const r = 90 + Math.random() * 70;
      return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.8 - 30, c: palette[i % palette.length], s: 6 + Math.round(Math.random() * 6), d: Math.random() * 0.12 };
    });
  }, [burst]); // eslint-disable-line react-hooks/exhaustive-deps

  // Imagen de la capa quieta (todo menos las celdas que se están animando).
  const still = useMemo(() => {
    if (typeof document === 'undefined') return '';
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    if (!ctx) return '';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = shown[y][x];
      if (!c || fx.cells[`${x}-${y}`]) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
    return cv.toDataURL();
  }, [shown, fx.cells]);

  const unit = 1 / H;
  return (
    <div className={cn('relative isolate flex items-center justify-center overflow-hidden', className)}>
      {/* Foco y rejilla de puntos (tokens). */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_38%,rgb(var(--lq-primary)/0.18),transparent_62%)]" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(rgb(var(--lq-on-surface)/0.08)_1px,transparent_1px)] bg-[length:14px_14px] [mask-image:radial-gradient(ellipse_at_50%_45%,black,transparent_70%)]" />
      {/* Polvo flotando. */}
      {!reduce && [0, 1, 2, 3, 4].map((i) => (
        <motion.span
          key={i}
          aria-hidden
          className="absolute size-1.5 bg-primary/40"
          style={{ left: `${18 + i * 16}%`, bottom: '18%' }}
          animate={{ y: [0, -160 - i * 20], opacity: [0, 0.9, 0] }}
          transition={{ duration: 5 + i, repeat: Infinity, delay: i * 1.1, ease: 'easeOut' }}
        />
      ))}

      <motion.div
        className="relative h-[86%] max-h-full"
        style={{ aspectRatio: `${W} / ${H}` }}
        animate={FOCUS[focus]}
        transition={{ type: 'spring', stiffness: 140, damping: 22, mass: 0.9 }}
      >
        {/* Sombra en el suelo (oscura, detrás del personaje), respira con él. */}
        <motion.span
          aria-hidden
          className="absolute bottom-[-1%] left-1/2 h-[5%] w-[62%] rounded-[50%] bg-[radial-gradient(closest-side,rgb(0_0_0/0.55),rgb(0_0_0/0.25)_60%,transparent)]"
          style={{ x: '-50%' }}
          animate={reduce ? undefined : { scaleX: [1, 1, 0.9, 0.9, 1], opacity: [0.9, 0.9, 0.6, 0.6, 0.9] }}
          transition={{ duration: 2.4, times: [0, 0.45, 0.5, 0.95, 1], repeat: Infinity, ease: 'linear' }}
        />
        <motion.div animate={jump} className="relative size-full">
          <motion.svg
            viewBox={`0 0 ${W} ${H}`}
            shapeRendering="crispEdges"
            className="block size-full overflow-visible"
            aria-hidden
            animate={reduce ? undefined : { y: ['0%', '0%', `-${unit * 100}%`, `-${unit * 100}%`, '0%'] }}
            transition={{ duration: 2.4, times: [0, 0.45, 0.5, 0.95, 1], repeat: Infinity, ease: 'linear' }}
          >
            {/* Capa quieta: una imagen de 32×36 escalada sin suavizado (sin costuras con zoom). */}
            {still && <image href={still} x={0} y={0} width={W} height={H} style={{ imageRendering: 'pixelated' }} preserveAspectRatio="none" />}
            {/* Píxeles que cambian, uno a uno. */}
            {Object.entries(fx.cells).map(([k, f]) => {
              const [x, y] = k.split('-').map(Number);
              const c = shown[y]?.[x];
              return c ? <rect key={`${k}-${fx.gen}`} x={x} y={y} width={1} height={1} fill={c} className={f.k === 'in' ? 'lq-px-in' : 'lq-px-re'} style={{ animationDelay: `${f.d}ms` }} /> : null;
            })}
            {fx.ghosts.map((g) => (
              <rect key={`g-${g.x}-${g.y}-${fx.gen}`} x={g.x} y={g.y} width={1} height={1} fill={g.c} className="lq-px-out" style={{ animationDelay: `${g.d}ms` }} />
            ))}
          </motion.svg>
        </motion.div>

        <AnimatePresence>
          {burst > 0 && (
            <motion.div key={burst} aria-hidden className="pointer-events-none absolute left-1/2 top-[45%]" exit={{ opacity: 0 }}>
              <motion.span
                className="absolute -left-20 -top-20 size-40 rounded-full border-4 border-primary"
                initial={{ scale: 0.2, opacity: 0.8 }} animate={{ scale: 1.6, opacity: 0 }} transition={{ duration: 0.7, ease: 'easeOut' }}
              />
              {particles.map((p, i) => (
                <motion.span
                  key={i}
                  className="absolute"
                  // Colores del propio personaje (datos), no de la interfaz.
                  style={{ width: p.s, height: p.s, backgroundColor: p.c, marginLeft: -p.s / 2, marginTop: -p.s / 2 }}
                  initial={{ x: 0, y: 0, scale: 0, rotate: 0, opacity: 1 }}
                  animate={{ x: p.x, y: [0, p.y, p.y + 60], scale: [0, 1.2, 0.6], rotate: 180, opacity: [1, 1, 0] }}
                  transition={{ duration: 1.1, delay: p.d, ease: [0.22, 1, 0.36, 1] }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {burst > 0 && (
          <motion.span
            key={`ok-${burst}`}
            className="absolute left-1/2 top-5 flex items-center gap-2 rounded-full bg-success-text px-4 py-2 text-label-lg text-background shadow-lg"
            style={{ x: '-50%' }}
            initial={{ opacity: 0, y: -16, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22, delay: 0.15 }}
          >
            <Check aria-hidden className="size-4" strokeWidth={2.5} />{doneLabel}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
