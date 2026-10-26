// Portada pública y acceso (solo Google). Una cuenta nueva se crea al entrar por
// primera vez con 7 días de Pro sin tarjeta, y la guarda de rutas la lleva al
// onboarding. Móvil (360 px+): titular, acceso y la ventana de Inicio (el cielo
// de la hora real) antes de cualquier scroll; debajo, los cuatro pilares, el FAQ
// y los planes. En los navegadores de Instagram, Facebook o TikTok, Google no deja
// entrar: el acceso se cambia por «Ábrelo en tu navegador».
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import * as authService from '@/services/auth.service';
import { LegalFooter } from '@/components/legal/LegalFooter';
import { BrandLockup } from '@/components/layout/Brand';
import { Lettering } from '@/components/layout/Lettering';
import { HomeWindow, useNow } from '@/components/dashboard/HomeWindow';
import { PricingSection } from '@/components/billing/PricingSection';
import { OpenInBrowser } from '@/components/auth/OpenInBrowser';
import { detectInAppBrowser } from '@/lib/inAppBrowser';
import { AccordionItem } from '@/components/ui/lq';
import { ease } from '@/lib/motion';
import { track } from '@/lib/analytics';
import { PRO_ANNUAL_PER_DAY_COP, TRIAL_DAYS, formatCop } from '@/lib/plan';
import { useIsDark } from '@/store/themeStore';
import { clearReferral, readReferral } from '@/services/referral.service';

type Providers = { googleClientId: string | null };

declare global {
  interface Window {
    google?: { accounts: { id: {
      initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: 'popup' }) => void;
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
    } } };
  }
}

const loaded = new Map<string, Promise<void>>();
function loadScript(src: string) {
  if (!loaded.has(src)) {
    loaded.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true; s.onload = () => resolve(); s.onerror = () => { loaded.delete(src); reject(new Error('script')); };
      document.head.appendChild(s);
    }));
  }
  return loaded.get(src)!;
}

const PILLARS = [
  { name: 'Esencia', line: 'Un solo lugar para tu día.', body: 'Tus hábitos, tus ideas y tus metas viven juntos. Nada se queda en otra app.' },
  { name: 'Diseño', line: 'Calma en cada detalle.', body: 'Un modo oscuro cuidado, vidrio suave y una ventana con el cielo de tu hora.' },
  { name: 'Versatilidad', line: 'Del hábito a la idea sin cambiar de app.', body: 'Hábitos, libreta, obstáculos, bienestar y metas en un mismo espacio.' },
  { name: 'Intuitividad', line: 'Todo a un toque.', body: 'Marcas un hábito, anotas una idea o pospones un aviso sin buscar menús.' },
];

