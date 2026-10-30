// Tarjeta «Mapa 3D» de Estadísticas: el mapa de zonas en relieve (WebGL) y, al lado, un
// resumen accesible con botones para recorrer las zonas. three.js solo se descarga cuando la
// tarjeta se acerca a la pantalla; sin WebGL 2 la tarjeta no aparece (las tarjetas de zona
// siguen mostrando los mismos datos).
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { useInView } from 'framer-motion';
import { ChevronLeft, ChevronRight, Hand, X } from 'lucide-react';
import { useText, type Copy } from '@/lib/i18n';
import { zoneColumns, type ZoneLike } from './statsMath';
import { GlowMeter } from './StatsDepth';
import type { ZoneMap3DProps } from './zones3d/ZoneMap3D';

const es = {
  eyebrow: 'Mapa 3D',
  title: 'Tus zonas en relieve',
  hint: 'Cada columna es una zona: su altura es el ritmo y las que brillan tienen registros. El cristal del centro crece con tu Life Score.',
  lifeScore: 'Life Score',
  pick: 'Toca una columna o usa las flechas para ver cada zona.',
  pace: 'Ritmo',
  noPace: 'Sin ritmo medible',
  prev: 'Zona anterior',
  next: 'Zona siguiente',
  clear: 'Ver todas',
  drag: 'Arrastra para girar',
};
const en: typeof es = {
  eyebrow: '3D map',
  title: 'Your zones in relief',
  hint: 'Each column is a zone: its height is the pace, and the glowing ones have records. The crystal in the middle grows with your Life Score.',
  lifeScore: 'Life Score',
  pick: 'Tap a column or use the arrows to see each zone.',
  pace: 'Pace',
  noPace: 'No measurable pace',
  prev: 'Previous zone',
  next: 'Next zone',
  clear: 'See all',
  drag: 'Drag to turn',
};
const COPY: Copy<typeof es> = { es, en };

// three.js solo se descarga si la tarjeta llega a montarse.
const ZoneMap3D = lazy<ComponentType<ZoneMap3DProps>>(() => import('./zones3d/ZoneMap3D').catch(() => ({
  default: ({ onUnavailable }: ZoneMap3DProps) => { useEffect(onUnavailable, []); return null; },
})));

export interface ZoneMapCardProps {
  zones: Array<ZoneLike & { activityLabel: string }>;
  score: number;
}

export function ZoneMapCard({ zones, score }: ZoneMapCardProps) {
  const t = useText(COPY);
  const ref = useRef<HTMLElement>(null);
  const near = useInView(ref, { once: true, margin: '320px 0px' });
  const [ok, setOk] = useState(() => typeof window !== 'undefined' && 'WebGL2RenderingContext' in window);
  const [selected, setSelected] = useState<string | null>(null);
  const columns = useMemo(() => zoneColumns(zones), [zones]);
  const shown = useMemo(() => columns.map((c) => zones.find((z) => z.id === c.id)!).filter(Boolean), [columns, zones]);
  const zone = shown.find((z) => z.id === selected) ?? null;

  // Un cambio de periodo puede dejar fuera la zona elegida.
  useEffect(() => { if (selected && !shown.some((z) => z.id === selected)) setSelected(null); }, [selected, shown]);

  if (!ok || columns.length === 0) return null;

  const cycle = (dir: 1 | -1) => {
    const i = shown.findIndex((z) => z.id === selected);
    const next = i < 0 ? (dir > 0 ? 0 : shown.length - 1) : (i + dir + shown.length) % shown.length;
    setSelected(shown[next].id);
  };

  return (
    <section ref={ref} aria-labelledby="zone-map-t" className="lq-glass3d grid md:grid-cols-[minmax(0,1fr)_minmax(250px,300px)]">
      <div className="relative h-[280px] sm:h-[320px] md:h-auto md:min-h-[360px]">
        {near && (
          <Suspense fallback={null}>
            <ZoneMap3D
              columns={columns}
              score={score}
              selected={selected}
              onSelect={setSelected}
              onUnavailable={() => setOk(false)}
              tag={zone && <><span className="truncate">{zone.name}</span>{zone.scoreAvailable && <span className="font-mono tabular-nums text-primary-text">{Math.round(zone.score)}%</span>}</>}
            />
          </Suspense>
        )}
        {/* Solo para puntero: con teclado se recorre con las flechas de la tarjeta. */}
        <span aria-hidden className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-background/70 px-2.5 py-1 text-caption text-on-surface-light">
          <Hand className="size-3.5" strokeWidth={1.75} />{t.drag}
        </span>
      </div>
      <div className="flex flex-col gap-3 border-t border-on-background/[.07] p-5 md:border-l md:border-t-0 md:p-6">
        <span className="text-label-md font-semibold uppercase tracking-[.08em] text-primary-text">{t.eyebrow}</span>
        <h2 id="zone-map-t" className="text-heading-sm">{t.title}</h2>
        <p className="text-body-sm text-on-surface-light">{t.hint}</p>
        <div aria-live="polite" className="lq-well flex min-h-[96px] flex-col justify-center gap-2 px-4 py-3">
          {zone ? (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-label-lg md:text-body-md md:font-semibold">{zone.name}</span>
                <span className="shrink-0 font-mono text-label-lg tabular-nums">{zone.scoreAvailable ? `${Math.round(zone.score)}%` : '—'}</span>
              </div>
              <GlowMeter value={zone.scoreAvailable ? zone.score : 0} active />
              <span className="line-clamp-2 text-caption text-on-surface-light">{zone.scoreAvailable ? `${t.pace} · ${zone.activityLabel}` : `${t.noPace} · ${zone.activityLabel}`}</span>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="lq-emboss font-mono text-heading-lg font-bold leading-none tabular-nums">{score}</span>
                <span className="text-body-sm text-on-surface-light">{t.lifeScore}</span>
              </div>
              <span className="text-caption text-on-surface-light">{t.pick}</span>
            </>
          )}
        </div>
        <div className="mt-auto flex items-center gap-2 pt-1">
          <button type="button" className="lq-flip-chip px-2.5" aria-label={t.prev} onClick={() => cycle(-1)}><ChevronLeft aria-hidden className="size-4" strokeWidth={2} /></button>
          <button type="button" className="lq-flip-chip px-2.5" aria-label={t.next} onClick={() => cycle(1)}><ChevronRight aria-hidden className="size-4" strokeWidth={2} /></button>
          {zone && <button type="button" className="lq-flip-chip" onClick={() => setSelected(null)}><X aria-hidden className="size-4" strokeWidth={2} />{t.clear}</button>}
        </div>
      </div>
    </section>
  );
}
