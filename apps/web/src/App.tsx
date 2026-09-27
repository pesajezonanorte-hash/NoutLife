import { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from './store/authStore';
import { useUIStore } from './store/uiStore';
import { useBootstrapAuth } from './hooks/useAuth';
import { GameLayout } from './components/layout/GameLayout';
import { SplashScreen } from './components/animations/SplashScreen';
import { SageWidget } from './components/sage/SageWidget';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotificationPermissionModal, useNotificationModalState } from './components/ui/NotificationPermissionModal';
import { useKeyboardAdjust } from './hooks/useKeyboardAdjust';

// Páginas lazy. Los loaders viven en un mapa para poder precargarlos en idle:
// así, al cambiar de zona, el módulo ya está cacheado y NO aparece el flash
// del Suspense ("parpadeos al cambiar de zona").
const loaders = {
  LoginPage: () => import('./pages/Login'),
  RegisterPage: () => import('./pages/Register'),
  DashboardPage: () => import('./pages/Dashboard'),
  CharacterPage: () => import('./pages/Character'),
  OnboardingPage: () => import('./pages/Onboarding'),
  QuestsPage: () => import('./pages/Quests'),
  HabitsPage: () => import('./pages/Habits'),
  AchievementsPage: () => import('./pages/Achievements'),
  HistoryPage: () => import('./pages/History'),
  GymPage: () => import('./pages/Gym'),
  FinancesPage: () => import('./pages/Finances'),
  SleepPage: () => import('./pages/Sleep'),
  FoodPage: () => import('./pages/Food'),
  LearningPage: () => import('./pages/Learning'),
  JournalPage: () => import('./pages/Journal'),
  LovePage: () => import('./pages/Love'),
  ShopPage: () => import('./pages/Shop'),
  SettingsPage: () => import('./pages/Settings'),
  LeaderboardPage: () => import('./pages/Leaderboard'),
  ChallengesPage: () => import('./pages/Challenges'),
  GuildPage: () => import('./pages/Guild'),
  StatsPage: () => import('./pages/Stats'),
  SeasonPage: () => import('./pages/Season'),
  AgendaPage: () => import('./pages/Agenda'),
  LifePage: () => import('./pages/Life'),
  GoalsPage: () => import('./pages/Goals'),
  RitualsPage: () => import('./pages/Rituals'),
  GlowUpPage: () => import('./pages/GlowUp'),
  WisdomPage: () => import('./pages/Wisdom'),
  CustomZonesPage: () => import('./pages/CustomZones'),
  NotFoundPage: () => import('./pages/NotFound'),
  AboutPage: () => import('./pages/About'),
  FAQPage: () => import('./pages/FAQ'),
} as const;

/** Calienta todos los módulos de página cuando el navegador está ocioso. */
function preloadPages() {
  const preload = () => Object.values(loaders).forEach((load) => void load());
  const idle = (window as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) {
    idle(preload, { timeout: 3000 });
  } else {
    window.setTimeout(preload, 1200);
  }
}

