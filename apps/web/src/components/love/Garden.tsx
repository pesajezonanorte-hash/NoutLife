// Jardín de Relaciones: cada fecha especial es una flor. Los tallos crecen
// (trazo SVG) y las flores se abren en secuencia; se mecen al pasar el cursor,
// sueltan pétalos al tocarlas y la próxima fecha (en 7 días o menos) late
// suave. Una fecha recién añadida brota delante de ti. Cada flor es un botón
// que lleva a su fila en la lista.
import { useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';
import { InkPath } from '@/components/ambience';

export interface GardenDate { id: string; label: string; days: number }

const PETAL_TONES = ['fill-error', 'fill-warning', 'fill-secondary', 'fill-error/70', 'fill-warning/80'];
const PETALS = Array.from({ length: 6 }, (_, i) => ({ tx: `${Math.cos((i / 6) * Math.PI * 2) * 26}px`, ty: `${Math.sin((i / 6) * Math.PI * 2) * 22 + 10}px` }));

function Flower({ d, i, total, fresh, onPick }: { d: GardenDate; i: number; total: number; fresh: boolean; onPick: () => void }) {
  const [burst, setBurst] = useState(0);
  const soon = d.days >= 0 && d.days <= 7;
  // Las fechas cercanas crecen más alto.
  const stem = 46 + Math.max(0, 40 - Math.min(40, Math.max(0, d.days) / 9));
  const x = ((i + 0.5) / total) * 100;
  const delay = fresh ? 0.2 : 0.25 + i * 0.18;
  const tone = PETAL_TONES[i % PETAL_TONES.length];
  const when = d.days >= 0 ? `en ${d.days} ${d.days === 1 ? 'día' : 'días'}` : `hace ${-d.days} días`;
  return (
    <button
      type="button"
      onClick={() => { setBurst((n) => n + 1); onPick(); }}
      aria-label={`${d.label}, ${when}. Ver en la lista`}
      className="group absolute bottom-3 flex -translate-x-1/2 flex-col items-center rounded-full"
      style={{ left: `${x}%`, height: stem + 34, width: 52 }}
    >
      <svg aria-hidden="true" viewBox={`0 0 52 ${stem + 34}`} className="lq-flower absolute inset-0 overflow-visible" style={{ ['--r' as string]: '3deg', transformOrigin: '50% 100%' }}>
        {/* Tallo y hoja */}
        <g className="text-success">
          <InkPath d={`M26 ${stem + 34}C24 ${stem + 10} 29 ${stem * 0.55} 26 26`} delay={delay} duration={0.8} strokeWidth={2.2} />
          <InkPath d={`M26 ${stem * 0.75 + 20}C34 ${stem * 0.7 + 14} 40 ${stem * 0.68 + 12} 42 ${stem * 0.6 + 12}`} delay={delay + 0.35} duration={0.4} strokeWidth={1.8} />
        </g>
        {/* Flor: se abre al terminar de crecer el tallo; late si la fecha está cerca */}
        <motion.g
          initial={{ scale: 0, rotate: -40 }}
          animate={{ scale: 1, rotate: 0, transition: { ...springs.heavy, delay: delay + 0.65 } }}
          style={{ originX: '26px', originY: '22px' }}
        >
          <g className={cn(soon && 'lq-heartbeat')} style={{ transformOrigin: '26px 22px' }}>
            {Array.from({ length: 5 }, (_, k) => {
              const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
              return <ellipse key={k} cx={26 + Math.cos(a) * 8} cy={22 + Math.sin(a) * 8} rx={6.5} ry={5} transform={`rotate(${(a * 180) / Math.PI + 90} ${26 + Math.cos(a) * 8} ${22 + Math.sin(a) * 8})`} className={tone} />;
            })}
            <circle cx={26} cy={22} r={4.2} className="fill-secondary-text" />
          </g>
        </motion.g>
      </svg>
      {/* Pétalos que salen al tocar */}
      {burst > 0 && (
        <span key={burst} aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[18px]">
          {PETALS.map((p, k) => (
            <span key={k} className={cn('lq-burst absolute -ml-1 -mt-1 block size-2 rounded-[60%_40%]', k % 2 ? 'bg-error/70' : 'bg-warning/80')} style={{ '--tx': p.tx, '--ty': p.ty, '--delay': '0s' } as CSSProperties} />
          ))}
        </span>
      )}
    </button>
  );
}

export function Garden({ dates, fresh, onPick }: { dates: GardenDate[]; fresh?: string | null; onPick: (id: string) => void }) {
  const shown = dates.slice(0, 7);
  if (!shown.length) return null;
  return (
    <div className="relative h-44 overflow-hidden rounded-2xl border border-border bg-[linear-gradient(180deg,rgb(var(--lq-warning)/.10),rgb(var(--lq-error)/.05)_45%,transparent_70%)]">
      {/* Suelo */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 block h-6 bg-[linear-gradient(180deg,rgb(var(--lq-success)/.18),rgb(var(--lq-success)/.30))]" />
      {shown.map((d, i) => <Flower key={d.id} d={d} i={i} total={shown.length} fresh={fresh === d.id} onPick={() => onPick(d.id)} />)}
    </div>
  );
}
