// Enlace de recompensa de un solo uso (/claim?token=…), el que el equipo envía por Instagram.
// Se ve siempre en el tema Calma (.lq-skin-calma), aunque la cuenta lleve otro: es lo que se regala.
// Sin sesión, guarda el token y lleva a iniciar sesión; al volver (o tras el onboarding),
// PendingReward trae de vuelta aquí. Canjear es un clic explícito: abrir el enlace no lo gasta.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Clock, Gift, Link2Off, Sparkles, TicketX, WifiOff } from 'lucide-react';
import { BrandLockup } from '@/components/layout/Brand';
import { Button, buttonClasses } from '@/components/ui/lq';
import { ease } from '@/lib/motion';
import { track } from '@/lib/analytics';
import { SKINS } from '@/lib/shopThemes';
import { useLocale, type Copy } from '@/lib/i18n';
import { useAuthStore } from '@/store/authStore';
import {
  claimReward, clearPendingReward, getReward, rewardErrorStatus, storePendingReward,
  type RewardClaim, type RewardStatus,
} from '@/services/reward.service';

type Unavailable = Exclude<RewardStatus, 'available'> | 'error';

interface Texts {
  eyebrow: string;
  title: string;
  proTitle: (days: number) => string;
  proBody: string;
  themeTitle: string;
  themeBody: string;
  claim: string;
  claiming: string;
  loginHint: string;
  singleUse: string;
  doneTitle: string;
  doneBody: string;
  activated: (days: number, until: string) => string;
  extended: (days: number, until: string) => string;
  complimentary: string;
  themeUnlocked: string;
  themeAgain: string;
  enter: string;
  retry: string;
  failed: string;
  unavailable: Record<Unavailable, { title: string; body: string }>;
  home: string;
}

const COPY: Copy<Texts> = {
  es: {
    eyebrow: 'Recompensa exclusiva',
    title: 'Algo para ti',
    proTitle: (days) => `${days} días de NoutLife Pro`,
    proBody: 'Todas las zonas, sin límites. Si ya tienes Pro, los días se suman al final de tu plan.',
    themeTitle: 'Tema Calma',
    themeBody: 'Grafito y verde niebla. No está en la Tienda.',
    claim: 'Canjear recompensa',
    claiming: 'Canjeando…',
    loginHint: 'Inicia sesión con Google para canjearla.',
    singleUse: 'Enlace de un solo uso.',
    doneTitle: 'Recompensa canjeada',
    doneBody: 'Ya está en tu cuenta. El tema queda puesto también la próxima vez que abras NoutLife.',
    activated: (days, until) => `${days} días de Pro activados, hasta el ${until}.`,
    extended: (days, until) => `Sumamos ${days} días a tu Pro: ahora termina el ${until}.`,
    complimentary: 'Tu Pro de cortesía sigue igual: no tiene fecha de fin.',
    themeUnlocked: 'Tema Calma desbloqueado y puesto.',
    themeAgain: 'Ya tenías el tema Calma: lo volvimos a poner.',
    enter: 'Entrar a NoutLife',
    retry: 'Reintentar',
    failed: 'No pudimos canjearla. Inténtalo de nuevo en un momento.',
    unavailable: {
      claimed: { title: 'Este enlace ya se usó', body: 'Cada enlace de recompensa se puede canjear una sola vez.' },
      expired: { title: 'Este enlace expiró', body: 'Su plazo para canjearlo ya terminó.' },
      invalid: { title: 'Enlace no válido', body: 'Revisa que lo hayas copiado completo.' },
      error: { title: 'No pudimos abrir el enlace', body: 'Revisa tu conexión e inténtalo de nuevo.' },
    },
    home: 'Ir a NoutLife',
  },
  en: {
    eyebrow: 'Exclusive reward',
    title: 'Something for you',
    proTitle: (days) => `${days} days of NoutLife Pro`,
    proBody: 'Every zone, no limits. If you already have Pro, the days are added to the end of your plan.',
    themeTitle: 'Calma theme',
    themeBody: 'Graphite and mist green. Not sold in the Shop.',
    claim: 'Claim reward',
    claiming: 'Claiming…',
    loginHint: 'Sign in with Google to claim it.',
    singleUse: 'Single-use link.',
    doneTitle: 'Reward claimed',
    doneBody: 'It is on your account. The theme stays on the next time you open NoutLife too.',
    activated: (days, until) => `${days} days of Pro activated, until ${until}.`,
    extended: (days, until) => `We added ${days} days to your Pro: it now ends on ${until}.`,
    complimentary: 'Your complimentary Pro stays the same: it has no end date.',
    themeUnlocked: 'Calma theme unlocked and applied.',
    themeAgain: 'You already had the Calma theme: we put it back on.',
    enter: 'Open NoutLife',
    retry: 'Try again',
    failed: 'We could not claim it. Please try again in a moment.',
    unavailable: {
      claimed: { title: 'This link was already used', body: 'Each reward link can be claimed only once.' },
      expired: { title: 'This link has expired', body: 'The time to claim it is over.' },
      invalid: { title: 'Invalid link', body: 'Make sure you copied all of it.' },
      error: { title: 'We could not open the link', body: 'Check your connection and try again.' },
    },
    home: 'Go to NoutLife',
  },
};