const LoginPage        = lazy(loaders.LoginPage);
const RegisterPage     = lazy(loaders.RegisterPage);
const DashboardPage    = lazy(loaders.DashboardPage);
const CharacterPage    = lazy(loaders.CharacterPage);
const OnboardingPage   = lazy(loaders.OnboardingPage);
const QuestsPage       = lazy(loaders.QuestsPage);
const HabitsPage       = lazy(loaders.HabitsPage);
const AchievementsPage = lazy(loaders.AchievementsPage);
const HistoryPage      = lazy(loaders.HistoryPage);
const GymPage          = lazy(loaders.GymPage);
const FinancesPage     = lazy(loaders.FinancesPage);
const SleepPage        = lazy(loaders.SleepPage);
const FoodPage         = lazy(loaders.FoodPage);
const LearningPage     = lazy(loaders.LearningPage);
const JournalPage      = lazy(loaders.JournalPage);
const LovePage         = lazy(loaders.LovePage);
const ShopPage         = lazy(loaders.ShopPage);
const SettingsPage     = lazy(loaders.SettingsPage);
const LeaderboardPage  = lazy(loaders.LeaderboardPage);
const ChallengesPage   = lazy(loaders.ChallengesPage);
const GuildPage        = lazy(loaders.GuildPage);
const StatsPage        = lazy(loaders.StatsPage);
const SeasonPage       = lazy(loaders.SeasonPage);
const AgendaPage       = lazy(loaders.AgendaPage);
const LifePage         = lazy(loaders.LifePage);
const GoalsPage        = lazy(loaders.GoalsPage);
const RitualsPage      = lazy(loaders.RitualsPage);
const GlowUpPage       = lazy(loaders.GlowUpPage);
const WisdomPage       = lazy(loaders.WisdomPage);
const CustomZonesPage  = lazy(loaders.CustomZonesPage);
const NotFoundPage     = lazy(loaders.NotFoundPage);
const AboutPage        = lazy(loaders.AboutPage);
const FAQPage          = lazy(loaders.FAQPage);

// Page transition variants (entrada suave, salida instantánea sin parpadeos)
const pageVariants = {
  initial: { opacity: 0, y: 16, scale: 0.995 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1], // easeOut suave y minimalista
    },
  },
  // Salida instantánea: con mode="wait", una salida animada deja un frame en
  // blanco entre zonas (los "parpadeos" que se ven). El swap inmediato +
  // entrada fluida dan sensación de fluidez sin flashes.
  exit: {
    opacity: 0,
    transition: { duration: 0 },
  },
};

