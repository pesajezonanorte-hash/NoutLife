import { motion } from 'framer-motion';
import { ArrowLeft, Compass, Home } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, IconChip, buttonClasses } from '@/components/ui/lq';
import { item, stagger } from '@/lib/motion';
import { Lettering } from '@/components/layout/Lettering';
import { useText, type Copy } from '@/lib/i18n';

const COPY: Copy<{ error: string; title: string; body: string; back: string; home: string }> = {
  es: {
    error: 'Error 404', title: 'Zona sin explorar',
    body: 'Puede que el enlace esté mal escrito o que esta zona se haya movido.',
    back: 'Volver', home: 'Ir al inicio',
  },
  en: {
    error: 'Error 404', title: 'Uncharted zone',
    body: 'The link may be mistyped, or this zone may have moved.',
    back: 'Go back', home: 'Go to home',
  },
};

export default function NotFoundPage() {
  const t = useText(COPY);
  const navigate = useNavigate();
  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <motion.div variants={item}><IconChip icon={Compass} tone="forest" size="lg" /></motion.div>
      <motion.div variants={item} className="flex max-w-md flex-col gap-3">
        <span className="font-mono text-label-lg tabular-nums text-on-surface-light">{t.error}</span>
        <h1 className="text-display-sm md:text-display-md"><Lettering text={t.title} /></h1>
        <p className="text-body-lg text-on-surface-light">{t.body}</p>
      </motion.div>
      <motion.div variants={item} className="flex flex-wrap justify-center gap-3">
        <Button variant="secondary" size="md" onClick={() => navigate(-1)}><ArrowLeft aria-hidden className="size-4" />{t.back}</Button>
        <Link to="/" className={buttonClasses('primary', 'md')}><Home aria-hidden className="size-4" />{t.home}</Link>
      </motion.div>
    </motion.div>
  );
}
