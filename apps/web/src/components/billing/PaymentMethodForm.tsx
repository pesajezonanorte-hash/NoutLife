// Checkout de Pro: plan (anual o mensual), código de creador y medio de pago (tarjeta o
// Nequi). Los dos medios se vinculan con Wompi desde el navegador (llave pública) y a la
// API de NoutLife solo llega un token: el servidor lee en Wompi los datos reales del medio
// de pago y decide la prueba gratis. Nequi pide además la cédula, que solo entra en la
// huella anti-abuso, y solo se ofrece en Colombia. Una sola casilla, en micro-texto, acepta
// los Términos y la Privacidad de NoutLife (con la renovación automática que se lee justo
// encima) y los dos documentos que Wompi exige. Los montos salen de la misma aritmética que
// la API (precio del plan menos el descuento del código, solo en el primer pago) y en la
// moneda de la cuenta: con precios en dólares se dice que Wompi cobra en pesos con la TRM.
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CreditCard, Gem, Lock, Smartphone, type LucideIcon } from 'lucide-react';
import type { BillingInterval, Subscription } from '@noutlife/shared';
import { Button, Field, Input, SegmentedControl, type SegmentOption } from '@/components/ui/lq';
import { useAuthStore } from '@/store/authStore';
import { ease, useMotionReduced } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { track } from '@/lib/analytics';
import { apiErrorMessage, localizeBillingMessage } from '@/lib/billing-messages';
import type { Copy } from '@/lib/i18n';
import type { Offer } from '@/lib/offer';
import { useOffer } from '@/lib/useOffer';
import { TRIAL_DAYS, annualAvailable, longDay } from '@/lib/plan';
import {
  PAYMENT_ERROR_TEXT, PaymentError, getBillingConfig, isValidCardNumber, savePaymentMethod, subscribe, tokenizeCard, tokenizeNequi,
  waitForNequiApproval, type BillingConfig, type CardInput, type PaymentField, type PaymentMethodLink,
} from '@/services/billing.service';
import { CreatorCodeField } from './CreatorCodeField';
import { FxNote } from './FxNote';

const DAY_MS = 24 * 60 * 60_000;

type Method = 'CARD' | 'NEQUI';
type Errors = Partial<Record<PaymentField | 'consent', string>>;

const formatNumber = (value: string) => value.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
const formatExpiry = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
};
const formatPhone = (value: string) => value.replace(/\D/g, '').slice(0, 10).replace(/^(\d{3})(\d{0,3})(\d{0,4}).*$/, (_, a: string, b: string, c: string) => [a, b, c].filter(Boolean).join(' '));

