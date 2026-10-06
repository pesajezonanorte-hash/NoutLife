// La paloma mensajera: lleva las solicitudes de amistad y las invitaciones a
// gremios. Al enviar una, una paloma sale del botón con la carta enrollada en
// la pata, bate las alas y se va volando en arco (con un par de plumas que caen);
// la petición ya salió antes de que despegue, la animación solo acompaña. En las
// solicitudes recibidas la paloma se queda posada sobre la nota y picotea.
// Con «Reducir movimiento»: un sobre con check que aparece y se desvanece.
import { useEffect, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { create } from 'zustand';
import { cn } from '@/lib/utils';
import { useMotionStore } from '@/store/motionStore';

// Colores de la paloma: un objeto (gris azulado con el cuello tornasol jade).
const PIGEON: CSSProperties = {
  ['--pg-body' as string]: 'color-mix(in srgb, rgb(var(--lq-info)) 20%, rgb(var(--lq-jade-200)))',
  ['--pg-dark' as string]: 'color-mix(in srgb, rgb(var(--lq-info)) 22%, rgb(var(--lq-jade-600)))',
  ['--pg-belly' as string]: 'color-mix(in srgb, white 50%, rgb(var(--lq-jade-200)))',
  ['--pg-neck' as string]: 'rgb(var(--lq-jade-500))',
  ['--pg-neck2' as string]: 'color-mix(in srgb, rgb(var(--lq-info)) 45%, rgb(var(--lq-jade-400)))',
  ['--pg-beak' as string]: 'rgb(var(--lq-warning))',
  ['--pg-ink' as string]: 'rgb(var(--lq-jade-900))',
  ['--pg-paper' as string]: 'color-mix(in srgb, rgb(var(--lq-jade-50)) 40%, white)',
  ['--pg-ribbon' as string]: 'rgb(var(--lq-error))',
};
const f = (v: string): CSSProperties => ({ fill: `var(${v})` });
const s = (v: string, w = 1.4): CSSProperties => ({ stroke: `var(${v})`, strokeWidth: w, fill: 'none', strokeLinecap: 'round' });

/** La paloma (vista de lado, mirando a la derecha). */
export function Pigeon({ flying = false, letter = false, className, style }: { flying?: boolean; letter?: boolean; className?: string; style?: CSSProperties }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 48" className={cn('overflow-visible', className)} style={{ ...PIGEON, ...style }}>
      <path d="M4 25 L17 21 L18.5 31 L5 30 Z" style={f('--pg-dark')} />
      <path d="M5 30 L10 27" style={s('--pg-body', 1)} />
      <ellipse cx="29" cy="27.5" rx="15" ry="9.5" style={f('--pg-body')} />
      <ellipse cx="32.5" cy="31" rx="10" ry="5.5" style={f('--pg-belly')} />
      {letter && (
        <g>
          <path d="M30 36 L30 39" style={s('--pg-ink', .8)} />
          <rect x="25" y="38.5" width="11" height="5" rx="2.5" style={{ ...f('--pg-paper'), stroke: 'var(--pg-ink)', strokeWidth: .6 }} />
          <rect x="29.4" y="38.5" width="2.2" height="5" style={f('--pg-ribbon')} />
        </g>
      )}
      {!flying && (
        <g>
          <path d="M28 36 L27 41 M27 41 L24.5 42 M27 41 L28.5 42.5" style={s('--pg-beak', 1.3)} />
          <path d="M34 36 L34 41 M34 41 L31.5 42 M34 41 L35.5 42.5" style={s('--pg-beak', 1.3)} />
        </g>
      )}
      <path d="M37 22.5 C39 16.5 46 15.5 48 20.5 C47 25.5 41 28.5 37 27.5 Z" style={f('--pg-neck')} />
      <path d="M38.5 24.5 C41 20 45 19.5 47 21.5" style={s('--pg-neck2', 2)} />
      <g className={cn(!flying && 'lq-pigeon-head')}>
        <circle cx="46" cy="15.5" r="6" style={f('--pg-body')} />
        <circle cx="48" cy="14.4" r="1.7" style={{ fill: 'rgb(var(--lq-warning) / .9)' }} />
        <circle cx="48.2" cy="14.3" r=".9" style={f('--pg-ink')} />
        <path d="M51.6 15 L57 16.7 L51.6 18 Z" style={f('--pg-beak')} />
        <ellipse cx="51.3" cy="15.2" rx="1" ry=".7" style={{ fill: 'rgb(255 255 255 / .85)' }} />
      </g>
      {flying ? (
        <g className="lq-pigeon-wing">
          <path d="M22 23.5 C25 9 38 5.5 45 11.5 C38.5 15 33 20 26 27.5 Z" style={f('--pg-dark')} />
          <path d="M24 22.5 C28 13 36 10 41.5 12.5" style={s('--pg-body', 1.2)} />
          <path d="M29 20.5 L37 14.5 M31 23 L39.5 16.5" style={s('--pg-ink', 1)} />
        </g>
      ) : (
        <g>
          <path d="M18 24.5 C25 19.5 36 19 42 24 C36 30.5 26 31.5 18 28.5 Z" style={f('--pg-dark')} />
          <path d="M26 24 L34 23.5 M27 27 L36 26.5" style={s('--pg-ink', .9)} />
        </g>
      )}
    </svg>
  );
}

