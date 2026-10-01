import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as notifService from '../../services/notification.service';
import type { InAppNotification } from '../../services/notification.service';
import { E } from '@/components/ui/glyphs';

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return `hace ${Math.floor(diff / 86400)}d`;
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

const TYPE_ICON: Record<string, string> = {
  achievement: '🏆', streak: '🔥', reminder: '⏰',
  sage: '🧙', goal: '🎯', levelup: '⭐', system: '📢',
};

export function NotificationBell({ variant = 'default' }: { variant?: 'default' | 'dock' | 'mobile' }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [panelPosition, setPanelPosition] = useState({ top: 8, left: 8, arrowLeft: 16 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const gutter = 8;
    const panelWidth = Math.min(320, Math.max(0, window.innerWidth - gutter * 2));
    const maxLeft = Math.max(gutter, window.innerWidth - panelWidth - gutter);
    const left = Math.min(maxLeft, Math.max(gutter, rect.right - panelWidth));
    // The panel has a capped scrollable list, so this keeps its complete shell
    // on screen even in a short mobile viewport.
    const top = Math.min(rect.bottom + gutter, Math.max(gutter, window.innerHeight - 390));
    const arrowLeft = Math.min(panelWidth - 18, Math.max(18, rect.left + rect.width / 2 - left));

    setPanelPosition({ top, left, arrowLeft });
  }, []);

  useEffect(() => {
    notifService.getUnreadCount().then(setUnread).catch(() => null);
    const interval = setInterval(() => {
      notifService.getUnreadCount().then(setUnread).catch(() => null);
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    notifService.listInAppNotifications().then(({ notifications, unread: u, nextCursor: cursor }) => {
      setItems(notifications);
      setUnread(u);
      setNextCursor(cursor);
    }).catch(() => null).finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);
    return () => {
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
    };
  }, [open, updatePanelPosition]);

  async function handleMarkRead(id: string) {
    await notifService.markAsRead(id).catch(() => null);
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    setUnread((u) => Math.max(0, u - 1));
  }

  async function handleMarkAll() {
    await notifService.markAllAsRead().catch(() => null);
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
  }

  async function handleLoadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await notifService.listInAppNotifications({ cursor: nextCursor });
      setItems((previous) => [...previous, ...page.notifications]);
      setUnread(page.unread);
      setNextCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleDeleteAll() {
    await notifService.deleteAllNotifications().catch(() => null);
    setItems([]);
    setUnread(0);
    setNextCursor(null);
    setConfirmClearAll(false);
  }

  async function handleDelete(id: string) {
    await notifService.deleteNotification(id).catch(() => null);
    const wasUnread = items.find((n) => n.id === id)?.isRead === false;
    setItems((prev) => prev.filter((n) => n.id !== id));
    if (wasUnread) setUnread((u) => Math.max(0, u - 1));
  }

  function handleClick(notif: InAppNotification) {
    if (!notif.isRead) handleMarkRead(notif.id);
    if (notif.link) { setOpen(false); navigate(notif.link); }
  }

  const groupedItems = items.reduce<Array<{ label: string; notifications: InAppNotification[] }>>((groups, notification) => {
    const label = dayLabel(notification.createdAt);
    const group = groups.find((candidate) => candidate.label === label);
    if (group) group.notifications.push(notification);
    else groups.push({ label, notifications: [notification] });
    return groups;
  }, []);

  return (
    <div className={variant === 'dock' ? 'relative h-full w-full' : 'relative'}>
      <motion.button
        ref={triggerRef}
        onClick={() => {
          if (!open) updatePanelPosition();
          setOpen((value) => !value);
        }}
        whileTap={{ scale: 0.94 }}
        aria-label="Notificaciones"
        aria-expanded={open}
        aria-haspopup="dialog"
        className={variant === 'dock'
          ? 'relative flex h-full w-full items-center justify-center rounded-[10px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-panel-light)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]'
          : variant === 'mobile'
            ? 'relative flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-gold)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]'
            : 'relative flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-gold)] hover:text-[var(--text-primary)]'}
        title="Notificaciones"
      >
        <Bell size={16} className={variant === 'dock' ? 'h-[80%] w-[80%]' : undefined} />
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full text-xs font-bold flex items-center justify-center"
            style={{ background: 'var(--accent-red)', color: 'var(--text-inv)' }}
          >
            {unread > 9 ? '9+' : unread}
          </motion.span>
        )}
      </motion.button>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[998] bg-black/45 backdrop-blur-[1px]"
              aria-hidden="true"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.94 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="notification-panel-title"
              className="fixed z-[999] flex w-80 max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-2xl"
              style={{
                top: panelPosition.top,
                left: panelPosition.left,
                maxHeight: 'calc(100dvh - 1rem)',
                transformOrigin: `${panelPosition.arrowLeft}px top`,
                boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
              }}
            >
            {/* Arrow indicator pointing to the bell */}
            <div
              className="absolute -top-1.5 h-3 w-3 rotate-45 border-l border-t border-[var(--border)] bg-[var(--bg-panel)]"
              style={{ left: panelPosition.arrowLeft - 6 }}
              aria-hidden
            />
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <span id="notification-panel-title" className="text-sm font-semibold text-[var(--text-primary)]">Notificaciones</span>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button
                    onClick={handleMarkAll}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-gold)] hover:bg-[var(--bg-panel-light)] transition-colors"
                    title="Marcar todas como leídas"
                    aria-label="Marcar todas como leídas"
                  >
                    <CheckCheck size={14} />
                  </button>
                )}
                {items.length > 0 && (
                  <button
                    onClick={() => setConfirmClearAll(true)}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-panel-light)] hover:text-[var(--accent-red)] transition-colors"
                    title="Eliminar todas"
                    aria-label="Eliminar todas las notificaciones"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel-light)] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="min-h-0 max-h-80 overflow-y-auto" style={{ maxHeight: 'min(20rem, calc(100dvh - 5rem))' }}>
              {loading ? (
                <div className="space-y-2 p-3">
                  {[1, 2, 3].map((i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
                </div>
              ) : items.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell size={28} className="mx-auto text-[var(--text-muted)] opacity-30 mb-2" />
                  <p className="text-xs text-[var(--text-muted)]">Sin notificaciones</p>
                </div>
              ) : (
                <div className="space-y-3 py-2">
                  {groupedItems.map((group) => (
                    <section key={group.label} aria-label={group.label}>
                      <p className="px-4 pb-1 text-xs font-semibold text-[var(--text-muted)]">{group.label}</p>
                      <div className="divide-y divide-[var(--border)]">
                        {group.notifications.map((n) => (
                    <motion.div
                      key={n.id}
                      layout
                      className={`group relative px-4 py-3 cursor-pointer hover:bg-[var(--bg-panel-light)] transition-colors ${!n.isRead ? 'bg-[var(--bg-panel-light)]' : ''}`}
                      onClick={() => handleClick(n)}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-lg flex-shrink-0 mt-0.5">
                          <E e={n.icon ?? TYPE_ICON[n.type] ?? '📢'} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold truncate ${!n.isRead ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                            {n.title}
                          </p>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-snug line-clamp-2">
                            {n.body}
                          </p>
                          <p className="text-xs text-[var(--text-muted)] mt-1">{timeAgo(n.createdAt)}</p>
                        </div>
                      {/* Punto "nuevo": se aparta (fade) al hacer hover para
                          dejarle el sitio a las acciones sin solaparse */}
                      {!n.isRead && (
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5 transition-opacity group-hover:opacity-0"
                          style={{ background: 'var(--accent-cyan)' }}
                        />
                      )}
                    </div>
                    {/* Actions on hover */}
                    <div
                      className="absolute right-1.5 top-1.5 hidden group-hover:flex items-center gap-0.5 rounded-lg px-1 py-0.5 shadow-sm"
                      style={{ background: 'color-mix(in oklab, var(--bg-panel) 92%, transparent)', backdropFilter: 'blur(6px)' }}
                    >
                        {!n.isRead && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id); }}
                            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent-green)] transition-colors"
                            title="Marcar como leída"
                          >
                            <Check size={12} />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent-red)] transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </motion.div>
                        ))}
                      </div>
                    </section>
                  ))}
                  {nextCursor && (
                    <div className="px-3 pt-1">
                      <button
                        type="button"
                        onClick={() => void handleLoadMore()}
                        disabled={loadingMore}
                        className="min-h-11 w-full rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] disabled:opacity-60"
                      >
                        {loadingMore ? 'Cargando…' : 'Cargar más'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            </motion.div>
            {confirmClearAll && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/55 p-4"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="clear-notifications-title"
              >
                <div className="w-full max-w-xs rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 shadow-2xl">
                  <p id="clear-notifications-title" className="text-sm font-semibold text-[var(--text-primary)]">Eliminar todas las notificaciones</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Esta acción elimina el historial de avisos y no se puede deshacer.</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setConfirmClearAll(false)} className="min-h-11 rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-[var(--text-secondary)]">Cancelar</button>
                    <button type="button" onClick={() => void handleDeleteAll()} className="min-h-11 rounded-lg border border-[var(--accent-red)] bg-[var(--accent-red)] px-3 text-xs font-semibold text-white">Eliminar</button>
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
