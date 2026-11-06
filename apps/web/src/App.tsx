import { CookieNotice } from '@/components/legal/CookieNotice';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation, type Location } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import { isAdminEmail } from './utils/admin';
import { skinOf } from './lib/shopThemes';
import { useUIStore } from './store/uiStore';
import { useBootstrapAuth } from './hooks/useAuth';
import { AppShell, ZoneTip } from './components/layout/AppShell';
import { RouteStage } from './components/layout/RouteStage';
import { SplashScreen } from './components/animations/SplashScreen';
import { SageWidget } from './components/sage/SageWidget';
import { PlanGate } from './components/billing/PlanGate';
import { TrialNotice } from './components/billing/TrialNotice';
import { GiftWelcome } from './components/billing/GiftWelcome';
import { PendingReward } from './components/billing/PendingReward';
import { PendingApprovalGate } from './components/billing/PendingApprovalGate';
import { LockedZone } from './components/billing/LockedZone';
import { priceListFor, type ProZone } from './lib/plan';
import { LocaleProvider, useLocale, useLocaleStore, useText, type Copy, type Locale } from './lib/i18n';
import { clearRefreshSessionExpected } from './lib/session-hint';
import { setSuperProperties } from './lib/analytics';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotificationPermissionModal, useNotificationModalState } from './components/ui/NotificationPermissionModal';
import { NotificationInvite, useNotificationInvite } from './components/ui/NotificationInvite';
import { Button, PageLoader as LqPageLoader } from './components/ui/lq';
import { useRoutePending } from './lib/routeStage';
import { LoadingGate } from './components/ui/LoadingGate';
import { useKeyboardAdjust } from './hooks/useKeyboardAdjust';
import { useTourDone } from './components/onboarding/WelcomeTour';
import { useLocalReminders } from './lib/localReminders';
import { touchLastActive } from './lib/sleepGapSuggestion';
import { syncPushSubscription } from './services/notification.service';
import { flushWrites } from './lib/offline/engine';
import { isNativeApp } from './lib/native';

// Páginas diferidas. Los loaders viven en un mapa para poder precargarlos en
// idle; así, al cambiar de zona, el módulo suele estar en caché y no aparece
// un flash de carga innecesario.
const loaders = {
  LoginPage: () => import('./pages/Login'),
  LegalPage: () => import('./pages/Legal'),
  DashboardPage: () => import('./pages/Dashboard'),
  ProfilePage: () => import('./pages/Profile'),
  AdminPage: () => import('./pages/Admin'),
  AdminCreatorsPage: () => import('./pages/Admin/Creators'),
  AdminRewardsPage: () => import('./pages/Admin/Rewards'),
  OnboardingPage: () => import('./pages/Onboarding'),
  QuestsPage: () => import('./pages/Quests'),
  HabitsPage: () => import('./pages/Habits'),
  HabitDetailPage: () => import('./pages/HabitDetail'),
  AchievementsPage: () => import('./pages/Achievements'),
  HistoryPage: () => import('./pages/History'),
  ColiseoPage: () => import('./pages/Coliseo'),
  RecreationPage: () => import('./pages/Recreation'),
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
  GalleryPage: () => import('./pages/Gallery'),
  UserProfilePage: () => import('./pages/UserProfile'),
  StatsPage: () => import('./pages/Stats'),
  SeasonPage: () => import('./pages/Season'),
  AgendaPage: () => import('./pages/Agenda'),
  NotebookPage: () => import('./pages/Notebook'),
  LifePage: () => import('./pages/Life'),
  ChecklistsPage: () => import('./pages/Checklists'),
  CyclePage: () => import('./pages/Cycle'),
  CustomZoneDetailPage: () => import('./pages/CustomZoneDetail'),
  SharedResourcePage: () => import('./pages/SharedResource'),
  GlowUpPage: () => import('./pages/GlowUp'),
  WisdomPage: () => import('./pages/Wisdom'),
  CustomZonesPage: () => import('./pages/CustomZones'),
  NotFoundPage: () => import('./pages/NotFound'),
  AboutPage: () => import('./pages/About'),
  FAQPage: () => import('./pages/FAQ'),
  PlanPage: () => import('./pages/Plan'),
  InvitePage: () => import('./pages/Invite'),
  ClaimPage: () => import('./pages/Claim'),
} as const;

// Playground del rediseño: solo se enruta en desarrollo (fuera de `loaders`
// para no precargarlo).
const loadPlayground = () => import('./pages/UIPlayground');

