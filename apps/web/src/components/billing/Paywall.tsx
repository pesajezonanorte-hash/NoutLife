// Paywall de entrada: nadie entra al Dashboard sin vincular antes un método de
// pago (tarjeta o Nequi, con Wompi). Con la prueba disponible: $0 hoy, 7 días
// de Pro y luego $9.900 COP/mes, cancelable con 1 clic. Si el correo o el
// medio de pago ya usaron su prueba, el servidor la niega y la persona elige
// entre pagar Pro o entrar a NoutLife Lite (también con el medio vinculado).
// Vidrio esmerilado sobre luz de ambiente, el precio como protagonista y pasos
// con transición lateral (oferta → método de pago → listo).
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CheckCircle2, Gem, Lock, LogOut } from 'lucide-react';
import type { Subscription } from '@noutlife/shared';
import { AmbientLight, Sheen } from '@/components/ambience';
import { BrandLockup } from '@/components/layout/Brand';
import { DangerDialog } from '@/components/settings/DangerDialog';
import { Badge, Button, Confetti } from '@/components/ui/lq';
import { ease, useMotionReduced } from '@/lib/motion';
import { LITE_LIMITS, PRO_PER_DAY_COP, PRO_PRICE_COP, PRO_ZONE_COUNT, TRIAL_DAYS, formatCop, longDay } from '@/lib/plan';
import * as authService from '@/services/auth.service';
import { getBillingConfig, getBillingStatus } from '@/services/billing.service';
import { useAuthStore } from '@/store/authStore';
import { usePlanStore } from '@/store/planStore';
import { PaymentMethodForm, type PaymentMethodFormProps } from './PaymentMethodForm';
import { TrialRibbon } from './TrialRibbon';

const PRICE = formatCop(PRO_PRICE_COP);

type Intent = PaymentMethodFormProps['intent'];
type Step = 'offer' | 'form' | 'done';

/** Ancla Pro / Lite: lo que abre Pro y lo que en Lite queda con candado o con tope. */
const ROWS: Array<{ label: string; detail?: string; pro: string | true; lite: string | false }> = [
  { label: `${PRO_ZONE_COUNT} zonas Pro`, detail: 'Finanzas, Gimnasio, Comida, Sueño…', pro: true, lite: false },
  { label: 'Hábitos y rutinas activos', pro: 'Ilimitados', lite: `Hasta ${LITE_LIMITS.activeHabits}` },
  { label: 'Historial y analíticas', pro: 'Completos', lite: `${LITE_LIMITS.historyDays} días` },
  { label: 'El Sabio con IA', pro: true, lite: false },
];

/** Título de cada paso; al cambiar de paso recibe el foco (los lectores lo anuncian). */
function StepTitle({ id, focus, children }: { id: string; focus: boolean; children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (focus) ref.current?.focus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <h1 ref={ref} id={id} tabIndex={-1} className="text-heading-lg tracking-tight outline-none [text-wrap:balance] sm:text-display-sm">
      {children}
    </h1>
  );
}

function Comparison() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background/60">
      <table className="w-full border-collapse text-left text-body-sm">
        <caption className="sr-only">Qué incluye NoutLife Pro frente a NoutLife Lite</caption>
        <thead>
          <tr className="border-b border-border text-label-md">
            <th scope="col" className="px-4 py-2.5 font-normal text-on-surface-light">Qué incluye</th>
            <th scope="col" className="w-[84px] bg-secondary/[var(--lq-soft-alpha)] px-2 py-2.5 text-center font-semibold text-secondary-text">Pro</th>
            <th scope="col" className="w-[68px] px-2 py-2.5 text-center font-normal text-on-surface-light">Lite</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.label} className="border-b border-border last:border-b-0">
              <th scope="row" className="px-4 py-2.5 font-normal text-on-background">
                {row.label}
                {row.detail && <span className="block text-label-sm font-normal text-on-surface-light">{row.detail}</span>}
              </th>
              <td className="bg-secondary/[var(--lq-soft-alpha)] px-2 py-2.5 text-center font-semibold text-on-background">
                {row.pro === true
                  ? <><Check aria-hidden className="mx-auto size-4 text-success-text" strokeWidth={2.5} /><span className="sr-only">Incluido</span></>
                  : row.pro}
              </td>
              <td className="px-2 py-2.5 text-center text-on-surface-light">
                {row.lite === false
                  ? <><Lock aria-hidden className="mx-auto size-4" strokeWidth={1.75} /><span className="sr-only">Bloqueado</span></>
                  : row.lite}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Texto del último paso según lo que respondió el servidor. */
