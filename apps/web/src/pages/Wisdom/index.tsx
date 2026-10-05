// Sabiduría (WisdomDesktop): principio del día con Guardar/Compartir/Reflexionar,
// chips por categoría y principios abiertos o bloqueados por nivel.
// Zona ambientada: un lugar antiguo. El principio del día está escrito en
// pergamino y se graba palabra a palabra; los demás emergen de la niebla. Luz de
// antorcha que oscila muy suave, polvo y niebla tenue. Un principio nuevo desde
// la última visita intensifica la luz un instante.
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Bookmark, BookOpen, Brain, Coins, HeartPulse, List, NotebookPen, Share2, Sprout, Swords, Users, type LucideIcon } from 'lucide-react';
import { enter, item, stagger } from '@/lib/motion';
import { AmbientLight, Particles, ZoneShell, useParticleBudget } from '@/components/ambience';
import { EngravedText } from '@/components/wisdom/Engraved';
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
/** Último principio del día visto en este navegador (para notar uno nuevo). */
const LAST_KEY = 'lq-wisdom-last';
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
  /** El principio del día es nuevo: la antorcha se aviva un instante. */
  const [discovered, setDiscovered] = useState(false);
  const budget = useParticleBudget();

  const load = () => {
    setState('loading');
    Promise.allSettled([wisdomService.getDailyCard(), wisdomService.getAllCards()]).then(([d, all]) => {
      if (d.status === 'fulfilled') setDaily(d.value);
      if (all.status === 'fulfilled') { setData(all.value); setState('ready'); } else setState('error');
    });
  };
  useEffect(load, []);

  const featured = daily ?? data?.available[0] ?? null;
  useEffect(() => {
    if (!featured) return;
    try {
      const last = localStorage.getItem(LAST_KEY);
      if (last && last !== featured.id) setDiscovered(true);
      localStorage.setItem(LAST_KEY, featured.id);
    } catch { /* sin almacenamiento */ }
  }, [featured]);
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
    <ZoneShell
      zone="wisdom"
      contentClassName="gap-8 md:gap-12"
      ambience={(
        <>
          {/* Antorchas: luz cálida que oscila muy suave */}
          <AmbientLight tone="warning" alpha={0.13} darkAlpha={0.1} breathe={false} className="lq-candle -left-[8%] top-[-4%] h-[26rem] w-[34%]" />
          <AmbientLight tone="warning" alpha={0.1} darkAlpha={0.08} breathe={false} className="lq-candle right-[-6%] top-[8%] h-[22rem] w-[30%] [animation-delay:-1.7s]" />
        </>
      )}
      view={(
        <>
          {/* Niebla tenue al pie y polvo suspendido */}
          <span className="lq-amb-wander absolute inset-x-[-10%] bottom-[-6%] block h-[40%] bg-[radial-gradient(60%_60%_at_50%_100%,rgb(var(--lq-on-surface-light)/.10),transparent)] blur-2xl [--d:30s]" />
          <Particles count={budget(10)} kind="drift" seed={77} y={[10, 80]} duration={[12, 20]} alpha={[0.18, 0.4]} size={[1.5, 3]} sx={[-18, 18]} sy={[-20, 12]}
            render={(sz) => <span className="block rounded-full bg-secondary" style={{ width: sz, height: sz }} />} />
        </>
      )}
    >
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
          <SpotCard aria-label="Principio del día" className="lq-tex-parchment relative flex flex-col gap-6">
            {/* Un principio nuevo aviva la luz un instante */}
            {discovered && <motion.span aria-hidden="true" className="pointer-events-none absolute -inset-10 rounded-[2rem] bg-[radial-gradient(closest-side,rgb(var(--lq-secondary)/.35),transparent)]" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.15] }} transition={{ duration: 2.4, times: [0, 0.35, 1], delay: 0.6 }} />}
            <BookOpen aria-hidden className="absolute right-8 top-6 size-28 animate-float text-primary/[var(--lq-soft-alpha)] [.reduce-motion_&]:animate-none md:right-10 md:size-32" strokeWidth={1} />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-label-lg text-primary-text">{daily ? 'Principio del día' : 'Principio destacado'}</span>
              <Badge variant={fc.tone} icon={fc.icon}>{fc.label}</Badge>
            </div>
            <p className="relative max-w-[760px] text-heading-lg [text-wrap:balance] md:text-display-sm"><EngravedText text={`“${featured.quote}”`} delay={0.45} step={discovered ? 0.09 : 0.05} /></p>
            {featured.author && (
              <motion.p className="relative text-body-md text-on-surface-light" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.8, delay: 0.6 + featured.quote.split(/\s+/).length * (discovered ? 0.09 : 0.05) } }}>
                — {featured.author}
              </motion.p>
            )}
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
                <motion.li key={c.id} variants={enter.emerge}>
                  <Card interactive padding="lg" className="lq-tex-parchment h-full">
                    <QuoteCard category={k.label} icon={k.icon} tone={k.tone} text={c.quote} author={c.author} />
                  </Card>
                </motion.li>
              );
            })}
            {locked.map((c) => {
              const k = catOf(c.category);
              return (
                <motion.li key={c.id} variants={enter.emerge}>
                  <Card padding="lg" className="h-full bg-background">
                    <QuoteCard category={k.label} icon={k.icon} tone={k.tone} unlockLevel={c.levelRequired} />
                  </Card>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </motion.section>
    </ZoneShell>
  );
}
