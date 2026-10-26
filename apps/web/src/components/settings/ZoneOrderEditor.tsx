// Ajustes → Zonas: una sola lista arrastrable con todas las zonas. Las
// PINNED_COUNT primeras son las principales (TabBar / Sidebar, entre Inicio y
// Perfil); el resto va a "Más zonas". Se arrastra por el asa (ratón o dedo) o se
// mueve con los botones subir/bajar (teclado y lectores de pantalla). Cada zona de
// «Más zonas» tiene un interruptor para mostrarla u ocultarla en la navegación.
import { useState } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { ChevronDown, ChevronUp, GripVertical, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { DEFAULT_ORDER, PINNED_COUNT, useNavStore } from '@/store/navStore';
import { localizedNavCatalog, resolveOrder, useCustomZoneEntries, useUnavailableZones, type NavEntry } from '@/components/layout/nav';
import { Badge, Button, Card, Switch } from '@/components/ui/lq';
import { useLocale, useText, type Copy } from '@/lib/i18n';

const COPY: Copy<{
  more: string; primary: (n: number) => string; show: (l: string) => string; up: (l: string) => string; down: (l: string) => string;
  nav: string; title: string; intro: (n: number) => string; visible: (v: number, total: number) => string; principal: string;
  reset: string; restored: string; order: string; mainZone: string; inMore: string; position: (l: string, n: number, where: string) => string;
  hiddenMsg: (l: string, on: boolean) => string;
}> = {
  es: {
    more: 'Más zonas', primary: (n) => `Principal ${n}`, show: (l) => `Mostrar ${l} en la navegación`,
    up: (l) => `Subir ${l}`, down: (l) => `Bajar ${l}`, nav: 'Navegación', title: 'Zonas principales',
    intro: (n) => `Las ${n} primeras aparecen en la barra principal, entre Inicio y Perfil. Arrastra desde el asa para cambiarlas u ordenarlas; el resto queda en «Más zonas», donde puedes ocultar las que no uses.`,
    visible: (v, total) => `${v} de ${total} visibles`, principal: 'Principales', reset: 'Restablecer', restored: 'Zonas restablecidas',
    order: 'Orden de zonas', mainZone: ', zona principal', inMore: ', en Más zonas',
    position: (l, n, where) => `${l}: posición ${n}${where}`,
    hiddenMsg: (l, on) => `${l} ${on ? 'visible' : 'oculta'} en la navegación`,
  },
  en: {
    more: 'More zones', primary: (n) => `Main ${n}`, show: (l) => `Show ${l} in the navigation`,
    up: (l) => `Move ${l} up`, down: (l) => `Move ${l} down`, nav: 'Navigation', title: 'Main zones',
    intro: (n) => `The first ${n} appear in the main bar, between Home and Profile. Drag the handle to change or reorder them; the rest stay under “More zones”, where you can hide the ones you don’t use.`,
    visible: (v, total) => `${v} of ${total} visible`, principal: 'Main', reset: 'Reset', restored: 'Zones reset',
    order: 'Zone order', mainZone: ', main zone', inMore: ', in More zones',
    position: (l, n, where) => `${l}: position ${n}${where}`,
    hiddenMsg: (l, on) => `${l} ${on ? 'shown' : 'hidden'} in the navigation`,
  },
};

interface ZoneRowProps {
  zone: NavEntry; index: number; total: number; hidden: boolean;
  onMove: (from: number, to: number) => void;
  onToggle: (visible: boolean) => void;
  t: typeof COPY.es;
}

function ZoneRow({ zone, index, total, hidden, onMove, onToggle, t }: ZoneRowProps) {
  const controls = useDragControls();
  const pinned = index < PINNED_COUNT;
  const switchId = `zone-${zone.to.replace(/W/g, '')}`;
  const Icon = zone.icon;
  return (
    <Reorder.Item
      as="li"
      value={zone.to}
      dragListener={false}
      dragControls={controls}
      className="relative list-none"
      whileDrag={{ scale: 1.02, zIndex: 10 }}
    >
      {index === PINNED_COUNT && (
        <p className="px-1 pb-2 pt-4 text-label-md uppercase text-on-surface-light">{t.more}</p>
      )}
      <div
        className={cn(
          'flex min-h-14 select-none items-center gap-2 rounded-2xl border px-2 sm:gap-3 sm:px-3',
          pinned ? 'border-primary/30 bg-primary/[var(--lq-soft-alpha)]' : 'border-border bg-surface',
          'transition-opacity duration-300',
          !pinned && hidden && 'opacity-55',
        )}
      >
        <span
          aria-hidden
          onPointerDown={(e) => controls.start(e)}
          className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl text-on-surface-light active:cursor-grabbing"
        >
          <GripVertical className="size-5" strokeWidth={1.75} />
        </span>
        <Icon aria-hidden className={cn('size-5 shrink-0', pinned ? 'text-primary-text' : 'text-on-surface')} strokeWidth={1.75} />
        <label htmlFor={pinned ? undefined : switchId} className="min-w-0 flex-1 truncate text-label-lg">{zone.label}</label>
        {pinned
          ? <Badge variant="primary" className="hidden sm:inline-flex">{t.primary(index + 1)}</Badge>
          : <Switch id={switchId} checked={!hidden} onChange={(e) => onToggle(e.target.checked)} aria-label={t.show(zone.label)} />}
        <span className="flex shrink-0">
          <Button variant="icon" aria-label={t.up(zone.label)} disabled={index === 0} onClick={() => onMove(index, index - 1)}>
            <ChevronUp aria-hidden className="size-5" strokeWidth={1.75} />
          </Button>
          <Button variant="icon" aria-label={t.down(zone.label)} disabled={index === total - 1} onClick={() => onMove(index, index + 1)}>
            <ChevronDown aria-hidden className="size-5" strokeWidth={1.75} />
          </Button>
        </span>
      </div>
    </Reorder.Item>
  );
}

export function ZoneToggleList() {
  const t = useText(COPY);
  const locale = useLocale();
  const userId = String(useAuthStore((s) => s.user?.id) ?? 'anon');
  const stored = useNavStore((s) => s.byUser[userId]);
  const setOrder = useNavStore((s) => s.setOrder);
  const hidden = new Set(useNavStore((s) => s.hiddenByUser?.[userId]) ?? []);
  const setHidden = useNavStore((s) => s.setHidden);
  const extra = useCustomZoneEntries();
  const byTo = new Map([...localizedNavCatalog(locale), ...extra].map((z) => [z.to, z]));
  const unavailable = useUnavailableZones();
  const order = resolveOrder(stored, extra, unavailable);
  const [announce, setAnnounce] = useState('');

  const save = (next: string[]) => setOrder(userId, next);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    save(next);
    const label = byTo.get(it)?.label ?? '';
    setAnnounce(t.position(label, to + 1, to < PINNED_COUNT ? t.mainZone : t.inMore));
  };

  const pinnedSet = new Set(order.slice(0, PINNED_COUNT));
  const visible = order.filter((to) => pinnedSet.has(to) || !hidden.has(to)).length;

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-label-lg text-primary-text">{t.nav}</p>
          <h2 className="text-heading-sm">{t.title}</h2>
          <p className="mt-1 max-w-xl text-body-sm text-on-surface-light">{t.intro(PINNED_COUNT)}</p>
        </div>
        <Badge variant="primary" size="lg" className="font-mono tabular-nums">{t.visible(visible, order.length)}</Badge>
        <Button variant="secondary" size="sm" onClick={() => { save(resolveOrder(DEFAULT_ORDER, extra, unavailable)); setAnnounce(t.restored); }}>
          <RotateCcw aria-hidden className="size-4" strokeWidth={1.75} />
          {t.reset}
        </Button>
      </div>
      <p className="text-label-md uppercase text-on-surface-light">{t.principal}</p>
      <Reorder.Group as="ol" axis="y" values={order} onReorder={save} aria-label={t.order} className="-mt-2 flex flex-col gap-2">
        {order.map((to, i) => {
          const zone = byTo.get(to);
          return zone ? (
            <ZoneRow
              key={to} zone={zone} index={i} total={order.length} hidden={hidden.has(to)} onMove={move} t={t}
              onToggle={(on) => { setHidden(userId, to, !on); setAnnounce(t.hiddenMsg(zone.label, on)); }}
            />
          ) : null;
        })}
      </Reorder.Group>
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>
    </Card>
  );
}

/** Nombre anterior (Ajustes → Zonas). */
export const ZoneOrderEditor = ZoneToggleList;
