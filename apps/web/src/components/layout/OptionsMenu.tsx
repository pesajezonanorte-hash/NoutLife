import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Languages, LogOut, MessageSquarePlus, Monitor, Moon, MoreHorizontal, Sun, Volume2, VolumeX, Zap, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ease } from '@/lib/motion';
import { Button } from '@/components/ui/lq';
import { useUIStore } from '@/store/uiStore';
import { useThemeStore, type ThemeMode } from '@/store/themeStore';
import { useShellStore } from '@/store/shellStore';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/hooks/useToast';
import * as userService from '@/services/user.service';
import { LOCALE_NAMES, useLocale, useLocaleStore, type Copy, type Locale } from '@/lib/i18n';
import { useShellActions } from './actions';

const es = {
  more: 'Más opciones',
  themeLabel: { light: 'Tema: claro', dark: 'Tema: oscuro', auto: 'Tema: automático' } as Record<ThemeMode, string>,
  change: 'Cambiar',
  mute: 'Silenciar sonidos',
  unmute: 'Activar sonidos',
  focus: 'Modo enfoque',
  feedback: 'Enviar feedback',
  language: 'Idioma',
  logout: 'Cerrar sesión',
  languageError: 'No pudimos cambiar el idioma. Inténtalo de nuevo.',
};

const en: typeof es = {
  more: 'More options',
  themeLabel: { light: 'Theme: light', dark: 'Theme: dark', auto: 'Theme: automatic' },
  change: 'Change',
  mute: 'Mute sounds',
  unmute: 'Turn on sounds',
  focus: 'Focus mode',
  feedback: 'Send feedback',
  language: 'Language',
  logout: 'Log out',
  languageError: "We couldn't change the language. Try again.",
};

const COPY: Copy<typeof es> = { es, en };

const THEME_NEXT: Record<ThemeMode, { next: ThemeMode; icon: LucideIcon }> = {
  light: { next: 'dark', icon: Sun },
  dark: { next: 'auto', icon: Moon },
  auto: { next: 'light', icon: Monitor },
};

interface Item { label: string; icon: LucideIcon; onSelect: () => void; danger?: boolean; hint?: string }

/**
 * Menú "Más opciones" de la Topbar (no tiene prototipo; sigue el patrón de
 * popover del sistema: surface + border + shadow-lg, rounded-2xl).
 * role="menu" con ↑/↓, Home/End, Escape devuelve el foco al botón.
 */
export function OptionsMenu() {
  const locale = useLocale();
  const t = COPY[locale];
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { audioEnabled, toggleAudio } = useUIStore();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  // Con un tema de la Tienda, claro/oscuro lo fija el tema.
  const skin = useThemeStore((s) => s.skin);
  const setFocusOpen = useShellStore((s) => s.setFocusOpen);
  const setFeedbackOpen = useShellStore((s) => s.setFeedbackOpen);
  const { logout } = useShellActions();
  const signedIn = useAuthStore((s) => Boolean(s.user));
  const updateUser = useAuthStore((s) => s.updateUser);
  const toast = useToastStore((s) => s.error);

  /** Con sesión, el idioma se guarda en la cuenta (manda en todos tus dispositivos); sin sesión, en este navegador. */
  async function switchLanguage() {
    const next: Locale = locale === 'en' ? 'es' : 'en';
    useLocaleStore.getState().choose(next);
    if (!signedIn) return;
    try { updateUser(await userService.updateProfile({ language: next })); } catch { toast(t.languageError); }
  }

  const theme = THEME_NEXT[mode];
  const items: Item[] = [
    ...(skin ? [] : [{ label: t.themeLabel[mode], hint: t.change, icon: theme.icon, onSelect: () => setMode(theme.next) }]),
    { label: audioEnabled ? t.mute : t.unmute, icon: audioEnabled ? Volume2 : VolumeX, onSelect: toggleAudio },
    { label: t.focus, icon: Zap, onSelect: () => setFocusOpen(true) },
    { label: t.feedback, icon: MessageSquarePlus, onSelect: () => setFeedbackOpen(true) },
    { label: t.language, hint: LOCALE_NAMES[locale === 'en' ? 'es' : 'en'], icon: Languages, onSelect: () => void switchLanguage() },
    { label: t.logout, icon: LogOut, onSelect: () => void logout(), danger: true },
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
        aria-label={t.more}
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
            aria-label={t.more}
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
