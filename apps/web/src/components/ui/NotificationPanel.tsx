// Campana + panel de notificaciones (rediseño). Sin prototipo propio: sigue el
// botón ícono del header de Dashboard.dc.html (punto error como indicador) y el
// patrón de popover/Sheet del sistema. Móvil → Sheet; md+ → popover anclado.
// El número llega en vivo (lib/live). Cada aviso lleva el ícono de su zona, se
// filtra por tipo, se toca para ir a su carta o zona, y en el móvil se desliza a
// la izquierda para borrarlo.
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Bell, BookOpen, Check, CheckCheck, Clock, Flame, Heart, Mail, Map as MapIcon, Megaphone, Moon, NotebookPen, Sparkles, Star, Swords, Target, Tent,
  Trash2, Trophy, UtensilsCrossed, Wallet, type LucideIcon,
} from 'lucide-react';
import { useLive } from '@/lib/live';
import { cn } from '@/lib/utils';
import { ease } from '@/lib/motion';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button, EmptyState, Sheet, Skeleton, type Tone } from '@/components/ui/lq';
import { softTone } from '@/components/ui/lq/tones';
import * as notifService from '../../services/notification.service';
import type { InAppNotification } from '../../services/notification.service';
import { syncAppBadge } from '@/lib/systemNotifications';
import { INTL_LOCALE, useLocale, useText, type Copy, type Locale } from '@/lib/i18n';

type Filter = 'all' | 'social' | 'reminders' | 'achievements';

const es = {
  now: 'hace un momento',
  minAgo: (n: number): string => `hace ${n} min`,
  hAgo: (n: number): string => `hace ${n} h`,
  dAgo: (n: number): string => `hace ${n} d`,
  today: 'Hoy',
  yesterday: 'Ayer',
  filters: { all: 'Todo', social: 'Mensajes y social', reminders: 'Recordatorios', achievements: 'Logros' } as Record<Filter, string>,
  markReadAria: (title: string): string => `Marcar como leída: ${title}`,
  deleteAria: (title: string): string => `Eliminar: ${title}`,
  unread: '(sin leer)',
  loadingAria: 'Cargando notificaciones',
  loadFail: 'No pudimos cargar tus notificaciones.',
  retry: 'Reintentar',
  emptyTitle: 'Todo al día',
  emptyDesc: 'Aquí verás mensajes, recordatorios de cada zona, logros y rachas.',
  showAria: 'Mostrar',
  nothing: 'Nada por aquí.',
  clearQ: '¿Eliminar todas las notificaciones?',
  clearBody: 'Se borra el historial de avisos y no se puede deshacer.',
  cancel: 'Cancelar',
  remove: 'Eliminar',
  loadMore: 'Cargar más',
  markAllAria: 'Marcar todas como leídas',
  deleteAllAria: 'Eliminar todas las notificaciones',
  bellUnread: (n: number): string => `Notificaciones, ${n} sin leer`,
  bell: 'Notificaciones',
};

const en: typeof es = {
  now: 'just now',
  minAgo: (n: number): string => `${n} min ago`,
  hAgo: (n: number): string => `${n} h ago`,
  dAgo: (n: number): string => `${n} d ago`,
  today: 'Today',
  yesterday: 'Yesterday',
  filters: { all: 'All', social: 'Messages and social', reminders: 'Reminders', achievements: 'Achievements' } as Record<Filter, string>,
  markReadAria: (title: string): string => `Mark as read: ${title}`,
  deleteAria: (title: string): string => `Delete: ${title}`,
  unread: '(unread)',
  loadingAria: 'Loading notifications',
  loadFail: 'We could not load your notifications.',
  retry: 'Try again',
  emptyTitle: 'All caught up',
  emptyDesc: 'Here you will see messages, reminders from each zone, achievements and streaks.',
  showAria: 'Show',
  nothing: 'Nothing here.',
  clearQ: 'Delete all notifications?',
  clearBody: 'This clears the alert history and cannot be undone.',
  cancel: 'Cancel',
  remove: 'Delete',
  loadMore: 'Load more',
  markAllAria: 'Mark all as read',
  deleteAllAria: 'Delete all notifications',
  bellUnread: (n: number): string => `Notifications, ${n} unread`,
  bell: 'Notifications',
};

const COPY: Copy<typeof es> = { es, en };

function timeAgo(iso: string, t: typeof es): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return t.now;
  if (diff < 3600) return t.minAgo(Math.floor(diff / 60));
  if (diff < 86400) return t.hAgo(Math.floor(diff / 3600));
  return t.dAgo(Math.floor(diff / 86400));
}

