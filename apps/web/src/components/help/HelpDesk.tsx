// El mostrador de Ayuda: el cartel de información que cuelga y se mece, el
// mostrador con su timbre (suena, se agita, al buscar) y el resaltado de lo que
// buscaste dentro de la respuesta. Lo decorativo es aria-hidden.
import { Fragment, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/** Cartel «i» colgado de dos cadenas. */
export function InfoSign({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('lq-amb-sway pointer-events-none block origin-top [--d:6s] [--o:50%_0%] [--r:1.5deg]', className)}>
      <svg viewBox="0 0 120 120" className="block size-full overflow-visible">
        <path d="M30 0v34M90 0v34" className="lq-chain-line" strokeWidth={2} strokeDasharray="4 3" />
        <rect x="10" y="34" width="100" height="74" rx="12" className="lq-sign-plate" />
        <rect x="16" y="40" width="88" height="62" rx="8" className="lq-sign-inner" />
        <circle cx="60" cy="56" r="5" className="lq-sign-ink" />
        <rect x="55" y="66" width="10" height="26" rx="4" className="lq-sign-ink" />
      </svg>
    </span>
  );
}

/** Timbre del mostrador: se agita cuando `ring` cambia. */
export function DeskBell({ ring, className }: { ring: number; className?: string }) {
  return (
    <motion.span
      key={ring}
      aria-hidden="true"
      className={cn('pointer-events-none block origin-bottom', className)}
      initial={ring ? { rotate: 0 } : false}
      animate={ring ? { rotate: [0, -14, 11, -7, 4, 0], transition: { duration: 0.6, ease: 'easeOut' } } : undefined}
    >
      <svg viewBox="0 0 48 40" className="block size-full">
        <rect x="21" y="2" width="6" height="6" rx="2" className="lq-bell-top" />
        <path d="M6 32a18 18 0 0 1 36 0Z" className="lq-bell-dome" />
        <path d="M14 22a10 10 0 0 1 8-8" className="fill-none stroke-white/60" strokeWidth={2.5} strokeLinecap="round" />
        <rect x="2" y="32" width="44" height="6" rx="3" className="lq-bell-base" />
      </svg>
    </motion.span>
  );
}

/** Minúsculas y sin tildes, carácter a carácter (para resaltar sin perder las tildes del original). */
const normChar = (c: string) => c.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Marca en el texto lo que coincide con la búsqueda (sin tildes ni mayúsculas). */
export function Highlight({ text, query }: { text: string; query: string }): ReactNode {
  const q = normChar(query.trim());
  if (q.length < 2) return text;
  const chars = [...text];
  const map: number[] = [];
  let flat = '';
  chars.forEach((c, i) => { const n = normChar(c); for (let k = 0; k < n.length; k++) map.push(i); flat += n; });
  const parts: ReactNode[] = [];
  let from = 0;
  let at = flat.indexOf(q);
  while (at >= 0) {
    const start = map[at];
    const end = map[at + q.length - 1] + 1;
    if (start > from) parts.push(chars.slice(from, start).join(''));
    parts.push(<mark key={start} className="lq-found-mark">{chars.slice(start, end).join('')}</mark>);
    from = end;
    at = flat.indexOf(q, at + q.length);
  }
  if (from < chars.length) parts.push(chars.slice(from).join(''));
  return <>{parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}</>;
}