const FAQ = [
  { q: '¿Es gratis?', a: `Sí. NoutLife Lite es gratis para siempre, y los primeros ${TRIAL_DAYS} días tienes Pro completo.` },
  { q: '¿Me van a cobrar?', a: 'Solo si decides pasar a Pro. Para empezar no necesitas tarjeta, y si te suscribes cancelas con un clic.' },
  { q: '¿Funciona en iPhone?', a: 'Sí. Añádela a tu pantalla de inicio desde Safari para recibir los avisos.' },
  { q: '¿Mis datos?', a: 'Son tuyos. Puedes exportarlos cuando quieras desde Ajustes.' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [providers, setProviders] = useState<Providers | null>(null);
  const [apiError, setApiError] = useState('');
  const [busy, setBusy] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const googleRef = useRef<HTMLDivElement>(null);
  const [inApp] = useState(() => detectInAppBrowser(navigator.userAgent));
  const now = useNow();
  const dark = useIsDark();

  async function signIn(provider: 'google', idToken: string, displayName?: string) {
    setApiError('');
    setBusy(true);
    track('signup_started', { provider });
    try {
      // Invitación (T9): solo la usa el servidor si la cuenta es nueva.
      const referredBy = readReferral();
      const { user, accessToken } = await authService.oauthSignIn({ provider, idToken, displayName, referredBy });
      clearReferral();
      setAuth(user, accessToken);
      const isNew = !user.onboardingCompleted;
      track(isNew ? 'signup_completed' : 'login_completed');
      if (isNew && user.subscription?.status === 'trialing') track('trial_started', { type: 'reverse' });
      navigate(isNew ? '/onboarding' : '/', { replace: true });
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setApiError(message ?? 'No se pudo iniciar sesión. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    track('landing_viewed', { in_app_browser: inApp ?? false });
  }, [inApp]);

  useEffect(() => {
    if (inApp) return;
    authService.getProviders().then(setProviders).catch(() => setApiError('No se pudo conectar con el servidor. Inténtalo de nuevo.'));
  }, [inApp]);

  useEffect(() => {
    const clientId = providers?.googleClientId;
    if (!clientId) return;
    loadScript('https://accounts.google.com/gsi/client').then(() => {
      if (!window.google || !googleRef.current) return;
      window.google.accounts.id.initialize({ client_id: clientId, ux_mode: 'popup', callback: ({ credential }) => void signIn('google', credential) });
      // El texto del botón oficial de Google no se puede cambiar: «Continuar con Google».
      window.google.accounts.id.renderButton(googleRef.current, {
        type: 'standard', theme: dark ? 'outline' : 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', locale: 'es',
        width: Math.min(400, googleRef.current.clientWidth || 320),
      });
    }).catch(() => setApiError('No se pudo cargar el inicio de sesión de Google.'));
    // signIn solo usa setters estables: no hace falta en las dependencias.
  }, [providers?.googleClientId, dark]);

  const none = providers && !providers.googleClientId;
  const linkClass = 'inline-flex min-h-11 items-center font-semibold text-primary-text underline-offset-4 hover:underline';

  return (
    <div className="min-h-dvh bg-background text-on-background">
      <main id="main" className="mx-auto flex max-w-[1120px] flex-col px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 md:pt-10">
        <BrandLockup markSize={30} />

        {/* Primera pantalla: qué es y cómo entrar. En escritorio, la ventana a la derecha. */}
        <section aria-labelledby="lq-hero" className="grid items-center gap-x-16 gap-y-8 pt-8 md:min-h-[min(720px,82dvh)] md:grid-cols-[minmax(0,1fr)_minmax(320px,440px)] md:pt-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease } }}
            className="flex max-w-[520px] flex-col gap-6"
          >
            <div className="flex flex-col gap-3">
              <h1 id="lq-hero" className="text-display-sm [text-wrap:balance] sm:text-display-md lg:text-display-lg">
                <Lettering text="Tu rutina, tu mente y tus ideas. En un solo lugar." delay={0.2} />
              </h1>
              <p className="text-body-lg text-on-surface-light [text-wrap:pretty]">
                Hábitos, libreta, obstáculos, bienestar y metas en un espacio que da gusto abrir todos los días.
              </p>
            </div>

            {inApp ? <OpenInBrowser app={inApp} /> : (
              <div className="flex flex-col gap-3" aria-busy={busy}>
                <p className="text-label-lg">Empieza gratis con Google</p>
                {providers?.googleClientId && <div ref={googleRef} className="flex min-h-11 max-w-[400px]" />}
                {none && <p className="text-body-sm text-on-surface-light">El inicio de sesión no está disponible ahora mismo.</p>}
                <p className="text-body-sm text-on-surface-light">
                  {TRIAL_DAYS} días de Pro incluidos, sin tarjeta. Después sigues gratis en Lite, o pasas a Pro desde unos {formatCop(PRO_ANNUAL_PER_DAY_COP)} COP al día.
                </p>
                {apiError && (
                  <p role="alert" className="flex items-start gap-2 rounded-xl bg-error/[var(--lq-soft-alpha)] px-4 py-3 text-body-sm text-error-text">
                    <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
                    {apiError}
                  </p>
                )}
              </div>
            )}
          </motion.div>

          {/* La ventana de Inicio: el cielo de la hora real del visitante, igual que dentro de la app. */}
          <figure className="mx-auto w-full max-w-[400px] md:max-w-none">
            <HomeWindow now={now} className="max-w-[440px]" />
            <figcaption className="pt-4 text-center text-body-sm text-on-surface-light">La ventana de Inicio sigue el cielo de tu hora.</figcaption>
          </figure>
        </section>

        <section aria-labelledby="lq-pillars" className="flex flex-col gap-8 pt-16 md:pt-24">
          <h2 id="lq-pillars" className="max-w-[560px] text-heading-lg [text-wrap:balance] md:text-display-sm">Orden en calma, todos los días</h2>
          <dl className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
            {PILLARS.map((p) => (
              <div key={p.name} className="flex flex-col gap-1.5 border-t border-border pt-5">
                <dt className="flex flex-col gap-1">
                  <span className="text-body-sm text-primary-text">{p.name}</span>
                  <span className="text-heading-sm">{p.line}</span>
                </dt>
                <dd className="max-w-[44ch] text-body-md text-on-surface-light">{p.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="lq-faq" className="flex max-w-[720px] flex-col gap-4 pt-16 md:pt-24">
          <h2 id="lq-faq" className="text-heading-lg">Preguntas rápidas</h2>
          <div className="flex flex-col gap-3">
            {FAQ.map((item, i) => (
              <AccordionItem key={item.q} title={item.q} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? null : i)}>
                <p className="max-w-prose px-4 pb-4 text-body-md text-on-surface md:px-5">{item.a}</p>
              </AccordionItem>
            ))}
          </div>
        </section>

        <PricingSection
          mode="public"
          className="pt-16 md:pt-24"
          showRibbon={false}
          title="Lite gratis para siempre. Pro cuando lo quieras."
          description={`Toda cuenta empieza con ${TRIAL_DAYS} días de Pro, sin tarjeta. El día ${TRIAL_DAYS + 1} sigues gratis en Lite sin perder nada, o pasas a Pro desde unos ${formatCop(PRO_ANNUAL_PER_DAY_COP)} COP al día con el plan anual.`}
          proAction={{
            label: 'Empieza gratis',
            // El acceso con Google está arriba: se vuelve a él.
            onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
            note: 'Sin tarjeta. Cancela en cualquier momento con 1 clic.',
          }}
        />

        <footer className="mt-16 border-t border-border pt-6 text-center text-body-md text-on-surface">
          Al continuar aceptas los <Link to="/terms" className={linkClass}>Términos</Link> y la <Link to="/privacy" className={linkClass}>Política de privacidad</Link>.
          <LegalFooter className="mt-2" />
        </footer>
      </main>
    </div>
  );
}
