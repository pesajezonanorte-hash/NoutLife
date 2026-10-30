// Repisa de hobbies (Recreación): un control, unos cascos, una paleta con pincel, una claqueta y
// un dado de rol en 3D (Blender) que flotan sobre la repisa. Se agarran, se lanzan y vuelven a
// su sitio con un muelle elástico, girando por la inercia. Tocar uno abre «Registrar función»
// con su tipo ya elegido; los botones de debajo hacen lo mismo con teclado y lector de
// pantalla. three.js solo se descarga cuando la repisa se acerca a la pantalla; sin WebGL 2
// quedan los botones.
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Hand } from 'lucide-react';
import hobbiesUrl from '@/assets/models/props-hobbies.glb?url';
import hobbiesHdUrl from '@/assets/models/props-hobbies-hd.glb?url';
import { hasWebGL2, useNear } from '@/components/three3d/near';
import type { PropShelf3DProps } from '@/components/three3d/PropShelf3D';
import type { RecreationKind } from '@/services/recreation.service';
import { useLocale, useText, type Copy } from '@/lib/i18n';
import { kindOf } from './recreationMeta';

const es = {
  eyebrow: 'Tu rincón',
  title: 'Repisa de hobbies',
  hint: 'Agárralos, lánzalos y suéltalos: cada objeto vuelve a su sitio. Toca uno para registrar ese tipo de ocio.',
  log: (k: string) => `Registrar ${k.toLowerCase()}`,
  dice: 'Juego de mesa o rol',
  drag: 'Arrastra y lanza',
  quick: 'Registrar por tipo',
};
const en: typeof es = {
  eyebrow: 'Your corner',
  title: 'Hobby shelf',
  hint: 'Grab them, throw them and let go: every object goes back to its spot. Tap one to log that kind of leisure.',
  log: (k) => `Log ${k.toLowerCase()}`,
  dice: 'Board or tabletop game',
  drag: 'Drag and throw',
  quick: 'Log by type',
};
const COPY: Copy<typeof es> = { es, en };

const PropShelf3D = lazy<ComponentType<PropShelf3DProps>>(() => import('@/components/three3d/PropShelf3D').catch(() => ({
  default: ({ onUnavailable }: PropShelf3DProps) => { useEffect(onUnavailable, []); return null; },
})));

/** Objeto de la repisa → tipo de ocio que registra. */
const SHELF: Array<{ kind: RecreationKind; model: string; rest: [number, number, number]; size?: number; spin?: number }> = [
  { kind: 'GAME', model: 'gamepad', rest: [0.2, -0.35, 0.05], size: 1.05, spin: 0.4 },
  { kind: 'MUSIC', model: 'headphones', rest: [0.05, 0.45, 0], spin: 0.3 },
  { kind: 'HOBBY', model: 'palette', rest: [-0.15, 0.3, 0.1], size: 1.05 },
  { kind: 'MOVIE', model: 'clapper', rest: [0.05, -0.4, 0], spin: 0.35 },
  { kind: 'OTHER', model: 'd20', rest: [0.35, 0.25, 0], size: 0.85, spin: 0.5 },
];

export function HobbyShelf({ onPick }: { onPick: (kind: RecreationKind) => void }) {
  const t = useText(COPY);
  const locale = useLocale();
  const ref = useRef<HTMLElement>(null);
  const near = useNear(ref);
  const [ok, setOk] = useState(hasWebGL2);
  const labelOf = (kind: RecreationKind) => (kind === 'OTHER' ? t.dice : kindOf(kind, locale).label);
  const items = useMemo(() => SHELF.map((s) => ({ id: s.kind, model: s.model, rest: s.rest, size: s.size, spin: s.spin, label: labelOf(s.kind) })), [locale]); // eslint-disable-line react-hooks/exhaustive-deps
  const latest = useRef(onPick);
  latest.current = onPick;

  return (
    <section ref={ref} aria-labelledby="hobby-shelf-t" className="lq-glass3d flex flex-col">
      <div className="flex flex-wrap items-end justify-between gap-2 px-5 pt-5">
        <div className="flex flex-col gap-1">
          <span className="text-label-md font-semibold uppercase tracking-[.08em] text-primary-text">{t.eyebrow}</span>
          <h2 id="hobby-shelf-t" className="text-heading-sm">{t.title}</h2>
        </div>
        <p className="max-w-[46ch] text-body-sm text-on-surface-light">{t.hint}</p>
      </div>
      {ok && (
        <div className="lq-shelf-stage relative h-[250px] sm:h-[270px] md:h-[300px]">
          {near && (
            <Suspense fallback={null}>
              <PropShelf3D
                url={hobbiesUrl} hdUrl={hobbiesHdUrl} items={items}
                columns={(aspect) => (aspect >= 1.6 ? 5 : 3)}
                onTap={(id) => latest.current(id as RecreationKind)}
                onUnavailable={() => setOk(false)}
              />
            </Suspense>
          )}
          <span aria-hidden className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-background/70 px-2.5 py-1 text-caption text-on-surface-light">
            <Hand className="size-3.5" strokeWidth={1.75} />{t.drag}
          </span>
        </div>
      )}
      <ul aria-label={t.quick} className="flex flex-wrap gap-2 border-t border-on-background/[.07] px-5 py-4">
        {SHELF.map((s) => {
          const Icon = kindOf(s.kind, locale).icon;
          return (
            <li key={s.kind}>
              <button type="button" className="lq-flip-chip" onClick={() => onPick(s.kind)}>
                <Icon aria-hidden className="size-4" strokeWidth={1.75} />{t.log(labelOf(s.kind))}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
