// «¿Tienes un código de creador?» en el checkout. Cerrado por defecto (un enlace discreto, para no
// distraer de pagar); al abrirlo, el código se valida en la API y queda en la cuenta: su descuento va
// en el primer pago y los cobros quedan atribuidos al creador. Quien llegó con el ?ref= de un creador
// (plan v3: un ref por creador) ve su código sugerido. Solo existe antes del primer pago.
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BadgeCheck, Ticket, X } from 'lucide-react';
import type { CreatorCodeInfo } from '@noutlife/shared';
import { Button, Input } from '@/components/ui/lq';
import { useAuthStore } from '@/store/authStore';
import { attribution } from '@/lib/analytics';
import { apiErrorMessage } from '@/lib/billing-messages';
import { useLocale, type Copy, type Locale } from '@/lib/i18n';
import { ease, useMotionReduced } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { applyCreatorCode, lookupCreatorCode, removeCreatorCode } from '@/services/billing.service';

/** Mismo formato que la API (lib/creator-codes): 3 a 20 letras, números, guion o guion bajo. */
const CODE_FORMAT = /^[A-Za-z0-9][A-Za-z0-9_-]{2,19}$/;

const es = {
  benefit: (percent: number, creator: string) => (percent > 0
    ? `${percent} % de descuento en tu primer pago. Gracias por apoyar a ${creator}.`
    : `Gracias por apoyar a ${creator}.`),
  applyError: 'No pudimos aplicar el código. Inténtalo de nuevo.',
  removeError: 'No pudimos quitar el código.',
  formatError: 'Revisa el código: son de 3 a 20 letras o números.',
  applied: (code: string) => `Código ${code}`,
  remove: (code: string) => `Quitar el código ${code}`,
  suggested: (creator: string) => `¿Llegaste por ${creator}? Su código es `,
  apply: 'Aplicar',
  toggle: '¿Tienes un código de creador?',
  label: 'Código de creador',
  placeholder: 'Escribe el código',
  hint: 'Va en tu primer pago, mensual o anual.',
};
const en: typeof es = {
  benefit: (percent, creator) => (percent > 0
    ? `${percent}% off your first payment. Thanks for supporting ${creator}.`
    : `Thanks for supporting ${creator}.`),
  applyError: 'We couldn’t apply the code. Please try again.',
  removeError: 'We couldn’t remove the code.',
  formatError: 'Check the code: 3 to 20 letters or numbers.',
  applied: (code) => `Code ${code}`,
  remove: (code) => `Remove code ${code}`,
  suggested: (creator) => `Came from ${creator}? Their code is `,
  apply: 'Apply',
  toggle: 'Have a creator code?',
  label: 'Creator code',
  placeholder: 'Enter the code',
  hint: 'Applies to your first payment, monthly or annual.',
};
const COPY: Copy<typeof es> = { es, en };

/** Qué gana quien aplica el código, en una frase. */
export function creatorCodeBenefit(code: Pick<CreatorCodeInfo, 'creatorName' | 'discountPercent'>, locale: Locale = 'es'): string {
  return COPY[locale].benefit(code.discountPercent, code.creatorName);
}

