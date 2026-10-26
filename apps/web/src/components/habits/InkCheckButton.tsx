// Check de libreta (Hábitos, Agenda): un círculo hecho a mano donde, al completar,
// se traza un check de tinta. La tinta aparece en cuanto se toca (sin esperar a
// la API) y dura menos de 400 ms; si el registro falla, el trazo se recoge.
// Mismo contrato accesible que CheckButton: aria-pressed, nombre «Completar X»;
// con `locked`, una vez completado queda bloqueado y anunciado como tal; sin él,
// tocarlo otra vez lo desmarca y la tinta se recoge.
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { SketchCheck, SketchCircle } from '@/components/ambience';
import { useText, type Copy } from '@/lib/i18n';

const COPY: Copy<{ done: (n: string) => string; undo: (n: string) => string; complete: (n: string) => string }> = {
  es: { done: (n) => `${n}: completado hoy`, undo: (n) => `Desmarcar ${n}`, complete: (n) => `Completar ${n}` },
  en: { done: (n) => `${n}: completed today`, undo: (n) => `Undo ${n}`, complete: (n) => `Complete ${n}` },
};

export interface InkCheckButtonProps {
  checked: boolean;
  /** Nombre del hábito: genera «Completar X». */
  name: string;
  onToggle: () => void;
  /** Hay un registro en curso para este hábito. */
  pending?: boolean;
  /** Marcado y sin vuelta atrás (la API no permite desmarcar). */
  locked?: boolean;
  className?: string;
}

export function InkCheckButton({ checked, name, onToggle, pending, locked, className }: InkCheckButtonProps) {
  const t = useText(COPY);
  const [inking, setInking] = useState(false);
  const wasPending = useRef(false);
  const shown = checked || inking;
  const isLocked = checked && locked;

  // Si el registro terminó sin marcar el hábito (error), la tinta se recoge.
  useEffect(() => {
    if (pending) { wasPending.current = true; return; }
    if (wasPending.current && !checked) setInking(false);
    wasPending.current = false;
  }, [pending, checked]);

  // Mientras la tinta de un toque espera a la API, otro toque no hace nada.
  const waiting = inking && !checked;
  const toggle = () => { setInking(!checked); onToggle(); };

  return (
    <motion.button
      type="button"
      aria-pressed={checked}
      aria-label={isLocked ? t.done(name) : checked ? t.undo(name) : t.complete(name)}
      aria-disabled={isLocked || undefined}
      aria-busy={pending || undefined}
      disabled={pending}
      onClick={isLocked || waiting ? undefined : toggle}
      whileTap={isLocked ? undefined : { scale: 0.9 }}
      transition={springs.snappy}
      className={cn(
        'group/ink relative flex size-12 shrink-0 items-center justify-center rounded-full transition-colors duration-200',
        shown ? 'text-success-text' : 'text-border-strong hover:text-success-text',
        isLocked && 'cursor-default',
        className,
      )}
    >
      {/* Mancha de tinta que empapa el papel */}
      <motion.span
        aria-hidden="true"
        className="absolute inset-1.5 rounded-full bg-success/[.14]"
        initial={false}
        animate={{ scale: shown ? 1 : 0.4, opacity: shown ? 1 : 0 }}
        transition={springs.snappy}
      />
      <SketchCircle
        drawn
        duration={0}
        strokeWidth={1.8}
        className={cn('absolute inset-0 size-full transition-transform duration-[560ms] ease-[var(--lq-ease-natural)]', !shown && 'group-hover/ink:-rotate-12')}
      />
      <SketchCheck drawn={shown} duration={0.22} className="relative size-7" />
    </motion.button>
  );
}
