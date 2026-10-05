// Pasaje comercial de la Tienda: toldos por categoría, escaparates que se
// encienden, etiquetas de precio colgadas de un hilo, lámparas del pasaje y el
// monedero. Lo decorativo va con aria-hidden; el color de cada escaparate llega
// por la variable --win (canales RGB del token de su categoría).
import { forwardRef, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';
import { useMotionStore } from '@/store/motionStore';
import { AnimatedValue } from '@/components/ui/lq/StatCard';
import type { Tone } from '@/components/ui/lq/tones';

const WIN: Record<Tone, string> = {
  primary: 'primary', secondary: 'secondary', forest: 'forest', success: 'success',
  warning: 'warning', error: 'error', info: 'info', muted: 'border-strong',
};
/** Color del escaparate (toldo, luz) según el tono de la categoría. */
export const winVars = (tone: Tone) => ({ '--win': `var(--lq-${WIN[tone]})` }) as CSSProperties;

/** Toldo con faldón ondulado: se despliega con peso, como al abrir la tienda. */
export function Awning({ delay = 0, size = 'md', className }: { delay?: number; size?: 'md' | 'lg'; className?: string }) {
  return (
    <motion.span
      aria-hidden="true"
      className={cn('lq-awning block origin-top', size === 'lg' && 'lq-awning-lg', className)}
      initial={{ scaleY: 0, opacity: 0 }}
      animate={{ scaleY: 1, opacity: 1, transition: { scaleY: { ...springs.heavy, delay }, opacity: { duration: 0.2, delay } } }}
    />
  );
}

/**
 * Escaparate: pared del fondo, una luz cenital que se enciende con un parpadeo
 * (como un tubo al arrancar), el vidrio con su reflejo y el artículo sobre un
 * pedestal que gira un poco al pasar el cursor. `lit={false}`: escaparate en penumbra.
 */
export function ShopWindow({ lit = true, delay = 0, turn = true, tag, className, children }: {
  lit?: boolean; delay?: number; turn?: boolean; tag?: ReactNode; className?: string; children: ReactNode;
}) {
  const reduce = useMotionStore((s) => s.reduce);
  const on = lit ? (reduce ? 1 : [0, 0.9, 0.3, 1]) : 0.22;
  return (
    <div className={cn('lq-window relative isolate flex flex-col items-center justify-end overflow-hidden pb-[9%]', className)}>
      <motion.span
        aria-hidden="true"
        className="lq-window-light absolute inset-0 -z-10 block"
        initial={{ opacity: 0 }}
        animate={{ opacity: on, transition: { duration: Array.isArray(on) ? 0.9 : 0.5, times: Array.isArray(on) ? [0, 0.3, 0.5, 1] : undefined, delay } }}
      />
      <span aria-hidden="true" className="lq-glass-sweep" />
      <span className={cn('relative block', turn && 'lq-turn')}>{children}</span>
      <span aria-hidden="true" className="lq-plinth mt-1.5 block" />
      {tag}
    </div>
  );
}

/** Etiqueta de precio colgada de un hilo: se mece al pasar por el escaparate y la cifra destella. */
export function PriceTag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('lq-tag-swing absolute right-[8%] top-0 flex origin-top flex-col items-center', className)}>
      <span aria-hidden="true" className="relative z-10 -mb-2.5 block h-6 w-px bg-secondary-text/60" />
      <span className="lq-tag block px-3 pb-1.5 pt-4">{children}</span>
    </span>
  );
}

export interface Lamp { x: string; cord: number; d?: number; className?: string }

/** Lámparas del pasaje: cuelgan del techo, se mecen apenas y dejan un cono de luz cálida que se enciende al llegar. */
export function PendantLamps({ lamps, delay = 0.15 }: { lamps: Lamp[]; delay?: number }) {
  return (
    <>
      {lamps.map((l, i) => (
        <span
          key={i}
          className={cn('lq-amb-sway absolute top-0 -ml-6 block w-12', l.className)}
          style={{ left: l.x, '--r': '1.2deg', '--d': `${l.d ?? 8}s`, '--o': '50% 0%', animationDelay: `${-i * 2.3}s` } as CSSProperties}
        >
          <span className="mx-auto block w-px bg-on-background/25" style={{ height: l.cord }} />
          <svg viewBox="0 0 48 22" className="lq-lamp-shade relative z-10 -mt-px block w-12">
            <path d="M21 0h6v5c9 1.6 15.6 7.6 17 17H4C5.4 12.6 12 6.6 21 5Z" />
          </svg>
          <motion.span
            className="lq-lamp-glow absolute left-[calc(50%-9rem)] top-[calc(100%-2px)] block h-[26rem] w-[18rem]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 1.1, delay: delay + i * 0.18 } }}
          >
            <span className="lq-lamp-cone absolute inset-0 block" />
            <span className="lq-lamp-bulb absolute left-1/2 top-0 block size-8 -translate-x-1/2 -translate-y-1/2 rounded-full" />
          </motion.span>
        </span>
      ))}
    </>
  );
}

/** Monedero: la moneda da una vuelta cada vez que el saldo cambia y la cifra rueda hasta el nuevo valor. */
export const GoldBalance = forwardRef<HTMLSpanElement, { value: number; className?: string }>(function GoldBalance({ value, className }, ref) {
  const [turns, setTurns] = useState(0);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value) { prev.current = value; setTurns((t) => t + 1); }
  }, [value]);
  return (
    <span ref={ref} className={cn('inline-flex items-center gap-2.5 rounded-full bg-warning/[var(--lq-soft-alpha)] py-1.5 pl-1.5 pr-4 text-warning-text', className)}>
      <span aria-hidden="true" className="block [perspective:240px]">
        <motion.span className="lq-coin block size-8 rounded-full" animate={{ rotateY: turns * 360 }} transition={springs.heavy} />
      </span>
      <span aria-live="polite" className="font-mono text-heading-sm"><AnimatedValue value={value} /></span>
      <span className="text-label-lg">Gold</span>
    </span>
  );
});