function doneCopy(next: Subscription, intent: Intent): { title: string; body: string; cta: string } {
  if (next.pendingPayment) {
    return {
      title: 'Tu pago está en proceso',
      body: next.paymentMethodType === 'NEQUI'
        ? 'Aprueba el cobro en tu app de Nequi. Tu cuenta pasa a Pro sola en cuanto Wompi lo confirme.'
        : 'Wompi está confirmando tu pago. Tu cuenta pasa a Pro sola en unos minutos.',
      cta: 'Entrar a NoutLife',
    };
  }
  if (intent === 'trial' && next.status === 'trialing') {
    return {
      title: 'Tu prueba Pro empezó',
      body: `Tienes todo NoutLife Pro gratis hasta el ${longDay(next.trialEndsAt)}. Hoy no se cobró nada y cancelas con 1 clic en Plan.`,
      cta: 'Entrar a NoutLife',
    };
  }
  if (next.plan === 'pro') {
    return intent === 'save'
      ? { title: 'Listo, sigues en Pro', body: `El próximo cobro de ${PRICE} es el ${longDay(next.accessEndsAt)}. Cancelas con 1 clic en Plan.`, cta: 'Entrar a NoutLife' }
      : { title: 'Ya tienes NoutLife Pro', body: 'Todas las zonas, hábitos ilimitados y el Sabio con IA están listos.', cta: 'Entrar a NoutLife' };
  }
  return {
    title: 'Todo listo',
    body: 'Tu método de pago quedó vinculado y hoy no se cobró nada. Entras con NoutLife Lite; activa Pro cuando quieras desde Plan.',
    cta: 'Entrar a NoutLife Lite',
  };
}