function PageLoader() {
  return (
    <div className="w-full min-h-[300px] flex items-center justify-center py-16">
      <motion.div
        className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-sm font-semibold text-[var(--text-2)] shadow-lg flex items-center gap-2.5"
        animate={{ opacity: [0.6, 1, 0.6], y: [0, -4, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--primary)] animate-ping" />
        Cargando sección...
      </motion.div>
    </div>
  );
}

function SafePage({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        // OJO: nada de `will-change: transform` aquí. Crearía un containing
        // block para los `position: fixed` de los modales y sus backdrops/blur
        // se recortarían al contenedor de la página en vez del viewport
        // (el rectángulo feo encima del HUD).
        style={{ width: '100%' }}
      >
        <Routes location={location}>
          <Route path="/"             element={<SafePage><DashboardPage /></SafePage>} />
          <Route path="/character"    element={<SafePage><CharacterPage /></SafePage>} />
          <Route path="/quests"       element={<SafePage><QuestsPage /></SafePage>} />
          <Route path="/quests/new"   element={<SafePage><QuestsPage /></SafePage>} />
          <Route path="/habits"       element={<SafePage><HabitsPage /></SafePage>} />
          <Route path="/achievements" element={<SafePage><AchievementsPage /></SafePage>} />
          <Route path="/history"      element={<SafePage><HistoryPage /></SafePage>} />
          <Route path="/gym"          element={<SafePage><GymPage /></SafePage>} />
          <Route path="/finances"     element={<SafePage><FinancesPage /></SafePage>} />
          <Route path="/sleep"        element={<SafePage><SleepPage /></SafePage>} />
          <Route path="/food"         element={<SafePage><FoodPage /></SafePage>} />
          <Route path="/learning"     element={<SafePage><LearningPage /></SafePage>} />
          <Route path="/journal"      element={<SafePage><JournalPage /></SafePage>} />
          <Route path="/love"         element={<SafePage><LovePage /></SafePage>} />
          <Route path="/shop"         element={<SafePage><ShopPage /></SafePage>} />
          <Route path="/settings"     element={<SafePage><SettingsPage /></SafePage>} />
          <Route path="/leaderboard"  element={<SafePage><LeaderboardPage /></SafePage>} />
          <Route path="/challenges"   element={<SafePage><ChallengesPage /></SafePage>} />
          <Route path="/guild"        element={<SafePage><GuildPage /></SafePage>} />
          <Route path="/stats"        element={<SafePage><StatsPage /></SafePage>} />
          <Route path="/season"       element={<SafePage><SeasonPage /></SafePage>} />
          <Route path="/agenda"       element={<SafePage><AgendaPage /></SafePage>} />
          <Route path="/life"         element={<SafePage><LifePage /></SafePage>} />
          <Route path="/custom-zones" element={<SafePage><CustomZonesPage /></SafePage>} />
          <Route path="/goals"    element={<Navigate to="/quests?filter=meta" replace />} />
          <Route path="/metas"    element={<Navigate to="/quests?filter=meta" replace />} />
          <Route path="/rituals"  element={<SafePage><RitualsPage /></SafePage>} />
          <Route path="/rituales" element={<Navigate to="/rituals" replace />} />
          <Route path="/glow-up"  element={<SafePage><GlowUpPage /></SafePage>} />
          <Route path="/wisdom"   element={<SafePage><WisdomPage /></SafePage>} />
          <Route path="/about"    element={<SafePage><AboutPage /></SafePage>} />
          <Route path="/faq"      element={<SafePage><FAQPage /></SafePage>} />
          <Route path="*"         element={<SafePage><NotFoundPage /></SafePage>} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const pathname = window.location.pathname;
  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user && !user.onboardingCompleted && pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}

function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.onboardingCompleted) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return <PageLoader />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  useBootstrapAuth();
  useKeyboardAdjust();
  const { initAudio } = useUIStore();
  const { user, isLoading, isAuthenticated } = useAuthStore();
  const { show: showNotifModal, setShow: setShowNotifModal } = useNotificationModalState();

  // Precarga todas las zonas en idle: cero flashes del Suspense al navegar.
  useEffect(() => {
    preloadPages();
  }, []);

  useEffect(() => {
    const theme = (user as any)?.activeTheme ?? 'aurora';
    document.documentElement.setAttribute('data-theme', theme);
  }, [(user as any)?.activeTheme]);

  const [splashDone, setSplashDone] = useState(false);
  const [minimumSplashElapsed, setMinimumSplashElapsed] = useState(false);
  const [splashReady, setSplashReady] = useState(false);

  useEffect(() => {
    initAudio();
    // A hard fallback preserves access if the bootstrap request is unavailable.
    // The splash itself performs the short fade before marking the app as ready.
    const hardTimeout = window.setTimeout(() => setSplashReady(true), 6000);
    return () => window.clearTimeout(hardTimeout);
  }, [initAudio]);

  useEffect(() => {
    // Keep the launch transition perceptible without retaining the old,
    // disconnected four-second loading scene.
    const minDelay = window.setTimeout(() => setMinimumSplashElapsed(true), 1450);
    return () => window.clearTimeout(minDelay);
  }, []);

  useEffect(() => {
    if (minimumSplashElapsed && !isLoading) {
      setSplashReady(true);
    }
  }, [isLoading, minimumSplashElapsed]);

  const showSplash = !splashDone;

  return (
    <ErrorBoundary>
      {showSplash && <SplashScreen ready={splashReady} onDone={() => setSplashDone(true)} />}

      {isAuthenticated && showNotifModal && (
        <NotificationPermissionModal onClose={() => setShowNotifModal(false)} />
      )}

      {!showSplash && (
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login"      element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/register"   element={<PublicRoute><RegisterPage /></PublicRoute>} />
            <Route path="/onboarding" element={<OnboardingRoute><OnboardingPage /></OnboardingRoute>} />

            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <GameLayout>
                      <AnimatedRoutes />
                    </GameLayout>
                  </ErrorBoundary>
                  <SageWidget />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      )}
    </ErrorBoundary>
  );
}
