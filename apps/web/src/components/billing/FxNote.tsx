// Con precios en dólares, antes de pagar se dice que Wompi cobra en pesos colombianos con la TRM, con la
// cifra de hoy si la API la conoce (es solo informativa: el cobro usa la tasa del día en que ocurre).
// Con la lista en pesos no se muestra nada.
import { useEffect, useState } from 'react';
import { Globe2 } from 'lucide-react';
import { INTL_LOCALE, type Copy, type Locale } from '@/lib/i18n';
import { useOffer } from '@/lib/useOffer';
import { cn } from '@/lib/utils';
import { getUsdCopRate, type UsdCopRate } from '@/services/billing.service';

/** Pesos de hoy para un precio en dólares, como se leen en cada idioma: «$126.306 COP» · «COP 126,306». */
export function copToday(usdCents: number, rate: UsdCopRate | null, locale: Locale): string | null {
  if (!rate) return null;
  const pesos = Math.round((usdCents / 100) * rate.rate).toLocaleString(INTL_LOCALE[locale]);
  return locale === 'en' ? `COP ${pesos}` : `$${pesos} COP`;
}

const FX: Copy<(cop: string | null, later: boolean) => string> = {
  es: (cop, later) => (later
    ? `Wompi cobra en pesos colombianos con la TRM del día del cobro${cop ? ` (hoy serían unos ${cop})` : ''}. Tu banco lo convierte a tu moneda y puede cobrar una comisión por compras internacionales.`
    : `Wompi cobra en pesos colombianos con la TRM de hoy${cop ? `: unos ${cop}` : ''}. Tu banco lo convierte a tu moneda y puede cobrar una comisión por compras internacionales.`),
  en: (cop, later) => (later
    ? `Wompi charges in Colombian pesos at the official exchange rate of the charge date${cop ? ` (about ${cop} today)` : ''}. Your bank converts it to dollars and may add a foreign transaction fee.`
    : `Wompi charges in Colombian pesos at today’s official exchange rate${cop ? `: about ${cop}` : ''}. Your bank converts it to dollars and may add a foreign transaction fee.`),
};

/** `usdCents`: lo que se cobrará en dólares. `later`: el cobro no es hoy (prueba o próxima renovación). */
export function FxNote({ usdCents, later, className }: { usdCents: number; later: boolean; className?: string }) {
  const offer = useOffer();
  const usd = offer.list.currency === 'USD';
  const [rate, setRate] = useState<UsdCopRate | null>(null);

  useEffect(() => {
    if (!usd) return;
    let alive = true;
    getUsdCopRate().then((value) => { if (alive) setRate(value); });
    return () => { alive = false; };
  }, [usd]);

  if (!usd) return null;
  return (
    <p lang={offer.locale} className={cn('flex items-start gap-2 text-label-sm text-on-surface-light', className)}>
      <Globe2 aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
      {FX[offer.locale](copToday(usdCents, rate, offer.locale), later)}
    </p>
  );
}
