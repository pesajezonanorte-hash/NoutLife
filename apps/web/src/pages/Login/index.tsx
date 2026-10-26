// Portada pública y acceso (solo Google). Una cuenta nueva se crea al entrar por
// primera vez con 7 días de Pro sin tarjeta, y la guarda de rutas la lleva al
// onboarding. Móvil (360 px+): titular, acceso y la ventana de Inicio (el cielo
// de la hora real) antes de cualquier scroll; debajo, los cuatro pilares, el FAQ
// y los planes. En los navegadores de Instagram, Facebook o TikTok, Google no deja
// entrar: el acceso se cambia por «Ábrelo en tu navegador».
//
// Idioma: /login sigue al idioma de la persona (lib/i18n); /en y /es fijan el suyo (LocaleProvider en
// App.tsx) y son las URL que indexa Google, con canonical propio. El aviso legal con enlaces va
// antes del botón de Google (dictamen del asesor: «al continuar aceptas» con el enlace visible antes).
// Al registrarse viajan la zona horaria (fija el mercado de precios) y el idioma de la portada.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle, Globe2 } from 'lucide-react';
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
import { useDocumentLang, useLocale } from '@/lib/i18n';
import { useDocumentMeta } from '@/lib/seo';
import { useOffer } from '@/lib/useOffer';
import { deviceTimezone } from '@/lib/plan';
import { useIsDark } from '@/store/themeStore';
import { clearReferral, readReferral } from '@/services/referral.service';
import { LANDING } from './copy';

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

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const locale = useLocale();
  const offer = useOffer();
  const t = LANDING[locale];
  const [providers, setProviders] = useState<Providers | null>(null);
  const [apiError, setApiError] = useState('');
  const [busy, setBusy] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const googleRef = useRef<HTMLDivElement>(null);
  const [inApp] = useState(() => detectInAppBrowser(navigator.userAgent));
  const now = useNow();
  const dark = useIsDark();
  // El texto del error sigue al idioma aunque se cambie después de que ocurra.
  const [errorKey, setErrorKey] = useState<'signInError' | 'serverError' | 'googleError' | null>(null);

  useDocumentLang(locale);
  // /login, /en y /es muestran la misma portada: Google indexa la del idioma (/en o /es).
  useDocumentMeta({ title: t.meta.title, description: t.meta.description, path: `/${locale}`, locale });

  async function signIn(provider: 'google', idToken: string, displayName?: string) {
    setApiError('');
    setErrorKey(null);
    setBusy(true);
    track('signup_started', { provider, locale });
    try {
      // Invitación (T9): solo la usa el servidor si la cuenta es nueva. Lo mismo la zona y el idioma.
      const referredBy = readReferral();
      const { user, accessToken } = await authService.oauthSignIn({ provider, idToken, displayName, referredBy, timezone: deviceTimezone(), language: locale });
      clearReferral();
      setAuth(user, accessToken);
      const isNew = !user.onboardingCompleted;
      track(isNew ? 'signup_completed' : 'login_completed', { locale, market: user.subscription?.pricing?.market ?? 'CO' });
      if (isNew && user.subscription?.status === 'trialing') track('trial_started', { type: 'reverse' });
      navigate(isNew ? '/onboarding' : '/', { replace: true });
    } catch (err: unknown) {
      // El servidor responde en español: en inglés se muestra el texto propio.
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      if (message && locale === 'es') setApiError(message);
      else setErrorKey('signInError');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    track('landing_viewed', { in_app_browser: inApp ?? false, locale, market: offer.list.market });
    // Una vista por visita y por idioma.
  }, [inApp, locale]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (inApp) return;
    authService.getProviders().then(setProviders).catch(() => setErrorKey('serverError'));
  }, [inApp]);

  useEffect(() => {
    const clientId = providers?.googleClientId;
    if (!clientId) return;
    // Google localiza el texto de su botón con el hl del script (el locale de renderButton no basta): cada
    // idioma de la portada carga el suyo, y el enlace al otro idioma recarga la página.
    loadScript(`https://accounts.google.com/gsi/client?hl=${locale}`).then(() => {
      if (!window.google || !googleRef.current) return;
      window.google.accounts.id.initialize({ client_id: clientId, ux_mode: 'popup', callback: ({ credential }) => void signIn('google', credential) });
      // El texto del botón oficial de Google no se puede cambiar: «Continuar con Google» / «Continue with Google».
      window.google.accounts.id.renderButton(googleRef.current, {
        type: 'standard', theme: dark ? 'outline' : 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', locale,
        width: Math.min(400, googleRef.current.clientWidth || 320),
      });
    }).catch(() => setErrorKey('googleError'));
    // signIn solo usa setters estables y el idioma, que ya está en las dependencias.
  }, [providers?.googleClientId, dark, locale]); // eslint-disable-line react-hooks/exhaustive-deps

  const none = providers && !providers.googleClientId;
  const linkClass = 'font-semibold text-primary-text underline-offset-4 hover:underline';
  const error = apiError || (errorKey ? t[errorKey] : '');

  return (
    <div className="min-h-dvh bg-background text-on-background">
      <main id="main" className="mx-auto flex max-w-[1120px] flex-col px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 md:pt-10">
        <div className="flex items-center justify-between gap-4">
          <BrandLockup markSize={30} />
          {/* El otro idioma, escrito en ese idioma: un enlace rastreable a su portada. Recarga la página para
              traer su cabecera estática y el botón de Google en ese idioma. */}
          <Link
            to={t.otherLanguage.to}
            reloadDocument
            hrefLang={t.otherLanguage.lang}
            lang={t.otherLanguage.lang}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-body-sm text-on-surface-light underline-offset-4 hover:text-on-background hover:underline"
          >
            <Globe2 aria-hidden className="size-4" strokeWidth={1.75} />{t.otherLanguage.label}
          </Link>
        </div>

        {/* Primera pantalla: qué es y cómo entrar. En escritorio, la ventana a la derecha. */}
        <section aria-labelledby="lq-hero" className="grid items-center gap-x-16 gap-y-8 pt-8 md:min-h-[min(720px,82dvh)] md:grid-cols-[minmax(0,1fr)_minmax(320px,440px)] md:pt-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease } }}
            className="flex max-w-[520px] flex-col gap-6"
          >
            <div className="flex flex-col gap-3">
              <h1 id="lq-hero" className="text-display-sm [text-wrap:balance] sm:text-display-md lg:text-display-lg">
                <Lettering key={locale} text={t.headline} delay={0.2} />
              </h1>
              <p className="text-body-lg text-on-surface-light [text-wrap:pretty]">{t.subhead}</p>
            </div>

            {inApp ? <OpenInBrowser app={inApp} /> : (
              <div className="flex flex-col gap-3" aria-busy={busy}>
                <p className="text-label-lg">{t.start}</p>
                {/* Antes del botón: al continuar se aceptan los Términos y la Privacidad, con sus enlaces a la vista. */}
                <p className="max-w-[400px] text-body-sm text-on-surface-light">
                  {t.consent.before} <Link to="/terms" className={linkClass}>{t.consent.terms}</Link> {t.consent.and}{' '}
                  <Link to="/privacy" className={linkClass}>{t.consent.privacy}</Link>{t.consent.after}
                </p>
                {providers?.googleClientId && <div ref={googleRef} className="flex min-h-11 max-w-[400px]" />}
                {none && <p className="text-body-sm text-on-surface-light">{t.unavailable}</p>}
                <p className="text-body-sm text-on-surface-light">{t.trialLine(offer)}</p>
                {error && (
                  <p role="alert" className="flex items-start gap-2 rounded-xl bg-error/[var(--lq-soft-alpha)] px-4 py-3 text-body-sm text-error-text">
                    <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
                    {error}
                  </p>
                )}
              </div>
            )}
          </motion.div>

          {/* La ventana de Inicio: el cielo de la hora real del visitante, igual que dentro de la app. */}
          <figure className="mx-auto w-full max-w-[400px] md:max-w-none">
            <HomeWindow now={now} className="max-w-[440px]" />
            <figcaption className="pt-4 text-center text-body-sm text-on-surface-light">{t.windowCaption}</figcaption>
          </figure>
        </section>

        <section aria-labelledby="lq-pillars" className="flex flex-col gap-8 pt-16 md:pt-24">
          <h2 id="lq-pillars" className="max-w-[560px] text-heading-lg [text-wrap:balance] md:text-display-sm">{t.pillarsTitle}</h2>
          <dl className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
            {t.pillars.map((p) => (
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
          <h2 id="lq-faq" className="text-heading-lg">{t.faqTitle}</h2>
          <div className="flex flex-col gap-3">
            {t.faq.map((item, i) => (
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
          title={t.pricingTitle}
          description={t.pricingDescription(offer)}
          proAction={{
            label: t.startFree,
            // El acceso con Google está arriba: se vuelve a él.
            onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
            note: t.startFreeNote,
          }}
        />

        <LegalFooter className="mt-16 border-t border-border" />
      </main>
    </div>
  );
}
