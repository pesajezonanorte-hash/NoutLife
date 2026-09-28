import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

// React 18's JSX types predate the standard `inert` attribute. The browser
// still receives the native attribute, which keeps the hidden face unfocusable.
declare module 'react' {
  interface HTMLAttributes<T> {
    inert?: boolean | '';
  }
}

export type PerspectiveFlipCardTrigger = 'auto' | 'hover' | 'tap';

export interface PerspectiveFlipCardProps {
  /** Content rendered on the summary side. Keep it free of interactive controls. */
  front: ReactNode;
  /** Content rendered on the detail side. Interactive actions belong here. */
  back: ReactNode;
  /** A concise name announced by the summary-side toggle. */
  label: string;
  /** Enables pointer hover, touch/click, or chooses the appropriate input automatically. */
  trigger?: PerspectiveFlipCardTrigger;
  /** Optional controlled state. */
  flipped?: boolean;
  /** Called when the card asks to change sides. */
  onFlipChange?: (flipped: boolean) => void;
  className?: string;
  frontClassName?: string;
  backClassName?: string;
  id?: string;
}

const FLIP_DURATION_MS = 700;
const preserve3dStyle = {
  transformStyle: 'preserve-3d',
  WebkitTransformStyle: 'preserve-3d',
} as CSSProperties;
const backfaceHiddenStyle = {
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
} as CSSProperties;

function getMediaMatch(query: string) {
  return typeof window !== 'undefined' && window.matchMedia(query).matches;
}

function useMediaMatch(query: string) {
  const [matches, setMatches] = useState(() => getMediaMatch(query));

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();

    // `addListener` keeps the media change path working on older Safari/iOS.
    const compatibleMedia = media as unknown as {
      addEventListener?: (type: string, listener: () => void) => void;
      removeEventListener?: (type: string, listener: () => void) => void;
      addListener?: (listener: () => void) => void;
      removeListener?: (listener: () => void) => void;
    };
    if (compatibleMedia.addEventListener && compatibleMedia.removeEventListener) {
      compatibleMedia.addEventListener('change', update);
      return () => compatibleMedia.removeEventListener?.('change', update);
    }
    compatibleMedia.addListener?.(update);
    return () => compatibleMedia.removeListener?.(update);
  }, [query]);

  return matches;
}

/** Shared so composed cards remove their interior translateZ layers as well. */
export function usePrefersReducedMotion() {
  return useMediaMatch('(prefers-reduced-motion: reduce)');
}

/**
 * A semantic, controlled-or-uncontrolled 3D flip shell.
 *
 * The front is a real button so Enter and Space work natively. The back has a
 * built-in return control and is the only side that receives interactive detail
 * actions. This avoids nesting buttons inside a click-to-navigate card.
 */