const es = {
  errors: {
    number: 'Revisa el número de la tarjeta.',
    expiryFormat: 'Escribe el vencimiento como MM/AA.',
    expired: 'Esta tarjeta ya venció.',
    cvc: 'El código tiene 3 o 4 dígitos.',
    holder: 'Escribe el nombre como aparece en la tarjeta.',
    consent: 'Marca la casilla para continuar.',
    phone: 'Escribe tu celular Nequi de 10 dígitos. Empieza por 3.',
    documentNumber: 'Escribe tu cédula, solo números (entre 6 y 10 dígitos).',
  },
  chargeFailed: 'No se pudo completar el cobro. Prueba con otro método de pago.',
  trialUsed: 'Este método de pago ya usó una prueba gratis.',
  linkFailed: 'No pudimos vincular tu método de pago. Inténtalo de nuevo.',
  activateFailed: 'No se pudo activar Pro. Inténtalo de nuevo.',
  unavailable: 'Los pagos aún no están disponibles. Tu cuenta sigue funcionando con normalidad.',
  understood: 'Entendido',
  planLabel: 'Plan de NoutLife Pro',
  option: (o: Offer, interval: BillingInterval) => `${interval === 'year' ? 'Anual' : 'Mensual'} · ${o.money(o.listFor(interval))}`,
  savesNow: (o: Offer) => `Ahorras ${o.money(o.savings)} al año frente al plan mensual.`,
  wouldSave: (o: Offer) => `Con el plan anual ahorrarías ${o.money(o.savings)} al año (${o.savingsPercent} %).`,
  deniedLinked: 'Tu método de pago quedó vinculado: activa Pro y sigue sin límites.',
  activate: (name: string, price: string) => `Activar ${name} por ${price}`,
  cancelAnytime: 'Cancela en cualquier momento con 1 clic.',
  stayLite: 'Seguir en NoutLife Lite',
  zeroToday: '$0 hoy',
  trialThen: (price: string, date: string) => `${TRIAL_DAYS} días de Pro gratis. Luego ${price} desde el ${date}.`,
  methodLegend: 'Medio de pago',
  card: 'Tarjeta',
  cardHint: 'Débito o crédito',
  nequiHint: 'Desde tu celular',
  cardOnly: 'Medio de pago · tarjeta débito o crédito',
  cardNumber: 'Número de la tarjeta',
  expiry: 'Vencimiento',
  expiryPlaceholder: 'MM/AA',
  cvc: 'Código de seguridad',
  holder: 'Nombre en la tarjeta',
  nequiPhone: 'Celular Nequi',
  documentNumber: 'Cédula',
  digitsOnly: 'Solo números',
  nequiNote: 'Te llegará una aprobación en tu app de Nequi. Tu cédula solo se usa cifrada, para evitar pruebas repetidas.',
  zeroTodayDot: '$0 hoy.',
  firstOn: (date: string, price: string, unit: string) => `$0 hoy. El ${date} se cobran ${price} por tu primer ${unit} de Pro.`,
  nextOn: (price: string, date: string) => `$0 hoy. El próximo cobro de ${price} es el ${date}.`,
  awaiting: 'Abre tu app de Nequi y aprueba la vinculación. Te esperamos aquí.',
  startTrial: `Empezar mis ${TRIAL_DAYS} días gratis`,
  pay: (price: string) => `Pagar ${price} y activar Pro`,
  link: 'Vincular método de pago',
  consent: {
    agree: 'Acepto los',
    terms: 'Términos',
    and: 'y la',
    privacy: 'Política de privacidad',
    renewal: 'de NoutLife, con la renovación automática descrita arriba, y los',
    wompiTerms: 'términos',
    wompiAnd: 'y el',
    wompiData: 'tratamiento de datos',
    wompi: 'de Wompi.',
  },
  secureCard: 'Pago seguro con Wompi. NoutLife nunca ve el número de tu tarjeta.',
  secureNequi: 'Pago seguro con Wompi. NoutLife no guarda tu cédula en texto plano.',
  notNow: 'Ahora no',
  sandbox: 'Modo de pruebas: usa la tarjeta 4242 4242 4242 4242 con cualquier fecha futura y CVC.',
};

