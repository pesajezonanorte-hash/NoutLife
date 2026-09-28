"use client";

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { usePageVisibility } from './LoadingGate';

interface LoaderSegment {
  width: number;
  tone: 'muted' | 'secondary' | 'gold' | 'success' | 'danger';
  circle?: boolean;
}

interface LoaderLine {
  id: number;
  indent?: number;
  segments: LoaderSegment[];
}

export type ModernLoaderVariant = 'screen' | 'page' | 'compact';

export interface ModernLoaderProps {
  /** Layout intent. `screen` preserves the launch-terminal presentation. */
  variant?: ModernLoaderVariant;
  /** Status messages typed into the terminal title or command line. */
  words?: readonly string[];
  /** Real progress supplied by the caller. Omit it for indeterminate loading. */
  progress?: number;
  /** Stops the stream and presents a completed terminal state. */
  ready?: boolean;
  className?: string;
}

const DEFAULT_WORDS = [
  'Iniciando tus herramientas…',
  'Sincronizando tu progreso…',
  'Preparando tu jornada…',
] as const;

const LINE_TEMPLATES: LoaderLine[] = [
  { id: 1, segments: [{ width: 24, tone: 'secondary' }] },
  { id: 2, segments: [{ width: 12, tone: 'gold' }, { width: 6, tone: 'muted', circle: true }, { width: 28, tone: 'gold' }, { width: 17, tone: 'gold' }] },
  { id: 3, indent: 1, segments: [{ width: 37, tone: 'muted' }, { width: 19, tone: 'secondary' }] },
  { id: 4, segments: [{ width: 42, tone: 'success' }, { width: 25, tone: 'secondary' }, { width: 29, tone: 'gold' }] },
  { id: 5, segments: [{ width: 13, tone: 'gold' }, { width: 31, tone: 'success' }] },
  { id: 6, indent: 1, segments: [{ width: 20, tone: 'gold' }, { width: 15, tone: 'muted' }] },
  { id: 7, segments: [{ width: 27, tone: 'secondary' }, { width: 11, tone: 'danger' }, { width: 35, tone: 'muted' }] },
  { id: 8, indent: 1, segments: [{ width: 46, tone: 'success' }, { width: 18, tone: 'secondary' }] },
  { id: 9, segments: [{ width: 15, tone: 'gold' }, { width: 8, tone: 'muted', circle: true }, { width: 32, tone: 'muted' }] },
  { id: 10, segments: [{ width: 39, tone: 'secondary' }] },
  { id: 11, indent: 1, segments: [{ width: 22, tone: 'success' }, { width: 24, tone: 'gold' }] },
  { id: 12, segments: [{ width: 19, tone: 'muted' }, { width: 42, tone: 'secondary' }] },
];

const TONE_COLOR: Record<LoaderSegment['tone'], string> = {
  muted: 'var(--text-muted)',
  secondary: 'var(--text-secondary)',
  gold: 'var(--accent-gold)',
  success: 'var(--accent-green)',
  danger: 'var(--accent-red)',
};

const VARIANT_CONFIG: Record<ModernLoaderVariant, {
  lineLimit: number;
  container: string;
  body: string;
  lineGap: string;
  showWindowChrome: boolean;
}> = {
  screen: {
    lineLimit: 9,
    container: 'max-w-[30rem]',
    body: 'h-[13.5rem] px-5 py-4 sm:h-56',
    lineGap: 'gap-2',
    showWindowChrome: true,
  },
  page: {
    lineLimit: 7,
    container: 'max-w-[28rem]',
    body: 'h-48 px-5 py-4 sm:h-52',
    lineGap: 'gap-2',
    showWindowChrome: true,
  },
  compact: {
    lineLimit: 3,
    container: 'max-w-none',
    body: 'h-28 px-4 py-3',
    lineGap: 'gap-1.5',
    showWindowChrome: false,
  },
};

