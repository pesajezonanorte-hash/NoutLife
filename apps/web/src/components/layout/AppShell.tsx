// Shell del rediseño (docs/redesign/README.md → Layout):
//   móvil  (<768)    MobileHeader + TabBar + Fab
//   md+    (≥768)    Sidebar recogido (72 px, íconos) que se despliega a 256 px
//                    al pasar el cursor o con teclado, + Topbar h-16, sin FAB
// La página hace scroll en window; el Sidebar es fixed y flota sobre la página al desplegarse.
import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { Info, X } from 'lucide-react';
import { ease } from '@/lib/motion';
import { useAuthStore } from '@/store/authStore';
import { useShellStore } from '@/store/shellStore';
import { refreshUser } from '@/hooks/useAuth';
import { ZONE_TOOLTIPS } from '@/lib/gameProgress';
import { Button, Toaster } from '@/components/ui/lq';
import { LevelUpOverlay } from '../animations/LevelUpOverlay';
import { FloatingXPLayer } from '../animations/FloatingXP';
import { ScreenFlash } from '../animations/ScreenFlash';
import { AchievementUnlockedToast } from '../achievements/AchievementUnlockedToast';
import { CommandPalette } from '../ui/CommandPalette';
import { OfflineIndicator } from '../ui/OfflineIndicator';
import { ScrollToTop } from '../ui/ScrollToTop';
import { FocusMode } from '../ui/FocusMode';
import { MusicPlayer } from '../ui/MusicPlayer';
import { TabBar } from './TabBar';
import { Fab } from './Fab';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileHeader } from './MobileHeader';
import { MenuSheet } from './MenuSheet';
import { QuickActions } from './QuickActions';
import { FeedbackDialog } from './FeedbackDialog';

/** Primera visita a una zona: tarjeta informativa descartable (sustituye al tooltip dorado). */
function ZoneTip() {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);
  const tip = ZONE_TOOLTIPS[pathname];

  const key = `lifequest_zone_tip_${pathname}`;

  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(key) === 'seen'; } catch { /* sin storage */ }
    setVisible(Boolean(tip) && !seen);
  }, [key, tip]);

  // Se marca como vista cuando de verdad se mostró (idempotente en StrictMode).
  useEffect(() => {
    if (!visible) return;
    try { localStorage.setItem(key, 'seen'); } catch { /* sin storage */ }
  }, [visible, key]);

  return (
    <AnimatePresence initial={false}>
      {visible && tip && (
        <motion.aside
          aria-label="Sobre esta zona"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease } }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          className="mb-6 flex items-start gap-3 rounded-2xl border border-info/30 bg-info/[var(--lq-soft-alpha)] p-4"
        >
          <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-info-text" strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <p className="text-label-lg text-info-text">{tip.title}</p>
            <p className="mt-1 text-body-sm text-on-surface">{tip.body}</p>
          </div>
          <Button variant="icon" aria-label="Entendido, ocultar" onClick={() => setVisible(false)} className="-m-2">
            <X aria-hidden className="size-5" strokeWidth={1.75} />
          </Button>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/** Mantiene XP/oro/nivel frescos al navegar y al volver a la pestaña. */
function useUserSync(pathname: string) {
  useEffect(() => { void refreshUser(); }, [pathname]);
  useEffect(() => {
    const sync = () => { if (document.visibilityState === 'visible') void refreshUser(); };
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const user = useAuthStore((s) => s.user);
  const focusOpen = useShellStore((s) => s.focusOpen);
  const setFocusOpen = useShellStore((s) => s.setFocusOpen);

  useUserSync(pathname);

  // Al cambiar de ruta: arriba del todo y menús cerrados.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    useShellStore.setState({ menuOpen: false, quickOpen: false });
  }, [pathname]);

  return (
    <div className="min-h-dvh bg-background text-on-background md:flex">
      <a
        href="#main"
        className="sr-only z-[70] rounded-lg bg-primary-strong px-4 py-3 text-label-lg text-on-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>

      <Sidebar className="hidden md:block" />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader className="md:hidden" />
        <Topbar className="hidden md:flex" />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1120px] flex-1 px-4 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-2 outline-none md:px-8 md:pb-12 md:pt-8 lg:pt-12"
        >
          <ZoneTip />
          {children}
        </main>
      </div>

      <TabBar className="md:hidden" />
      <Fab className="md:hidden" />

      <MenuSheet />
      <QuickActions />
      <FeedbackDialog />
      <CommandPalette />
      <Toaster />
      <OfflineIndicator />
      <ScrollToTop />
      <LevelUpOverlay />
      <FloatingXPLayer />
      <ScreenFlash />
      <AchievementUnlockedToast />
      <MusicPlayer url={user?.gymPlaylistUrl} />
      <AnimatePresence>
        {focusOpen && <FocusMode onClose={() => setFocusOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}
