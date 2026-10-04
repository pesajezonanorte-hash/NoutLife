// Sabiduría (WisdomDesktop): principio del día con Guardar/Compartir/Reflexionar,
// chips por categoría y principios abiertos o bloqueados por nivel.
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Bookmark, BookOpen, Brain, Coins, HeartPulse, List, NotebookPen, Share2, Sprout, Swords, Users, type LucideIcon } from 'lucide-react';
import { item, stagger } from '@/lib/motion';
import { cn } from '@/lib/utils';
import * as wisdomService from '@/services/wisdom.service';
import type { WisdomCard } from '@/services/wisdom.service';
import { PageHeader } from '@/components/layout/PageHeader';
import { useToast } from '@/hooks/useToast';
import {
  Badge, Button, Card, ChipGroup, EmptyState, ErrorState, PageLoader, ProgressBar, QuoteCard, SpotCard, type ChipOption, type Tone,
} from '@/components/ui/lq';

type Cat = { label: string; tone: Exclude<Tone, 'muted'>; icon: LucideIcon };
const CATS: Record<string, Cat> = {
  discipline: { label: 'Disciplina', tone: 'error', icon: Swords },
  mindset: { label: 'Mentalidad', tone: 'primary', icon: Brain },
  finance: { label: 'Finanzas', tone: 'warning', icon: Coins },
  health: { label: 'Salud', tone: 'success', icon: HeartPulse },
  relationships: { label: 'Relaciones', tone: 'forest', icon: Users },
  growth: { label: 'Crecimiento', tone: 'info', icon: Sprout },
};
const catOf = (c: string): Cat => CATS[c] ?? { label: c, tone: 'primary', icon: BookOpen };

// TODO(api): no hay endpoint para guardar principios; se guardan en este dispositivo.
const SAVED_KEY = 'lq-wisdom-saved';
function readSaved(): string[] {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]'); } catch { return []; }
}

type Data = Awaited<ReturnType<typeof wisdomService.getAllCards>>;

export default function WisdomPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [daily, setDaily] = useState<WisdomCard | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [cat, setCat] = useState('all');
  const [saved, setSaved] = useState<string[]>(readSaved);

  const load = () => {
    setState('loading');
    Promise.allSettled([wisdomService.getDailyCard(), wisdomService.getAllCards()]).then(([d, all]) => {
      if (d.status === 'fulfilled') setDaily(d.value);
      if (all.status === 'fulfilled') { setData(all.value); setState('ready'); } else setState('error');
    });
  };
  useEffect(load, []);

  const featured = daily ?? data?.available[0] ?? null;
  const total = (data?.available.length ?? 0) + (data?.locked.length ?? 0);
  const nextLevel = useMemo(() => (data?.locked.length ? Math.min(...data.locked.map((l) => l.levelRequired)) : null), [data]);

  const options: ChipOption<string>[] = [
    { value: 'all', label: 'Todas', icon: List },
    ...Object.entries(CATS).map(([value, c]) => ({ value, label: c.label, icon: c.icon })),
  ];
  const open = (data?.available ?? []).filter((c) => c.id !== featured?.id && (cat === 'all' || c.category === cat));
  const locked = (data?.locked ?? []).filter((c) => cat === 'all' || c.category === cat).slice(0, 6);

  const isSaved = featured ? saved.includes(featured.id) : false;
  const toggleSave = () => {
    if (!featured) return;
    const next = isSaved ? saved.filter((id) => id !== featured.id) : [...saved, featured.id];
    setSaved(next);
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch { /* sin storage */ }
  };
  const share = async () => {
    if (!featured) return;
    const text = `“${featured.quote}”${featured.author ? ` — ${featured.author}` : ''}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast.success('Principio copiado'); }
    } catch { /* cancelado */ }
  };

  if (state === 'loading') return <PageLoader />;
  if (state === 'error') return <ErrorState onRetry={load} />;

  const fc = featured ? catOf(featured.category) : null;

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-8 md:gap-12">
      <PageHeader
        eyebrow="Sabiduría"
        title="Biblioteca de principios"
        description={`Ideas que desbloqueas al subir de nivel. ${data?.available.length ?? 0} de ${total} disponibles.`}
        aside={
          <div className="flex w-full max-w-[260px] flex-col gap-1.5">
            <div className="flex justify-between"><span className="text-body-sm text-on-surface-light">Desbloqueados</span><span className="font-mono text-label-lg tabular-nums">{data?.available.length ?? 0}/{total}</span></div>
            <ProgressBar value={total ? ((data?.available.length ?? 0) / total) * 100 : 0} shine label="Principios desbloqueados" />
            {nextLevel && <span className="text-body-sm text-on-surface-light">Siguiente al nivel {nextLevel}</span>}
          </div>
        }
      />

      {featured && fc && (
        <motion.div variants={item}>
          <SpotCard aria-label="Principio del día" className="relative flex flex-col gap-6">
            <BookOpen aria-hidden className="absolute right-8 top-6 size-28 animate-float text-primary/[var(--lq-soft-alpha)] [.reduce-motion_&]:animate-none md:right-10 md:size-32" strokeWidth={1} />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-label-lg text-primary-text">{daily ? 'Principio del día' : 'Principio destacado'}</span>
              <Badge variant={fc.tone} icon={fc.icon}>{fc.label}</Badge>
            </div>
            <p className="relative max-w-[760px] text-heading-lg [text-wrap:balance] md:text-display-sm">“{featured.quote}”</p>
            {featured.author && <p className="text-body-md text-on-surface-light">— {featured.author}</p>}
            <div className="flex flex-wrap gap-3">
              <Button variant={isSaved ? 'secondary' : 'primary'} aria-pressed={isSaved} onClick={toggleSave}>
                <Bookmark aria-hidden className={cn('size-4', isSaved && 'fill-current')} strokeWidth={1.75} />{isSaved ? 'Guardado' : 'Guardar'}
              </Button>
              <Button variant="ghost" onClick={share}><Share2 aria-hidden className="size-4" strokeWidth={1.75} />Compartir</Button>
              <Button variant="ghost" onClick={() => navigate('/journal')}><NotebookPen aria-hidden className="size-4" strokeWidth={1.75} />Reflexionar en el diario</Button>
            </div>
          </SpotCard>
        </motion.div>
      )}

      <motion.section variants={item} className="flex flex-col gap-6" aria-label="Biblioteca">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ChipGroup label="Categoría" options={options} value={cat} onChange={setCat} />
          <span className="text-body-sm text-on-surface-light">Guardados · <span className="font-mono">{saved.length}</span></span>
        </div>
        {open.length === 0 && locked.length === 0 ? (
          <EmptyState icon={BookOpen} title="Nada en esta categoría" description="Sube de nivel para desbloquear más principios." />
        ) : (
          <motion.ul variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-3">
            {open.map((c) => {
              const k = catOf(c.category);
              return (
                <motion.li key={c.id} variants={item}>
                  <Card interactive padding="lg" className="h-full">
                    <QuoteCard category={k.label} icon={k.icon} tone={k.tone} text={c.quote} author={c.author} />
                  </Card>
                </motion.li>
              );
            })}
            {locked.map((c) => {
              const k = catOf(c.category);
              return (
                <motion.li key={c.id} variants={item}>
                  <Card padding="lg" className="h-full bg-background">
                    <QuoteCard category={k.label} icon={k.icon} tone={k.tone} unlockLevel={c.levelRequired} />
                  </Card>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </motion.section>
    </motion.div>
  );
}