function useTypewriter(
  words: readonly string[],
  complete: boolean,
  reduceMotion: boolean,
  paused: boolean,
) {
  const safeWords = words.length ? words : DEFAULT_WORDS;
  const [wordIndex, setWordIndex] = useState(0);
  const [letterCount, setLetterCount] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const activeWord = complete ? 'Tu espacio está listo.' : safeWords[wordIndex % safeWords.length];

  useEffect(() => {
    if (complete || reduceMotion) {
      setLetterCount(activeWord.length);
      setDeleting(false);
      return undefined;
    }

    if (paused) return undefined;

    const atEnd = letterCount >= activeWord.length;
    const atStart = letterCount === 0;
    const delay = deleting ? 18 : atEnd ? 1_000 : 32;
    const timer = window.setTimeout(() => {
      if (atEnd && !deleting) {
        setDeleting(true);
      } else if (atStart && deleting) {
        setDeleting(false);
        setWordIndex((current) => (current + 1) % safeWords.length);
      } else {
        setLetterCount((current) => current + (deleting ? -1 : 1));
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [activeWord, complete, deleting, letterCount, paused, reduceMotion, safeWords.length]);

  return activeWord.slice(0, letterCount);
}

/**
 * A compact, theme-aware terminal stream for launch, route, and content states.
 * New code-like lines write in at the bottom and gently move older lines up.
 */
export default function ModernLoader({
  variant = 'screen',
  words = DEFAULT_WORDS,
  progress,
  ready = false,
  className,
}: ModernLoaderProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const isPageVisible = usePageVisibility();
  const canAnimate = !reduceMotion && isPageVisible;
  const config = VARIANT_CONFIG[variant];
  const isCompact = variant === 'compact';
  const hasProgress = typeof progress === 'number';
  const [lineCursor, setLineCursor] = useState(4);
  const text = useTypewriter(words, ready, reduceMotion, !isPageVisible);
  const clampedProgress = typeof progress === 'number' ? Math.max(0, Math.min(100, Math.round(progress))) : 0;
  const accessibleMessage = ready
    ? 'LifeQuest está listo.'
    : `${words[0] ?? DEFAULT_WORDS[0]}${hasProgress ? ` ${clampedProgress} por ciento.` : ''}`;
  const visibleLines = useMemo(() => {
    const visibleCount = Math.min(config.lineLimit, lineCursor + 1);
    const firstSequence = Math.max(0, lineCursor - visibleCount + 1);
    return Array.from({ length: visibleCount }, (_, index) => {
      const sequence = firstSequence + index;
      return { line: LINE_TEMPLATES[sequence % LINE_TEMPLATES.length], sequence };
    });
  }, [config.lineLimit, lineCursor]);
  const cursorLine = LINE_TEMPLATES[(lineCursor + 1) % LINE_TEMPLATES.length];
  const showProgress = variant === 'screen' && hasProgress;

  useEffect(() => {
    if (ready || !canAnimate) return undefined;
    const interval = window.setInterval(() => setLineCursor((current) => current + 1), 360);
    return () => window.clearInterval(interval);
  }, [canAnimate, ready]);

  return (
    <div
      className={cn('w-full', config.container, className)}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy={!ready}
    >
      <span className="sr-only">{accessibleMessage}</span>

      <motion.section
        aria-hidden="true"
        className={cn(
          'overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]',
          isCompact ? 'shadow-sm' : 'shadow-lg',
        )}
        initial={canAnimate ? { opacity: 0, y: 12, scale: 0.985 } : false}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: canAnimate ? 0.38 : 0, ease: [0.22, 1, 0.36, 1] }}
      >
        {config.showWindowChrome ? (
          <div className="flex h-11 items-center border-b border-[var(--border-soft)] px-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent-red)]/90" />
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent-gold)]/90" />
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent-green)]/90" />
            </div>
            <div className="ml-4 min-w-0 flex-1 truncate text-center font-mono text-[11px] text-[var(--text-muted)]">
              <span>{text}</span>
              {!ready ? (
                <motion.span
                  className="ml-0.5 inline-block h-3 w-px translate-y-0.5 bg-[var(--accent-gold)]"
                  animate={canAnimate ? { opacity: [1, 1, 0, 0] } : { opacity: 1 }}
                  transition={canAnimate ? { duration: 0.82, repeat: Infinity, ease: 'linear' } : { duration: 0 }}
                />
              ) : null}
            </div>
            {showProgress ? (
              <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-[var(--text-muted)]">{clampedProgress}%</span>
            ) : null}
          </div>
        ) : null}

        <div className={cn('relative overflow-hidden', config.body)}>
          <motion.div
            className={cn('flex h-full flex-col justify-end', config.lineGap)}
            animate={ready ? { opacity: 0.58 } : { opacity: 1 }}
            transition={{ duration: canAnimate ? 0.22 : 0 }}
          >
            {isCompact ? (
              <div className="flex min-w-0 items-center gap-1.5 font-mono text-[10px] text-[var(--text-muted)]">
                <span className="truncate">{text}</span>
                {!ready ? (
                  <motion.span
                    className="h-3 w-px shrink-0 bg-[var(--accent-gold)]"
                    animate={canAnimate ? { opacity: [1, 1, 0, 0] } : { opacity: 1 }}
                    transition={canAnimate ? { duration: 0.82, repeat: Infinity, ease: 'linear' } : { duration: 0 }}
                  />
                ) : null}
              </div>
            ) : null}

            <AnimatePresence initial={false}>
              {visibleLines.map(({ line, sequence }) => (
                <motion.div
                  key={sequence}
                  layout={canAnimate}
                  className={cn('flex h-3 shrink-0 items-center gap-2', line.indent ? 'pl-4' : '')}
                  initial={canAnimate ? { opacity: 0, y: 8 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  exit={canAnimate ? { opacity: 0, y: -7 } : undefined}
                  transition={{
                    opacity: { duration: canAnimate ? 0.18 : 0 },
                    y: { duration: canAnimate ? 0.18 : 0, ease: 'easeOut' },
                    layout: { duration: canAnimate ? 0.24 : 0, ease: [0.22, 1, 0.36, 1] },
                  }}
                >
                  {line.segments.map((segment, segmentIndex) => (
                    segment.circle ? (
                      <motion.span
                        key={segmentIndex}
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: TONE_COLOR[segment.tone], opacity: 0.55 }}
                        initial={canAnimate ? { scale: 0 } : false}
                        animate={{ scale: 1 }}
                        transition={{ duration: canAnimate ? 0.18 : 0, delay: canAnimate ? segmentIndex * 0.04 : 0 }}
                      />
                    ) : (
                      <motion.span
                        key={segmentIndex}
                        className="h-2.5 shrink-0 origin-left rounded-sm"
                        style={{ width: `${segment.width}%`, backgroundColor: TONE_COLOR[segment.tone], opacity: 0.58 }}
                        initial={canAnimate ? { scaleX: 0 } : false}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: canAnimate ? 0.24 : 0, delay: canAnimate ? segmentIndex * 0.045 : 0, ease: [0.22, 1, 0.36, 1] }}
                      />
                    )
                  ))}
                </motion.div>
              ))}
            </AnimatePresence>

            {!ready ? (
              <motion.div
                key={`cursor-${lineCursor}`}
                layout={canAnimate}
                className={cn('flex h-3 shrink-0 items-center', cursorLine.indent ? 'pl-4' : '')}
                initial={canAnimate ? { opacity: 0, y: 6 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: canAnimate ? 0.16 : 0, ease: 'easeOut' }}
              >
                <motion.span
                  className="h-3 w-px bg-[var(--accent-gold)]"
                  animate={canAnimate ? { opacity: [1, 1, 0, 0] } : { opacity: 1 }}
                  transition={canAnimate ? { duration: 0.74, repeat: Infinity, ease: 'linear' } : { duration: 0 }}
                />
              </motion.div>
            ) : null}
          </motion.div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-[linear-gradient(to_bottom,transparent,var(--bg-panel))]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-7 bg-[linear-gradient(to_top,transparent,var(--bg-panel))]" />
        </div>

        {showProgress ? (
          <div className="border-t border-[var(--border-soft)] px-4 py-3">
            <div className="h-1 overflow-hidden rounded-full bg-[var(--bg-muted)]">
              <motion.div
                className="h-full rounded-full bg-[var(--accent-gold)]"
                animate={{ width: `${clampedProgress}%` }}
                transition={{ duration: canAnimate ? 0.26 : 0, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        ) : null}
      </motion.section>
    </div>
  );
}
