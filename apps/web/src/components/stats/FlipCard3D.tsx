// Tarjeta de vidrio con bisel que gira en 3D (Estadísticas): el anverso resume y el reverso
// amplía con métricas y gráficos. Sigue la cadena 3D compartida con PerspectiveFlipCard: solo
// el rotor es contexto 3D y las caras quedan planas (con translateZ anidados, WebKit pintaba
// las dos caras a la vez). El tamaño sale de la cara más alta: las dos caras comparten celda
// de grid, sin alturas fijas.
// El giro es una transición CSS con curva de muelle (compositor, 60 fps aunque el hilo
// principal esté ocupado); al girar, la tarjeta se levanta, su sombra se encoge y un brillo
// cruza el vidrio. Con «Reducir movimiento» o sin preserve-3d, las caras se funden.
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Rotate3d, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSpotlight } from '@/lib/motion';
import { useText, type Copy } from '@/lib/i18n';
import { useNested3dSupport, usePrefersReducedMotion } from '@/components/ui/perspective-flip-card';

const es = {
  details: 'Detalles',
  back: 'Volver',
  showBack: (label: string): string => `${label}: ver detalles`,
  showFront: (label: string): string => `Volver al resumen de ${label}`,
  backOf: (label: string): string => `Detalles de ${label}`,
};
const en: typeof es = {
  details: 'Details',
  back: 'Back',
  showBack: (label) => `${label}: see details`,
  showFront: (label) => `Back to the ${label} summary`,
  backOf: (label) => `${label} details`,
};
const COPY: Copy<typeof es> = { es, en };

type Side = 'front' | 'back';

interface FlipState {
  flipped: boolean;
  flip: (next: boolean) => void;
  label: string;
  backId: string;
  register: (side: Side, el: HTMLButtonElement | null) => void;
}

const FlipContext = createContext<FlipState | null>(null);
const FaceContext = createContext<Side>('front');

/** Clave por dispositivo: el amago de giro se muestra dos veces como mucho y nunca tras girar una. */
const PEEK_KEY = 'lq-flip-peeks';
const readPeeks = () => { try { return Number(localStorage.getItem(PEEK_KEY) ?? 0); } catch { return 99; } };
const writePeeks = (n: number) => { try { localStorage.setItem(PEEK_KEY, String(n)); } catch { /* modo privado */ } };

/** Lo que el clic no debe tomar como «girar»: controles propios del reverso. */
const INTERACTIVE = 'a, button, input, select, textarea, label, [role="button"], [role="slider"], [role="tab"]';

export interface FlipCard3DProps {
  /** Nombre corto de la tarjeta («Progreso de XP»): lo anuncian los botones de giro. */
  label: string;
  front: ReactNode;
  /** Reverso. Como función recibe si ya está a la vista y quieto, para animar sus gráficos entonces. */
  back: ReactNode | ((active: boolean) => ReactNode);
  /** face: todo el anverso gira la tarjeta (sin controles dentro). toggle: solo <FlipToggle /> (el anverso tiene controles, p. ej. un gráfico). */
  trigger?: 'face' | 'toggle';
  className?: string;
  /** Clases de las dos caras (relleno, gap…). */
  faceClassName?: string;
  frontClassName?: string;
  backClassName?: string;
  /** Amago de giro al entrar en pantalla, para enseñar que la tarjeta se voltea. */
  peek?: boolean;
}

