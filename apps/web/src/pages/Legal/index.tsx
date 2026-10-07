// Política de privacidad (/privacy), Términos de uso (/terms) y Propiedad
// intelectual (/copyright). Públicas: las enlazan el login, Ajustes, el pie y las
// fichas de las tiendas. El texto vive en ./content.ts.
import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { BrandLockup } from '@/components/layout/Brand';
import { Button } from '@/components/ui/lq';
import { LegalFooter } from '@/components/legal/LegalFooter';
import { COPYRIGHT, LEGAL_UPDATED, PRIVACY, TERMS } from './content';

const SITE = 'https://noutlife.vercel.app';
const SEO = {
  privacy: { path: '/privacy', title: 'Política de privacidad', description: 'Cómo NoutLife recopila, usa y protege tus datos: inicio de sesión con Google, proveedores de IA, almacenamiento local y tus derechos.' },
  terms: { path: '/terms', title: 'Términos de uso', description: 'Reglas de uso de NoutLife: edad mínima, contenido del usuario, servicios de terceros y responsabilidad.' },
  copyright: { path: '/copyright', title: 'Propiedad intelectual y DMCA', description: 'Titularidad de la marca, el diseño y el código de NoutLife, prohibición de clonación y procedimiento DMCA.' },
} as const;

function setMeta(selector: string, attr: 'content' | 'href', value: string) {
  document.head.querySelector(selector)?.setAttribute(attr, value);
}

/** Título, descripción, canonical y Open Graph propios de cada página legal; se restauran al salir. */
function useLegalSeo(kind: keyof typeof SEO) {
  useEffect(() => {
    const { path, title, description } = SEO[kind];
    const fullTitle = `${title} — NoutLife`;
    const url = SITE + path;
    const q = (sel: string, attr: 'content' | 'href') => document.head.querySelector(sel)?.getAttribute(attr) ?? '';
    const prev = {
      title: document.title,
      description: q('meta[name="description"]', 'content'),
      ogTitle: q('meta[property="og:title"]', 'content'),
      ogDescription: q('meta[property="og:description"]', 'content'),
      ogUrl: q('meta[property="og:url"]', 'content'),
      canonical: q('link[rel="canonical"]', 'href'),
    };
    document.title = fullTitle;
    setMeta('meta[name="description"]', 'content', description);
    setMeta('meta[property="og:title"]', 'content', fullTitle);
    setMeta('meta[property="og:description"]', 'content', description);
    setMeta('meta[property="og:url"]', 'content', url);
    setMeta('link[rel="canonical"]', 'href', url);
    return () => {
      document.title = prev.title;
      setMeta('meta[name="description"]', 'content', prev.description);
      setMeta('meta[property="og:title"]', 'content', prev.ogTitle);
      setMeta('meta[property="og:description"]', 'content', prev.ogDescription);
      setMeta('meta[property="og:url"]', 'content', prev.ogUrl);
      setMeta('link[rel="canonical"]', 'href', prev.canonical);
    };
  }, [kind]);
}

export default function LegalPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const kind = pathname.startsWith('/privacy') ? 'privacy' : pathname.startsWith('/copyright') ? 'copyright' : 'terms';
  useLegalSeo(kind);
  const sections = { privacy: PRIVACY, terms: TERMS, copyright: COPYRIGHT }[kind];
  const title = { privacy: 'Política de privacidad', terms: 'Términos de uso', copyright: 'Propiedad intelectual y DMCA' }[kind];

  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-on-background md:py-12">
      <article className="mx-auto flex max-w-[720px] flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <BrandLockup />
          <Button variant="ghost" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
            <ArrowLeft aria-hidden className="size-5" strokeWidth={1.75} />Volver
          </Button>
        </div>
        <header className="flex flex-col gap-1">
          <h1 className="text-display-sm">{title}</h1>
          <p className="text-body-sm text-on-surface-light">Última actualización: {LEGAL_UPDATED}</p>
        </header>
        {sections.map((s) => (
          <section key={s.h} className="flex flex-col gap-2">
            <h2 className="text-heading-md">{s.h}</h2>
            {s.p.map((t) => <p key={t} className="text-body-lg text-on-surface">{t}</p>)}
          </section>
        ))}
        <p className="text-body-sm text-on-surface-light">
          Lee también: {[
            kind !== 'privacy' && <Link key="p" to="/privacy" className="text-primary-text underline">Política de privacidad</Link>,
            kind !== 'terms' && <Link key="t" to="/terms" className="text-primary-text underline">Términos de uso</Link>,
            kind !== 'copyright' && <Link key="c" to="/copyright" className="text-primary-text underline">Propiedad intelectual</Link>,
          ].filter(Boolean).flatMap((el, i) => (i ? [' · ', el] : [el]))}.
        </p>
        <LegalFooter className="-mx-4" />
      </article>
    </main>
  );
}