const en: typeof es = {
  errors: {
    number: 'Check the card number.',
    expiryFormat: 'Enter the expiry as MM/YY.',
    expired: 'This card has expired.',
    cvc: 'The security code has 3 or 4 digits.',
    holder: 'Enter the name as it appears on the card.',
    consent: 'Check the box to continue.',
    phone: 'Enter your 10-digit Nequi number. It starts with 3.',
    documentNumber: 'Enter your ID number, digits only (6 to 10).',
  },
  chargeFailed: 'The charge couldn’t be completed. Try another payment method.',
  trialUsed: 'This payment method has already used a free trial.',
  linkFailed: 'We couldn’t link your payment method. Please try again.',
  activateFailed: 'We couldn’t activate Pro. Please try again.',
  unavailable: 'Payments aren’t available yet. Your account keeps working as usual.',
  understood: 'Got it',
  planLabel: 'NoutLife Pro plan',
  option: (o, interval) => `${interval === 'year' ? 'Annual' : 'Monthly'} · ${o.money(o.listFor(interval))}`,
  savesNow: (o) => `You save ${o.money(o.savings)} a year compared with monthly.`,
  wouldSave: (o) => `With the annual plan you’d save ${o.money(o.savings)} a year (${o.savingsPercent}%).`,
  deniedLinked: 'Your payment method is linked: activate Pro and keep going without limits.',
  activate: (name, price) => `Activate ${name} for ${price}`,
  cancelAnytime: 'Cancel anytime in 1 click.',
  stayLite: 'Stay on NoutLife Lite',
  zeroToday: '$0 today',
  trialThen: (price, date) => `${TRIAL_DAYS} days of Pro free. Then ${price} starting ${date}.`,
  methodLegend: 'Payment method',
  card: 'Card',
  cardHint: 'Debit or credit',
  nequiHint: 'From your phone',
  cardOnly: 'Payment method · debit or credit card',
  cardNumber: 'Card number',
  expiry: 'Expiry',
  expiryPlaceholder: 'MM/YY',
  cvc: 'Security code',
  holder: 'Name on card',
  nequiPhone: 'Nequi phone number',
  documentNumber: 'ID number (cédula)',
  digitsOnly: 'Digits only',
  nequiNote: 'You’ll get an approval request in your Nequi app. Your ID is only used encrypted, to prevent repeated trials.',
  zeroTodayDot: '$0 today.',
  firstOn: (date, price, unit) => `$0 today. On ${date} you’ll be charged ${price} for your first ${unit} of Pro.`,
  nextOn: (price, date) => `$0 today. Your next charge of ${price} is on ${date}.`,
  awaiting: 'Open your Nequi app and approve the link. We’ll wait here.',
  startTrial: `Start my ${TRIAL_DAYS} free days`,
  pay: (price) => `Pay ${price} and activate Pro`,
  link: 'Link payment method',
  consent: {
    agree: 'I agree to NoutLife’s',
    terms: 'Terms',
    and: 'and',
    privacy: 'Privacy Policy',
    renewal: ', including the automatic renewal described above, and to Wompi’s',
    wompiTerms: 'terms',
    wompiAnd: 'and',
    wompiData: 'personal data policy',
    wompi: '(in Spanish).',
  },
  secureCard: 'Secure payment with Wompi. NoutLife never sees your card number.',
  secureNequi: 'Secure payment with Wompi. NoutLife never stores your ID in plain text.',
  notNow: 'Not now',
  sandbox: 'Test mode: use card 4242 4242 4242 4242 with any future date and CVC.',
};

const COPY: Copy<typeof es> = { es, en };

function validateCard(t: typeof es, number: string, expiry: string, cvc: string, holder: string, consent: boolean): Errors {
  const errors: Errors = {};
  if (!isValidCardNumber(number)) errors.number = t.errors.number;
  const [mm, yy] = expiry.split('/');
  const month = Number(mm);
  const year = 2000 + Number(yy);
  const now = new Date();
  if (!mm || !yy || yy.length !== 2 || month < 1 || month > 12) errors.expiry = t.errors.expiryFormat;
  else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) errors.expiry = t.errors.expired;
  if (!/^\d{3,4}$/.test(cvc)) errors.cvc = t.errors.cvc;
  if (holder.trim().length < 3) errors.holder = t.errors.holder;
  if (!consent) errors.consent = t.errors.consent;
  return errors;
}

function validateNequi(t: typeof es, phone: string, documentNumber: string, consent: boolean): Errors {
  const errors: Errors = {};
  if (!/^3\d{9}$/.test(phone.replace(/\D/g, ''))) errors.phone = t.errors.phone;
  if (!/^\d{6,10}$/.test(documentNumber)) errors.documentNumber = t.errors.documentNumber;
  if (!consent) errors.consent = t.errors.consent;
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
function PriceFraming({ offer, trial, interval }: { offer: Offer; trial: boolean; interval: BillingInterval }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-secondary/[var(--lq-soft-alpha)] px-4 py-3 text-body-sm text-on-background">
      <Gem aria-hidden className="mt-0.5 size-4 shrink-0 text-secondary-text" strokeWidth={1.75} />
      {offer.framing(interval, trial)}
    </p>
  );
}

export interface PaymentMethodFormProps {
  /**
   * trial: vincula el medio de pago y empieza la prueba ($0 hoy; el servidor la confirma).
   * save: cambia el medio de pago, sin cobro. charge: lo vincula y cobra el primer periodo (desde Lite).
   */
  intent: 'trial' | 'save' | 'charge';
  /** Fecha del próximo cobro, para el texto de «save». */
  chargeDate?: string | null;
  /** Plan con que abre el checkout (lo elegido en la pantalla anterior). Por defecto, el anual recomendado. */
  interval?: BillingInterval;
  onDone: (subscription: Subscription) => void;
  onCancel?: () => void;
  /** Texto del botón que llama a `onCancel` antes de vincular («Ahora no» por defecto). */
  cancelLabel?: string;
}