export function CreatorCodeField({ className }: { className?: string }) {
  const sub = useAuthStore((s) => s.user?.subscription);
  const updateUser = useAuthStore((s) => s.updateUser);
  const locale = useLocale();
  const t = COPY[locale];
  const reduce = useMotionReduced();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [suggested, setSuggested] = useState<CreatorCodeInfo | null>(null);

  const editable = sub?.creatorCodeEditable === true;
  const applied = sub?.creatorCode ?? null;

  // El ?ref= de la primera visita: si es un código activo, se ofrece aplicarlo con un toque.
  useEffect(() => {
    if (!editable || applied) return;
    const ref = attribution().ref;
    if (!ref || !CODE_FORMAT.test(ref)) return;
    let alive = true;
    lookupCreatorCode(ref).then((found) => { if (alive) setSuggested(found); }).catch(() => { /* no es un código */ });
    return () => { alive = false; };
  }, [editable, applied]);

  async function apply(code: string) {
    setBusy(true);
    setError('');
    try {
      updateUser({ subscription: await applyCreatorCode(code) });
      setValue('');
      setOpen(false);
      setSuggested(null);
    } catch (err) {
      setError(apiErrorMessage(err, locale, t.applyError));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError('');
    try {
      updateUser({ subscription: await removeCreatorCode() });
    } catch (err) {
      setError(apiErrorMessage(err, locale, t.removeError));
    } finally {
      setBusy(false);
    }
  }

  /** Enter o «Aplicar». Va dentro del formulario de pago: nunca debe enviarlo. */
  function submit(e: { preventDefault: () => void; stopPropagation: () => void }) {
    e.preventDefault();
    e.stopPropagation();
    const code = value.trim();
    if (!CODE_FORMAT.test(code)) { setError(t.formatError); return; }
    void apply(code);
  }

  // Ya pagó (los códigos son para el primer pago), cortesía o una API sin códigos: nada que mostrar.
  if (!sub || sub.complimentary || (!editable && !applied)) return null;

  if (applied) {
    return (
      <div lang={locale} className={cn('flex flex-col gap-1.5', className)}>
        <div className="flex items-center gap-3 rounded-xl border border-success/40 bg-success/[var(--lq-soft-alpha)] px-3.5 py-2.5">
          <BadgeCheck aria-hidden className="size-5 shrink-0 text-success-text" strokeWidth={1.75} />
          <p className="min-w-0 flex-1 text-body-sm text-on-background">
            <span className="font-semibold">{t.applied(applied.code)}</span> · {creatorCodeBenefit(applied, locale)}
          </p>
          {editable && (
            <Button variant="icon" aria-label={t.remove(applied.code)} disabled={busy} onClick={() => void remove()}>
              <X aria-hidden className="size-4" strokeWidth={2} />
            </Button>
          )}
        </div>
        {error && <p role="alert" className="text-body-sm text-error-text">{error}</p>}
      </div>
    );
  }

  const reveal = reduce ? {} : { initial: { opacity: 0, height: 0 }, animate: { opacity: 1, height: 'auto' }, transition: { duration: 0.24, ease } };

  return (
    <div lang={locale} className={cn('flex flex-col gap-2', className)}>
      {suggested && !open && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-secondary/[var(--lq-soft-alpha)] px-3.5 py-2.5">
          <Ticket aria-hidden className="size-4 shrink-0 text-secondary-text" strokeWidth={1.75} />
          <p className="min-w-0 flex-[1_1_180px] text-body-sm text-on-background">
            {t.suggested(suggested.creatorName)}<span className="font-semibold">{suggested.code}</span>.
          </p>
          <Button variant="secondary" size="sm" loading={busy} onClick={() => void apply(suggested.code)}>{t.apply}</Button>
        </div>
      )}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className="flex min-h-11 items-center gap-2 self-start text-body-sm font-semibold text-primary-text underline-offset-4 hover:underline"
        >
          <Ticket aria-hidden className="size-4" strokeWidth={1.75} />
          {t.toggle}
        </button>
      ) : (
        <motion.div {...reveal} className="overflow-hidden">
          {/* Un <form> propio dentro del de pago no es válido en HTML: se maneja con Enter y el botón. */}
          <div className="flex flex-col gap-1.5 pt-0.5">
            <label htmlFor="creator-code" className="text-label-md text-on-surface-light">{t.label}</label>
            <div className="flex gap-2">
              <Input
                id="creator-code"
                value={value}
                onChange={(e) => { setValue(e.target.value.toUpperCase().replace(/\s/g, '')); setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') submit(e); }}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={20}
                placeholder={t.placeholder}
                invalid={Boolean(error)}
                aria-describedby={error ? 'creator-code-error' : undefined}
                className="font-mono uppercase placeholder:font-sans placeholder:normal-case"
                autoFocus
              />
              <Button variant="secondary" size="md" loading={busy} disabled={!value.trim()} onClick={(e) => submit(e)}>{t.apply}</Button>
            </div>
            {error && <p id="creator-code-error" role="alert" className="text-body-sm text-error-text">{error}</p>}
            <p className="text-label-sm text-on-surface-light">{t.hint}</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
