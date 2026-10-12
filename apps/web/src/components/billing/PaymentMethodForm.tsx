// Medio de pago: tarjeta o Nequi. Los dos se vinculan con Wompi desde el navegador
// (llave pública) y a la API de NoutLife solo llega un token: el servidor lee en
// Wompi los datos reales del medio de pago y decide la prueba gratis. Nequi pide
// además la cédula, que solo entra en la huella anti-abuso. Wompi exige aceptar
// explícitamente sus dos documentos: una sola casilla, en micro-texto.
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CreditCard, Gem, Lock, Smartphone, type LucideIcon } from 'lucide-react';
import type { Subscription } from '@noutlife/shared';
import { Button, Field, Input } from '@/components/ui/lq';
import { useAuthStore } from '@/store/authStore';
import { ease, useMotionReduced } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { PRO_FRAMING, PRO_FRAMING_TRIAL, PRO_PRICE_COP, TRIAL_DAYS, formatCop, longDay } from '@/lib/plan';
import {
  PaymentError, getBillingConfig, isValidCardNumber, savePaymentMethod, subscribe, tokenizeCard, tokenizeNequi,
  waitForNequiApproval, type BillingConfig, type CardInput, type PaymentField, type PaymentMethodLink,
} from '@/services/billing.service';

const PRICE = formatCop(PRO_PRICE_COP);
const DAY_MS = 24 * 60 * 60_000;

type Method = 'CARD' | 'NEQUI';
type Errors = Partial<Record<PaymentField | 'consent', string>>;

const formatNumber = (value: string) => value.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
const formatExpiry = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
};
const formatPhone = (value: string) => value.replace(/\D/g, '').slice(0, 10).replace(/^(\d{3})(\d{0,3})(\d{0,4}).*$/, (_, a: string, b: string, c: string) => [a, b, c].filter(Boolean).join(' '));
const apiError = (error: unknown) => (error as { response?: { data?: { error?: string } } }).response?.data?.error;

function validateCard(number: string, expiry: string, cvc: string, holder: string, consent: boolean): Errors {
  const errors: Errors = {};
  if (!isValidCardNumber(number)) errors.number = 'Revisa el número de la tarjeta.';
  const [mm, yy] = expiry.split('/');
  const month = Number(mm);
  const year = 2000 + Number(yy);
  const now = new Date();
  if (!mm || !yy || yy.length !== 2 || month < 1 || month > 12) errors.expiry = 'Escribe el vencimiento como MM/AA.';
  else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) errors.expiry = 'Esta tarjeta ya venció.';
  if (!/^\d{3,4}$/.test(cvc)) errors.cvc = 'El código tiene 3 o 4 dígitos.';
  if (holder.trim().length < 3) errors.holder = 'Escribe el nombre como aparece en la tarjeta.';
  if (!consent) errors.consent = 'Marca la casilla de Wompi para continuar.';
  return errors;
}

function validateNequi(phone: string, documentNumber: string, consent: boolean): Errors {
  const errors: Errors = {};
  if (!/^3\d{9}$/.test(phone.replace(/\D/g, ''))) errors.phone = 'Escribe tu celular Nequi de 10 dígitos. Empieza por 3.';
  if (!/^\d{6,10}$/.test(documentNumber)) errors.documentNumber = 'Escribe tu cédula, solo números (entre 6 y 10 dígitos).';
  if (!consent) errors.consent = 'Marca la casilla de Wompi para continuar.';
  return errors;
}

function MethodOption({ active, icon: Icon, label, hint, onClick }: { active: boolean; icon: LucideIcon; label: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex min-h-14 items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-colors',
        active ? 'border-secondary/60 bg-secondary/[var(--lq-soft-alpha)] text-on-background' : 'border-border text-on-surface-light',
      )}
    >
      <Icon aria-hidden className="size-5 shrink-0" strokeWidth={1.75} />
      <span className="flex min-w-0 flex-col">
        <span className="text-body-md font-semibold">{label}</span>
        <span className="text-label-sm">{hint}</span>
      </span>
    </button>
  );
}

