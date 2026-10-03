import { useRef, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { softTone, type Tone } from './tones';

export const MOODS: Array<{ n: number; name: string; mouth: string; tone: Tone }> = [
  { n: 1, name: 'Muy mal', mouth: 'M8.5 16.5q3.5-3 7 0', tone: 'error' },
  { n: 2, name: 'Mal', mouth: 'M9 16q3-1.2 6 0', tone: 'warning' },
  { n: 3, name: 'Neutral', mouth: 'M9 15.5h6', tone: 'muted' },
  { n: 4, name: 'Bien', mouth: 'M9 14.5q3 2 6 0', tone: 'success' },
  { n: 5, name: 'Genial', mouth: 'M8 14q4 4 8 0', tone: 'primary' },
];

export const moodOf = (n?: number | null) => MOODS[Math.min(5, Math.max(1, n ?? 3)) - 1];

/** Cara SVG del ánimo (1–5). Decorativa por defecto; pasa `label` para exponerla como imagen. */
export function MoodFace({ mood, className, label }: { mood: number; className?: string; label?: string }) {
  const m = moodOf(mood);
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
      className={cn('size-6', className)} {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <circle cx="12" cy="12" r="9" /><path d="M9 10h.01M15 10h.01" /><path d={m.mouth} />
    </svg>
  );
}

export interface MoodPickerProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  className?: string;
}

/** Cinco caras en radiogroup (flechas con roving tabindex). 56 px, la elegida crece 1.08 y se tiñe de primary. */
export function MoodPicker({ value, onChange, label = 'Ánimo', className }: MoodPickerProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (i + d + MOODS.length) % MOODS.length;
    onChange(MOODS[next].n);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex flex-wrap gap-2', className)}>
      {MOODS.map((m, i) => {
        const on = value === m.n;
        return (
          <motion.button
            key={m.n}
            ref={(el) => (refs.current[i] = el)}
            type="button" role="radio" aria-checked={on} aria-label={m.name} title={m.name}
            tabIndex={on ? 0 : -1}
            animate={{ scale: on ? 1.08 : 1 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 24 }}
            onClick={() => onChange(m.n)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'flex size-14 items-center justify-center rounded-2xl border transition-colors',
              on ? cn('border-2 border-primary', softTone.primary) : 'border-border bg-background text-on-surface hover:border-primary/40',
            )}
          >
            <MoodFace mood={m.n} className="size-7" />
          </motion.button>
        );
      })}
    </div>
  );
}
