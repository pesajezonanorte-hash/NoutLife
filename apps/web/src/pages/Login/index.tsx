// Login — solo Google o Apple. Una cuenta nueva se crea al entrar por primera
// vez y la guarda de rutas la lleva al onboarding.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import * as authService from '@/services/auth.service';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/lq';

type Providers = { googleClientId: string | null; appleClientId: string | null; appleRedirectUri: string | null };

declare global {
  interface Window {
    google?: { accounts: { id: {
      initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: 'popup' }) => void;
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
    } } };
    AppleID?: { auth: {
      init: (o: { clientId: string; scope: string; redirectURI: string; usePopup: boolean }) => void;
      signIn: () => Promise<{ authorization: { id_token: string }; user?: { name?: { firstName?: string; lastName?: string } } }>;
    } };
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

function AppleLogo() {
  return (
    <svg aria-hidden viewBox="0 0 17 20" className="size-[18px] fill-current">
      <path d="M14.2 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9C3.7 4.8 2 5.8 1.1 7.4c-1.9 3.3-.5 8.1 1.3 10.8.9 1.3 1.9 2.7 3.3 2.7 1.3-.1 1.8-.9 3.4-.9s2 .9 3.4.8c1.4 0 2.3-1.3 3.2-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.9-1.1-2.9-4.6ZM11.6 2.9c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.1 1.1.1 2.3-.6 3-1.5Z" />
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [providers, setProviders] = useState<Providers | null>(null);
  const [apiError, setApiError] = useState('');
  const [busy, setBusy] = useState(false);
  const googleRef = useRef<HTMLDivElement>(null);

  async function signIn(provider: 'google' | 'apple', idToken: string, displayName?: string) {
    setApiError('');
    setBusy(true);
    try {
      const { user, accessToken } = await authService.oauthSignIn({ provider, idToken, displayName });
      setAuth(user, accessToken);
      navigate(user.onboardingCompleted ? '/' : '/onboarding', { replace: true });
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setApiError(message ?? 'No se pudo iniciar sesión. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    authService.getProviders().then(setProviders).catch(() => setApiError('No se pudo conectar con el servidor. Inténtalo de nuevo.'));
  }, []);

  useEffect(() => {
    const clientId = providers?.googleClientId;
    if (!clientId) return;
    loadScript('https://accounts.google.com/gsi/client').then(() => {
      if (!window.google || !googleRef.current) return;
      window.google.accounts.id.initialize({ client_id: clientId, ux_mode: 'popup', callback: ({ credential }) => void signIn('google', credential) });
      window.google.accounts.id.renderButton(googleRef.current, {
        type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale: 'es',
        width: Math.min(400, googleRef.current.clientWidth || 320),
      });
    }).catch(() => setApiError('No se pudo cargar el inicio de sesión de Google.'));
    // signIn solo usa setters estables: no hace falta en las dependencias.
  }, [providers?.googleClientId]);

  async function apple() {
    if (!providers?.appleClientId) return;
    setApiError('');
    try {
      await loadScript('https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/es_ES/appleid.auth.js');
      window.AppleID!.auth.init({
        clientId: providers.appleClientId, scope: 'name email',
        redirectURI: providers.appleRedirectUri ?? window.location.origin, usePopup: true,
      });
      const res = await window.AppleID!.auth.signIn();
      const n = res.user?.name;
      await signIn('apple', res.authorization.id_token, [n?.firstName, n?.lastName].filter(Boolean).join(' ') || undefined);
    } catch (err) {
      // Cerrar la ventana de Apple no es un error.
      if ((err as { error?: string })?.error !== 'popup_closed_by_user') setApiError('No se pudo iniciar sesión con Apple.');
    }
  }

  const none = providers && !providers.googleClientId && !providers.appleClientId;

  return (
    <AuthLayout
      title="Entra a Noutlife"
      subtitle="Usa tu cuenta de Google o Apple. Si es tu primera vez, creamos tu personaje."
      footer={<>Al continuar aceptas los <Link to="/terms" className="inline-flex min-h-11 items-center font-semibold text-primary-text underline-offset-4 hover:underline">Términos</Link> y la <Link to="/privacy" className="inline-flex min-h-11 items-center font-semibold text-primary-text underline-offset-4 hover:underline">Política de privacidad</Link>.</>}
    >
      <div className="flex flex-col items-stretch gap-3" aria-busy={busy}>
        {providers?.appleClientId && (
          <Button size="lg" block onClick={() => void apple()} loading={busy} className="!bg-black !text-white hover:!bg-black/85 dark:!bg-white dark:!text-black">
            <AppleLogo />Continuar con Apple
          </Button>
        )}
        {providers?.googleClientId && <div ref={googleRef} className="flex min-h-11 justify-center" />}
        {none && <p className="text-body-sm text-on-surface-light">El inicio de sesión no está disponible ahora mismo.</p>}

        {apiError && (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-error/[var(--lq-soft-alpha)] px-4 py-3 text-body-sm text-error-text">
            <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            {apiError}
          </p>
        )}
      </div>
    </AuthLayout>
  );
}
