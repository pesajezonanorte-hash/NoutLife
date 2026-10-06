import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotionConfig } from 'framer-motion';
import { useAuthStore } from './store/authStore';
import { useSignupStore } from './store/signupStore';
import { useUIStore } from './store/uiStore';
import { useBootstrapAuth } from './hooks/useAuth';
import { AppShell } from './components/layout/AppShell';
import { SplashScreen } from './components/animations/SplashScreen';
import { SageWidget } from './components/sage/SageWidget';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotificationPermissionModal, useNotificationModalState } from './components/ui/NotificationPermissionModal';
import { PageLoader as LqPageLoader, Spinner } from './components/ui/lq';
import { page as pageVariants } from './lib/motion';
import { LoadingGate, LOADER_DELAY_MS, useLoadingVisibility } from './components/ui/LoadingGate';
import { useKeyboardAdjust } from './hooks/useKeyboardAdjust';
import { useTourDone } from './components/onboarding/WelcomeTour';
import { useLocalReminders } from './lib/localReminders';
import { syncPushSubscription } from './services/notification.service';

// Páginas diferidas. Los loaders viven en un mapa para poder precargarlos en
// idle; así, al cambiar de zona, el módulo suele estar en caché y no aparece
// un flash de carga innecesario.
const loaders = {
  LoginPage: () => import('./pages/Login'),
  RegisterPage: () => import('./pages/Register'),
  DashboardPage: () => import('./pages/Dashboard'),
  ProfilePage: () => import('./pages/Profile'),
  OnboardingPage: () => import('./pages/Onboarding'),
  QuestsPage: () => import('./pages/Quests'),
  HabitsPage: () => import('./pages/Habits'),
  HabitDetailPage: () => import('./pages/HabitDetail'),
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
  SocialPage: () => import('./pages/Social'),
  UserProfilePage: () => import('./pages/UserProfile'),
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

// Playground del rediseño: solo se enruta en desarrollo (fuera de `loaders`
// para no precargarlo).
const loadPlayground = () => import('./pages/UIPlayground');

type PageModule = { default: ComponentType<any> };
type PageImport = () => Promise<PageModule>;

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

// El shell conserva la zona actual hasta que el módulo de destino está listo.
// Las redirecciones no necesitan esperar ningún bundle propio.
const routeLoaders: Record<string, () => Promise<unknown>> = {
  '/': loaders.DashboardPage,
  '/profile': loaders.ProfilePage,
  '/quests': loaders.QuestsPage,
  '/quests/new': loaders.QuestsPage,
  '/habits': loaders.HabitsPage,
  '/achievements': loaders.AchievementsPage,
  '/history': loaders.HistoryPage,
  '/gym': loaders.GymPage,
  '/finances': loaders.FinancesPage,
  '/sleep': loaders.SleepPage,
  '/food': loaders.FoodPage,
  '/learning': loaders.LearningPage,
  '/journal': loaders.JournalPage,
  '/love': loaders.LovePage,
  '/shop': loaders.ShopPage,
  '/settings': loaders.SettingsPage,
  '/leaderboard': loaders.LeaderboardPage,
  '/social': loaders.SocialPage,
  '/stats': loaders.StatsPage,
  '/season': loaders.SeasonPage,
  '/agenda': loaders.AgendaPage,
  '/life': loaders.LifePage,
  '/custom-zones': loaders.CustomZonesPage,
  '/rituals': loaders.RitualsPage,
  '/glow-up': loaders.GlowUpPage,
  '/wisdom': loaders.WisdomPage,
  '/about': loaders.AboutPage,
  '/faq': loaders.FAQPage,
};

// Rutas que solo redirigen (no esperan ningún bundle).
const REDIRECTS = new Set(['/goals', '/metas', '/rituales', '/character', '/friends', '/guild']);

function loaderForPath(pathname: string) {
  if (REDIRECTS.has(pathname)) return null;
  if (/^\/habits\/[^/]+$/.test(pathname)) return loaders.HabitDetailPage;
  return routeLoaders[pathname] ?? loaders.NotFoundPage;
}

function PageLoader() {
  return <LqPageLoader className="min-h-[300px] sm:min-h-[360px]" />;
}

/**
 * Loads a page module without delegating its lifetime to a Suspense fallback.
 * This is what lets LoadingGate keep an already-visible terminal on screen for
 * its full shared minimum, even when an import resolves immediately after it.
 */
function DeferredLazyPage({ load }: { load: PageImport }) {
  const [Page, setPage] = useState<ComponentType<any> | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    setPage(null);
    setLoadError(null);

    void load().then(
      (module) => {
        if (active) setPage(() => module.default);
      },
      (error: unknown) => {
        if (active) setLoadError(error);
      },
    );

    return () => {
      active = false;
    };
  }, [load]);

  if (loadError) throw loadError;

  return (
    <LoadingGate loading={!Page} fallback={<PageLoader />}>
      {Page ? <Page /> : null}
    </LoadingGate>
  );
}

