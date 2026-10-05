// Después de cerrar el jardín: una escena que acompaña (y no juzga). Cada vez
// sale una distinta: peces que saltan en el océano, un corazón que se cose,
// una flor que vuelve a brotar, el sol que sale o un globo que se suelta.
import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotionConfig } from 'framer-motion';
import { springs } from '@/lib/motion/presets';
import { Button, useDialogBehavior } from '@/components/ui/lq';

type Variant = 'fish' | 'heart' | 'sprout' | 'sunrise' | 'balloon';

const COPY: Record<Variant, { title: string; body: string }> = {
  fish: { title: 'Hay millones de peces en el océano', body: 'Y alguno salta justo cuando menos lo esperas. Hoy, nada primero hacia ti.' },
  heart: { title: 'Los corazones rotos también sanan', body: 'Puntada a puntada. No tiene que ser hoy; basta con que sea a tu ritmo.' },
  sprout: { title: 'Lo que se marchita abona lo que viene', body: 'Tu jardín vuelve a estar en blanco, y la tierra recuerda cómo florecer.' },
  sunrise: { title: 'Mañana el sol sale igual', body: 'Y tú también. Cuida tus hábitos pequeños: son los que sostienen los días grandes.' },
  balloon: { title: 'Soltar también es cuidarte', body: 'Lo que fue bonito se queda contigo. Lo demás puede irse volando.' },
};

const VARIANTS = Object.keys(COPY) as Variant[];

function Ocean({ reduce }: { reduce: boolean }) {
  const fish = [
    { x0: 40, x1: 170, peak: 40, delay: 0.4, tone: 'rgb(var(--lq-warning))' },
    { x0: 210, x1: 320, peak: 60, delay: 1.7, tone: 'rgb(var(--lq-error))' },
    { x0: 120, x1: 240, peak: 30, delay: 3.0, tone: 'rgb(var(--lq-info))' },
  ];
  return (
    <svg viewBox="0 0 360 220" className="h-full w-full">
      {fish.map((f, i) => (
        <motion.g
          key={i}
          initial={{ x: f.x0, y: 170, rotate: -50, opacity: 0 }}
          animate={reduce ? { x: (f.x0 + f.x1) / 2, y: f.peak + 40, rotate: 0, opacity: 1 } : {
            x: [f.x0, (f.x0 + f.x1) / 2, f.x1], y: [170, f.peak, 170], rotate: [-50, 0, 60], opacity: [0, 1, 1, 0],
          }}
          transition={reduce ? { duration: 0.6 } : { duration: 1.6, delay: f.delay, repeat: Infinity, repeatDelay: 2.6, ease: 'easeInOut' }}
        >
          <path d="M-14 0 Q-4 -9 10 0 Q-4 9 -14 0 Z M10 0 L20 -7 L18 0 L20 7 Z" fill={f.tone} />
          <circle cx="-7" cy="-1.5" r="1.4" fill="rgb(var(--lq-background))" />
        </motion.g>
      ))}
      {[0, 1].map((layer) => (
        <motion.path
          key={layer}
          d="M-360 175 Q-315 160 -270 175 T-180 175 T-90 175 T0 175 T90 175 T180 175 T270 175 T360 175 T450 175 T540 175 T630 175 T720 175 V220 H-360 Z"
          fill={layer ? 'rgb(var(--lq-info) / .55)' : 'rgb(var(--lq-info) / .3)'}
          animate={reduce ? undefined : { x: layer ? [0, 180] : [180, 0] }}
          transition={{ duration: layer ? 7 : 9, repeat: Infinity, ease: 'linear' }}
          style={{ y: layer * 8 }}
        />
      ))}
    </svg>
  );
}

function Heart({ reduce }: { reduce: boolean }) {
  const half = 'M180 190 C120 150 80 120 80 80 C80 55 100 38 124 38 C150 38 168 56 180 76';
  return (
    <svg viewBox="0 0 360 220" className="h-full w-full">
      <motion.path d={half} fill="rgb(var(--lq-error) / .85)"
        initial={{ x: 0, rotate: 0 }} animate={reduce ? { x: 0 } : { x: [0, -16, -16, 0], rotate: [0, -8, -8, 0] }}
        transition={{ duration: 4, times: [0, 0.25, 0.6, 1], repeat: Infinity, repeatDelay: 1, ease: 'easeInOut' }} style={{ originX: '180px', originY: '190px' }} />
      {/* Espejo en un <g>: Framer escribe el transform del path y borraría el atributo. */}
      <g transform="translate(360 0) scale(-1 1)">
        <motion.path d={half} fill="rgb(var(--lq-error) / .85)"
          initial={{ x: 0 }} animate={reduce ? { x: 0 } : { x: [0, -16, -16, 0] }}
          transition={{ duration: 4, times: [0, 0.25, 0.6, 1], repeat: Infinity, repeatDelay: 1, ease: 'easeInOut' }} />
      </g>
      {/* La costura que los vuelve a unir */}
      <motion.path d="M180 76 L172 96 L188 114 L172 134 L188 152 L180 190" fill="none" stroke="rgb(var(--lq-warning))" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 7"
        initial={{ pathLength: 0 }} animate={{ pathLength: reduce ? 1 : [0, 0, 1, 1] }} transition={{ duration: 4, times: [0, 0.35, 0.75, 1], repeat: reduce ? 0 : Infinity, repeatDelay: 1 }} />
    </svg>
  );
}

