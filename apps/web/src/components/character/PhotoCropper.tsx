// Recorte de la foto de perfil (como en WhatsApp/Instagram): arrastrar para
// encuadrar, pellizcar / rueda / deslizador para el zoom y girar 90°. La imagen
// siempre cubre el círculo: al soltar fuera de los bordes vuelve con un muelle
// (mientras se arrastra hay resistencia elástica). El resultado es un JPEG
// cuadrado de `size` px (512 por defecto) con exactamente lo que se ve dentro del círculo.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { animate, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springSoft } from '@/lib/motion';
import { useMotionStore } from '@/store/motionStore';
import { Button } from '@/components/ui/lq';

const OUT = 512;
const MAX_SRC = 1600;
const MIN_Z = 1;
const MAX_Z = 4;
/** Margen entre el marco cuadrado y el círculo (px). */
const PAD = 20;

export interface PhotoCropperProps {
  src: string;
  onCancel: () => void;
  onApply: (dataUrl: string) => void;
  /** Lado del JPEG resultante (px). */
  size?: number;
}

/** Carga la imagen y la reduce a MAX_SRC (lado mayor) para que arrastrar sea fluido. */
function loadSource(src: string): Promise<HTMLCanvasElement | HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => {
      const k = Math.min(1, MAX_SRC / Math.max(img.naturalWidth, img.naturalHeight));
      if (k === 1) return resolve(img);
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      const ctx = c.getContext('2d');
      if (!ctx) return resolve(img);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(c);
    };
    img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
    img.src = src;
  });
}

/** Muelle con rebote visible para el punto del zoom y los botones. */
const bounce = { type: 'spring', stiffness: 520, damping: 14, mass: 0.7 } as const;

/** Envoltorio que rebota al pulsar (botones de acción). */
function Bouncy({ children }: { children: ReactNode }) {
  return <motion.span className="block" whileTap={{ scale: 0.92 }} transition={bounce}>{children}</motion.span>;
}

/** Botón de ícono que rebota al pulsar y crece un poco al pasar el cursor. */
function BounceIcon({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.12 }}
      whileTap={disabled ? undefined : { scale: 0.8 }}
      transition={bounce}
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-on-surface transition-colors hover:bg-surface-variant hover:text-on-background disabled:opacity-40"
    >
      {children}
    </motion.button>
  );
}

/**
 * Deslizador de zoom minimalista: una línea fina, el tramo recorrido en color y
 * un punto que sigue el valor con un muelle (rebota al saltar con +/−, crece al
 * agarrarlo). Accesible como role="slider" (flechas, Inicio/Fin, RePág/AvPág).
 */
function ZoomSlider({ value, onChange, onStep }: { value: number; onChange: (z: number) => void; onStep: (delta: number) => void }) {
  const reduce = useMotionStore((s) => s.reduce);
  const trackRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [grab, setGrab] = useState(false);
  const frac = (value - MIN_Z) / (MAX_Z - MIN_Z);
  const target = useMotionValue(0);
  const x = useSpring(target, reduce ? { stiffness: 10000, damping: 1000 } : { stiffness: 420, damping: 18, mass: 0.6 });
  const fill = useTransform(x, (v) => (width ? v / width : 0));

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { target.set(frac * width); }, [frac, width, target]);

  const fromPointer = (clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r || !r.width) return;
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    onChange(MIN_Z + f * (MAX_Z - MIN_Z));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = { ArrowRight: 0.1, ArrowUp: 0.1, ArrowLeft: -0.1, ArrowDown: -0.1, PageUp: 0.5, PageDown: -0.5, Home: -MAX_Z, End: MAX_Z };
    if (!(e.key in steps)) return;
    e.preventDefault();
    onStep(steps[e.key]);
  };

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Zoom"
      aria-valuemin={MIN_Z * 100}
      aria-valuemax={MAX_Z * 100}
      aria-valuenow={Math.round(value * 100)}
      aria-valuetext={`${Math.round(value * 100)} %`}
      onKeyDown={onKey}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setGrab(true); fromPointer(e.clientX); }}
      onPointerMove={(e) => grab && fromPointer(e.clientX)}
      onPointerUp={() => setGrab(false)}
      onPointerCancel={() => setGrab(false)}
      className="group relative flex h-11 min-w-0 flex-1 cursor-pointer touch-none items-center rounded-full focus-visible:outline-offset-4"
    >
      <div ref={trackRef} className="relative h-0.5 w-full rounded-full bg-border">
        <motion.span aria-hidden className="absolute inset-0 rounded-full bg-primary" style={{ scaleX: fill, originX: 0 }} />
        <motion.span aria-hidden className="absolute top-1/2 -ml-2 -mt-2 block size-4" style={{ x }}>
          {/* Halo que aparece al agarrar */}
          <motion.span
            className="absolute inset-0 rounded-full bg-primary/20"
            animate={{ scale: grab ? 2.4 : 1, opacity: grab ? 1 : 0 }}
            transition={bounce}
          />
          <motion.span
            className="absolute inset-0 rounded-full bg-primary shadow-md ring-2 ring-background"
            animate={{ scale: grab ? 1.35 : 1 }}
            whileHover={{ scale: 1.2 }}
            transition={bounce}
          />
        </motion.span>
      </div>
    </div>
  );
}