export function PerspectiveFlipCard({
  front,
  back,
  label,
  trigger = 'auto',
  flipped,
  onFlipChange,
  className,
  frontClassName,
  backClassName,
  id,
}: PerspectiveFlipCardProps) {
  const generatedId = useId();
  const contentId = id ?? `flip-card-${generatedId.replace(/:/g, '')}`;
  const frontButtonRef = useRef<HTMLButtonElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const requestedBackFocus = useRef(false);
  const requestedFrontFocus = useRef(false);
  const previousFlipped = useRef(Boolean(flipped));
  const [uncontrolledFlipped, setUncontrolledFlipped] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const canHover = useMediaMatch('(hover: hover) and (pointer: fine)');
  const prefersReducedMotion = useMediaMatch('(prefers-reduced-motion: reduce)');
  const isFlipped = flipped ?? uncontrolledFlipped;
  const hoverEnabled = trigger === 'hover' || (trigger === 'auto' && canHover);

  const requestFlip = useCallback((next: boolean) => {
    if (next === isFlipped) return;
    if (flipped === undefined) setUncontrolledFlipped(next);
    onFlipChange?.(next);
  }, [flipped, isFlipped, onFlipChange]);

  useEffect(() => {
    if (previousFlipped.current === isFlipped) return;
    previousFlipped.current = isFlipped;

    if (prefersReducedMotion) {
      setIsAnimating(false);
      return;
    }

    setIsAnimating(true);
    const timeout = window.setTimeout(() => setIsAnimating(false), FLIP_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [isFlipped, prefersReducedMotion]);

  useEffect(() => {
    if (!isFlipped || !requestedBackFocus.current) return;
    requestedBackFocus.current = false;
    const frame = window.requestAnimationFrame(() => backButtonRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isFlipped]);

  useEffect(() => {
    if (isFlipped || !requestedFrontFocus.current) return;
    requestedFrontFocus.current = false;
    const frame = window.requestAnimationFrame(() => frontButtonRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isFlipped]);

  const returnToFront = useCallback((returnFocus = true) => {
    if (returnFocus) requestedFrontFocus.current = true;
    requestFlip(false);
  }, [requestFlip]);

  function handleFrontClick() {
    requestedBackFocus.current = true;
    requestFlip(true);
  }

  function handleKeyDownCapture(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape' || !isFlipped) return;
    event.preventDefault();
    event.stopPropagation();
    returnToFront();
  }

  const depthStyle = (value: number): CSSProperties | undefined => {
    if (prefersReducedMotion) return undefined;
    return { ...preserve3dStyle, transform: `translateZ(${value}px)` };
  };

  const faceStyle = (side: 'front' | 'back'): CSSProperties => {
    if (prefersReducedMotion) return {};
    return {
      ...preserve3dStyle,
      ...backfaceHiddenStyle,
      transform: side === 'back' ? 'rotateY(180deg)' : 'rotateY(0deg)',
    };
  };

  return (
    <div
      className={cn(
        'group relative isolate h-[clamp(22rem,58dvh,30rem)] min-h-[22rem] w-full max-w-[28rem] [perspective:2000px]',
        prefersReducedMotion && '[perspective:none]',
        className,
      )}
      onPointerEnter={() => {
        if (hoverEnabled) requestFlip(true);
      }}
      onPointerLeave={() => {
        if (hoverEnabled) requestFlip(false);
      }}
      onKeyDownCapture={handleKeyDownCapture}
    >
      <div
        className={cn(
          'relative h-full w-full transition-transform duration-[700ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]',
          !prefersReducedMotion && '[transform-style:preserve-3d]',
          prefersReducedMotion && 'transition-none',
          isAnimating && !prefersReducedMotion && 'will-change-transform',
        )}
        style={prefersReducedMotion
          ? undefined
          : { ...preserve3dStyle, transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
      >
        <div
          aria-hidden={isFlipped}
          inert={isFlipped ? '' : undefined}
          className={cn(
            'absolute inset-0 rounded-3xl border border-border bg-card shadow-lg transition-opacity',
            prefersReducedMotion ? 'duration-200' : 'duration-150',
            isFlipped && 'pointer-events-none opacity-0',
            frontClassName,
          )}
          style={faceStyle('front')}
        >
          <button
            ref={frontButtonRef}
            type="button"
            className="h-full w-full rounded-[inherit] p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={`${label}. Mostrar detalles y acciones`}
            aria-controls={contentId}
            aria-expanded={isFlipped}
            aria-pressed={isFlipped}
            tabIndex={isFlipped ? -1 : 0}
            onClick={handleFrontClick}
          >
            {front}
            <span className="sr-only">Pulsa para mostrar los detalles. Escape vuelve al resumen.</span>
          </button>
        </div>

        <section
          id={contentId}
          aria-hidden={!isFlipped}
          inert={!isFlipped ? '' : undefined}
          aria-label={`Detalles de ${label}`}
          className={cn(
            'absolute inset-0 flex min-h-0 flex-col rounded-3xl border border-border bg-card shadow-lg transition-opacity',
            prefersReducedMotion ? 'duration-200' : 'duration-150',
            !isFlipped && 'pointer-events-none opacity-0',
            backClassName,
          )}
          style={faceStyle('back')}
        >
          <div className="pointer-events-none absolute right-4 top-4 z-10" style={depthStyle(46)}>
            <button
              ref={backButtonRef}
              type="button"
              className="pointer-events-auto inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-muted px-3 text-xs font-semibold text-foreground transition-transform hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label={`Volver al resumen de ${label}`}
              aria-expanded={false}
              aria-pressed={false}
              onClick={(event) => {
                event.stopPropagation();
                returnToFront();
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Volver
            </button>
          </div>
          {back}
        </section>
      </div>
    </div>
  );
}

/**
 * `translateZ` values shared by higher-level card compositions.
 * Kept here so all LifeQuest flip cards turn off their depth layers together.
 */
export function getFlipDepthStyle(value: number, prefersReducedMotion: boolean): CSSProperties | undefined {
  if (prefersReducedMotion) return undefined;
  return { ...preserve3dStyle, transform: `translateZ(${value}px)` };
}
