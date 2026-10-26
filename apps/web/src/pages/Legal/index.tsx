// Política de privacidad (/privacy), Términos de uso (/terms), Propiedad intelectual (/copyright) y la
// política de datos de salud de EE. UU. (/health-data). Públicas: las enlazan la portada, el checkout,
// Ajustes, el pie y las fichas de las tiendas. Cada documento existe en español (./content.ts) e inglés
// (./content.en.ts); se abre en el idioma de la persona y se puede leer en el otro sin cambiar su idioma.
// La política de datos de salud (Washington My Health My Data Act) solo existe en inglés.
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Languages } from 'lucide-react';
import { BrandLockup } from '@/components/layout/Brand';
import { Button } from '@/components/ui/lq';
import { LegalFooter } from '@/components/legal/LegalFooter';
import { LocaleProvider, useDocumentLang, useLocale, type Copy, type Locale } from '@/lib/i18n';
import { useDocumentMeta } from '@/lib/seo';
import { COPYRIGHT, LEGAL_UPDATED, PRIVACY, TERMS, type LegalSection } from './content';
import { COPYRIGHT_EN, HEALTH_DATA_EN, LEGAL_UPDATED_EN, PRIVACY_EN, TERMS_EN } from './content.en';

type Kind = 'privacy' | 'terms' | 'copyright' | 'health';

interface Doc { title: string; description: string; sections: LegalSection[]; updated: string }

const DOCS: Record<Kind, { path: string; es: Doc | null; en: Doc }> = {
  privacy: {
    path: '/privacy',
    es: { title: 'Política de privacidad', description: 'Cómo NoutLife recopila, usa y protege tus datos: inicio de sesión con Google, proveedores de IA, almacenamiento local y tus derechos.', sections: PRIVACY, updated: LEGAL_UPDATED },
    en: { title: 'Privacy Policy', description: 'How NoutLife collects, uses and protects your information: Google sign-in, payments, AI providers, analytics and your privacy rights, including US state rights.', sections: PRIVACY_EN, updated: LEGAL_UPDATED_EN },
  },
  terms: {
    path: '/terms',
    es: { title: 'Términos de uso', description: 'Reglas de uso de NoutLife: edad mínima, contenido del usuario, servicios de terceros y responsabilidad.', sections: TERMS, updated: LEGAL_UPDATED },
    en: { title: 'Terms of Service', description: 'The rules for using NoutLife: eligibility, subscriptions and automatic renewal, cancellation, your content, acceptable use and liability.', sections: TERMS_EN, updated: LEGAL_UPDATED_EN },
  },
  copyright: {
    path: '/copyright',
    es: { title: 'Propiedad intelectual y DMCA', description: 'Titularidad de la marca, el diseño y el código de NoutLife, prohibición de clonación y procedimiento DMCA.', sections: COPYRIGHT, updated: LEGAL_UPDATED },
    en: { title: 'Intellectual Property & Copyright', description: 'Ownership of the NoutLife brand, design and code, restrictions on copying, and how to report copyright infringement under the DMCA.', sections: COPYRIGHT_EN, updated: LEGAL_UPDATED_EN },
  },
  health: {
    path: '/health-data',
    es: null,
    en: { title: 'Consumer Health Data Privacy Policy', description: 'How NoutLife collects, uses and shares consumer health data, and how to exercise your rights under Washington’s My Health My Data Act.', sections: HEALTH_DATA_EN, updated: LEGAL_UPDATED_EN },
  },
};

const UI: Copy<{
  back: string; updated: (date: string) => string; seeAlso: string; other: string; englishOnly: string;
  links: Record<Kind, string>;
}> = {
  es: {
    back: 'Volver',
    updated: (date) => `Última actualización: ${date}`,
    seeAlso: 'Lee también:',
    other: 'Read in English',
    englishOnly: 'Este aviso aplica a residentes de Estados Unidos y solo está disponible en inglés.',
    links: { privacy: 'Política de privacidad', terms: 'Términos de uso', copyright: 'Propiedad intelectual', health: 'Datos de salud' },
  },
  en: {
    back: 'Back',
    updated: (date) => `Last updated: ${date}`,
    seeAlso: 'See also:',
    other: 'Leer en español',
    englishOnly: '',
    links: { privacy: 'Privacy Policy', terms: 'Terms of Service', copyright: 'Intellectual Property', health: 'Consumer Health Data' },
  },
};

function kindOf(pathname: string): Kind {
  if (pathname.startsWith('/privacy')) return 'privacy';
  if (pathname.startsWith('/copyright')) return 'copyright';
  if (pathname.startsWith('/health-data')) return 'health';
  return 'terms';
}

export default function LegalPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const kind = kindOf(pathname);
  const appLocale = useLocale();
  // Leer el documento en el otro idioma no cambia el idioma de la app.
  const [view, setView] = useState<Locale | null>(null);
  const locale = view ?? appLocale;
  const entry = DOCS[kind];
  const doc = entry[locale] ?? entry.en;
  const docLocale: Locale = entry[locale] ? locale : 'en';
  const ui = UI[locale];

  useDocumentLang(docLocale);
  useDocumentMeta({ title: `${doc.title} — NoutLife`, description: doc.description, path: entry.path, locale: docLocale });

  const others = (Object.keys(DOCS) as Kind[])
    .filter((k) => k !== kind && (k !== 'health' || locale === 'en'))
    .map((k) => <Link key={k} to={DOCS[k].path} className="text-primary-text underline">{ui.links[k]}</Link>);
  const otherLocale: Locale = locale === 'es' ? 'en' : 'es';

  return (
    <LocaleProvider value={locale}>
      <main className="min-h-dvh bg-background px-4 py-6 text-on-background md:py-12">
        <article lang={docLocale} className="mx-auto flex max-w-[720px] flex-col gap-6">
          <div className="flex items-center justify-between gap-3">
            <BrandLockup />
            <Button variant="ghost" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
              <ArrowLeft aria-hidden className="size-5" strokeWidth={1.75} />{ui.back}
            </Button>
          </div>
          <header className="flex flex-col gap-2">
            <h1 className="text-display-sm">{doc.title}</h1>
            <p className="text-body-sm text-on-surface-light">{ui.updated(doc.updated)}</p>
            {entry.es && (
              <button
                type="button"
                lang={otherLocale}
                onClick={() => setView(otherLocale)}
                className="inline-flex min-h-11 items-center gap-1.5 self-start text-body-sm font-semibold text-primary-text underline-offset-4 hover:underline"
              >
                <Languages aria-hidden className="size-4" strokeWidth={1.75} />{ui.other}
              </button>
            )}
            {!entry[locale] && ui.englishOnly && <p lang="es" className="text-body-sm text-on-surface-light">{ui.englishOnly}</p>}
          </header>
          {doc.sections.map((s) => (
            <section key={s.h} className="flex flex-col gap-2">
              <h2 className="text-heading-md">{s.h}</h2>
              {s.p.map((t) => <p key={t} className="text-body-lg text-on-surface">{t}</p>)}
            </section>
          ))}
          <p className="text-body-sm text-on-surface-light">
            {ui.seeAlso} {others.flatMap((el, i) => (i ? [' · ', el] : [el]))}.
          </p>
          <LegalFooter className="-mx-4" />
        </article>
      </main>
    </LocaleProvider>
  );
}
