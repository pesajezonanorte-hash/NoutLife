// Contador rodante (odómetro de bóveda): cada dígito es una columna 0–9 que rueda
// hasta su valor con un muelle con masa, en cascada desde las unidades. Cuando el
// valor cambia, solo ruedan los dígitos que cambian. Solo transform/opacity.
import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { cn } from '@/lib/utils';
import { fmtNumber, heavy } from '@/lib/motion';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const isDigit = (c: string) => c >= '0' && c <= '9';
/** Separadores numéricos: mismo tamaño que los dígitos. */
const isSep = (c: string) => c === '.' || c === ',' || c === '−' || c === '-' || c === '+' || c === ':' || c === '/';

function Digit({ d, delay, seen }: { d: number; delay: number; seen: boolean }) {
  return (
    <span className="relative inline-block h-[1.1em] overflow-hidden leading-[1.1em]">
      <span className="invisible">0</span>
      <motion.span
        className="absolute inset-x-0 top-0 flex flex-col items-center"
        initial={{ y: '0%', opacity: 0 }}
        animate={{ y: `${-d * 10}%`, opacity: seen ? 1 : 0 }}
        transition={{ ...heavy, delay, opacity: { duration: 0.25, delay } }}
      >
        {DIGITS.map((n) => <span key={n} className="block h-[1.1em] leading-[1.1em]">{n}</span>)}
      </motion.span>
    </span>
  );
}

export interface OdometerProps {
  value: number;
  format?: (n: number) => string;
  /** Símbolos y sufijos (moneda, k, mil, %) más pequeños y suaves, como en un extracto bancario. */
  quietUnits?: boolean;
  className?: string;
}

/** Número con dígitos que ruedan al entrar en pantalla y al cambiar. Accesible: el valor real va en sr-only. */
export function Odometer({ value, format = fmtNumber, quietUnits, className }: OdometerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.6 });
  const text = format(value);
  const chars = text.split('');
  let fromRight = chars.filter(isDigit).length;
  const firstDigit = chars.findIndex(isDigit);
  return (
    <span ref={ref} className={cn('inline-flex items-start whitespace-nowrap', className)}>
      <span aria-hidden className="inline-flex items-start">
        {chars.map((c, i) => {
          const pos = chars.length - i; // clave estable desde la derecha
          if (isDigit(c)) {
            fromRight -= 1;
            return <Digit key={`d${pos}`} seen={seen} d={seen ? Number(c) : 0} delay={0.05 + fromRight * 0.045} />;
          }
          if (c === ' ' || c === ' ' || c === ' ') return <span key={`s${pos}`} className="inline-block w-[0.18em]" />;
          return (
            <span key={`c${pos}`} className={cn('inline-block', quietUnits && !isSep(c)
              ? cn('text-[0.56em] font-medium leading-none opacity-60', i < firstDigit ? 'mr-[0.08em] self-start pt-[0.22em]' : 'ml-[0.04em] self-end pb-[0.24em]')
              : 'h-[1.1em] leading-[1.1em]')}>
              {c}
            </span>
          );
        })}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
