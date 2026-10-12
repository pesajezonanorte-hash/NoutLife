// Método de pago. La tarjeta se tokeniza en el navegador directo con Wompi
// (llave pública) y a la API de NoutLife solo llega el token: el servidor lee
// en Wompi los datos reales del medio de pago y decide la prueba gratis. Wompi
// exige aceptar explícitamente sus dos documentos: una sola casilla, en micro-texto.
import { useEffect, useId, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Lock } from 'lucide-react';
import type { Subscription } from '@noutlife/shared';
import { Button, Field, Input } from '@/components/ui/lq';
import { useAuthStore } from '@/store/authStore';
import { ease, useMotionReduced } from '@/lib/motion';
import { PRO_PRICE_COP, TRIAL_DAYS, formatCop, longDay } from '@/lib/plan';
import {
  CardError, getBillingConfig, isValidCardNumber, savePaymentMethod, subscribe, tokenizeCard,
  type BillingConfig, type CardInput,
} from '@/services/billing.service';

const PRICE = formatCop(PRO_PRICE_COP);
const DAY_MS = 24 * 60 * 60_000;

const formatNumber = (value: string) => value.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
const formatExpiry = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
};
const apiError = (error: unknown) => (error as { response?: { data?: { error?: string } } }).response?.data?.error;

type Errors = Partial<Record<keyof CardInput | 'expiry' | 'consent', string>>;

function validate(number: string, expiry: string, cvc: string, holder: string, consent: boolean): Errors {
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

export interface CardFormProps {
  /**
   * trial: vincula el método de pago y empieza la prueba ($0 hoy; el servidor la confirma).
   * save: cambia el método de pago, sin cobro. charge: lo vincula y cobra el primer mes (desde Lite).
   */
  intent: 'trial' | 'save' | 'charge';
  /** Fecha del próximo cobro, para el texto de «save». */
  chargeDate?: string | null;
  onDone: (subscription: Subscription) => void;
  onCancel?: () => void;
}

export function CardForm({ intent, chargeDate, onDone, onCancel }: CardFormProps) {
  const updateUser = useAuthStore((s) => s.updateUser);
  const reduce = useMotionReduced();
  const consentId = useId();
  const [config, setConfig] = useState<BillingConfig | null>(null);
  const [configError, setConfigError] = useState(false);
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [holder, setHolder] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  /** El servidor negó la prueba (correo o método de pago ya usados): el método quedó vinculado y se ofrece pagar. */
  const [denied, setDenied] = useState('');
  // Calculada una vez: el texto no cambia mientras se escribe.
  const [trialEnd] = useState(() => new Date(Date.now() + TRIAL_DAYS * DAY_MS).toISOString());

  useEffect(() => {
    getBillingConfig().then(setConfig).catch(() => setConfigError(true));
  }, []);

  function finish(subscription: Subscription) {
    updateUser({ subscription });
    if (subscription.plan === 'pro' || subscription.pendingPayment) onDone(subscription);
    else setFormError(subscription.lastPaymentError ?? 'No se pudo completar el cobro. Prueba con otro método de pago.');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found = validate(number, expiry, cvc, holder, consent);
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length || !config) return;

    setBusy(true);
    try {
      const [expMonth, expYear] = expiry.split('/');
      const card = await tokenizeCard(config, { number, expMonth, expYear, cvc, holder });
      const subscription = await savePaymentMethod(card);
      if (intent === 'charge') { finish(await subscribe()); return; }
      updateUser({ subscription });
      if (intent === 'trial' && subscription.plan !== 'pro') {
        setDenied(subscription.lastPaymentError ?? 'Este método de pago ya usó una prueba gratis.');
        return;
      }
      onDone(subscription);
    } catch (error) {
      if (error instanceof CardError) {
        if (error.field) setErrors({ [error.field === 'expMonth' || error.field === 'expYear' ? 'expiry' : error.field]: error.message });
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

          <p className="text-label-md text-on-surface-light">Método de pago · tarjeta débito o crédito</p>
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

          {intent !== 'trial' && (
            <p className="text-body-sm text-on-surface">
              {intent === 'charge'
                ? `Hoy ${PRICE} y luego cada mes, el mismo día. Cancela en cualquier momento con 1 clic.`
                : chargeDate ? `$0 hoy. El próximo cobro de ${PRICE} es el ${longDay(chargeDate)}.` : '$0 hoy.'}
            </p>
          )}

          {errorBox}

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
            Pago seguro con Wompi. NoutLife nunca ve el número de tu tarjeta.
          </p>
          {onCancel && <Button variant="ghost" size="md" onClick={onCancel} disabled={busy}>Ahora no</Button>}
          {config?.sandbox && (
            <p className="text-center text-body-sm text-warning-text">Modo de pruebas: usa la tarjeta 4242 4242 4242 4242 con cualquier fecha futura y CVC.</p>
          )}
        </motion.form>
      )}
    </AnimatePresence>
  );
}
