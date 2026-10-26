// La oferta de Pro para quien mira: el idioma actual (o el fijado por la portada /en, /es) y la lista de
// precios de su cuenta o, sin sesión, la de su dispositivo. Las reglas puras están en lib/offer.
import { useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useLocale } from './i18n';
import { offerFor, type Offer } from './offer';
import { priceListFor } from './plan';

export function useOffer(): Offer {
  const locale = useLocale();
  const subscription = useAuthStore((s) => s.user?.subscription);
  const list = priceListFor(subscription);
  return useMemo(() => offerFor(locale, list), [locale, list]);
}