function dayLabel(iso: string, t: typeof es, locale: Locale): string {
  const date = new Date(iso);
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diff = Math.round((startToday - startDate) / 86_400_000);
  if (diff === 0) return t.today;
  if (diff === 1) return t.yesterday;
  return date.toLocaleDateString(INTL_LOCALE[locale], { day: 'numeric', month: 'long' });
}

// La API manda un emoji en `icon`; el rediseño no usa emojis → ícono por tipo.
const TYPE_ICON: Record<string, { icon: LucideIcon; tone: Tone }> = {
  achievement: { icon: Trophy, tone: 'warning' },
  streak: { icon: Flame, tone: 'error' },
  reminder: { icon: Clock, tone: 'info' },
  sage: { icon: Sparkles, tone: 'forest' },
  goal: { icon: Target, tone: 'primary' },
  levelup: { icon: Star, tone: 'warning' },
  level_up: { icon: Star, tone: 'warning' },
  quest_deadline: { icon: Target, tone: 'error' },
  quest_completed: { icon: Target, tone: 'success' },
  friend: { icon: Mail, tone: 'primary' },
  guild: { icon: Tent, tone: 'warning' },
  partner: { icon: Heart, tone: 'error' },
  guide: { icon: MapIcon, tone: 'forest' },
  daily_summary: { icon: Sparkles, tone: 'forest' },
  system: { icon: Megaphone, tone: 'muted' },
};
/** Los recordatorios llevan el ícono de su zona (por adónde llevan). */
const ZONE_ICON: Array<[string, { icon: LucideIcon; tone: Tone }]> = [
  // '/gym': avisos anteriores al renombre a Coliseo.
  ['/coliseo', { icon: Swords, tone: 'error' }], ['/gym', { icon: Swords, tone: 'error' }], ['/sleep', { icon: Moon, tone: 'info' }], ['/food', { icon: UtensilsCrossed, tone: 'warning' }],
  ['/journal', { icon: NotebookPen, tone: 'forest' }], ['/learning', { icon: BookOpen, tone: 'primary' }], ['/finances', { icon: Wallet, tone: 'success' }],
  ['/habits', { icon: Flame, tone: 'error' }], ['/social', { icon: Mail, tone: 'primary' }],
];
function iconOf(n: InAppNotification) {
  if (n.type === 'reminder' && n.link) {
    const z = ZONE_ICON.find(([p]) => n.link!.startsWith(p));
    if (z) return z[1];
  }
  return TYPE_ICON[n.type] ?? TYPE_ICON.system;
}
const FILTERS: Array<{ id: Filter; test: (n: InAppNotification) => boolean }> = [
  { id: 'all', test: () => true },
  { id: 'social', test: (n) => n.category === 'SOCIAL' },
  { id: 'reminders', test: (n) => n.type === 'reminder' || n.type === 'quest_deadline' },
  { id: 'achievements', test: (n) => n.category === 'ACHIEVEMENTS' || n.type === 'achievement' || n.type === 'levelup' },
];

function NotificationRow({ n, onOpen, onRead, onDelete }: {
  n: InAppNotification;
  onOpen: () => void;
  onRead: () => void;
  onDelete: () => void;
}) {
  const t = useText(COPY);
  const { icon: Icon, tone } = iconOf(n);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -60, transition: { duration: 0.15 } }}
      // En táctil: deslizar a la izquierda lo borra.
      drag="x" dragDirectionLock dragConstraints={{ left: 0, right: 0 }} dragElastic={{ left: 0.6, right: 0 }} dragSnapToOrigin
      onDragEnd={(_, info) => { if (info.offset.x < -110) onDelete(); }}
      style={{ touchAction: 'pan-y' }}
      className={cn('group flex items-start gap-1 rounded-xl pr-1 transition-colors hover:bg-surface-variant', !n.isRead && 'bg-primary/[0.05]')}
    >
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 rounded-xl p-3 text-left">
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', softTone[tone])}>
          <Icon aria-hidden className="size-5" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={cn('truncate text-label-lg', n.isRead ? 'text-on-surface' : 'text-on-background')}>{n.title}</span>
            {!n.isRead && (
              <>
                <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary" />
                <span className="sr-only">{t.unread}</span>
              </>
            )}
          </span>
          <span className="mt-0.5 line-clamp-2 block text-body-sm text-on-surface-light">{n.body}</span>
          <span className="mt-1 block text-caption text-on-surface-light">{timeAgo(n.createdAt, t)}</span>
        </span>
      </button>
      {/* Acciones visibles en hover/foco (desktop) y siempre en táctil. */}
      <span className="flex shrink-0 flex-col pt-1 md:opacity-0 md:transition-opacity md:group-focus-within:opacity-100 md:group-hover:opacity-100">
        {!n.isRead && (
          <Button variant="icon" aria-label={t.markReadAria(n.title)} onClick={onRead}>
            <Check aria-hidden className="size-5" strokeWidth={1.75} />
          </Button>
        )}
        <Button variant="icon" aria-label={t.deleteAria(n.title)} onClick={onDelete} className="hover:text-error-text">
          <Trash2 aria-hidden className="size-5" strokeWidth={1.75} />
        </Button>
      </span>
    </motion.li>
  );
}