function Sprout({ reduce }: { reduce: boolean }) {
  return (
    <svg viewBox="0 0 360 220" className="h-full w-full">
      <ellipse cx="180" cy="200" rx="120" ry="16" fill="rgb(var(--lq-warning) / .25)" />
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.ellipse key={i} cx={150 + i * 14} cy="70" rx="7" ry="11" fill="rgb(var(--lq-error) / .6)"
          initial={{ y: 0, opacity: 0.9 }} animate={reduce ? { opacity: 0 } : { y: [0, 120], x: [0, (i - 2) * 18], rotate: [0, 120], opacity: [0.9, 0.9, 0] }}
          transition={{ duration: 2.4, delay: i * 0.25, repeat: Infinity, repeatDelay: 3.2 }} />
      ))}
      <motion.path d="M180 200 C180 170 178 150 182 120" fill="none" stroke="rgb(var(--lq-success))" strokeWidth="5" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ ...springs.gentle, delay: 0.6 }} />
      <motion.path d="M181 140 C160 128 150 132 146 116 C164 112 176 122 181 140 Z" fill="rgb(var(--lq-success) / .85)"
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...springs.heavy, delay: 1.4 }} style={{ originX: '181px', originY: '140px' }} />
      <motion.path d="M182 126 C204 112 216 118 220 100 C200 98 186 108 182 126 Z" fill="rgb(var(--lq-success) / .85)"
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...springs.heavy, delay: 1.8 }} style={{ originX: '182px', originY: '126px' }} />
    </svg>
  );
}

function Sunrise({ reduce }: { reduce: boolean }) {
  return (
    <svg viewBox="0 0 360 220" className="h-full w-full">
      <motion.g initial={{ y: 70 }} animate={{ y: 0 }} transition={{ duration: reduce ? 0.3 : 3.2, ease: [0.22, 1, 0.36, 1] }}>
        {Array.from({ length: 10 }, (_, i) => (
          <motion.line key={i} x1="180" y1="120" x2={180 + Math.cos((Math.PI * (i + 0.5)) / 10) * 120} y2={120 - Math.sin((Math.PI * (i + 0.5)) / 10) * 120}
            stroke="rgb(var(--lq-warning) / .5)" strokeWidth="3" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: [0.55, 0.8, 0.55] }} transition={{ duration: 3, delay: 1 + i * 0.08, repeat: reduce ? 0 : Infinity, ease: 'easeInOut' }} />
        ))}
        <circle cx="180" cy="120" r="44" fill="rgb(var(--lq-warning))" />
      </motion.g>
      <path d="M0 160 Q90 120 180 150 T360 140 V220 H0 Z" fill="rgb(var(--lq-success) / .55)" />
      <path d="M0 190 Q120 160 220 185 T360 175 V220 H0 Z" fill="rgb(var(--lq-forest) / .7)" />
    </svg>
  );
}

function Balloon({ reduce }: { reduce: boolean }) {
  return (
    <svg viewBox="0 0 360 220" className="h-full w-full">
      <motion.g initial={{ y: 70, x: 0 }} animate={reduce ? { y: 0 } : { y: [70, -150], x: [0, 20, -10, 30] }}
        transition={reduce ? { duration: 0.4 } : { duration: 7, repeat: Infinity, ease: 'easeIn' }}>
        <path d="M180 60 C150 60 140 90 152 110 C162 126 176 132 180 140 C184 132 198 126 208 110 C220 90 210 60 180 60 Z" fill="rgb(var(--lq-error) / .85)" />
        <path d="M180 140 C176 160 188 172 180 196" fill="none" stroke="rgb(var(--lq-on-surface-light))" strokeWidth="1.5" />
      </motion.g>
      <path d="M100 200 Q180 186 260 200" fill="none" stroke="rgb(var(--lq-on-surface-light) / .4)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const SCENES: Record<Variant, (p: { reduce: boolean }) => JSX.Element> = { fish: Ocean, heart: Heart, sprout: Sprout, sunrise: Sunrise, balloon: Balloon };

export function BreakupScene({ open, onClose, onRestart }: { open: boolean; onClose: () => void; onRestart: () => void }) {
  const reduce = Boolean(useReducedMotionConfig());
  const variant = useMemo(() => VARIANTS[Math.floor(Math.random() * VARIANTS.length)], [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const panelRef = useDialogBehavior(open, onClose);
  if (!open) return null;
  const Scene = SCENES[variant];
  const copy = COPY[variant];
  return createPortal(
    <motion.div
      ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="breakup-title" tabIndex={-1}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-6 overflow-hidden bg-background px-6 text-center outline-none"
    >
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springs.gentle, delay: 0.2 }} className="h-[200px] w-full max-w-[420px] md:h-[240px]">
        <Scene reduce={reduce} />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springs.gentle, delay: 0.7 }} className="flex max-w-[460px] flex-col gap-3">
        <h2 id="breakup-title" className="text-display-sm">{copy.title}</h2>
        <p className="text-body-lg text-on-surface-light">{copy.body}</p>
      </motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }} className="flex flex-wrap justify-center gap-3">
        <Button variant="secondary" onClick={onClose}>Volver al jardín</Button>
        <Button onClick={onRestart}>Empezar de nuevo</Button>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
