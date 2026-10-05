// Jardín zen de cada ritual: arena rastrillada en líneas paralelas y, alrededor
// de cada piedra (un paso), anillos concéntricos que se dibujan al llegar. Las
// piedras caen y se asientan; con el ritual hecho hoy les crece musgo y al
// completarlo una onda recorre la arena desde cada piedra. También el bambú que
// se mece junto al título. Decorativo (aria-hidden): los pasos se leen en la lista.
import { useMemo, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';
import { seeded } from '@/components/ambience';

export function ZenGarden({ steps, done, celebrate, seed = 1, className }: { steps: number; done?: boolean; celebrate?: boolean; seed?: number; className?: string }) {
  const stones = useMemo(() => {
    const rnd = seeded(seed * 97 + steps);
    const n = Math.max(1, Math.min(steps, 6));
    return Array.from({ length: n }, (_, i) => ({
      x: n === 1 ? 150 : 46 + (i * 208) / (n - 1),
      y: 62 + Math.sin(i * 1.4 + seed) * 20,
      rx: 13 + rnd() * 7,
      ry: 9 + rnd() * 4,
      tilt: -18 + rnd() * 36,
      shade: i % 3,
    }));
  }, [steps, seed]);
  return (
    <svg aria-hidden="true" viewBox="0 0 300 124" preserveAspectRatio="xMidYMid slice" className={cn('lq-sand block w-full overflow-hidden rounded-lg', className)}>
      {/* Rastrillado paralelo */}
      <g className="lq-rake">
        {Array.from({ length: 16 }, (_, k) => <path key={k} d={`M-10 ${6 + k * 8}C80 ${4 + k * 8} 200 ${9 + k * 8} 310 ${6 + k * 8}`} strokeWidth={1.1} fill="none" />)}
      </g>
      {stones.map((s, i) => (
        <g key={i}>
          {/* Alrededor de la piedra la arena se rastrilla en círculos */}
          <ellipse cx={s.x} cy={s.y} rx={s.rx + 30} ry={s.ry + 26} className="lq-sand-fill" />
          {[10, 18, 26].map((d, k) => (
            <motion.ellipse
              key={k} cx={s.x} cy={s.y} rx={s.rx + d} ry={s.ry + d * 0.82} fill="none" strokeWidth={1.1} className="lq-rake-ring"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1, transition: { pathLength: { duration: 0.9, delay: 0.5 + i * 0.18 + k * 0.1, ease: [0.45, 0.05, 0.25, 1] }, opacity: { duration: 0.1, delay: 0.5 + i * 0.18 + k * 0.1 } } }}
            />
          ))}
          {/* Al completar el ritual, una onda sale de cada piedra */}
          {celebrate && (
            <ellipse cx={s.x} cy={s.y} rx={s.rx + 10} ry={s.ry + 8} fill="none" strokeWidth={2} className="lq-ripple lq-zen-wave" style={{ animationDelay: `${i * 0.12}s`, transformOrigin: 'center' } as CSSProperties} />
          )}
          {/* La piedra cae y se asienta */}
          <motion.g initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1, transition: { ...springs.heavy, delay: 0.3 + i * 0.16, opacity: { duration: 0.2, delay: 0.3 + i * 0.16 } } }}>
            <ellipse cx={s.x + 2} cy={s.y + 4} rx={s.rx} ry={s.ry * 0.7} className="fill-black/15" />
            <ellipse cx={s.x} cy={s.y} rx={s.rx} ry={s.ry} transform={`rotate(${s.tilt} ${s.x} ${s.y})`} className={['fill-jade-700', 'fill-jade-800', 'fill-jade-600'][s.shade]} />
            <ellipse cx={s.x - s.rx * 0.3} cy={s.y - s.ry * 0.35} rx={s.rx * 0.45} ry={s.ry * 0.3} transform={`rotate(${s.tilt} ${s.x} ${s.y})`} className="fill-white/20" />
            {/* Musgo: crece cuando el ritual ya está hecho hoy */}
            <motion.ellipse
              cx={s.x + s.rx * 0.2} cy={s.y + s.ry * 0.45} rx={s.rx * 0.7} ry={s.ry * 0.38} className="fill-success"
              initial={false} animate={{ opacity: done || celebrate ? 0.9 : 0, scale: done || celebrate ? 1 : 0.4 }}
              transition={{ ...springs.gentle, delay: celebrate ? 0.2 + i * 0.12 : 0 }}
              style={{ originX: `${s.x}px`, originY: `${s.y}px` }}
            />
          </motion.g>
        </g>
      ))}
    </svg>
  );
}

/** Bambú: tres cañas que se mecen despacio con sus hojas. */
export function Bamboo({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('pointer-events-none flex items-end gap-3', className)}>
      {[[180, 9, 0], [230, 11, -2.6], [150, 8, -5.2]].map(([h, w, delay], k) => (
        <span key={k} className="lq-amb-sway block origin-bottom [--o:50%_100%] [--r:1.6deg]" style={{ ['--d' as string]: `${7 + k * 1.3}s`, animationDelay: `${delay}s` }}>
          <svg viewBox={`0 0 40 ${h}`} style={{ height: h, width: 40 }} className="block overflow-visible">
            <rect x={20 - w / 2} y="0" width={w} height={h} rx={w / 2} className="lq-cane" />
            {Array.from({ length: Math.floor(h / 46) }, (_, j) => <rect key={j} x={20 - w / 2 - 1} y={34 + j * 46} width={w + 2} height="3" rx="1.5" className="lq-cane-node" />)}
            <path d={`M20 ${h * 0.22}C32 ${h * 0.16} 40 ${h * 0.18} 46 ${h * 0.12}C38 ${h * 0.2} 30 ${h * 0.23} 20 ${h * 0.25}Z`} className="lq-leaf" />
            <path d={`M20 ${h * 0.42}C8 ${h * 0.36} 0 ${h * 0.38} -6 ${h * 0.32}C2 ${h * 0.4} 10 ${h * 0.44} 20 ${h * 0.45}Z`} className="lq-leaf" />
          </svg>
        </span>
      ))}
    </span>
  );
}
