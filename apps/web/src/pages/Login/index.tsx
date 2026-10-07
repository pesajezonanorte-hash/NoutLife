// Login — solo Google. Una cuenta nueva se crea al entrar por primera
// vez y la guarda de rutas la lleva al onboarding.
import { LegalFooter } from '@/components/legal/LegalFooter';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import * as authService from '@/services/auth.service';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/lq';

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
  const [providers, setProviders] = useState<Providers | null>(null);
  const [apiError, setApiError] = useState('');
  const [busy, setBusy] = useState(false);
  const googleRef = useRef<HTMLDivElement>(null);

  async function signIn(provider: 'google', idToken: string, displayName?: string) {
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

  const none = providers && !providers.googleClientId;

  return (
    <AuthLayout
      title="Entra a Noutlife"
      subtitle="Usa tu cuenta de Google. Si es tu primera vez, creamos tu personaje."
      footer={<>Al continuar aceptas los <Link to="/terms" className="inline-flex min-h-11 items-center font-semibold text-primary-text underline-offset-4 hover:underline">Términos</Link> y la <Link to="/privacy" className="inline-flex min-h-11 items-center font-semibold text-primary-text underline-offset-4 hover:underline">Política de privacidad</Link>.<LegalFooter className="mt-2" /></>}
    >
      <div className="flex flex-col items-stretch gap-3" aria-busy={busy}>
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
