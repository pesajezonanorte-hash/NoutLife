// Formulario de tarjeta. La tarjeta se tokeniza en el navegador directo con
// Wompi (llave pública) y a la API de NoutLife solo llega el token. Antes de
// guardarla, la persona acepta los dos contratos de Wompi (política de
// privacidad y autorización de datos personales).
import { useEffect, useId, useState, type FormEvent } from 'react';
import { AlertCircle, Lock } from 'lucide-react';
import type { Subscription } from '@noutlife/shared';
import { Button, Field, Input } from '@/components/ui/lq';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { usePlanStore } from '@/store/planStore';
import { PRO_PRICE_COP, formatCop, longDay } from '@/lib/plan';
import {
  CardError, getBillingConfig, isValidCardNumber, savePaymentMethod, subscribe, tokenizeCard,
  type BillingConfig, type CardInput,
} from '@/services/billing.service';

const PRICE = formatCop(PRO_PRICE_COP);

const formatNumber = (value: string) => value.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
const formatExpiry = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
};

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
  if (!consent) errors.consent = 'Acepta los dos documentos de Wompi para guardar la tarjeta.';
  return errors;
}

export interface CardFormProps {
  /** save: guarda la tarjeta sin cobrar (prueba o cambio de tarjeta). charge: guarda y cobra el primer mes (desde Lite). */
  intent: 'save' | 'charge';
  /** Fecha del primer cobro (fin de la prueba), para el texto de «save». */
  chargeDate?: string | null;
  onDone: (subscription: Subscription) => void;
  onCancel?: () => void;
}

export function CardForm({ intent, chargeDate, onDone, onCancel }: CardFormProps) {
  const updateUser = useAuthStore((s) => s.updateUser);
  const navigate = useNavigate();
  const termsId = useId();
  const [config, setConfig] = useState<BillingConfig | null>(null);
  const [configError, setConfigError] = useState(false);
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [holder, setHolder] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptData, setAcceptData] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getBillingConfig().then(setConfig).catch(() => setConfigError(true));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found = validate(number, expiry, cvc, holder, acceptTerms && acceptData);
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length || !config) return;

    setBusy(true);
    try {
      const [expMonth, expYear] = expiry.split('/');
      const card = await tokenizeCard(config, { number, expMonth, expYear, cvc, holder });
      const wasPro = useAuthStore.getState().user?.subscription?.plan === 'pro';
      let subscription = await savePaymentMethod(card);
      if (intent === 'charge') subscription = await subscribe();
      updateUser({ subscription });
      // La tarjeta ya usó una prueba gratis: la API pasó la cuenta a Lite. Se lleva a la sección de pago.
      if (wasPro && intent === 'save' && subscription.plan === 'lite') {
        usePlanStore.getState().closeUpgrade();
        onCancel?.();
        navigate('/plan');
        return;
      }
      if (intent === 'charge' && subscription.plan !== 'pro' && !subscription.pendingPayment) {
        setFormError(subscription.lastPaymentError ?? 'No se pudo completar el cobro. Prueba con otra tarjeta.');
        return;
      }
      onDone(subscription);
    } catch (error) {
      if (error instanceof CardError) {
        if (error.field) setErrors({ [error.field === 'expMonth' || error.field === 'expYear' ? 'expiry' : error.field]: error.message });
        else setFormError(error.message);
      } else {
        const message = (error as { response?: { data?: { error?: string } } }).response?.data?.error;
        setFormError(message ?? 'No pudimos guardar la tarjeta. Inténtalo de nuevo.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (configError || (config && !config.enabled)) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-body-md text-on-surface">Los pagos con tarjeta aún no están disponibles. Tu cuenta sigue funcionando con normalidad.</p>
        {onCancel && <Button variant="secondary" size="md" onClick={onCancel} className="self-end">Entendido</Button>}
      </div>
    );
  }

  return (
    <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" aria-busy={busy}>
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

      <fieldset className="flex flex-col gap-2" aria-describedby={errors.consent ? termsId : undefined}>
        <legend className="sr-only">Documentos de Wompi</legend>
        <label className="flex min-h-11 items-start gap-3 text-body-sm text-on-surface">
          <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[rgb(var(--lq-primary))]" />
          <span>
            Acepto los{' '}
            {config?.termsUrl
              ? <a href={config.termsUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-text underline underline-offset-4">términos y la política de privacidad de Wompi</a>
              : 'términos y la política de privacidad de Wompi'}.
          </span>
        </label>
        <label className="flex min-h-11 items-start gap-3 text-body-sm text-on-surface">
          <input type="checkbox" checked={acceptData} onChange={(e) => setAcceptData(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[rgb(var(--lq-primary))]" />
          <span>
            Autorizo el{' '}
            {config?.personalDataUrl
              ? <a href={config.personalDataUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-text underline underline-offset-4">tratamiento de mis datos personales</a>
              : 'tratamiento de mis datos personales'}{' '}
            para procesar el pago.
          </span>
        </label>
        {errors.consent && <p id={termsId} className="flex items-center gap-1.5 text-body-sm text-error-text"><AlertCircle aria-hidden className="size-4" />{errors.consent}</p>}
      </fieldset>

      <p className="text-body-sm text-on-surface">
        {intent === 'charge'
          ? `Hoy se cobran ${PRICE} y después cada mes, el mismo día. Cancela cuando quieras con un solo clic.`
          : chargeDate
            ? `No se cobra nada hoy. El ${longDay(chargeDate)} se cobran ${PRICE} si no cancelas antes.`
            : 'No se cobra nada hoy.'}
      </p>

      {formError && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-error/[var(--lq-soft-alpha)] px-4 py-3 text-body-sm text-error-text">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />{formError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onCancel && <Button variant="secondary" size="md" onClick={onCancel} disabled={busy}>Ahora no</Button>}
        <Button type="submit" size="md" loading={busy} disabled={!config}>
          {intent === 'charge' ? `Pagar ${PRICE} y activar Pro` : 'Guardar tarjeta'}
        </Button>
      </div>

      <p className="flex items-center justify-center gap-1.5 text-center text-body-sm text-on-surface-light">
        <Lock aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
        La tarjeta va directo a Wompi. NoutLife no ve ni guarda su número.
      </p>
      {config?.sandbox && (
        <p className="text-center text-body-sm text-warning-text">Modo de pruebas: usa la tarjeta 4242 4242 4242 4242 con cualquier fecha futura y CVC.</p>
      )}
    </form>
  );
}