export function PaymentMethodForm({ intent, chargeDate, interval: initialInterval, onDone, onCancel, cancelLabel }: PaymentMethodFormProps) {
  const updateUser = useAuthStore((s) => s.updateUser);
  const sub = useAuthStore((s) => s.user?.subscription);
  const offer = useOffer();
  const { locale } = offer;
  const t = COPY[locale];
  const canAnnual = annualAvailable(sub);
  // Quien ya tiene medio de pago eligió antes: se respeta su plan. Si no, el anual recomendado.
  const [interval, setInterval] = useState<BillingInterval>(() => (
    !canAnnual ? 'month' : initialInterval ?? (sub?.hasPaymentMethod && sub.interval ? sub.interval : 'year')
  ));
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
  // El plan se elige cuando el próximo cobro es el primero (prueba o activar desde Lite). Al cambiar
  // de tarjeta con un periodo ya pagado no: rige el plan guardado, que se cambia en Plan.
  const choosesPlan = canAnnual && (intent !== 'save' || sub?.status === 'trialing');
  const planInterval: BillingInterval = choosesPlan ? interval : sub?.interval ?? 'month';
  // El descuento del código solo va en el primer pago (mientras el código se puede cambiar).
  const codeDiscount = sub?.creatorCodeEditable ? sub.creatorCode?.discountPercent ?? 0 : 0;
  const firstCents = offer.firstPayment(planInterval, codeDiscount);
  // Nequi es colombiano: solo se ofrece con la lista en pesos. Sin Nequi, el medio es siempre la tarjeta.
  const nequi = Boolean(config?.nequiEnabled) && offer.list.market === 'CO';
  const activeMethod: Method = nequi ? method : 'CARD';
  const nextCents = sub?.nextChargeInCents ?? (sub?.nextChargeCop != null ? sub.nextChargeCop * 100 : offer.listFor(planInterval));
  const intervalOptions: SegmentOption<BillingInterval>[] = [
    { value: 'year', label: t.option(offer, 'year') },
    { value: 'month', label: t.option(offer, 'month') },
  ];

  useEffect(() => {
    alive.current = true;
    getBillingConfig().then(setConfig).catch(() => setConfigError(true));
    return () => { alive.current = false; };
  }, []);

  function finish(subscription: Subscription) {
    updateUser({ subscription });
    if (subscription.plan === 'pro' || subscription.pendingPayment) onDone(subscription);
    else setFormError(localizeBillingMessage(subscription.lastPaymentError, locale) ?? t.chargeFailed);
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
    const found = activeMethod === 'CARD'
      ? validateCard(t, number, expiry, cvc, holder, consent)
      : validateNequi(t, phone, documentNumber, consent);
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length || !config) return;

    setBusy(true);
    track('checkout_started', { intent, interval: planInterval, method: activeMethod, with_code: Boolean(sub?.creatorCode), market: offer.list.market });
    const chosen = choosesPlan ? interval : undefined;
    try {
      const link = activeMethod === 'CARD' ? await cardLink(config) : await nequiLink(config);
      const subscription = await savePaymentMethod(link, chosen);
      if (intent === 'charge') { finish(await subscribe(chosen)); return; }
      updateUser({ subscription });
      if (intent === 'trial' && subscription.plan !== 'pro') {
        setDenied(localizeBillingMessage(subscription.lastPaymentError, locale) ?? t.trialUsed);
        return;
      }
      onDone(subscription);
    } catch (error) {
      if (error instanceof PaymentError) {
        const text = PAYMENT_ERROR_TEXT[locale][error.code];
        if (error.field) setErrors({ [error.field]: text });
        else setFormError(text);
      } else {
        setFormError(apiErrorMessage(error, locale, t.linkFailed));
      }
    } finally {
      setBusy(false);
    }
  }

  async function payNow() {
    setBusy(true);
    setFormError('');
    try {
      finish(await subscribe(choosesPlan ? interval : undefined));
    } catch (error) {
      setFormError(apiErrorMessage(error, locale, t.activateFailed));
    } finally {
      setBusy(false);
    }
  }

  if (configError || (config && !config.enabled)) {
    return (
      <div lang={locale} className="flex flex-col gap-4">
        <p className="text-body-md text-on-surface">{t.unavailable}</p>
        {onCancel && <Button variant="secondary" size="md" onClick={onCancel} className="self-end">{t.understood}</Button>}
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
  // Plan del checkout: anual o mensual, con lo que ahorra el anual dicho en la moneda de la cuenta.
  // Mientras se cobra (o se espera a Nequi) no se cambia: el plan ya salió con la petición.
  const planSwitch = choosesPlan && (
    <fieldset disabled={busy} className="flex flex-col gap-1.5">
      <SegmentedControl role="radiogroup" label={t.planLabel} options={intervalOptions} value={interval} onChange={setInterval} />
      <p className="text-label-sm text-on-surface-light">{interval === 'year' ? t.savesNow(offer) : t.wouldSave(offer)}</p>
    </fieldset>
  );
  const codeField = (intent !== 'save' || sub?.status === 'trialing') && <CreatorCodeField />;
  // Precio en dólares: Wompi cobra en pesos. Se dice antes de pagar (FxNote no muestra nada con la lista en pesos).
  const fxNote = <FxNote usdCents={intent === 'save' && !choosesPlan ? nextCents : firstCents} later={intent !== 'charge'} />;
  const linkClass = 'underline underline-offset-2';

  return (
    <AnimatePresence mode="wait" initial={false}>
      {denied ? (
        <motion.div key="denied" lang={locale} {...fade} className="flex flex-col gap-4">
          <p role="alert" className="text-body-md text-on-surface">
            {denied} {t.deniedLinked}
          </p>
          {planSwitch}
          {codeField}
          {errorBox}
          <PriceFraming offer={offer} trial={false} interval={planInterval} />
          {fxNote}
          <Button size="lg" block loading={busy} onClick={() => void payNow()}>
            {t.activate(offer.name(planInterval), offer.priceLabel(planInterval, firstCents))}
          </Button>
          <p className="text-center text-label-sm text-on-surface-light">{t.cancelAnytime}</p>
          {onCancel && <Button variant="ghost" size="md" onClick={onCancel} disabled={busy}>{t.stayLite}</Button>}
        </motion.div>
      ) : (
        <motion.form key="form" lang={locale} {...fade} noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" aria-busy={busy}>
          {intent === 'trial' && (
            <div className="flex flex-col items-center gap-1 py-1 text-center">
              <p className="text-display-md font-semibold tracking-tight tabular-nums">{t.zeroToday}</p>
              <p className="text-body-md text-on-background">{t.cancelAnytime}</p>
              <p className="text-body-sm text-on-surface-light">{t.trialThen(offer.priceLabel(planInterval, firstCents), longDay(trialEnd, locale))}</p>
            </div>
          )}

          {nequi ? (
            <fieldset disabled={busy} className="flex flex-col gap-2">
              <legend className="mb-2 text-label-md text-on-surface-light">{t.methodLegend}</legend>
              <div className="grid grid-cols-2 gap-2">
                <MethodOption active={activeMethod === 'CARD'} icon={CreditCard} label={t.card} hint={t.cardHint} onClick={() => switchMethod('CARD')} />
                <MethodOption active={activeMethod === 'NEQUI'} icon={Smartphone} label="Nequi" hint={t.nequiHint} onClick={() => switchMethod('NEQUI')} />
              </div>
            </fieldset>
          ) : (
            <p className="text-label-md text-on-surface-light">{t.cardOnly}</p>
          )}

          {activeMethod === 'CARD' ? (
            <>
              <Field label={t.cardNumber} error={errors.number}>
                <Input
                  value={number} onChange={(e) => setNumber(formatNumber(e.target.value))}
                  inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" className="font-mono" data-autofocus
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t.expiry} error={errors.expiry}>
                  <Input value={expiry} onChange={(e) => setExpiry(formatExpiry(e.target.value))} inputMode="numeric" autoComplete="cc-exp" placeholder={t.expiryPlaceholder} className="font-mono" />
                </Field>
                <Field label={t.cvc} error={errors.cvc}>
                  <Input value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" autoComplete="cc-csc" placeholder="CVC" className="font-mono" />
                </Field>
              </div>
              <Field label={t.holder} error={errors.holder}>
                <Input value={holder} onChange={(e) => setHolder(e.target.value)} autoComplete="cc-name" autoCapitalize="characters" />
              </Field>
            </>
          ) : (
            <>
              <Field label={t.nequiPhone} error={errors.phone}>
                <Input
                  value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))}
                  inputMode="tel" autoComplete="tel-national" placeholder="300 000 0000" className="font-mono" data-autofocus
                />
              </Field>
              <Field label={t.documentNumber} error={errors.documentNumber}>
                <Input
                  value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  inputMode="numeric" autoComplete="off" placeholder={t.digitsOnly} className="font-mono"
                />
              </Field>
              <p className="text-body-sm text-on-surface-light">{t.nequiNote}</p>
            </>
          )}

          {/* Resumen junto al botón (plan, código y monto): el foco inicial va al primer campo de pago y no lo esconde. */}
          {planSwitch}
          {codeField}

          {intent !== 'trial' && (
            <p className="text-body-sm text-on-surface">
              {intent === 'charge'
                ? offer.chargeLine(planInterval, firstCents)
                : !chargeDate
                  ? t.zeroTodayDot
                  : choosesPlan
                    ? t.firstOn(longDay(chargeDate, locale), offer.money(firstCents), offer.unit(planInterval))
                    : t.nextOn(offer.money(nextCents), longDay(chargeDate, locale))}
            </p>
          )}

          {awaiting && (
            <p role="status" className="flex items-start gap-2 rounded-xl bg-secondary/[var(--lq-soft-alpha)] px-4 py-3 text-body-sm text-on-background">
              <Smartphone aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
              {t.awaiting}
            </p>
          )}

          {errorBox}

          {intent !== 'save' && <PriceFraming offer={offer} trial={intent === 'trial'} interval={planInterval} />}
          {fxNote}

          <Button type="submit" size="lg" block loading={busy} disabled={!config}>
            {intent === 'trial' ? t.startTrial : intent === 'charge' ? t.pay(offer.money(firstCents)) : t.link}
          </Button>

          <label className="flex min-h-11 items-start gap-2.5 text-label-sm text-on-surface-light">
            <input
              type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
              aria-describedby={errors.consent ? consentId : undefined}
              className="mt-0.5 size-4 shrink-0 accent-[rgb(var(--lq-primary))]"
            />
            <span>
              {t.consent.agree}{' '}
              <Link to="/terms" target="_blank" rel="noopener noreferrer" className={linkClass}>{t.consent.terms}</Link>{' '}
              {t.consent.and}{' '}
              <Link to="/privacy" target="_blank" rel="noopener noreferrer" className={linkClass}>{t.consent.privacy}</Link>
              {locale === 'en' ? '' : ' '}{t.consent.renewal}{' '}
              {config?.termsUrl
                ? <a href={config.termsUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>{t.consent.wompiTerms}</a>
                : t.consent.wompiTerms}{' '}
              {t.consent.wompiAnd}{' '}
              {config?.personalDataUrl
                ? <a href={config.personalDataUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>{t.consent.wompiData}</a>
                : t.consent.wompiData}{' '}
              {t.consent.wompi}
            </span>
          </label>
          {errors.consent && <p id={consentId} className="-mt-3 flex items-center gap-1.5 text-body-sm text-error-text"><AlertCircle aria-hidden className="size-4" />{errors.consent}</p>}

          <p className="flex items-center justify-center gap-1.5 text-center text-label-sm text-on-surface-light">
            <Lock aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
            {activeMethod === 'CARD' ? t.secureCard : t.secureNequi}
          </p>
          {onCancel && <Button variant="ghost" size="md" onClick={onCancel} disabled={busy}>{cancelLabel ?? t.notNow}</Button>}
          {config?.sandbox && activeMethod === 'CARD' && (
            <p className="text-center text-body-sm text-warning-text">{t.sandbox}</p>
          )}
        </motion.form>
      )}
    </AnimatePresence>
  );
}