const UNAVAILABLE_ICON = { claimed: TicketX, expired: Clock, invalid: Link2Off, error: WifiOff } as const;

const rise = (delay = 0) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease, delay } },
});

/** Muestra del tema: fondo, una tarjeta y el acento, con sus colores reales (SKINS.calma). */
function ThemeSwatch() {
  const p = SKINS.calma.palette;
  return (
    <span aria-hidden className="relative block size-11 shrink-0 overflow-hidden rounded-[12px] border border-white/10" style={{ background: p.background }}>
      <span className="absolute inset-x-1.5 top-2 h-3 rounded-[5px]" style={{ background: p.surface }} />
      <span className="absolute bottom-2 left-1.5 size-2.5 rounded-full" style={{ background: p.accent }} />
      <span className="absolute bottom-2 left-5 h-2.5 w-4 rounded-full opacity-80" style={{ background: p.soft }} />
    </span>
  );
}

function Benefit({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <li className="flex items-start gap-4">
      {icon}
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-heading-sm text-on-background">{title}</span>
        <span className="text-body-sm text-on-surface-light">{body}</span>
      </span>
    </li>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="lq-skin-calma relative isolate flex min-h-dvh flex-col overflow-hidden">
      {/* Un brillo tenue arriba y otro cálido abajo: la misma luz del tema. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_45%_at_50%_-8%,rgb(163_201_193/.10),transparent_70%),radial-gradient(45%_35%_at_100%_100%,rgb(214_196_160/.05),transparent_70%)]" />
      <main id="main" className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center gap-10 px-5 py-12">
        <motion.div {...rise()}><BrandLockup markSize={28} /></motion.div>
        {children}
      </main>
    </div>
  );
}

const card = 'flex flex-col gap-7 rounded-[24px] border border-border bg-surface/70 p-6 shadow-lg backdrop-blur-xl sm:p-7';

export default function ClaimPage() {
  const locale = useLocale();
  const t = COPY[locale];
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { isAuthenticated, isLoading, user, updateUser } = useAuthStore();
  const [status, setStatus] = useState<RewardStatus | 'error' | 'loading'>('loading');
  const [proDays, setProDays] = useState(7);
  const [claiming, setClaiming] = useState(false);
  const [failed, setFailed] = useState(false);
  const [result, setResult] = useState<RewardClaim | null>(null);

  const load = useCallback(() => {
    if (!token) { setStatus('invalid'); return; }
    setStatus('loading');
    getReward(token)
      .then((preview) => {
        setStatus(preview.status);
        if (preview.proDays) setProDays(preview.proDays);
        track('reward_viewed', { status: preview.status });
      })
      .catch(() => setStatus('error'));
  }, [token]);

  useEffect(load, [load]);

  // Llegó con la sesión lista: el token pendiente ya cumplió (si no lo canjea ahora, no se le vuelve a traer).
  const ready = isAuthenticated && Boolean(user?.onboardingCompleted);
  useEffect(() => { if (ready && status !== 'loading') clearPendingReward(); }, [ready, status]);

  const until = (iso: string | null) => (iso
    ? new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-CO', { day: 'numeric', month: 'long' }).format(new Date(iso))
    : '');

  async function claim() {
    if (!isAuthenticated) {
      storePendingReward(token);
      track('reward_login');
      navigate('/login');
      return;
    }
    if (!user?.onboardingCompleted) {
      storePendingReward(token);
      navigate('/onboarding');
      return;
    }
    setClaiming(true);
    setFailed(false);
    try {
      const done = await claimReward(token);
      clearPendingReward();
      // El tema y el plan cambian al instante: App aplica equippedTheme a <html data-theme>.
      updateUser({ equippedTheme: done.equippedTheme, subscription: done.subscription });
      setResult(done.claim);
      track('reward_claimed', { outcome: done.claim.outcome });
    } catch (error) {
      const gone = rewardErrorStatus(error);
      if (gone) { clearPendingReward(); setStatus(gone); } else setFailed(true);
    } finally {
      setClaiming(false);
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <Shell>
        <div className={card} aria-busy="true">
          <div className="h-3 w-28 animate-pulse rounded-full bg-surface-variant" />
          <div className="h-8 w-48 animate-pulse rounded-full bg-surface-variant" />
          <div className="h-24 animate-pulse rounded-[16px] bg-surface-variant/70" />
        </div>
      </Shell>
    );
  }

  if (result) {
    const proLine = result.outcome === 'complimentary' ? t.complimentary
      : result.outcome === 'extended' ? t.extended(result.proDays, until(result.accessEndsAt))
      : t.activated(result.proDays, until(result.accessEndsAt));
    return (
      <Shell>
        <motion.section {...rise(0.05)} className={card} aria-labelledby="lq-claim-done" aria-live="polite">
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1, transition: { duration: 0.5, ease } }}
            className="grid size-12 place-items-center rounded-full bg-primary/15 text-primary"
          >
            <Check aria-hidden className="size-6" strokeWidth={2} />
          </motion.span>
          <div className="flex flex-col gap-2">
            <h1 id="lq-claim-done" className="text-display-sm [text-wrap:balance]">{t.doneTitle}</h1>
            <p className="text-body-md text-on-surface-light">{t.doneBody}</p>
          </div>
          <ul className="flex flex-col gap-3">
            {[proLine, result.themeUnlocked ? t.themeUnlocked : t.themeAgain].map((line, i) => (
              <motion.li key={line} {...rise(0.15 + i * 0.08)} className="flex items-start gap-3 text-body-md text-on-surface">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2.25} />
                <span>{line}</span>
              </motion.li>
            ))}
          </ul>
          <Button size="lg" block onClick={() => navigate('/', { replace: true })}>{t.enter}</Button>
        </motion.section>
      </Shell>
    );
  }

  if (status !== 'available') {
    const Icon = UNAVAILABLE_ICON[status];
    const copy = t.unavailable[status];
    return (
      <Shell>
        <motion.section {...rise(0.05)} className={card} aria-labelledby="lq-claim-gone">
          <span className="grid size-12 place-items-center rounded-full bg-surface-variant text-on-surface-light">
            <Icon aria-hidden className="size-5" strokeWidth={1.75} />
          </span>
          <div className="flex flex-col gap-2">
            <h1 id="lq-claim-gone" className="text-heading-lg [text-wrap:balance]">{copy.title}</h1>
            <p className="text-body-md text-on-surface-light">{copy.body}</p>
          </div>
          {status === 'error'
            ? <Button size="lg" block variant="secondary" onClick={load}>{t.retry}</Button>
            : <Link to="/" replace className={buttonClasses('secondary', 'lg', true)}>{t.home}</Link>}
        </motion.section>
      </Shell>
    );
  }

  return (
    <Shell>
      <motion.section {...rise(0.05)} className={card} aria-labelledby="lq-claim-title">
        <div className="flex flex-col gap-2">
          <p className="text-label-md uppercase tracking-[0.14em] text-on-surface-light">{t.eyebrow}</p>
          <h1 id="lq-claim-title" className="text-display-sm [text-wrap:balance]">{t.title}</h1>
        </div>
        <ul className="flex flex-col gap-5">
          <Benefit
            icon={<span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-primary/15 text-primary"><Sparkles className="size-5" strokeWidth={1.75} /></span>}
            title={t.proTitle(proDays)}
            body={t.proBody}
          />
          <Benefit icon={<ThemeSwatch />} title={t.themeTitle} body={t.themeBody} />
        </ul>
        <div className="flex flex-col gap-3">
          <Button size="lg" block onClick={claim} disabled={claiming} aria-busy={claiming}>
            <Gift aria-hidden className="size-5" strokeWidth={1.75} />{claiming ? t.claiming : t.claim}
          </Button>
          {failed && <p role="alert" className="text-center text-body-sm text-error-text">{t.failed}</p>}
          <p className="text-center text-body-sm text-on-surface-light">
            {isAuthenticated ? t.singleUse : `${t.loginHint} ${t.singleUse}`}
          </p>
        </div>
      </motion.section>
    </Shell>
  );
}