export function Paywall() {
  const reduce = useMotionReduced();
  const titleId = useId();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const logoutLocal = useAuthStore((s) => s.logout);
  const holdPaywall = usePlanStore((s) => s.holdPaywall);
  const releasePaywall = usePlanStore((s) => s.releasePaywall);
  const sub = user?.subscription ?? null;
  const [step, setStep] = useState<Step>('offer');
  const [intent, setIntent] = useState<Intent>('trial');
  const [result, setResult] = useState<Subscription | null>(null);
  const [nequi, setNequi] = useState(false);
  const [danger, setDanger] = useState(false);
  const [leaving, setLeaving] = useState(false);
  /** El primer paso no roba el foco al cargar; los siguientes sí. */
  const moved = useRef(false);

  // Sigue en pantalla hasta que la persona pulsa «Entrar», aunque el medio ya esté vinculado.
  useEffect(() => { holdPaywall(); }, [holdPaywall]);

  useEffect(() => {
    let alive = true;
    getBillingConfig().then((config) => { if (alive) setNequi(config.nequiEnabled); }).catch(() => null);
    // Estado real del servidor: si ya vinculó un medio de pago (otra pestaña), entra directo.
    getBillingStatus()
      .then(({ subscription }) => {
        if (!alive) return;
        updateUser({ subscription });
        if (subscription.paywall === false) releasePaywall();
      })
      .catch(() => null);
    return () => { alive = false; };
  }, [updateUser, releasePaywall]);

  const trial = Boolean(sub?.trialAvailable);
  // Cuentas con prueba o cancelación aún vigentes y sin medio de pago: solo se vincula, sin cobro.
  const keepsPro = Boolean(sub && sub.status !== 'lite');
  const primary: Intent = trial ? 'trial' : keepsPro ? 'save' : 'charge';

  function go(next: Step) {
    moved.current = true;
    setStep(next);
  }

  function start(next: Intent) {
    setIntent(next);
    go('form');
  }

  function finish(next: Subscription) {
    setResult(next);
    go('done');
  }

  /** Antes de vincular, vuelve a la oferta. Tras una prueba negada el medio ya quedó vinculado: entra en Lite. */
  function cancelForm() {
    if (useAuthStore.getState().user?.subscription?.hasPaymentMethod) releasePaywall();
    else go('offer');
  }

  async function logout() {
    setLeaving(true);
    try { await authService.logout(); } catch { /* el estado local se limpia igual */ }
    releasePaywall();
    logoutLocal();
  }

  const slide = reduce
    ? {}
    : {
        initial: { opacity: 0, x: 28 },
        animate: { opacity: 1, x: 0, transition: { duration: 0.36, ease } },
        exit: { opacity: 0, x: -28, transition: { duration: 0.18 } },
      };

  const offer: { title: string; lead: string; price: string; unit?: string; fine: string } = primary === 'trial'
    ? {
        title: `${TRIAL_DAYS} días de Pro, gratis`,
        lead: 'Todas las zonas, hábitos ilimitados y el Sabio con IA desde hoy.',
        price: '$0 hoy',
        fine: `Luego ${PRICE} COP/mes.`,
      }
    : primary === 'save'
      ? {
          title: sub?.status === 'trialing' ? 'Tu prueba Pro sigue activa' : 'Tu Pro sigue activo',
          lead: 'Configura tu método de pago para seguir sin cortes.',
          price: '$0 hoy',
          fine: `El próximo cobro de ${PRICE} COP es el ${longDay(sub?.accessEndsAt)}.`,
        }
      : {
          title: 'Activa NoutLife Pro',
          lead: 'Ya usaste tu prueba gratis. Activa Pro y sigue con todo NoutLife desde hoy.',
          price: PRICE,
          unit: 'COP/mes',
          fine: `Unos ${formatCop(PRO_PER_DAY_COP)} al día.`,
        };

  const formTitle = intent === 'charge' ? 'Activa NoutLife Pro' : intent === 'save' && !keepsPro ? 'Entra a NoutLife Lite' : 'Configura tu método de pago';
  const done = result ? doneCopy(result, intent) : null;
  const celebrate = Boolean(result && !result.pendingPayment && result.plan === 'pro');

  return (
    <div className="relative isolate flex min-h-dvh flex-col bg-background text-on-background">
      {/* Luz de ambiente: el oro de Pro arriba y el jade de la marca abajo, respirando despacio.
          Se recorta aquí y no en la raíz: un overflow en la raíz anularía el botón fijo del móvil. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <AmbientLight tone="secondary" alpha={0.2} darkAlpha={0.12} d={14} className="-top-[14rem] left-1/2 h-[44rem] w-[44rem] -translate-x-1/2" />
        <AmbientLight tone="primary" alpha={0.12} darkAlpha={0.08} d={18} className="-bottom-[16rem] -left-[10rem] h-[36rem] w-[36rem]" />
        <AmbientLight tone="primary" alpha={0.08} darkAlpha={0.06} d={22} className="-right-[12rem] top-1/3 h-[30rem] w-[30rem]" />
      </div>

      <header className="mx-auto flex w-full max-w-[1040px] items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] md:pt-6">
        <BrandLockup markSize={30} />
        <Button variant="ghost" size="sm" loading={leaving} onClick={() => void logout()} className="text-on-surface-light">
          <LogOut aria-hidden className="size-4" strokeWidth={1.75} />Cerrar sesión
        </Button>
      </header>

      <main id="main" className="flex flex-1 items-start justify-center px-4 pb-8 pt-4 sm:items-center">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 28, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 240, damping: 26, mass: 0.9 }}
          className="relative w-full max-w-[460px] rounded-[32px] border border-border/70 bg-surface/70 p-5 shadow-xl backdrop-blur-2xl backdrop-saturate-150 sm:p-7"
        >
          <AnimatePresence mode="wait" initial={false}>
            {step === 'offer' && (
              <motion.section key="offer" {...slide} aria-labelledby={titleId} className="flex flex-col gap-6">
                <div className="flex flex-col items-center gap-3 text-center">
                  <Badge variant="secondary" icon={Gem}>NoutLife Pro</Badge>
                  <StepTitle id={titleId} focus={moved.current}>{offer.title}</StepTitle>
                  <p className="max-w-[34ch] text-body-md text-on-surface-light">{offer.lead}</p>
                </div>

                {/* El precio manda; la letra pequeña queda en una línea. */}
                <div className="relative overflow-hidden rounded-3xl border border-secondary/40 bg-secondary/[var(--lq-soft-alpha)] px-5 py-6 text-center">
                  <Sheen every={8} delay={1.4} />
                  <p className="flex flex-wrap items-baseline justify-center gap-x-2">
                    <span className="text-display-lg font-semibold tracking-tight tabular-nums">{offer.price}</span>
                    {offer.unit && <span className="text-body-lg text-on-surface-light">{offer.unit}</span>}
                  </p>
                  <p className="mt-1 text-body-md font-semibold text-on-background [text-wrap:balance]">Cancela en cualquier momento con 1 clic.</p>
                  <p className="mt-0.5 text-body-sm text-on-surface-light">{offer.fine}</p>
                </div>

                {primary === 'trial' && (
                  <TrialRibbon
                    chargeLabel={`Día ${TRIAL_DAYS + 1}: ${PRICE}`}
                    summary={`Los primeros ${TRIAL_DAYS} días son gratis. El día ${TRIAL_DAYS + 1} empieza el cobro de ${PRICE} COP al mes, salvo que canceles antes.`}
                  />
                )}

                <Comparison />

                {/* En el móvil el botón queda fijo abajo, sobre vidrio: siempre a la vista. */}
                <div className="sticky bottom-0 z-10 -mx-5 flex flex-col gap-2 border-t border-border/60 bg-surface/85 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
                  <Button size="lg" block onClick={() => start(primary)}>Configurar método de pago</Button>
                  <p className="flex items-center justify-center gap-1.5 text-center text-label-sm text-on-surface-light">
                    <Lock aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
                    {nequi ? 'Tarjeta o Nequi · Pago seguro con Wompi' : 'Tarjeta débito o crédito · Pago seguro con Wompi'}
                  </p>
                  {primary === 'charge' && (
                    <Button variant="ghost" size="md" onClick={() => start('save')}>Prefiero NoutLife Lite</Button>
                  )}
                </div>
              </motion.section>
            )}

            {step === 'form' && (
              <motion.section key="form" {...slide} aria-labelledby={titleId} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <StepTitle id={titleId} focus={moved.current}>{formTitle}</StepTitle>
                  {intent === 'save' && !keepsPro && (
                    <p className="text-body-sm text-on-surface-light">NoutLife Lite es gratis. Para entrar también se vincula un método de pago; hoy no se cobra nada.</p>
                  )}
                </div>
                <PaymentMethodForm
                  intent={intent}
                  chargeDate={keepsPro ? sub?.accessEndsAt : null}
                  onDone={finish}
                  onCancel={cancelForm}
                  cancelLabel="Atrás"
                />
              </motion.section>
            )}

            {step === 'done' && done && (
              <motion.section key="done" {...slide} aria-labelledby={titleId} className="flex flex-col items-center gap-5 py-2 text-center">
                {celebrate && <Confetti />}
                <motion.span
                  initial={reduce ? false : { scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 18 }}
                  className="flex size-20 items-center justify-center rounded-full bg-success/[var(--lq-soft-alpha)]"
                >
                  <CheckCircle2 aria-hidden className="size-11 text-success-text" strokeWidth={1.5} />
                </motion.span>
                <StepTitle id={titleId} focus={moved.current}>{done.title}</StepTitle>
                <p className="max-w-[36ch] text-body-md text-on-surface" aria-live="polite">{done.body}</p>
                <Button size="lg" block onClick={releasePaywall}>{done.cta}</Button>
              </motion.section>
            )}
          </AnimatePresence>
        </motion.div>
      </main>

      <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-label-sm text-on-surface-light">
        <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">Términos</a>
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">Privacidad</a>
        <button type="button" onClick={() => setDanger(true)} className="underline-offset-2 hover:underline">Eliminar mi cuenta</button>
      </footer>

      <DangerDialog mode={danger ? 'delete' : null} onClose={() => setDanger(false)} />
    </div>
  );
}