interface Flight { id: number; x: number; y: number }
interface PigeonState { flights: Flight[]; send: (from?: Element | DOMRect | null) => void; land: (id: number) => void }

let seq = 0;
export const usePigeonStore = create<PigeonState>((set) => ({
  flights: [],
  send: (from) => {
    const r = from instanceof Element ? from.getBoundingClientRect() : from ?? null;
    const x = r ? r.left + r.width / 2 : window.innerWidth / 2;
    const y = r ? r.top + r.height / 2 : window.innerHeight * 0.6;
    set((st) => ({ flights: [...st.flights.slice(-3), { id: ++seq, x, y }] }));
  },
  land: (id) => set((st) => ({ flights: st.flights.filter((fl) => fl.id !== id) })),
}));

/** Suelta una paloma desde un botón (o un punto) de la pantalla. */
export const sendPigeon = (from?: Element | DOMRect | null) => usePigeonStore.getState().send(from);

function PigeonFlight({ flight }: { flight: Flight }) {
  const reduce = useMotionStore((st) => st.reduce);
  useEffect(() => {
    const t = window.setTimeout(() => usePigeonStore.getState().land(flight.id), reduce ? 1000 : 2300);
    return () => window.clearTimeout(t);
  }, [flight.id, reduce]);

  if (reduce) {
    return (
      <motion.span
        className="absolute flex size-10 items-center justify-center rounded-full bg-success-strong text-on-success shadow-md"
        style={{ left: flight.x - 20, top: flight.y - 52 }}
        initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: 0.9, times: [0, 0.2, 0.7, 1] }}
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16v10H4z" /><path d="m4 7 8 6 8-6" /></svg>
      </motion.span>
    );
  }

  // Sale hacia el lado con más espacio y sube hasta perderse por arriba.
  const toRight = flight.x < window.innerWidth * 0.62;
  const dx = toRight ? window.innerWidth - flight.x + 90 : -(flight.x + 90);
  const dy = -(flight.y + 110);
  return (
    <>
      <motion.div
        className="absolute"
        style={{ left: flight.x - 34, top: flight.y - 30, scaleX: toRight ? 1 : -1 }}
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{
          opacity: [0, 1, 1, 1, 0],
          scale: [0.3, 1.12, 1, 0.92, 0.7],
          x: [0, -4, dx * 0.08, dx * 0.55, dx],
          y: [0, -8, -34, dy * 0.55, dy],
          rotate: toRight ? [0, 6, -10, -16, -20] : [0, -6, 10, 16, 20],
        }}
        transition={{ duration: 2, times: [0, 0.14, 0.32, 0.72, 1], ease: 'easeInOut' }}
      >
        <Pigeon flying letter className="h-[60px] w-[80px] drop-shadow-[0_6px_8px_rgb(0_0_0/.22)]" />
      </motion.div>
      {/* Un par de plumas que caen balanceándose al despegar */}
      {[0, 1].map((i) => (
        <motion.span
          key={i}
          className="absolute block h-2 w-4 rounded-[50%]"
          style={{ left: flight.x + (i ? 6 : -10), top: flight.y - 18, background: 'color-mix(in srgb, rgb(var(--lq-info)) 20%, rgb(var(--lq-jade-200)))' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.9, 0.9, 0], y: [0, 26, 52, 78], x: [0, i ? 12 : -10, i ? 2 : -2, i ? 14 : -12], rotate: [0, 40, -30, 50] }}
          transition={{ duration: 1.7, delay: 0.35 + i * 0.18, ease: 'easeInOut' }}
        />
      ))}
    </>
  );
}

/** Capa de las palomas en vuelo (una por envío; se monta una vez en el AppShell). */
export function PigeonLayer() {
  const flights = usePigeonStore((st) => st.flights);
  if (!flights.length) return null;
  return createPortal(
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[65] overflow-hidden">
      {flights.map((fl) => <PigeonFlight key={fl.id} flight={fl} />)}
    </div>,
    document.body,
  );
}
