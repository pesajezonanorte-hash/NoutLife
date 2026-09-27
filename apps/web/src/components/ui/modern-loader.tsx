"use client";

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

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

export interface ModernLoaderProps {
  /** Status messages typed into the terminal title bar. */
  words?: string[];
  /** Real loading progress supplied by the calling screen. */
  progress?: number;
  /** Stops the stream and presents a completed terminal state. */
  ready?: boolean;
  className?: string;
}

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

function useTypewriter(words: string[], complete: boolean, reduceMotion: boolean) {
  const safeWords = words.length ? words : ['Preparando LifeQuest…'];
  const [wordIndex, setWordIndex] = useState(0);
  const [letterCount, setLetterCount] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const activeWord = complete ? 'Tu espacio está listo.' : safeWords[wordIndex % safeWords.length];

  useEffect(() => {
    if (complete || reduceMotion) {
      setLetterCount(activeWord.length);
      setDeleting(false);
      return;
    }

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
  }, [activeWord, complete, deleting, letterCount, reduceMotion, safeWords.length]);

  return activeWord.slice(0, letterCount);
}

/**
 * A compact, theme-aware terminal stream for application launch states.
 * New code-like lines write in at the bottom and gently move older lines up.
 */
export default function ModernLoader({
  words = ['Iniciando tus herramientas…', 'Sincronizando tu progreso…', 'Preparando tu jornada…'],
  progress = 0,
  ready = false,
  className,
}: ModernLoaderProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const [lineCursor, setLineCursor] = useState(4);
  const text = useTypewriter(words, ready, reduceMotion);
  const visibleLines = useMemo(() => {
    const visibleCount = Math.min(9, lineCursor + 1);
    const firstSequence = Math.max(0, lineCursor - visibleCount + 1);
    return Array.from({ length: visibleCount }, (_, index) => {
      const sequence = firstSequence + index;
      return { line: LINE_TEMPLATES[sequence % LINE_TEMPLATES.length], sequence };
    });
  }, [lineCursor]);
  const cursorLine = LINE_TEMPLATES[(lineCursor + 1) % LINE_TEMPLATES.length];
  const clampedProgress = Math.max(0, Math.min(100, Math.round(progress)));

  useEffect(() => {
    if (ready || reduceMotion) return;
    const interval = window.setInterval(() => setLineCursor((current) => current + 1), 360);
    return () => window.clearInterval(interval);
  }, [ready, reduceMotion]);

  return (
    <div className={cn('w-full max-w-[30rem]', className)}>
      <span className="sr-only" role="status" aria-live="polite">
        {ready ? 'LifeQuest está listo.' : `${text || 'Iniciando LifeQuest'} ${clampedProgress} por ciento.`}
      </span>

      <motion.section
        aria-hidden="true"
        className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-[var(--shadow-lg)]"
        initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.38, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex h-11 items-center border-b border-[var(--border-soft)] px-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent-red)]/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent-gold)]/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent-green)]/90" />
          </div>
          <div className="ml-4 min-w-0 flex-1 text-center font-mono text-[11px] text-[var(--text-muted)]">
            <span>{text}</span>
            {!ready ? (
              <motion.span
                className="ml-0.5 inline-block h-3 w-px translate-y-0.5 bg-[var(--accent-gold)]"
                animate={{ opacity: [1, 1, 0, 0] }}
                transition={{ duration: 0.82, repeat: Infinity, ease: 'linear' }}
              />
            ) : null}
          </div>
          <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-[var(--text-muted)]">{clampedProgress}%</span>
        </div>

        <div className="relative h-[13.5rem] overflow-hidden px-5 py-4 sm:h-56">
          <motion.div
            className="flex h-full flex-col justify-end gap-2"
            animate={ready ? { opacity: 0.58 } : { opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.22 }}
          >
            <AnimatePresence initial={false}>
              {visibleLines.map(({ line, sequence }) => (
                <motion.div
                  key={sequence}
                  layout={!reduceMotion}
                  className={cn('flex h-3 shrink-0 items-center gap-2', line.indent ? 'pl-4' : '')}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -7 }}
                  transition={{
                    opacity: { duration: reduceMotion ? 0 : 0.18 },
                    y: { duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' },
                    layout: { duration: reduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] },
                  }}
                >
                  {line.segments.map((segment, segmentIndex) => (
                    segment.circle ? (
                      <motion.span
                        key={segmentIndex}
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: TONE_COLOR[segment.tone], opacity: 0.55 }}
                        initial={reduceMotion ? false : { scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: reduceMotion ? 0 : 0.18, delay: segmentIndex * 0.04 }}
                      />
                    ) : (
                      <motion.span
                        key={segmentIndex}
                        className="h-2.5 shrink-0 origin-left rounded-sm"
                        style={{ width: `${segment.width}%`, backgroundColor: TONE_COLOR[segment.tone], opacity: 0.58 }}
                        initial={reduceMotion ? false : { scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: reduceMotion ? 0 : 0.24, delay: segmentIndex * 0.045, ease: [0.22, 1, 0.36, 1] }}
                      />
                    )
                  ))}
                </motion.div>
              ))}
            </AnimatePresence>

            {!ready ? (
              <motion.div
                key={`cursor-${lineCursor}`}
                layout={!reduceMotion}
                className={cn('flex h-3 shrink-0 items-center', cursorLine.indent ? 'pl-4' : '')}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.16, ease: 'easeOut' }}
              >
                <motion.span
                  className="h-3 w-px bg-[var(--accent-gold)]"
                  animate={{ opacity: [1, 1, 0, 0] }}
                  transition={{ duration: 0.74, repeat: Infinity, ease: 'linear' }}
                />
              </motion.div>
            ) : null}
          </motion.div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-[linear-gradient(to_bottom,transparent,var(--bg-panel))]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-7 bg-[linear-gradient(to_top,transparent,var(--bg-panel))]" />
        </div>

        <div className="border-t border-[var(--border-soft)] px-4 py-3">
          <div className="h-1 overflow-hidden rounded-full bg-[var(--bg-muted)]">
            <motion.div
              className="h-full rounded-full bg-[var(--accent-gold)]"
              animate={{ width: `${clampedProgress}%` }}
              transition={{ duration: reduceMotion ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
      </motion.section>
    </div>
  );
}