export function FlipCard3D({ label, front, back, trigger = 'face', className, faceClassName, frontClassName, backClassName, peek }: FlipCard3DProps) {
  const t = useText(COPY);
  const reduce = usePrefersReducedMotion();
  const supports3d = useNested3dSupport();
  const spot = useSpotlight<HTMLDivElement>();
  const root = useRef<HTMLDivElement>(null);
  const buttons = useRef<Record<Side, HTMLButtonElement | null>>({ front: null, back: null });
  const focusNext = useRef<Side | null>(null);
  const shown = useRef(false);
  const [flipped, setFlipped] = useState(false);
  // Cada giro alterna data-spin a/b para reiniciar las animaciones de elevación, sombra y brillo.
  const [spin, setSpin] = useState(0);
  const [peeking, setPeeking] = useState(false);
  // «Armada»: el rotor ya es capa propia (will-change) cuando llega el clic, así el giro arranca
  // sin pintar las caras en ese fotograma. Se arma al pasar el ratón o con foco.
  const [armed, setArmed] = useState(false);
  const disarm = useRef(0);
  const backId = `flip-${useId().replace(/:/g, '')}`;
  const mode = supports3d && !reduce ? '3d' : 'fade';

  const arm = useCallback(() => {
    window.clearTimeout(disarm.current);
    setArmed(true);
    disarm.current = window.setTimeout(() => setArmed(false), 2500);
  }, []);
  useEffect(() => () => window.clearTimeout(disarm.current), []);

  const flip = useCallback((next: boolean) => {
    if (shown.current === next) return;
    shown.current = next;
    focusNext.current = next ? 'back' : 'front';
    arm();
    setFlipped(next);
    setSpin((s) => s + 1);
    setPeeking(false);
    writePeeks(99);
  }, [arm]);

  const register = useCallback((side: Side, el: HTMLButtonElement | null) => { buttons.current[side] = el; }, []);

  // Cara accesible (la otra queda inerte y oculta a lectores). Cambia al cruzar los 90°, no en
  // el clic: alternar `inert` recalcula el estilo de toda la cara, y a mitad de giro ese trabajo
  // no se ve porque la rotación ya la lleva el compositor.
  const [face, setFace] = useState<Side>('front');
  useEffect(() => {
    const next: Side = flipped ? 'back' : 'front';
    const timer = window.setTimeout(() => setFace(next), mode === '3d' ? 200 : 0);
    return () => window.clearTimeout(timer);
  }, [flipped, mode]);

  // El foco pasa al botón de la cara que queda a la vista.
  useEffect(() => {
    if (focusNext.current !== face) return;
    focusNext.current = null;
    buttons.current[face]?.focus({ preventScroll: true });
  }, [face]);

  // Los gráficos del reverso se animan cuando la tarjeta ya se asentó y se reinician cuando ya
  // no se ve: así el giro es solo trabajo del compositor (un SVG que se anima mientras la cara
  // gira obligaba a repintarla en cada fotograma).
  const [backActive, setBackActive] = useState(false);
  useEffect(() => {
    const wait = mode === '3d' ? (flipped ? 780 : 320) : 0;
    const timer = window.setTimeout(() => setBackActive(flipped), wait);
    return () => window.clearTimeout(timer);
  }, [flipped, mode]);

  // Amago: la primera vez que la tarjeta se ve casi entera, se asoma un poco y vuelve.
  useEffect(() => {
    if (!peek || mode !== '3d' || readPeeks() >= 2 || typeof IntersectionObserver === 'undefined') return;
    const el = root.current;
    if (!el) return;
    let timer = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      writePeeks(readPeeks() + 1);
      timer = window.setTimeout(() => {
        setPeeking(true);
        timer = window.setTimeout(() => setPeeking(false), 1500);
      }, 700);
    }, { threshold: 0.7 });
    io.observe(el);
    return () => { io.disconnect(); window.clearTimeout(timer); };
  }, [peek, mode]);

  const onBackClick = (e: MouseEvent<HTMLElement>) => {
    if (!(e.target as Element).closest(INTERACTIVE)) flip(false);
  };

  const ctx = useMemo<FlipState>(() => ({ flipped, flip, label, backId, register }), [flipped, flip, label, backId, register]);

  return (
    <FlipContext.Provider value={ctx}>
      <div
        ref={root}
        className={cn('lq-flip', className)}
        data-flipped={flipped ? 'true' : 'false'}
        data-mode={mode}
        data-spin={spin === 0 ? undefined : spin % 2 ? 'a' : 'b'}
        data-peek={peeking || undefined}
        data-armed={(armed && mode === '3d') || undefined}
        // Con el dedo no se arma al presionar: casi todo desplazamiento empieza sobre una tarjeta.
        onPointerEnter={(e) => { if (e.pointerType !== 'touch') arm(); }}
        onFocus={arm}
        onPointerMove={spot.onPointerMove}
        onPointerLeave={spot.onPointerLeave}
        onKeyDown={(e) => {
          if (e.key !== 'Escape' || !flipped) return;
          e.stopPropagation();
          flip(false);
        }}
      >
        {/* Sombra en el suelo: se encoge cuando la tarjeta se levanta al girar. */}
        <span aria-hidden className="lq-flip-floor" />
        <div className="lq-flip-tilt">
          <div className="lq-flip-rotor">
            <FaceContext.Provider value="front">
              <div
                role="group"
                aria-label={label}
                className={cn('lq-flip-face lq-flip-front lq-glass3d', faceClassName, frontClassName)}
                aria-hidden={face !== 'front' || undefined}
                inert={face !== 'front' ? '' : undefined}
              >
                {front}
                {trigger === 'face' && (
                  <button
                    ref={(el) => register('front', el)}
                    type="button"
                    className="lq-flip-hit"
                    aria-label={t.showBack(label)}
                    aria-expanded={flipped}
                    aria-controls={backId}
                    onClick={() => flip(true)}
                  />
                )}
                <span aria-hidden className="lq-flip-glare" />
              </div>
            </FaceContext.Provider>
            <FaceContext.Provider value="back">
              <section
                id={backId}
                aria-label={t.backOf(label)}
                className={cn('lq-flip-face lq-flip-back lq-glass3d', faceClassName, backClassName)}
                aria-hidden={face !== 'back' || undefined}
                inert={face !== 'back' ? '' : undefined}
                onClick={trigger === 'face' ? onBackClick : undefined}
              >
                {typeof back === 'function' ? back(backActive) : back}
                <span aria-hidden className="lq-flip-glare" />
              </section>
            </FaceContext.Provider>
          </div>
        </div>
      </div>
    </FlipContext.Provider>
  );
}

/** Botón que gira la tarjeta: «Detalles» en el anverso, «Volver» en el reverso. */
export function FlipToggle({ className }: { className?: string }) {
  const t = useText(COPY);
  const ctx = useContext(FlipContext);
  const side = useContext(FaceContext);
  if (!ctx) return null;
  const front = side === 'front';
  const Icon = front ? Rotate3d : RotateCcw;
  return (
    <button
      ref={(el) => ctx.register(side, el)}
      type="button"
      className={cn('lq-flip-chip lq-flip-toggle', className)}
      aria-label={front ? t.showBack(ctx.label) : t.showFront(ctx.label)}
      aria-expanded={front ? ctx.flipped : undefined}
      aria-controls={front ? ctx.backId : undefined}
      onClick={(e) => { e.stopPropagation(); ctx.flip(front); }}
    >
      <Icon aria-hidden className="size-4" strokeWidth={1.75} />
      <span>{front ? t.details : t.back}</span>
    </button>
  );
}

/** Pista visual (sin función) en anversos que giran al tocarlos enteros. */
export function FlipHint({ className }: { className?: string }) {
  return <Rotate3d aria-hidden className={cn('lq-flip-hint size-4', className)} strokeWidth={1.75} />;
}
