import { useEffect, useRef, useState } from 'react';
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

const TYPE_ICON: Record<string, string> = {
  achievement: '🏆', streak: '🔥', reminder: '⏰',
  sage: '🧙', goal: '🎯', levelup: '⭐', system: '📢',
};

export function NotificationBell({ variant = 'default' }: { variant?: 'default' | 'dock' | 'mobile' }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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
    notifService.listInAppNotifications().then(({ notifications, unread: u }) => {
      setItems(notifications);
      setUnread(u);
    }).catch(() => null).finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

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

  return (
    <div className={variant === 'dock' ? 'relative h-full w-full' : 'relative'} ref={panelRef}>
      <motion.button
        onClick={() => setOpen((o) => !o)}
        whileTap={{ scale: 0.94 }}
        aria-label="Notificaciones"
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

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[998]"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.94 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-0 w-80 max-w-[calc(100vw-1rem)] rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-2xl z-[999] overflow-hidden"
              style={{ top: 'calc(100% + 8px)', transformOrigin: 'top right', boxShadow: '0 12px 32px rgba(0,0,0,0.35)' }}
            >
            {/* Arrow indicator pointing to the bell */}
            <div
              className="absolute -top-1.5 right-3 w-3 h-3 rotate-45 border-l border-t border-[var(--border)] bg-[var(--bg-panel)]"
              aria-hidden
            />
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <span className="font-semibold text-sm text-[var(--text-primary)]">Notificaciones</span>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button
                    onClick={handleMarkAll}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-gold)] hover:bg-[var(--bg-panel-light)] transition-colors"
                    title="Marcar todas como leídas"
                  >
                    <CheckCheck size={14} />
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
            <div className="max-h-80 overflow-y-auto">
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
                <div className="divide-y divide-[var(--border)]">
                  {items.map((n) => (
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
              )}
            </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