export function PhotoCropper({ src, onCancel, onApply, size = OUT }: PhotoCropperProps) {
  const reduce = useMotionStore((s) => s.reduce);
  const frameRef = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState<{ el: HTMLCanvasElement | HTMLImageElement; url: string; w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [frame, setFrame] = useState(288);
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  const [dragging, setDragging] = useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const rotate = useMotionValue(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ x: number; y: number; px: number; py: number; dist: number; zoom: number } | null>(null);

  const circle = frame - PAD * 2;
  const quarter = ((rot / 90) % 4 + 4) % 4;
  const w = source ? (quarter % 2 ? source.h : source.w) : 1;
  const h = source ? (quarter % 2 ? source.w : source.h) : 1;
  /** px de pantalla por px de imagen con zoom 1 (la imagen cubre justo el círculo). */
  const base = circle / Math.min(w, h);
  const to = useCallback((mv: typeof x, v: number) => (reduce ? mv.set(v) : void animate(mv, v, { type: 'spring', stiffness: 300, damping: 24, mass: 0.9 })), [reduce]);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    loadSource(src)
      .then((el) => {
        if (!alive) return;
        const isCanvas = el instanceof HTMLCanvasElement;
        setSource({ el, url: isCanvas ? el.toDataURL('image/jpeg', 0.92) : src, w: isCanvas ? el.width : el.naturalWidth, h: isCanvas ? el.height : el.naturalHeight });
      })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [src]);

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setFrame(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Límite de desplazamiento para que la imagen siga cubriendo el círculo. */
  const limits = useCallback((z: number) => ({ x: Math.max(0, (w * base * z - circle) / 2), y: Math.max(0, (h * base * z - circle) / 2) }), [w, h, base, circle]);
  const clamp = (v: number, m: number) => Math.min(m, Math.max(-m, v));
  /** Resistencia elástica fuera de los límites (como el scroll de iOS). */
  const rubber = (v: number, m: number) => (Math.abs(v) <= m ? v : Math.sign(v) * (m + (Math.abs(v) - m) * 0.35));

  const settle = useCallback((z = zoom) => {
    const l = limits(z);
    to(x, clamp(x.get(), l.x));
    to(y, clamp(y.get(), l.y));
  }, [limits, to, x, y, zoom]);

  const setZoomTo = useCallback((next: number, animated = true) => {
    const z = Math.min(MAX_Z, Math.max(MIN_Z, next));
    const k = z / zoom;
    setZoom(z);
    // Zoom hacia el centro del círculo: el punto central no se mueve.
    const l = limits(z);
    const nx = clamp(x.get() * k, l.x), ny = clamp(y.get() * k, l.y);
    if (animated) { to(scale, base * z); to(x, nx); to(y, ny); }
    else { scale.set(base * z); x.set(nx); y.set(ny); }
  }, [zoom, limits, to, scale, base, x, y]);

  // Encaje inicial y al girar o redimensionar: escala de cobertura y recentrado.
  useEffect(() => {
    if (!source) return;
    to(scale, base * zoom);
    settle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, base]);

  // Al girar se intercambian ancho y alto: se recoloca dentro de los nuevos límites.
  useEffect(() => { to(rotate, rot); settle(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rot]);

  // Rueda del ratón: zoom (listener no pasivo para evitar el scroll del diálogo).
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); setZoomTo(zoom * Math.exp(-e.deltaY * 0.0015), false); };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setZoomTo, zoom]);

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    x.stop(); y.stop();
    const pts = [...pointers.current.values()];
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    gesture.current = { x: x.get(), y: y.get(), px: cx, py: cy, dist, zoom };
    setDragging(true);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const g = gesture.current;
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    let z = zoom;
    if (pts.length > 1 && g.dist) {
      z = Math.min(MAX_Z, Math.max(MIN_Z, g.zoom * (Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / g.dist)));
      setZoom(z);
      scale.set(base * z);
    }
    const k = z / g.zoom;
    const l = limits(z);
    x.set(rubber(g.x * k + (cx - g.px), l.x));
    y.set(rubber(g.y * k + (cy - g.py), l.y));
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size) {
      // Queda un dedo: el gesto continúa como arrastre desde aquí.
      const [p] = [...pointers.current.values()];
      gesture.current = { x: x.get(), y: y.get(), px: p.x, py: p.y, dist: 0, zoom };
      return;
    }
    gesture.current = null;
    setDragging(false);
    settle();
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 40 : 12;
    const l = limits(zoom);
    const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (move) { e.preventDefault(); to(x, clamp(x.get() + move[0], l.x)); to(y, clamp(y.get() + move[1], l.y)); return; }
    if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoomTo(zoom + 0.25); }
    if (e.key === '-' || e.key === '_') { e.preventDefault(); setZoomTo(zoom - 0.25); }
  };

  const reset = () => { setRot(0); setZoom(1); to(scale, (circle / Math.min(source?.w ?? 1, source?.h ?? 1))); to(x, 0); to(y, 0); };

  function apply() {
    if (!source) return;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingQuality = 'high';
    // Mismo orden que el transform en pantalla: traslación → giro → escala.
    const k = size / circle;
    ctx.translate(size / 2, size / 2);
    ctx.scale(k, k);
    ctx.translate(x.get(), y.get());
    ctx.rotate((rot * Math.PI) / 180);
    const s = base * zoom;
    ctx.scale(s, s);
    ctx.drawImage(source.el, -source.w / 2, -source.h / 2, source.w, source.h);
    try {
      onApply(c.toDataURL('image/jpeg', 0.88));
    } catch {
      // Enlace externo sin CORS: el lienzo queda «contaminado» y no se puede exportar.
      setFailed(true);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1, transition: springSoft }}
      className="flex flex-col gap-5"
    >
      <div>
        <h3 className="text-heading-sm">Ajusta tu foto</h3>
        <p className="mt-1 text-body-sm text-on-surface-light">Arrastra para encuadrar y pellizca, usa la rueda o el deslizador para acercar.</p>
      </div>

      <div
        ref={frameRef}
        role="group"
        tabIndex={0}
        aria-label="Encuadre de la foto. Flechas para mover, más y menos para el zoom."
        aria-roledescription="recorte de imagen"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
        className={cn(
          'relative mx-auto aspect-square w-full max-w-[340px] touch-none select-none overflow-hidden rounded-[28px] bg-surface-variant',
          dragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
      >
        {source && (
          <motion.img
            src={source.url}
            alt=""
            draggable={false}
            initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.35 } }}
            className="pointer-events-none absolute max-w-none"
            style={{ width: source.w, height: source.h, left: frame / 2 - source.w / 2, top: frame / 2 - source.h / 2, x, y, rotate, scale }}
          />
        )}
        {!source && !failed && <div aria-hidden className="lq-skeleton absolute inset-0" />}
        {failed && (
          <p role="alert" className="absolute inset-0 flex items-center justify-center p-8 text-center text-body-sm text-on-surface">
            No se pudo ajustar esta imagen. Si es un enlace externo, súbela desde tu dispositivo.
          </p>
        )}
        {/* Velo fuera del círculo + anillo + cuadrícula de tercios mientras se arrastra. */}
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-full shadow-[0_0_0_9999px_var(--scrim)] ring-2 ring-white/90"
          style={{ inset: PAD }}
        >
          <motion.div
            className="absolute inset-0 overflow-hidden rounded-full"
            animate={{ opacity: dragging ? 1 : 0 }} transition={{ duration: 0.2 }}
          >
            {[1, 2].map((i) => (
              <span key={`v${i}`} className="absolute inset-y-0 w-px bg-white/50" style={{ left: `${(i / 3) * 100}%` }} />
            ))}
            {[1, 2].map((i) => (
              <span key={`h${i}`} className="absolute inset-x-0 h-px bg-white/50" style={{ top: `${(i / 3) * 100}%` }} />
            ))}
          </motion.div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <BounceIcon label="Alejar" onClick={() => setZoomTo(zoom - 0.25)} disabled={zoom <= MIN_Z}>
          <ZoomOut aria-hidden className="size-5" strokeWidth={1.75} />
        </BounceIcon>
        <ZoomSlider value={zoom} onChange={(z) => setZoomTo(z, false)} onStep={(d) => setZoomTo(zoom + d)} />
        <BounceIcon label="Acercar" onClick={() => setZoomTo(zoom + 0.25)} disabled={zoom >= MAX_Z}>
          <ZoomIn aria-hidden className="size-5" strokeWidth={1.75} />
        </BounceIcon>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 [&>*]:inline-flex">
        <Bouncy><Button variant="ghost" size="sm" onClick={() => setRot((r) => r - 90)} disabled={!source}>
          <RotateCcw aria-hidden className="size-4" strokeWidth={1.75} />Girar
        </Button></Bouncy>
        <Bouncy><Button variant="ghost" size="sm" onClick={reset} disabled={!source}>Restablecer</Button></Bouncy>
        <Bouncy><Button variant="ghost" size="sm" onClick={() => setRot((r) => r + 90)} disabled={!source}>
          Girar<RotateCw aria-hidden className="size-4" strokeWidth={1.75} />
        </Button></Bouncy>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-border pt-4">
        <Bouncy><Button variant="secondary" block onClick={onCancel}>Cancelar</Button></Bouncy>
        <Bouncy><Button block onClick={apply} disabled={!source || failed}>Aplicar</Button></Bouncy>
      </div>
    </motion.div>
  );
}
