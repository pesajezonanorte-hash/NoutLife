// La casa (Inicio): una ventana con el cielo de la hora real. De día el sol
// recorre su arco y pasan nubes muy despacio; al amanecer y al atardecer el cielo
// se tiñe; de noche salen la luna y las estrellas. Al llegar, la ventana se posa,
// las cortinas se abren y el sol (o la luna) sube a su sitio; luego todo sigue
// en calma: las cortinas se mecen con la brisa, la planta del alféizar se balancea
// y de la taza sube vapor. RoomLight es la luz que esa ventana deja en la sala (o
// la lámpara, de noche). Todo es decorativo (aria-hidden) y, con «Reducir
// movimiento», queda quieto.
import { useEffect, useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';
import { AmbientLight, seeded } from '@/components/ambience';

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

export function phaseOf(d: Date): DayPhase {
  const h = d.getHours() + d.getMinutes() / 60;
  return h >= 5.5 && h < 8 ? 'dawn' : h >= 8 && h < 17.5 ? 'day' : h >= 17.5 && h < 20.5 ? 'dusk' : 'night';
}

/** La hora del reloj, renovada cada minuto: el sol se mueve mientras miras. */
export function useNow(every = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), every);
    return () => window.clearInterval(id);
  }, [every]);
  return now;
}

/** Posición (0–100 %) del sol de 6 a 20 h, o de la luna de 20 a 6 h, sobre un arco. */
function skyPosition(d: Date) {
  const h = d.getHours() + d.getMinutes() / 60;
  const night = h >= 20 || h < 6;
  const t = night ? ((h - 20 + 24) % 24) / 10 : (h - 6) / 14;
  const k = Math.min(1, Math.max(0, t));
  return { night, x: 12 + k * 76, y: 78 - Math.sin(Math.PI * k) * 58 };
}

const STARS = (() => {
  const r = seeded(19);
  return Array.from({ length: 16 }, () => ({ x: 4 + r() * 92, y: 4 + r() * 52, s: 1.5 + r() * 2, d: 3 + r() * 4, delay: -r() * 6, a: 0.5 + r() * 0.5 }));
})();

function Cloud({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <span className={cn('lq-cloud absolute block', className)} style={style}>
      <span className="lq-cloud-puff absolute bottom-0 left-[8%] block h-[62%] w-[48%]" />
      <span className="lq-cloud-puff absolute bottom-0 left-[34%] block h-full w-[46%]" />
      <span className="lq-cloud-puff absolute bottom-0 right-[6%] block h-[55%] w-[40%]" />
    </span>
  );
}

/** Planta en su maceta: cada hoja se mece a su ritmo desde la base. */
function Plant() {
  const leaves = [
    { d: 'M30 58C24 44 14 40 6 42c4 10 12 16 24 16Z', o: '30px 58px', r: '3deg', dur: '7s', delay: '0s' },
    { d: 'M30 58C36 42 46 36 56 38c-4 12-14 18-26 20Z', o: '30px 58px', r: '4deg', dur: '8.5s', delay: '-2s' },
    { d: 'M30 58C28 40 32 24 38 14c6 14 2 32-8 44Z', o: '30px 58px', r: '2.5deg', dur: '9.5s', delay: '-4s' },
    { d: 'M30 58C30 44 22 30 14 24c-2 14 4 28 16 34Z', o: '30px 58px', r: '3.5deg', dur: '7.8s', delay: '-1s' },
  ];
  return (
    <svg viewBox="0 0 60 92" className="block h-[4.6rem] w-[3.75rem] overflow-visible">
      {leaves.map((l, i) => (
        <path key={i} d={l.d} className={cn('lq-amb-sway', i % 2 ? 'fill-success/80' : 'fill-success')} style={{ ['--o' as string]: l.o, ['--r' as string]: l.r, ['--d' as string]: l.dur, animationDelay: l.delay }} />
      ))}
      <path d="M14 60h32l-4 30H18Z" className="lq-pot" />
      <path d="M12 56h36v7H12Z" className="lq-pot-rim" />
    </svg>
  );
}

