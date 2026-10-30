// Vitrina 3D de Logros: una medalla, una copa y una estrella esculpidas en Blender, con acabado
// metálico y borde de neón del tema. El metal sigue tu avance: bronce hasta un tercio de los
// logros, plata hasta dos tercios, oro hasta completarlos y platino con todos. Se agarran, se
// lanzan y vuelven a su sitio girando. three.js solo se descarga cerca de la pantalla; sin
// WebGL 2 la vitrina no aparece (el contador de debajo dice lo mismo).
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import trophiesUrl from '@/assets/models/props-trophies.glb?url';
import trophiesHdUrl from '@/assets/models/props-trophies-hd.glb?url';
import { hasWebGL2, useNear } from '@/components/three3d/near';
import type { PropShelf3DProps } from '@/components/three3d/PropShelf3D';
import type { Achievement } from '@/services/achievement.service';
import { useLocale, useText, type Copy } from '@/lib/i18n';
import { achievementText } from './achievementText';
import { trophyTier, type TrophyTier } from './trophyTier';

// sRGB; el oro es el del tema (sin tinte).
const METAL: Record<TrophyTier, string | undefined> = { bronze: '#b97a48', silver: '#c8d0d8', gold: undefined, platinum: '#dfeef2' };

const es = {
  tiers: { bronze: 'Bronce', silver: 'Plata', gold: 'Oro', platinum: 'Platino' } as Record<TrophyTier, string>,
  tierLine: (tier: string) => `Vitrina de ${tier.toLowerCase()}`,
  cup: (n: number, total: number) => `${n} de ${total} logros`,
  next: 'Tu próxima medalla',
  star: (pct: number) => `${pct}% de la vitrina`,
};
const en: typeof es = {
  tiers: { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum' },
  tierLine: (tier) => `${tier} showcase`,
  cup: (n, total) => `${n} of ${total} achievements`,
  next: 'Your next medal',
  star: (pct) => `${pct}% of the showcase`,
};
const COPY: Copy<typeof es> = { es, en };

const PropShelf3D = lazy<ComponentType<PropShelf3DProps>>(() => import('@/components/three3d/PropShelf3D').catch(() => ({
  default: ({ onUnavailable }: PropShelf3DProps) => { useEffect(onUnavailable, []); return null; },
})));

export function TrophyShowcase({ list }: { list: Achievement[] }) {
  const t = useText(COPY);
  const locale = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const near = useNear(ref);
  const [ok, setOk] = useState(hasWebGL2);
  const unlocked = list.filter((a) => a.unlocked);
  const share = list.length ? unlocked.length / list.length : 0;
  const tier = trophyTier(share);
  const latest = [...unlocked].sort((a, b) => (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? ''))[0];
  const metal = METAL[tier];
  const items = useMemo(() => [
    { id: 'medal', model: 'medal', rest: [0.1, 0.35, 0] as [number, number, number], size: 0.95, spin: 0.5, label: latest ? achievementText(latest, locale).title : t.next, tint: metal ? { metal } : undefined },
    { id: 'cup', model: 'cup', rest: [0.08, 0, 0] as [number, number, number], size: 1.2, spin: 0.3, label: t.cup(unlocked.length, list.length), tint: metal ? { metal } : undefined },
    { id: 'star', model: 'star', rest: [0.15, -0.3, 0.1] as [number, number, number], size: 0.9, spin: 0.6, label: t.star(Math.round(share * 100)), tint: metal ? { metal } : undefined },
  ], [locale, tier, unlocked.length, list.length, latest?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ok) return null;
  return (
    <div ref={ref} className="relative mb-2 h-[200px] sm:h-[230px] md:mb-4 md:h-[250px]">
      <span aria-hidden className="lq-trophy-spot pointer-events-none absolute inset-0" />
      {near && (
        <Suspense fallback={null}>
          {/* La clave fuerza una vitrina nueva si cambia el metal (otro nivel de logros). */}
          <PropShelf3D key={tier} url={trophiesUrl} hdUrl={trophiesHdUrl} items={items} columns={() => 3} onUnavailable={() => setOk(false)} />
        </Suspense>
      )}
      <span className="sr-only">{t.tierLine(t.tiers[tier])}</span>
      <span aria-hidden className="lq-brass absolute bottom-1 left-1/2 -translate-x-1/2 px-3 py-0.5 text-label-md">{t.tiers[tier]}</span>
    </div>
  );
}
