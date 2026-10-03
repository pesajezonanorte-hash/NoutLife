import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, MessageSquarePlus, Monitor, Moon, MoreHorizontal, Sun, Volume2, VolumeX, Zap, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ease } from '@/lib/motion';
import { Button } from '@/components/ui/lq';
import { useUIStore } from '@/store/uiStore';
import { useThemeStore, type ThemeMode } from '@/store/themeStore';
import { useShellStore } from '@/store/shellStore';
import { useShellActions } from './actions';

const THEME_NEXT: Record<ThemeMode, { next: ThemeMode; label: string; icon: LucideIcon }> = {
  light: { next: 'dark', label: 'Tema: claro', icon: Sun },
  dark: { next: 'auto', label: 'Tema: oscuro', icon: Moon },
  auto: { next: 'light', label: 'Tema: automático', icon: Monitor },
};

interface Item { label: string; icon: LucideIcon; onSelect: () => void; danger?: boolean; hint?: string }

/**
 * Menú "Más opciones" de la Topbar (no tiene prototipo; sigue el patrón de
 * popover del sistema: surface + border + shadow-lg, rounded-2xl).
 * role="menu" con ↑/↓, Home/End, Escape devuelve el foco al botón.
 */
export function OptionsMenu() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { audioEnabled, toggleAudio } = useUIStore();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const setFocusOpen = useShellStore((s) => s.setFocusOpen);
  const setFeedbackOpen = useShellStore((s) => s.setFeedbackOpen);
  const { logout } = useShellActions();

  const theme = THEME_NEXT[mode];
  const items: Item[] = [
    { label: theme.label, hint: 'Cambiar', icon: theme.icon, onSelect: () => setMode(theme.next) },
    { label: audioEnabled ? 'Silenciar sonidos' : 'Activar sonidos', icon: audioEnabled ? Volume2 : VolumeX, onSelect: toggleAudio },
    { label: 'Modo enfoque', icon: Zap, onSelect: () => setFocusOpen(true) },
    { label: 'Enviar feedback', icon: MessageSquarePlus, onSelect: () => setFeedbackOpen(true) },
    { label: 'Cerrar sesión', icon: LogOut, onSelect: () => void logout(), danger: true },
  ];

  const focusItem = (i: number) => {
    const els = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    if (!els?.length) return;
    els[(i + els.length) % els.length].focus();
  };

  useEffect(() => {
    if (!open) return;
    focusItem(0);
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const els = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(i + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusItem(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusItem(0); }
    else if (e.key === 'End') { e.preventDefault(); focusItem(els.length - 1); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Tab') close(false);
  };

  return (
    <div className="relative">
      <Button
        ref={triggerRef}
        variant="icon"
        aria-label="Más opciones"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <MoreHorizontal aria-hidden className="size-6" strokeWidth={1.75} />
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label="Más opciones"
            onKeyDown={onKeyDown}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.2, ease } }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            className="absolute right-0 top-[calc(100%+8px)] z-40 flex w-64 origin-top-right flex-col gap-1 rounded-2xl border border-border bg-background p-2 shadow-lg"
          >
            {items.map(({ label, icon: Icon, onSelect, danger, hint }, i) => (
              <div key={label} className="contents">
                {danger && <div role="separator" className="my-1 h-px bg-border" />}
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  // El tema se cicla sin cerrar el menú; el resto cierra.
                  onClick={() => { onSelect(); if (i !== 0) close(false); }}
                  className={cn(
                    'flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-left text-label-lg transition-colors',
                    danger
                      ? 'text-error-text hover:bg-error/[var(--lq-soft-alpha)] focus-visible:bg-error/[var(--lq-soft-alpha)]'
                      : 'text-on-surface hover:bg-surface-variant focus-visible:bg-surface-variant',
                  )}
                >
                  <Icon aria-hidden className="size-5 shrink-0" strokeWidth={1.75} />
                  <span className="flex-1">{label}</span>
                  {hint && <span className="text-body-sm text-on-surface-light">{hint}</span>}
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