function useNotifications(open: boolean) {
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // El número llega en vivo; al abrirse la app se pide una vez.
  const live = useLive((st) => st.notifications);
  useEffect(() => { notifService.getUnreadCount().then(setUnread).catch(() => null); }, []);
  useEffect(() => { if (typeof live === 'number') setUnread(live); }, [live]);
  // El número del icono de la app sigue a los avisos sin leer (el service worker lo sube al llegar uno).
  useEffect(() => { syncAppBadge(unread); }, [unread]);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    notifService.listInAppNotifications()
      .then(({ notifications, unread: u, nextCursor: cursor }) => {
        setItems(notifications);
        setUnread(u);
        setNextCursor(cursor);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);
  // Con el panel abierto, lo nuevo aparece solo.
  const prevLive = useRef(live);
  useEffect(() => {
    if (open && typeof live === 'number' && typeof prevLive.current === 'number' && live > prevLive.current) load();
    prevLive.current = live;
  }, [live, open, load]);

  return {
    unread, items, loading, failed, loadingMore, nextCursor, load,
    async markRead(id: string) {
      await notifService.markAsRead(id).catch(() => null);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
    },
    async markAll() {
      await notifService.markAllAsRead().catch(() => null);
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnread(0);
    },
    async remove(id: string) {
      await notifService.deleteNotification(id).catch(() => null);
      if (items.find((n) => n.id === id)?.isRead === false) setUnread((u) => Math.max(0, u - 1));
      setItems((prev) => prev.filter((n) => n.id !== id));
    },
    async removeAll() {
      await notifService.deleteAllNotifications().catch(() => null);
      setItems([]);
      setUnread(0);
      setNextCursor(null);
    },
    async loadMore() {
      if (!nextCursor || loadingMore) return;
      setLoadingMore(true);
      try {
        const page = await notifService.listInAppNotifications({ cursor: nextCursor });
        setItems((prev) => [...prev, ...page.notifications]);
        setUnread(page.unread);
        setNextCursor(page.nextCursor);
      } catch { /* se puede reintentar */ } finally {
        setLoadingMore(false);
      }
    },
  };
}

function PanelBody({ state, onNavigate, confirming, setConfirming }: {
  state: ReturnType<typeof useNotifications>;
  onNavigate: (link: string) => void;
  confirming: boolean;
  setConfirming: (v: boolean) => void;
}) {
  const t = useText(COPY);
  const locale = useLocale();
  const [filter, setFilter] = useState<Filter>('all');
  const test = FILTERS.find((f) => f.id === filter)!.test;
  const shown = state.items.filter(test);
  const groups = shown.reduce<Array<{ label: string; items: InAppNotification[] }>>((acc, n) => {
    const label = dayLabel(n.createdAt, t, locale);
    const g = acc.find((x) => x.label === label);
    if (g) g.items.push(n); else acc.push({ label, items: [n] });
    return acc;
  }, []);

  if (state.loading) {
    return (
      <div className="flex flex-col gap-3 p-2" aria-busy="true" aria-label={t.loadingAria}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-xl" />
            <div className="flex flex-1 flex-col gap-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-full" /></div>
          </div>
        ))}
      </div>
    );
  }
  if (state.failed) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 px-4 py-8 text-center">
        <p className="text-body-md text-on-surface">{t.loadFail}</p>
        <Button variant="secondary" size="sm" onClick={state.load}>{t.retry}</Button>
      </div>
    );
  }
  if (state.items.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        tone="muted"
        title={t.emptyTitle}
        description={t.emptyDesc}
        className="py-8"
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label={t.showAria} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
        {FILTERS.map((f) => {
          const n = state.items.filter((x) => f.test(x) && !x.isRead).length;
          return (
            <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} onClick={() => setFilter(f.id)}
              className={cn('flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-label-md transition-colors',
                filter === f.id ? 'border-primary bg-primary/10 text-primary-text' : 'border-border text-on-surface-light hover:text-on-surface')}>
              {t.filters[f.id]}{n > 0 && f.id !== 'all' && <span className="font-mono">{n}</span>}
            </button>
          );
        })}
      </div>
      {shown.length === 0 && <p className="px-3 py-6 text-center text-body-sm text-on-surface-light">{t.nothing}</p>}
      {confirming && (
        <div role="alertdialog" aria-labelledby="lq-clear-title" className="flex flex-col gap-3 rounded-2xl border border-error/30 bg-error/[var(--lq-soft-alpha)] p-4">
          <p id="lq-clear-title" className="text-label-lg text-error-text">{t.clearQ}</p>
          <p className="text-body-sm text-on-surface">{t.clearBody}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" data-autofocus onClick={() => setConfirming(false)}>{t.cancel}</Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => { void state.removeAll(); setConfirming(false); }}
            >
              {t.remove}
            </Button>
          </div>
        </div>
      )}
      {groups.map((g) => (
        <section key={g.label} aria-label={g.label} className="flex flex-col gap-1">
          <h3 className="px-3 text-label-md text-on-surface-light">{g.label}</h3>
          <ul className="flex flex-col gap-1">
            <AnimatePresence initial={false}>
              {g.items.map((n) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  onOpen={() => {
                    if (!n.isRead) void state.markRead(n.id);
                    if (n.link) onNavigate(n.link);
                  }}
                  onRead={() => void state.markRead(n.id)}
                  onDelete={() => void state.remove(n.id)}
                />
              ))}
            </AnimatePresence>
          </ul>
        </section>
      ))}
      {state.nextCursor && (
        <Button variant="ghost" size="sm" block onClick={() => void state.loadMore()} loading={state.loadingMore}>
          {t.loadMore}
        </Button>
      )}
    </div>
  );
}