type PageModule = { default: ComponentType<any> };
type PageImport = () => Promise<PageModule>;

/** Módulos ya descargados: su página se pinta en el primer render, sin un paso en blanco. */
const resolved = new Map<PageImport, ComponentType<any>>();
const ensurePage = (load: PageImport) => load().then((module) => { resolved.set(load, module.default); return module; });

/** Calienta todos los módulos de página cuando el navegador está ocioso. */
function preloadPages() {
  const preload = () => Object.values(loaders).forEach((load) => void ensurePage(load).catch(() => undefined));
  const idle = (window as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) {
    idle(preload, { timeout: 3000 });
  } else {
    window.setTimeout(preload, 1200);
  }
}

// El shell conserva la zona actual hasta que el módulo de destino está listo.
// Las redirecciones no necesitan esperar ningún bundle propio.
const routeLoaders: Record<string, PageImport> = {
  '/': loaders.DashboardPage,
  '/profile': loaders.ProfilePage,
  '/quests': loaders.QuestsPage,
  '/quests/new': loaders.QuestsPage,
  '/habits': loaders.HabitsPage,
  '/achievements': loaders.AchievementsPage,
  '/history': loaders.HistoryPage,
  '/coliseo': loaders.ColiseoPage,
  '/recreacion': loaders.RecreationPage,
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
  '/gallery': loaders.GalleryPage,
  '/stats': loaders.StatsPage,
  '/season': loaders.SeasonPage,
  '/agenda': loaders.AgendaPage,
  '/libreta': loaders.NotebookPage,
  '/life': loaders.LifePage,
  '/checklists': loaders.ChecklistsPage,
  '/ciclo-menstrual': loaders.CyclePage,
  '/custom-zones': loaders.CustomZonesPage,
  '/espejo': loaders.GlowUpPage,
  '/wisdom': loaders.WisdomPage,
  '/about': loaders.AboutPage,
  '/faq': loaders.FAQPage,
  '/plan': loaders.PlanPage,
  '/claim': loaders.ClaimPage,
};

// Rutas que solo redirigen (no esperan ningún bundle).
const REDIRECTS = new Set(['/rituals', '/rituales', '/character', '/friends', '/guild', '/glow-up', '/armario', '/gym', '/obstaculos']);

function loaderForPath(pathname: string): PageImport | null {
  if (REDIRECTS.has(pathname)) return null;
  if (/^\/habits\/[^/]+$/.test(pathname)) return loaders.HabitDetailPage;
  // Zonas creadas por el usuario: rutas dinámicas /zonas/:id.
  if (/^\/zonas\/[^/]+$/.test(pathname)) return loaders.CustomZoneDetailPage;
  return routeLoaders[pathname] ?? loaders.NotFoundPage;
}

function PageLoader() {
  return <LqPageLoader className="min-h-[300px] sm:min-h-[360px]" />;
}

const STALL_COPY: Copy<{ stalled: string; retry: string; restart: string }> = {
  es: {
    stalled: 'Esto tarda más de lo normal. Puedes reintentar o volver a iniciar sesión.',
    retry: 'Reintentar',
    restart: 'Reiniciar sesión',
  },
  en: {
    stalled: 'This is taking longer than usual. You can retry or sign in again.',
    retry: 'Retry',
    restart: 'Restart session',
  },
};
/** Desde que se abre la página hasta montar la app debajo; las hojas siguen armando la N mientras tanto. Se funde 450 ms después de armarse (splash/timing). */
const SPLASH_MIN_MS = 1200;
/** Tras este tiempo en el cargador (con el splash ya retirado), se ofrecen los botones; el cierre automático llega antes de AUTH_TIMEOUT_MS. */
const STALL_AFTER_MS = 3000;

/**
 * Cargador mientras se confirma la sesión. Si tarda más de STALL_AFTER_MS, ofrece reintentar
 * o reiniciar la sesión: nunca se queda atrapado en la pantalla de carga.
 */
