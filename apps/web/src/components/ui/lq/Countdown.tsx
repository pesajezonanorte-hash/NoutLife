import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { tick } from '@/lib/motion';

export interface CountdownProps {
  /** Fecha objetivo (ISO o Date). */
  to: string | Date;
  className?: string;
  /** Resalta los segundos con el color primario. */
  accent?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

function parts(target: number) {
  const left = Math.max(0, Math.floor((target - Date.now()) / 1000));
  return { d: Math.floor(left / 86400), h: Math.floor((left % 86400) / 3600), m: Math.floor((left % 3600) / 60), s: left % 60 };
}

/** Dígito que entra y sale con `tick` (key por valor). */
function Digit({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <span aria-hidden className="inline-flex min-w-[64px] flex-col items-center gap-1 rounded-2xl bg-surface-variant px-2 py-3 md:min-w-[72px]">
      <span className="relative h-9 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.b
            key={value}
            variants={tick}
            initial="initial"
            animate="animate"
            exit="exit"
            className={cn('block font-mono text-[2rem] font-bold leading-9 tabular-nums md:text-[2.25rem]', accent && 'text-primary-text')}
          >
            {value}
          </motion.b>
        </AnimatePresence>
      </span>
      <span className="text-body-sm text-on-surface-light">{label}</span>
    </span>
  );
}

/** Cuenta atrás en vivo (días · horas · min · seg). role="timer"; el texto accesible
 *  solo cambia por minuto para no saturar al lector de pantalla. */
export function Countdown({ to, className, accent = true }: CountdownProps) {
  const target = new Date(to).getTime();
  const [p, setP] = useState(() => parts(target));
  useEffect(() => {
    setP(parts(target));
    const id = window.setInterval(() => setP(parts(target)), 1000);
    return () => window.clearInterval(id);
  }, [target]);

  return (
    <div role="timer" aria-label={`Quedan ${p.d} días, ${p.h} horas y ${p.m} minutos`} className={cn('flex flex-wrap gap-2', className)}>
      <Digit value={pad(p.d)} label="días" />
      <Digit value={pad(p.h)} label="horas" />
      <Digit value={pad(p.m)} label="min" />
      <Digit value={pad(p.s)} label="seg" accent={accent} />
    </div>
  );
}