function HeaderActions({ state, onClearAll }: { state: ReturnType<typeof useNotifications>; onClearAll: () => void }) {
  const t = useText(COPY);
  return (
    <span className="flex items-center">
      {state.unread > 0 && (
        <Button variant="icon" aria-label={t.markAllAria} onClick={() => void state.markAll()}>
          <CheckCheck aria-hidden className="size-5" strokeWidth={1.75} />
        </Button>
      )}
      {state.items.length > 0 && (
        <Button variant="icon" aria-label={t.deleteAllAria} onClick={onClearAll} className="hover:text-error-text">
          <Trash2 aria-hidden className="size-5" strokeWidth={1.75} />
        </Button>
      )}
    </span>
  );
}

/** Botón ícono 44 px con punto error si hay sin leer; aria-label incluye el número. */
export function NotificationBell({ className }: { className?: string }) {
  const t = useText(COPY);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const state = useNotifications(open);
  const navigate = useNavigate();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const close = useCallback((refocus = true) => {
    setOpen(false);
    setConfirming(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  // Popover desktop: Escape y clic fuera cierran; foco al panel al abrir.
  useEffect(() => {
    if (!open || !isDesktop) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !triggerRef.current?.contains(t)) close(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, isDesktop, close]);

  const label = state.unread > 0 ? t.bellUnread(state.unread) : t.bell;
  const onNavigate = (link: string) => { close(false); navigate(link); };
  const title: ReactNode = (
    <span className="flex items-center gap-2">
      {t.bell}
      {state.unread > 0 && <span className="rounded-full bg-error/[var(--lq-soft-alpha)] px-2 text-label-md text-error-text">{state.unread}</span>}
    </span>
  );

  return (
    <div className={cn('relative', className)}>
      <Button
        ref={triggerRef}
        variant="icon"
        data-tour="bell"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <Bell aria-hidden className="size-6" strokeWidth={1.75} />
        {state.unread > 0 && (
          <motion.span
            aria-hidden
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute right-[11px] top-2.5 size-2 rounded-full bg-error ring-2 ring-background"
          />
        )}
      </Button>

      {isDesktop ? (
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-labelledby={titleId}
              tabIndex={-1}
              // No modal: si el foco sale con Tab (y no vuelve al botón), se cierra.
              onBlur={(e) => {
                const next = e.relatedTarget as Node | null;
                if (next && !panelRef.current?.contains(next) && !triggerRef.current?.contains(next)) close(false);
              }}
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.2, ease } }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              className="absolute right-0 top-[calc(100%+8px)] z-40 flex max-h-[min(560px,calc(100dvh-96px))] w-[380px] origin-top-right flex-col rounded-2xl border border-border bg-background shadow-lg outline-none"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border py-2 pl-4 pr-2">
                <h2 id={titleId} className="text-heading-sm text-on-background">{title}</h2>
                <HeaderActions state={state} onClearAll={() => setConfirming(true)} />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                <PanelBody state={state} onNavigate={onNavigate} confirming={confirming} setConfirming={setConfirming} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        <Sheet open={open} onClose={() => close()} title={title}>
          <div className="-mt-2 flex justify-end">
            <HeaderActions state={state} onClearAll={() => setConfirming(true)} />
          </div>
          <PanelBody state={state} onNavigate={onNavigate} confirming={confirming} setConfirming={setConfirming} />
        </Sheet>
      )}
    </div>
  );
}