function AuthLoading() {
  const t = useText(STALL_COPY);
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setStalled(true), STALL_AFTER_MS);
    return () => window.clearTimeout(id);
  }, []);

  const restart = () => {
    // Borra la pista de sesión y el estado local: la siguiente pantalla es el inicio de sesión.
    clearRefreshSessionExpected();
    useAuthStore.getState().logout();
    window.location.replace('/login');
  };

  return (
    <>
      <PageLoader />
      {stalled && (
        <div role="status" className="flex flex-col items-center gap-3 px-4 pb-8 text-center">
          <p className="max-w-sm text-body-md text-on-surface-light">{t.stalled}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={() => window.location.reload()}>{t.retry}</Button>
            <Button variant="ghost" onClick={restart}>{t.restart}</Button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Loads a page module without delegating its lifetime to a Suspense fallback.
 * This is what lets LoadingGate keep an already-visible terminal on screen for
 * its full shared minimum, even when an import resolves immediately after it.
 * Con el módulo ya descargado se pinta en el primer render (RouteStage lo trae antes de montarla).
 */
function DeferredLazyPage({ load }: { load: PageImport }) {
  const [Page, setPage] = useState<ComponentType<any> | null>(() => resolved.get(load) ?? null);
  const [loadError, setLoadError] = useState<unknown>(null);
  useRoutePending(!Page);

  useEffect(() => {
    const ready = resolved.get(load);
    if (ready) {
      setPage(() => ready);
      return undefined;
    }
    let active = true;
    setPage(null);
    setLoadError(null);

    void ensurePage(load).then(
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
  else { next.set('tab', 'directorio'); if (old.get('tab') === 'requests') next.set('view', 'requests'); }
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

/** Zona Pro: en NoutLife Lite se ve su candado en vez de la página (sus lecturas darían 402). */
function ProZonePage({ zone, load }: { zone: ProZone; load: PageImport }) {
  const lite = useAuthStore((s) => s.user?.subscription?.plan === 'lite');
  return lite ? <LockedZone zone={zone} /> : <DeferredLazyPage load={load} />;
}

/** Las rutas de una zona, en la ubicación que muestra su sitio en RouteStage (la de la URL puede ir por delante). */
function zoneRoutes(location: Location) {
  return (
    <>
      <ZoneTip pathname={location.pathname} />
      <Routes location={location}>
          <Route path="/"             element={<SafePage><DeferredLazyPage load={loaders.DashboardPage} /></SafePage>} />
          <Route path="/profile"      element={<SafePage><DeferredLazyPage load={loaders.ProfilePage} /></SafePage>} />
          {/* Administración: solo las cuentas de utils/admin (el servidor vuelve a comprobarlo). */}
          <Route path="/admin"        element={<AdminRoute><SafePage><DeferredLazyPage load={loaders.AdminPage} /></SafePage></AdminRoute>} />
          <Route path="/admin/creadores" element={<AdminRoute><SafePage><DeferredLazyPage load={loaders.AdminCreatorsPage} /></SafePage></AdminRoute>} />
          <Route path="/admin/recompensas" element={<AdminRoute><SafePage><DeferredLazyPage load={loaders.AdminRewardsPage} /></SafePage></AdminRoute>} />
          <Route path="/character"    element={<Navigate to="/profile" replace />} />
          <Route path="/quests"       element={<SafePage><DeferredLazyPage load={loaders.QuestsPage} /></SafePage>} />
          <Route path="/quests/new"   element={<SafePage><DeferredLazyPage load={loaders.QuestsPage} /></SafePage>} />
          <Route path="/habits"       element={<SafePage><DeferredLazyPage load={loaders.HabitsPage} /></SafePage>} />
          <Route path="/habits/:id"   element={<SafePage><DeferredLazyPage load={loaders.HabitDetailPage} /></SafePage>} />
          <Route path="/achievements" element={<SafePage><DeferredLazyPage load={loaders.AchievementsPage} /></SafePage>} />
          <Route path="/history"      element={<SafePage><DeferredLazyPage load={loaders.HistoryPage} /></SafePage>} />
          <Route path="/coliseo"      element={<SafePage><ProZonePage zone="coliseo" load={loaders.ColiseoPage} /></SafePage>} />
          <Route path="/recreacion"   element={<SafePage><ProZonePage zone="recreation" load={loaders.RecreationPage} /></SafePage>} />
          {/* Gimnasio pasó a llamarse Coliseo: enlaces, avisos y marcadores antiguos llegan a su sitio. */}
          <Route path="/gym"          element={<Navigate to={{ pathname: '/coliseo', search: window.location.search }} replace />} />
          <Route path="/finances"     element={<SafePage><ProZonePage zone="finances" load={loaders.FinancesPage} /></SafePage>} />
          <Route path="/sleep"        element={<SafePage><ProZonePage zone="sleep" load={loaders.SleepPage} /></SafePage>} />
          <Route path="/food"         element={<SafePage><ProZonePage zone="food" load={loaders.FoodPage} /></SafePage>} />
          <Route path="/learning"     element={<SafePage><ProZonePage zone="learning" load={loaders.LearningPage} /></SafePage>} />
          <Route path="/journal"      element={<SafePage><ProZonePage zone="journal" load={loaders.JournalPage} /></SafePage>} />
          <Route path="/love"         element={<SafePage><ProZonePage zone="love" load={loaders.LovePage} /></SafePage>} />
          <Route path="/shop"         element={<SafePage><DeferredLazyPage load={loaders.ShopPage} /></SafePage>} />
          <Route path="/settings"     element={<SafePage><DeferredLazyPage load={loaders.SettingsPage} /></SafePage>} />
          <Route path="/leaderboard"  element={<SafePage><DeferredLazyPage load={loaders.LeaderboardPage} /></SafePage>} />
          <Route path="/social"       element={<SafePage><DeferredLazyPage load={loaders.SocialPage} /></SafePage>} />
          <Route path="/gallery"      element={<SafePage><DeferredLazyPage load={loaders.GalleryPage} /></SafePage>} />
          <Route path="/friends"      element={<LegacyFriendsRedirect />} />
          <Route path="/guild"        element={<LegacyGuildRedirect />} />
          <Route path="/u/:username"  element={<SafePage><DeferredLazyPage load={loaders.UserProfilePage} /></SafePage>} />
          <Route path="/stats"        element={<SafePage><DeferredLazyPage load={loaders.StatsPage} /></SafePage>} />
          <Route path="/season"       element={<SafePage><DeferredLazyPage load={loaders.SeasonPage} /></SafePage>} />
          <Route path="/agenda"       element={<SafePage><DeferredLazyPage load={loaders.AgendaPage} /></SafePage>} />
          <Route path="/libreta"      element={<SafePage><DeferredLazyPage load={loaders.NotebookPage} /></SafePage>} />
          <Route path="/life"         element={<SafePage><DeferredLazyPage load={loaders.LifePage} /></SafePage>} />
          <Route path="/custom-zones" element={<SafePage><ProZonePage zone="custom-zones" load={loaders.CustomZonesPage} /></SafePage>} />
          <Route path="/zonas/:id" element={<SafePage><ProZonePage zone="custom-zones" load={loaders.CustomZoneDetailPage} /></SafePage>} />
          <Route path="/checklists" element={<SafePage><DeferredLazyPage load={loaders.ChecklistsPage} /></SafePage>} />
          {/* Obstáculos vive ahora dentro de la libreta de Hábitos. */}
          <Route path="/obstaculos" element={<Navigate to="/habits?tab=obstaculos" replace />} />
          <Route path="/ciclo-menstrual" element={<SafePage><DeferredLazyPage load={loaders.CyclePage} /></SafePage>} />
          <Route path="/ciclo" element={<Navigate to="/ciclo-menstrual" replace />} />
          {/* Rituales vive ahora dentro de la libreta de Hábitos. */}
          <Route path="/rituals"  element={<Navigate to="/habits?tab=rituales" replace />} />
          <Route path="/rituales" element={<Navigate to="/habits?tab=rituales" replace />} />
          <Route path="/espejo"   element={<SafePage><ProZonePage zone="mirror" load={loaders.GlowUpPage} /></SafePage>} />
          <Route path="/armario"  element={<Navigate to={{ pathname: '/espejo', search: window.location.search }} replace />} />
          <Route path="/glow-up"  element={<Navigate to="/espejo" replace />} />
          <Route path="/wisdom"   element={<SafePage><ProZonePage zone="wisdom" load={loaders.WisdomPage} /></SafePage>} />
          <Route path="/about"    element={<SafePage><DeferredLazyPage load={loaders.AboutPage} /></SafePage>} />
          <Route path="/faq"      element={<SafePage><DeferredLazyPage load={loaders.FAQPage} /></SafePage>} />
          <Route path="/plan"     element={<SafePage><DeferredLazyPage load={loaders.PlanPage} /></SafePage>} />
          <Route path="*"         element={<SafePage><DeferredLazyPage load={loaders.NotFoundPage} /></SafePage>} />
      </Routes>
    </>
  );
}

/** Trae el código de la zona de destino: un import que falle lo muestra el ErrorBoundary de su ruta. */
function prepareZone(pathname: string) {
  const load = loaderForPath(pathname);
  return load ? ensurePage(load) : null;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const email = useAuthStore((s) => s.user?.email);
  return isAdminEmail(email) ? <>{children}</> : <Navigate to="/" replace />;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const pathname = window.location.pathname;

  return (
    <>
      <LoadingGate loading={isLoading} fallback={<AuthLoading />}>
        {isLoading ? null
          : !isAuthenticated ? <Navigate to="/login" replace />
          : user && !user.onboardingCompleted && pathname !== '/onboarding' ? <Navigate to="/onboarding" replace />
          : children}
      </LoadingGate>
      {/* Cobro de Nequi en espera: pantalla de bloqueo hasta que Wompi responde. */}
      <PendingApprovalGate />
    </>
  );
}

function OnboardingRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  return (
    <LoadingGate loading={isLoading} fallback={<AuthLoading />}>
      {isLoading ? null : !isAuthenticated ? <Navigate to="/login" replace /> : user?.onboardingCompleted ? <Navigate to="/" replace /> : children}
    </LoadingGate>
  );
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  return (
    <LoadingGate loading={isLoading} fallback={<AuthLoading />}>
      {isLoading ? null : isAuthenticated ? <Navigate to="/" replace /> : children}
    </LoadingGate>
  );
}

/**
 * Portada en un idioma fijo (/en, /es): Google la indexa con su propio canonical y entrar por ella elige ese
 * idioma en este navegador. /login sigue al idioma de la persona.
 */
function LandingRoute({ locale }: { locale: Locale }) {
  useEffect(() => { useLocaleStore.getState().choose(locale); }, [locale]);
  return (
    <PublicRoute>
      <LocaleProvider value={locale}><DeferredLazyPage load={loaders.LoginPage} /></LocaleProvider>
    </PublicRoute>
  );
}

/** Recuerda el idioma (lo lee el splash de index.html antes de React) y lo manda, con el mercado de precios, en cada evento. */
function LocaleSync() {
  const locale = useLocale();
  const market = useAuthStore((s) => priceListFor(s.user?.subscription).market);
  useEffect(() => { useLocaleStore.getState().remember(locale); }, [locale]);
  useEffect(() => { setSuperProperties({ locale, market }); }, [locale, market]);
  return null;
}

export default function App() {
  useBootstrapAuth();
  useKeyboardAdjust();
  const { initAudio } = useUIStore();
  const { user, isLoading, isAuthenticated } = useAuthStore();
  const { show: showNotifModal, setShow: setShowNotifModal } = useNotificationModalState();
  // Al entrar por primera vez, la invitación a los avisos; si se pospone, otra vez tras el primer hábito
  // cumplido, nunca encima del tutorial.
  const tourDone = useTourDone(user?.id);

  // App de Android: esta versión arrancó bien (si no llega este aviso, el plugin vuelve a la anterior).
  useEffect(() => {
    if (isNativeApp()) void import('./lib/ota').then((ota) => ota.startOta()).catch(() => undefined);
  }, []);

  // Avisos: renueva la suscripción push de este dispositivo en cada apertura y,
  // con la app abierta, programa también los recordatorios de hoy.
  useEffect(() => {
    if (!isAuthenticated) return;
    void syncPushSubscription();
    void flushWrites();
    void import('./lib/offline/warm').then((warm) => warm.warmOfflineCache()).catch(() => undefined);
  }, [isAuthenticated, user?.id]);
  useLocalReminders(isAuthenticated);

  // Se guarda la última actividad visible. Al volver tras una pausa nocturna,
  // sleepGapSuggestion conserva una sugerencia para revisar en Sueño.
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    const userId = user.id;
    const touch = () => touchLastActive(userId);
    touch();
    document.addEventListener('visibilitychange', touch);
    window.addEventListener('pagehide', touch);
    window.addEventListener('focus', touch);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') touch();
    }, 5 * 60_000);
    return () => {
      document.removeEventListener('visibilitychange', touch);
      window.removeEventListener('pagehide', touch);
      window.removeEventListener('focus', touch);
      window.clearInterval(interval);
    };
  }, [isAuthenticated, user?.id]);

  // Precarga todas las zonas en idle para evitar flashes al navegar.
  useEffect(() => {
    preloadPages();
  }, []);

  // Tema de la Tienda: lo manda la cuenta (users.equippedTheme). Sin sesión, Aurora.
  const skin = skinOf(user?.equippedTheme);
  useEffect(() => {
    if (!isLoading) useThemeStore.getState().setSkin(user ? skin : null);
  }, [isLoading, Boolean(user), skin]);

  const [splashDone, setSplashDone] = useState(false);
  const [minimumSplashElapsed, setMinimumSplashElapsed] = useState(false);
  const [splashReady, setSplashReady] = useState(false);
  const [pageFetched, setPageFetched] = useState(false);

  useEffect(() => {
    initAudio();
    // A hard fallback preserves access if the bootstrap request is unavailable.
    // The splash itself performs the short fade before marking the app as ready.
    const hardTimeout = window.setTimeout(() => setSplashReady(true), 6000);
    return () => window.clearTimeout(hardTimeout);
  }, [initAudio]);

  useEffect(() => {
    // Las hojas siguen armando la N mientras la app se monta; el tiempo cuenta desde que se abrió la página,
    // así un teléfono lento no espera dos veces. Con «Reducir movimiento» no hay nada que ver.
    const min = document.documentElement.classList.contains('lq-rm') ? 500 : SPLASH_MIN_MS;
    const minDelay = window.setTimeout(() => setMinimumSplashElapsed(true), Math.max(0, min - performance.now()));
    return () => window.clearTimeout(minDelay);
  }, []);

  // La página de destino se descarga mientras dura el splash: al levantarse ya está pintada debajo.
  useEffect(() => {
    if (isLoading) return;
    const load = isAuthenticated ? loaderForPath(window.location.pathname) : loaders.LoginPage;
    void Promise.resolve(load?.()).catch(() => undefined).finally(() => setPageFetched(true));
  }, [isLoading, isAuthenticated]);

  useEffect(() => {
    if (minimumSplashElapsed && !isLoading && pageFetched) {
      setSplashReady(true);
    }
  }, [isLoading, minimumSplashElapsed, pageFetched]);

  const showSplash = !splashDone;
  const { open: inviteOpen, settled: inviteSettled } = useNotificationInvite(user?.id, isAuthenticated && !showSplash && Boolean(user?.onboardingCompleted));

  return (
    <ErrorBoundary>
      <LocaleSync />
      {!showSplash && <CookieNotice />}
      {showSplash && <SplashScreen ready={splashReady} onDone={() => setSplashDone(true)} />}

      {isAuthenticated && inviteOpen && user && <NotificationInvite userId={user.id} />}
      {isAuthenticated && showNotifModal && inviteSettled && tourDone && user?.onboardingCompleted && (
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
          <Route path="/register" element={<Navigate to="/login" replace />} />
          {/* Portada en inglés y en español: las URL que indexa Google (scripts/seo-pages genera su HTML estático). */}
          <Route path="/en" element={<LandingRoute locale="en" />} />
          <Route path="/es" element={<LandingRoute locale="es" />} />
          {/* Legales: públicas, sin sesión (las piden las tiendas y el login). */}
          <Route path="/privacy" element={<DeferredLazyPage load={loaders.LegalPage} />} />
          <Route path="/terms" element={<DeferredLazyPage load={loaders.LegalPage} />} />
          <Route path="/copyright" element={<DeferredLazyPage load={loaders.LegalPage} />} />
          <Route path="/health-data" element={<DeferredLazyPage load={loaders.LegalPage} />} />
          <Route path="/shared/:code" element={<SafePage><DeferredLazyPage load={loaders.SharedResourcePage} /></SafePage>} />
          <Route path="/i/:username" element={<SafePage><DeferredLazyPage load={loaders.InvitePage} /></SafePage>} />
          {/* Enlace de recompensa (Instagram): público; canjear pide sesión. */}
          <Route path="/claim" element={<SafePage><DeferredLazyPage load={loaders.ClaimPage} /></SafePage>} />
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
                    <RouteStage render={zoneRoutes} prepare={prepareZone} />
                  </AppShell>
                </ErrorBoundary>
                <SageWidget />
                {/* Plan: aviso de paso a Lite, tarjeta en la prueba y diálogo de Pro de los límites. */}
                <PlanGate blocked={!inviteSettled || (showNotifModal && tourDone && Boolean(user?.onboardingCompleted))} />
                {inviteSettled && <TrialNotice />}
                {inviteSettled && <GiftWelcome />}
                <PendingReward />
              </ProtectedRoute>
            }
          />
        </Routes>
      )}
    </ErrorBoundary>
  );
}