/** Reencuadre del precio, justo encima del botón que cobra: la cuota dicha en días quita la objeción. */
function PriceFraming({ trial }: { trial: boolean }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-secondary/[var(--lq-soft-alpha)] px-4 py-3 text-body-sm text-on-background">
      <Gem aria-hidden className="mt-0.5 size-4 shrink-0 text-secondary-text" strokeWidth={1.75} />
      {trial ? PRO_FRAMING_TRIAL : PRO_FRAMING}
    </p>
  );
}

export interface PaymentMethodFormProps {
  /**
   * trial: vincula el medio de pago y empieza la prueba ($0 hoy; el servidor la confirma).
   * save: cambia el medio de pago, sin cobro. charge: lo vincula y cobra el primer mes (desde Lite).
   */
  intent: 'trial' | 'save' | 'charge';
  /** Fecha del próximo cobro, para el texto de «save». */
  chargeDate?: string | null;
  onDone: (subscription: Subscription) => void;
  onCancel?: () => void;
  /** Texto del botón que llama a `onCancel` antes de vincular («Ahora no» por defecto). */
  cancelLabel?: string;
}

export function PaymentMethodForm({ intent, chargeDate, onDone, onCancel, cancelLabel = 'Ahora no' }: PaymentMethodFormProps) {
  const updateUser = useAuthStore((s) => s.updateUser);
  const reduce = useMotionReduced();
  const consentId = useId();
  const alive = useRef(false);
  const [config, setConfig] = useState<BillingConfig | null>(null);
  const [configError, setConfigError] = useState(false);
  const [method, setMethod] = useState<Method>('CARD');
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [holder, setHolder] = useState('');
  const [phone, setPhone] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  /** Esperando que la persona apruebe la vinculación en su app de Nequi. */
  const [awaiting, setAwaiting] = useState(false);
  /** El servidor negó la prueba (correo o medio de pago ya usados): el medio quedó vinculado y se ofrece pagar. */
  const [denied, setDenied] = useState('');
  // Calculada una vez: el texto no cambia mientras se escribe.
  const [trialEnd] = useState(() => new Date(Date.now() + TRIAL_DAYS * DAY_MS).toISOString());

  useEffect(() => {
    alive.current = true;
    getBillingConfig().then(setConfig).catch(() => setConfigError(true));
    return () => { alive.current = false; };
  }, []);

  function finish(subscription: Subscription) {
    updateUser({ subscription });
    if (subscription.plan === 'pro' || subscription.pendingPayment) onDone(subscription);
    else setFormError(subscription.lastPaymentError ?? 'No se pudo completar el cobro. Prueba con otro método de pago.');
  }

  function switchMethod(next: Method) {
    setMethod(next);
    setErrors({});
    setFormError('');
  }

  async function cardLink(cfg: BillingConfig): Promise<PaymentMethodLink> {
    const [expMonth, expYear] = expiry.split('/');
    return tokenizeCard(cfg, { number, expMonth, expYear, cvc, holder } satisfies CardInput);
  }

  /** Nequi: Wompi manda la aprobación al celular; esperamos a que la persona la dé. */
  async function nequiLink(cfg: BillingConfig): Promise<PaymentMethodLink> {
    const token = await tokenizeNequi(cfg, phone.replace(/\D/g, ''));
    setAwaiting(true);
    try {
      await waitForNequiApproval(cfg, token, () => !alive.current);
    } finally {
      setAwaiting(false);
    }
    return { method: 'NEQUI', nequiToken: token, documentNumber };
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found = method === 'CARD'
      ? validateCard(number, expiry, cvc, holder, consent)
      : validateNequi(phone, documentNumber, consent);
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length || !config) return;

    setBusy(true);
    try {
      const link = method === 'CARD' ? await cardLink(config) : await nequiLink(config);
      const subscription = await savePaymentMethod(link);
      if (intent === 'charge') { finish(await subscribe()); return; }
      updateUser({ subscription });
      if (intent === 'trial' && subscription.plan !== 'pro') {
        setDenied(subscription.lastPaymentError ?? 'Este método de pago ya usó una prueba gratis.');
        return;
      }
      onDone(subscription);
    } catch (error) {
      if (error instanceof PaymentError) {
        if (error.field) setErrors({ [error.field]: error.message });
        else setFormError(error.message);
      } else {
        setFormError(apiError(error) ?? 'No pudimos vincular tu método de pago. Inténtalo de nuevo.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function payNow() {
    setBusy(true);
    setFormError('');
    try {
      finish(await subscribe());
    } catch (error) {
      setFormError(apiError(error) ?? 'No se pudo activar Pro. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  if (configError || (config && !config.enabled)) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-body-md text-on-surface">Los pagos aún no están disponibles. Tu cuenta sigue funcionando con normalidad.</p>
        {onCancel && <Button variant="secondary" size="md" onClick={onCancel} className="self-end">Entendido</Button>}
      </div>
    );
  }

  const fade = reduce
    ? {}
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.28, ease } };
  const errorBox = formError && (
    <p role="alert" className="flex items-start gap-2 rounded-xl bg-error/[var(--lq-soft-alpha)] px-4 py-3 text-body-sm text-error-text">
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />{formError}
    </p>
  );

  return (
    <AnimatePresence mode="wait" initial={false}>
      {denied ? (
        <motion.div key="denied" {...fade} className="flex flex-col gap-4">
          <p role="alert" className="text-body-md text-on-surface">
            {denied} Tu método de pago quedó vinculado: activa Pro y sigue sin límites.
          </p>
          {errorBox}
          <PriceFraming trial={false} />
          <Button size="lg" block loading={busy} onClick={() => void payNow()}>Activar Pro por {PRICE}/mes</Button>
          <p className="text-center text-label-sm text-on-surface-light">Cancela en cualquier momento con 1 clic.</p>
          {onCancel && <Button variant="ghost" size="md" onClick={onCancel} disabled={busy}>Seguir en NoutLife Lite</Button>}
        </motion.div>
      ) : (
        <motion.form key="form" {...fade} noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" aria-busy={busy}>
          {intent === 'trial' && (
            <div className="flex flex-col items-center gap-1 py-1 text-center">
              <p className="text-display-md font-semibold tracking-tight tabular-nums">$0 hoy</p>
              <p className="text-body-md text-on-background">Cancela en cualquier momento con 1 clic.</p>
              <p className="text-body-sm text-on-surface-light">
                {TRIAL_DAYS} días de Pro gratis. Luego {PRICE}/mes desde el {longDay(trialEnd)}.
              </p>
            </div>
          )}

          {config?.nequiEnabled ? (
            <fieldset disabled={busy} className="flex flex-col gap-2">
              <legend className="mb-2 text-label-md text-on-surface-light">Medio de pago</legend>
              <div className="grid grid-cols-2 gap-2">
                <MethodOption active={method === 'CARD'} icon={CreditCard} label="Tarjeta" hint="Débito o crédito" onClick={() => switchMethod('CARD')} />
                <MethodOption active={method === 'NEQUI'} icon={Smartphone} label="Nequi" hint="Desde tu celular" onClick={() => switchMethod('NEQUI')} />
              </div>
            </fieldset>
          ) : (
            <p className="text-label-md text-on-surface-light">Medio de pago · tarjeta débito o crédito</p>
          )}

          {method === 'CARD' ? (
            <>
              <Field label="Número de la tarjeta" error={errors.number}>
                <Input
                  value={number} onChange={(e) => setNumber(formatNumber(e.target.value))}
                  inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" className="font-mono" data-autofocus
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Vencimiento" error={errors.expiry}>
                  <Input value={expiry} onChange={(e) => setExpiry(formatExpiry(e.target.value))} inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" className="font-mono" />
                </Field>
                <Field label="Código de seguridad" error={errors.cvc}>
                  <Input value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" autoComplete="cc-csc" placeholder="CVC" className="font-mono" />
                </Field>
              </div>
              <Field label="Nombre en la tarjeta" error={errors.holder}>
                <Input value={holder} onChange={(e) => setHolder(e.target.value)} autoComplete="cc-name" autoCapitalize="characters" />
              </Field>
            </>
          ) : (
            <>
              <Field label="Celular Nequi" error={errors.phone}>
                <Input
                  value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))}
                  inputMode="tel" autoComplete="tel-national" placeholder="300 000 0000" className="font-mono" data-autofocus
                />
              </Field>
              <Field label="Cédula" error={errors.documentNumber}>
                <Input
                  value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  inputMode="numeric" autoComplete="off" placeholder="Solo números" className="font-mono"
                />
              </Field>
              <p className="text-body-sm text-on-surface-light">
                Te llegará una aprobación en tu app de Nequi. Tu cédula solo se usa cifrada, para evitar pruebas repetidas.
              </p>
            </>
          )}

          {intent !== 'trial' && (
            <p className="text-body-sm text-on-surface">
              {intent === 'charge'
                ? `Hoy ${PRICE} y luego cada mes, el mismo día. Cancela en cualquier momento con 1 clic.`
                : chargeDate ? `$0 hoy. El próximo cobro de ${PRICE} es el ${longDay(chargeDate)}.` : '$0 hoy.'}
            </p>
          )}

          {awaiting && (
            <p role="status" className="flex items-start gap-2 rounded-xl bg-secondary/[var(--lq-soft-alpha)] px-4 py-3 text-body-sm text-on-background">
              <Smartphone aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
              Abre tu app de Nequi y aprueba la vinculación. Te esperamos aquí.
            </p>
          )}

          {errorBox}

          {intent !== 'save' && <PriceFraming trial={intent === 'trial'} />}

          <Button type="submit" size="lg" block loading={busy} disabled={!config}>
            {intent === 'trial' ? `Empezar mis ${TRIAL_DAYS} días gratis` : intent === 'charge' ? `Pagar ${PRICE} y activar Pro` : 'Vincular método de pago'}
          </Button>

          <label className="flex min-h-11 items-start gap-2.5 text-label-sm text-on-surface-light">
            <input
              type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
              aria-describedby={errors.consent ? consentId : undefined}
              className="mt-0.5 size-4 shrink-0 accent-[rgb(var(--lq-primary))]"
            />
            <span>
              Acepto los{' '}
              {config?.termsUrl
                ? <a href={config.termsUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">términos</a>
                : 'términos'}{' '}
              y autorizo el{' '}
              {config?.personalDataUrl
                ? <a href={config.personalDataUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">tratamiento de datos</a>
                : 'tratamiento de datos'}{' '}
              de Wompi.
            </span>
          </label>
          {errors.consent && <p id={consentId} className="-mt-3 flex items-center gap-1.5 text-body-sm text-error-text"><AlertCircle aria-hidden className="size-4" />{errors.consent}</p>}

          <p className="flex items-center justify-center gap-1.5 text-center text-label-sm text-on-surface-light">
            <Lock aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
            {method === 'CARD'
              ? 'Pago seguro con Wompi. NoutLife nunca ve el número de tu tarjeta.'
              : 'Pago seguro con Wompi. NoutLife no guarda tu cédula en texto plano.'}
          </p>
          {onCancel && <Button variant="ghost" size="md" onClick={onCancel} disabled={busy}>{cancelLabel}</Button>}
          {config?.sandbox && method === 'CARD' && (
            <p className="text-center text-body-sm text-warning-text">Modo de pruebas: usa la tarjeta 4242 4242 4242 4242 con cualquier fecha futura y CVC.</p>
          )}
        </motion.form>
      )}
    </AnimatePresence>
  );
}