/** Amigos y Gremio viven ahora en Social: los enlaces y avisos antiguos llegan a su sitio. */
function LegacyFriendsRedirect() {
  const old = new URLSearchParams(useLocation().search);
  const next = new URLSearchParams();
  const chat = old.get('chat');
  if (chat) { next.set('tab', 'cartas'); next.set('chat', chat); }
  else { next.set('tab', 'amigos'); if (old.get('tab') === 'requests') next.set('view', 'requests'); }
  return <Navigate to={`/social?${next.toString()}`} replace />;
}

function LegacyGuildRedirect() {
  const old = new URLSearchParams(useLocation().search);
  const next = new URLSearchParams({ tab: 'gremios' });
  const id = old.get('id');
  if (id) next.set('guild', id);
  return <Navigate to={`/social?${next.toString()}`} replace />;
}

function SafePage({ children }: { children: ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

function AnimatedRoutes({ location }: { location: ReturnType<typeof useLocation> }) {
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
          <Route path="/"             element={<SafePage><DeferredLazyPage load={loaders.DashboardPage} /></SafePage>} />
          <Route path="/profile"      element={<SafePage><DeferredLazyPage load={loaders.ProfilePage} /></SafePage>} />
          <Route path="/character"    element={<Navigate to="/profile" replace />} />
          <Route path="/quests"       element={<SafePage><DeferredLazyPage load={loaders.QuestsPage} /></SafePage>} />
          <Route path="/quests/new"   element={<SafePage><DeferredLazyPage load={loaders.QuestsPage} /></SafePage>} />
          <Route path="/habits"       element={<SafePage><DeferredLazyPage load={loaders.HabitsPage} /></SafePage>} />
          <Route path="/habits/:id"   element={<SafePage><DeferredLazyPage load={loaders.HabitDetailPage} /></SafePage>} />
          <Route path="/achievements" element={<SafePage><DeferredLazyPage load={loaders.AchievementsPage} /></SafePage>} />
          <Route path="/history"      element={<SafePage><DeferredLazyPage load={loaders.HistoryPage} /></SafePage>} />
          <Route path="/gym"          element={<SafePage><DeferredLazyPage load={loaders.GymPage} /></SafePage>} />
          <Route path="/finances"     element={<SafePage><DeferredLazyPage load={loaders.FinancesPage} /></SafePage>} />
          <Route path="/sleep"        element={<SafePage><DeferredLazyPage load={loaders.SleepPage} /></SafePage>} />
          <Route path="/food"         element={<SafePage><DeferredLazyPage load={loaders.FoodPage} /></SafePage>} />
          <Route path="/learning"     element={<SafePage><DeferredLazyPage load={loaders.LearningPage} /></SafePage>} />
          <Route path="/journal"      element={<SafePage><DeferredLazyPage load={loaders.JournalPage} /></SafePage>} />
          <Route path="/love"         element={<SafePage><DeferredLazyPage load={loaders.LovePage} /></SafePage>} />
          <Route path="/shop"         element={<SafePage><DeferredLazyPage load={loaders.ShopPage} /></SafePage>} />
          <Route path="/settings"     element={<SafePage><DeferredLazyPage load={loaders.SettingsPage} /></SafePage>} />
          <Route path="/leaderboard"  element={<SafePage><DeferredLazyPage load={loaders.LeaderboardPage} /></SafePage>} />
          <Route path="/social"       element={<SafePage><DeferredLazyPage load={loaders.SocialPage} /></SafePage>} />
          <Route path="/friends"      element={<LegacyFriendsRedirect />} />
          <Route path="/guild"        element={<LegacyGuildRedirect />} />
          <Route path="/u/:username"  element={<SafePage><DeferredLazyPage load={loaders.UserProfilePage} /></SafePage>} />
          <Route path="/stats"        element={<SafePage><DeferredLazyPage load={loaders.StatsPage} /></SafePage>} />
          <Route path="/season"       element={<SafePage><DeferredLazyPage load={loaders.SeasonPage} /></SafePage>} />
          <Route path="/agenda"       element={<SafePage><DeferredLazyPage load={loaders.AgendaPage} /></SafePage>} />
          <Route path="/life"         element={<SafePage><DeferredLazyPage load={loaders.LifePage} /></SafePage>} />
          <Route path="/custom-zones" element={<SafePage><DeferredLazyPage load={loaders.CustomZonesPage} /></SafePage>} />
          <Route path="/goals"    element={<Navigate to="/quests?filter=meta" replace />} />
          <Route path="/metas"    element={<Navigate to="/quests?filter=meta" replace />} />
          <Route path="/rituals"  element={<SafePage><DeferredLazyPage load={loaders.RitualsPage} /></SafePage>} />
          <Route path="/rituales" element={<Navigate to="/rituals" replace />} />
          <Route path="/glow-up"  element={<SafePage><DeferredLazyPage load={loaders.GlowUpPage} /></SafePage>} />
          <Route path="/wisdom"   element={<SafePage><DeferredLazyPage load={loaders.WisdomPage} /></SafePage>} />
          <Route path="/about"    element={<SafePage><DeferredLazyPage load={loaders.AboutPage} /></SafePage>} />
          <Route path="/faq"      element={<SafePage><DeferredLazyPage load={loaders.FAQPage} /></SafePage>} />
          <Route path="*"         element={<SafePage><DeferredLazyPage load={loaders.NotFoundPage} /></SafePage>} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Mantiene la zona actual mientras el bundle de destino se resuelve. El
 * boundary vive dentro de AppShell, por lo que HUD, navegación y fondo nunca
 * se desmontan al entrar por primera vez a una ruta lazy.
 */
function DeferredRouteContent() {
  const location = useLocation();
  const [displayedLocation, setDisplayedLocation] = useState(location);
  const [isRoutePending, setIsRoutePending] = useState(false);
  const showLoadingCue = useLoadingVisibility(isRoutePending, { delayMs: LOADER_DELAY_MS });
  const shouldReduceMotion = useReducedMotionConfig();

  // React Router actualiza la URL al instante, pero aquí esperamos el import de
  // la nueva zona antes de reemplazar el contenido. Eso mantiene la sección
  // anterior visible incluso cuando el navegador todavía no tiene su chunk.
  useEffect(() => {
    if (location.key === displayedLocation.key) return;

    const loader = loaderForPath(location.pathname);
    if (!loader) {
      setDisplayedLocation(location);
      setIsRoutePending(false);
      return;
    }

    let active = true;
    setIsRoutePending(true);

    void loader().then(
      () => {
        if (!active) return;
        setDisplayedLocation(location);
        setIsRoutePending(false);
      },
      () => {
        // El ErrorBoundary de la ruta conserva el manejo de un import fallido.
        // Sólo liberamos el cambio para que pueda mostrar dicho estado.
        if (!active) return;
        setDisplayedLocation(location);
        setIsRoutePending(false);
      },
    );

    return () => {
      active = false;
    };
  }, [displayedLocation.key, location]);

  return (
    <div className="relative">
      <AnimatedRoutes location={displayedLocation} />

      <AnimatePresence initial={false}>
        {showLoadingCue && (
          <motion.div
            className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-4"
            initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: shouldReduceMotion ? 0.01 : 0.18, ease: 'easeOut' }}
          >
            <span role="status" className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-label-lg text-on-surface shadow-md">
              <Spinner size="sm" className="text-primary-text" />
              Cargando…
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const pathname = window.location.pathname;

  return (
    <LoadingGate loading={isLoading} fallback={<PageLoader />}>
      {isLoading ? null : !isAuthenticated ? <Navigate to="/login" replace /> : user && !user.onboardingCompleted && pathname !== '/onboarding' ? <Navigate to="/onboarding" replace /> : children}
    </LoadingGate>
  );
}

function OnboardingRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  // Registro pendiente: el onboarding se hace antes de crear la cuenta.
  const signingUp = useSignupStore((s) => Boolean(s.draft));

  return (
    <LoadingGate loading={isLoading} fallback={<PageLoader />}>
      {isLoading ? null : !isAuthenticated ? (signingUp ? children : <Navigate to="/register" replace />) : user?.onboardingCompleted ? <Navigate to="/" replace /> : children}
    </LoadingGate>
  );
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  return (
    <LoadingGate loading={isLoading} fallback={<PageLoader />}>
      {isLoading ? null : isAuthenticated ? <Navigate to="/" replace /> : children}
    </LoadingGate>
  );
}

export default function App() {
  useBootstrapAuth();
  useKeyboardAdjust();
  const { initAudio } = useUIStore();
  const { user, isLoading, isAuthenticated } = useAuthStore();
  const { show: showNotifModal, setShow: setShowNotifModal } = useNotificationModalState();
  // El tutorial de bienvenida pregunta por los avisos en su último paso.
  const tourDone = useTourDone(user?.id);

  // Avisos: renueva la suscripción push de este dispositivo en cada apertura y,
  // con la app abierta, programa también los recordatorios de hoy.
  useEffect(() => {
    if (isAuthenticated) void syncPushSubscription();
  }, [isAuthenticated, user?.id]);
  useLocalReminders(isAuthenticated);

  // Precarga todas las zonas en idle para evitar flashes al navegar.
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
    // La animación de arranque (index.html) termina hacia los 3 s; con «Reducir movimiento», 0,5 s.
    const minDelay = window.setTimeout(() => setMinimumSplashElapsed(true), document.documentElement.classList.contains('lq-rm') ? 500 : 3000);
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

      {isAuthenticated && showNotifModal && tourDone && user?.onboardingCompleted && (
        <NotificationPermissionModal onClose={() => setShowNotifModal(false)} />
      )}

      {!showSplash && (
        <Routes>
          {import.meta.env.DEV && (
            <Route path="/_ui" element={<DeferredLazyPage load={loadPlayground} />} />
          )}
          <Route
            path="/login"
            element={
              <PublicRoute><DeferredLazyPage load={loaders.LoginPage} /></PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute><DeferredLazyPage load={loaders.RegisterPage} /></PublicRoute>
            }
          />
          <Route
            path="/onboarding"
            element={
              <OnboardingRoute><DeferredLazyPage load={loaders.OnboardingPage} /></OnboardingRoute>
            }
          />

          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <ErrorBoundary>
                  <AppShell>
                    <DeferredRouteContent />
                  </AppShell>
                </ErrorBoundary>
                <SageWidget />
              </ProtectedRoute>
            }
          />
        </Routes>
      )}
    </ErrorBoundary>
  );
}
