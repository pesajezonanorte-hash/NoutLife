// Campana + panel de notificaciones (rediseño). Sin prototipo propio: sigue el
// botón ícono del header de Dashboard.dc.html (punto error como indicador) y el
// patrón de popover/Sheet del sistema. Móvil → Sheet; md+ → popover anclado.
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Check, CheckCheck, Clock, Flame, Megaphone, Sparkles, Star, Target, Trash2, Trophy, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ease } from '@/lib/motion';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button, EmptyState, Sheet, Skeleton, type Tone } from '@/components/ui/lq';
import { softTone } from '@/components/ui/lq/tones';
import * as notifService from '../../services/notification.service';
import type { InAppNotification } from '../../services/notification.service';

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diff = Math.round((startToday - startDate) / 86_400_000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
}

// La API manda un emoji en `icon`; el rediseño no usa emojis → ícono por tipo.
const TYPE_ICON: Record<string, { icon: LucideIcon; tone: Tone }> = {
  achievement: { icon: Trophy, tone: 'warning' },
  streak: { icon: Flame, tone: 'error' },
  reminder: { icon: Clock, tone: 'info' },
  sage: { icon: Sparkles, tone: 'secondary' },
  goal: { icon: Target, tone: 'primary' },
  levelup: { icon: Star, tone: 'warning' },
  system: { icon: Megaphone, tone: 'muted' },
};

function NotificationRow({ n, onOpen, onRead, onDelete }: {
  n: InAppNotification;
  onOpen: () => void;
  onRead: () => void;
  onDelete: () => void;
}) {
  const { icon: Icon, tone } = TYPE_ICON[n.type] ?? TYPE_ICON.system;
  return (
    <motion.li
      layout
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
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
                <span className="sr-only">(sin leer)</span>
              </>
            )}
          </span>
          <span className="mt-0.5 line-clamp-2 block text-body-sm text-on-surface-light">{n.body}</span>
          <span className="mt-1 block text-caption text-on-surface-light">{timeAgo(n.createdAt)}</span>
        </span>
      </button>
      {/* Acciones visibles en hover/foco (desktop) y siempre en táctil. */}
      <span className="flex shrink-0 flex-col pt-1 md:opacity-0 md:transition-opacity md:group-focus-within:opacity-100 md:group-hover:opacity-100">
        {!n.isRead && (
          <Button variant="icon" aria-label={`Marcar como leída: ${n.title}`} onClick={onRead}>
            <Check aria-hidden className="size-5" strokeWidth={1.75} />
          </Button>
        )}
        <Button variant="icon" aria-label={`Eliminar: ${n.title}`} onClick={onDelete} className="hover:text-error-text">
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

  useEffect(() => {
    const poll = () => notifService.getUnreadCount().then(setUnread).catch(() => null);
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, []);

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
  const groups = state.items.reduce<Array<{ label: string; items: InAppNotification[] }>>((acc, n) => {
    const label = dayLabel(n.createdAt);
    const g = acc.find((x) => x.label === label);
    if (g) g.items.push(n); else acc.push({ label, items: [n] });
    return acc;
  }, []);

  if (state.loading) {
    return (
      <div className="flex flex-col gap-3 p-2" aria-busy="true" aria-label="Cargando notificaciones">
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
        <p className="text-body-md text-on-surface">No pudimos cargar tus notificaciones.</p>
        <Button variant="secondary" size="sm" onClick={state.load}>Reintentar</Button>
      </div>
    );
  }
  if (state.items.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        tone="muted"
        title="Todo al día"
        description="Aquí verás logros, rachas y recordatorios."
        className="py-8"
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {confirming && (
        <div role="alertdialog" aria-labelledby="lq-clear-title" className="flex flex-col gap-3 rounded-2xl border border-error/30 bg-error/[var(--lq-soft-alpha)] p-4">
          <p id="lq-clear-title" className="text-label-lg text-error-text">¿Eliminar todas las notificaciones?</p>
          <p className="text-body-sm text-on-surface">Se borra el historial de avisos y no se puede deshacer.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" data-autofocus onClick={() => setConfirming(false)}>Cancelar</Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => { void state.removeAll(); setConfirming(false); }}
            >
              Eliminar
            </Button>
          </div>
        </div>
      )}
      {groups.map((g) => (
        <section key={g.label} aria-label={g.label} className="flex flex-col gap-1">
          <h3 className="px-3 text-label-md uppercase text-on-surface-light">{g.label}</h3>
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
          Cargar más
        </Button>
      )}
    </div>
  );
}

function HeaderActions({ state, onClearAll }: { state: ReturnType<typeof useNotifications>; onClearAll: () => void }) {
  return (
    <span className="flex items-center">
      {state.unread > 0 && (
        <Button variant="icon" aria-label="Marcar todas como leídas" onClick={() => void state.markAll()}>
          <CheckCheck aria-hidden className="size-5" strokeWidth={1.75} />
        </Button>
      )}
      {state.items.length > 0 && (
        <Button variant="icon" aria-label="Eliminar todas las notificaciones" onClick={onClearAll} className="hover:text-error-text">
          <Trash2 aria-hidden className="size-5" strokeWidth={1.75} />
        </Button>
      )}
    </span>
  );
}

/** Botón ícono 44 px con punto error si hay sin leer; aria-label incluye el número. */
export function NotificationBell({ className }: { className?: string }) {
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

  const label = state.unread > 0 ? `Notificaciones, ${state.unread} sin leer` : 'Notificaciones';
  const onNavigate = (link: string) => { close(false); navigate(link); };
  const title: ReactNode = (
    <span className="flex items-center gap-2">
      Notificaciones
      {state.unread > 0 && <span className="rounded-full bg-error/[var(--lq-soft-alpha)] px-2 text-label-md text-error-text">{state.unread}</span>}
    </span>
  );

  return (
    <div className={cn('relative', className)}>
      <Button
        ref={triggerRef}
        variant="icon"
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