/** Taza con su vapor: tres hilos que suben a destiempo. */
function Mug() {
  return (
    <svg viewBox="0 0 48 60" className="block h-12 w-10 overflow-visible">
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M${14 + i * 7} 22c-4-5 4-8 0-13s4-8 0-12`} className="lq-steam fill-none stroke-on-surface-light/60" strokeWidth="2" strokeLinecap="round" style={{ animationDelay: `${i * 1.1}s` }} />
      ))}
      <path d="M34 34h4a7 7 0 0 1 0 14h-4" className="fill-none stroke-[rgb(var(--lq-info-text))]" strokeWidth="3.5" />
      <path d="M8 28h28v20a8 8 0 0 1-8 8H16a8 8 0 0 1-8-8Z" className="fill-info-text" />
      <path d="M8 28h28v4H8Z" className="fill-white/25" />
    </svg>
  );
}

export function HomeWindow({ now, className }: { now: Date; className?: string }) {
  const phase = phaseOf(now);
  const pos = skyPosition(now);
  const night = phase === 'night';
  return (
    <div aria-hidden="true" className={cn('relative mx-auto w-full max-w-[400px] select-none pt-4', className)}>
      {/* La barra de la cortina */}
      <span className="lq-rod absolute -left-3 -right-3 top-1 z-[2] block h-2 rounded-full" />
      <motion.div
        className="lq-window-frame relative aspect-[16/10] overflow-hidden rounded-t-[7rem] md:aspect-[4/3.2]"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0, transition: { ...springs.gentle, opacity: { duration: 0.5 } } }}
      >
        {/* El cielo de esta hora */}
        <div className="lq-sky absolute inset-0" data-phase={phase}>
          {night && STARS.map((s, i) => (
            <span key={i} className="lq-p lq-p-glow block rounded-full bg-white" style={{ '--x': `${s.x}%`, '--y': `${s.y}%`, width: s.s, height: s.s, '--d': `${s.d}s`, '--delay': `${s.delay}s`, '--a': s.a, '--sx': '0px', '--sy': '0px' } as CSSProperties} />
          ))}
          {/* El sol o la luna, en su punto del arco: sube a su sitio al llegar */}
          <span
            className="absolute block size-14 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, transition: 'left 2s ease-in-out, top 2s ease-in-out' }}
          >
            <motion.span
              className={cn('block size-full rounded-full', pos.night ? 'lq-moon' : 'lq-sun-disc')}
              initial={{ opacity: 0, y: 26, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { ...springs.gentle, delay: 0.35 } }}
            />
          </span>
          {/* Nubes que pasan muy despacio */}
          <Cloud className="top-[16%] h-7 w-24 [--cd:84s] [--cdelay:-20s]" />
          <Cloud className="top-[34%] h-5 w-16 opacity-80 [--cd:110s] [--cdelay:-70s]" />
          <Cloud className="top-[8%] h-4 w-12 opacity-60 [--cd:140s] [--cdelay:-35s]" />
          {/* Colinas a lo lejos */}
          <svg viewBox="0 0 400 120" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[34%] w-full">
            <path d="M0 70C60 40 120 52 180 62s130-34 220-8V120H0Z" className="lq-view-hill-far" data-phase={phase} />
            <path d="M0 92c70-26 150-16 220-4s120 6 180-10V120H0Z" className="lq-view-hill-near" data-phase={phase} />
          </svg>
          {/* Reflejo en el vidrio */}
          <span className="lq-glass-glint absolute inset-y-0 left-0 block w-1/3" />
        </div>
        {/* Parteluz y travesaño del marco */}
        <span className="lq-muntin absolute inset-y-0 left-1/2 block w-2 -translate-x-1/2" />
        <span className="lq-muntin absolute inset-x-0 top-[58%] block h-2" />
      </motion.div>
      {/* Cortinas: se abren al llegar y luego se mecen con la brisa */}
      {(['left', 'right'] as const).map((side) => (
        <motion.span
          key={side}
          className={cn('absolute bottom-3 top-2 z-[1] block w-[21%]', side === 'left' ? '-left-2 origin-left' : '-right-2 origin-right')}
          initial={{ scaleX: 2.2 }}
          animate={{ scaleX: 1, transition: { ...springs.gentle, delay: 0.15 } }}
        >
          <span className={cn('lq-curtain lq-curtain-sway block size-full', side === 'right' && 'lq-curtain-r')} style={{ animationDelay: side === 'left' ? '0s' : '-3.5s' }} />
        </motion.span>
      ))}
      {/* El alféizar con la planta y la taza */}
      <div className="relative z-[2] -mx-4 -mt-1">
        <span className="lq-sill block h-3.5 rounded-md" />
        <span className="absolute bottom-3 left-6 block"><Plant /></span>
        <span className="absolute bottom-3 right-8 block"><Mug /></span>
      </div>
    </div>
  );
}

/**
 * La luz de la ventana en la sala: un rectángulo de sol que cae hacia el lado
 * opuesto al sol (su ángulo sigue la hora) con motas de polvo; de noche, la
 * lámpara. Va en el ambiente de la zona.
 */
export function RoomLight({ now }: { now: Date }) {
  const phase = phaseOf(now);
  const pos = skyPosition(now);
  const lean = (pos.x - 50) * -0.5;
  return (
    <>
      {/* La lámpara de la sala: tenue de día, la luz principal de noche */}
      <AmbientLight tone="warning" alpha={phase === 'night' ? 0.13 : 0.06} darkAlpha={phase === 'night' ? 0.1 : 0.05} d={16} className="-left-[6%] top-0 h-[40rem] w-[58%]" />
      {phase !== 'night' && (
        <motion.span
          className="lq-sunpatch absolute right-[2%] top-[6%] block h-[40rem] w-[46%]"
          data-phase={phase}
          style={{ rotate: lean }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 1.6, delay: 0.6 } }}
        />
      )}
    </>
  );
}
