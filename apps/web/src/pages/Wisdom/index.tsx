// Sabiduría (WisdomDesktop): la cita del día de una figura histórica, con
// Guardar/Compartir/Reflexionar y «Otra cita» para rotar entre las desbloqueadas;
// chips por categoría y citas abiertas o bloqueadas por nivel.
// Zona ambientada: un santuario antiguo. La cita del día está tallada en una
// estela de piedra entre dos columnas con antorchas de llama viva y se graba palabra
// a palabra; las demás son placas de piedra que emergen de la niebla y las
// bloqueadas siguen cubiertas de polvo. Polvo y niebla tenue. Una cita nueva
// desde la última visita aviva la luz de las antorchas un instante.
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Bookmark, BookOpen, Brain, Coins, Compass, HeartPulse, List, NotebookPen, RotateCcw, Share2, Shuffle, Sprout, Swords, Users, type LucideIcon } from 'lucide-react';
import { enter, item, stagger } from '@/lib/motion';
import { AmbientLight, Particles, ZoneShell, useParticleBudget } from '@/components/ambience';
import { EngravedText } from '@/components/wisdom/Engraved';
import { Column, StoneTablet } from '@/components/wisdom/Sanctuary';
import { cn } from '@/lib/utils';
import * as wisdomService from '@/services/wisdom.service';
import type { WisdomCard } from '@/services/wisdom.service';
import { PageHeader } from '@/components/layout/PageHeader';
import { useToast } from '@/hooks/useToast';
import {
  Badge, Button, Card, ChipGroup, EmptyState, ErrorState, PageLoader, ProgressBar, QuoteCard, type ChipOption, type Tone,
} from '@/components/ui/lq';

type Cat = { label: string; tone: Exclude<Tone, 'muted'>; icon: LucideIcon };
const CATS: Record<string, Cat> = {
  discipline: { label: 'Disciplina', tone: 'error', icon: Swords },
  mindset: { label: 'Mentalidad', tone: 'primary', icon: Brain },
  strategy: { label: 'Estrategia', tone: 'secondary', icon: Compass },
  finance: { label: 'Finanzas', tone: 'warning', icon: Coins },
  health: { label: 'Salud', tone: 'success', icon: HeartPulse },
  relationships: { label: 'Relaciones', tone: 'forest', icon: Users },
  growth: { label: 'Crecimiento', tone: 'info', icon: Sprout },
};
const catOf = (c: string): Cat => CATS[c] ?? { label: c, tone: 'primary', icon: BookOpen };

// TODO(api): no hay endpoint para guardar citas; se guardan en este dispositivo.
const SAVED_KEY = 'lq-wisdom-saved';
/** Última cita del día vista en este navegador (para notar una nueva). */
const LAST_KEY = 'lq-wisdom-last';
function readSaved(): string[] {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]'); } catch { return []; }
}

/** Pausa del grabado por palabra: más lenta cuando la cita del día es nueva. */
const engraveStep = (slow: boolean) => (slow ? 0.09 : 0.05);

type Data = Awaited<ReturnType<typeof wisdomService.getAllCards>>;

export default function WisdomPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [daily, setDaily] = useState<WisdomCard | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [cat, setCat] = useState('all');
  const [saved, setSaved] = useState<string[]>(readSaved);
  /** La cita del día es nueva: la antorcha se aviva un instante. */
  const [discovered, setDiscovered] = useState(false);
  /** Cita elegida con «Otra cita» (null = la del día). */
  const [picked, setPicked] = useState<WisdomCard | null>(null);
  const budget = useParticleBudget();

  const load = () => {
    setState('loading');
    Promise.allSettled([wisdomService.getDailyCard(), wisdomService.getAllCards()]).then(([d, all]) => {
      if (d.status === 'fulfilled') setDaily(d.value);
      if (all.status === 'fulfilled') { setData(all.value); setState('ready'); } else setState('error');
    });
  };
  useEffect(load, []);

  const today = daily ?? data?.available[0] ?? null;
  const featured = picked ?? today;
  useEffect(() => {
    if (!today) return;
    try {
      const last = localStorage.getItem(LAST_KEY);
      if (last && last !== today.id) setDiscovered(true);
      localStorage.setItem(LAST_KEY, today.id);
    } catch { /* sin almacenamiento */ }
  }, [today]);
  const total = (data?.available.length ?? 0) + (data?.locked.length ?? 0);
  const nextLevel = useMemo(() => (data?.locked.length ? Math.min(...data.locked.map((l) => l.levelRequired)) : null), [data]);

  /** Otra cita al azar entre las desbloqueadas (nunca la que ya se ve). */
  const another = () => {
    const pool = (data?.available ?? []).filter((c) => c.id !== featured?.id);
    if (pool.length) setPicked(pool[Math.floor(Math.random() * pool.length)]);
  };

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
    const by = featured.author ? `\n${featured.author}${featured.source ? `, ${featured.source}` : ''}` : '';
    const text = `“${featured.quote}”${by}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast.success('Cita copiada'); }
    } catch { /* cancelado */ }
  };

  if (state === 'loading') return <PageLoader />;
  if (state === 'error') return <ErrorState onRetry={load} />;

  const fc = featured ? catOf(featured.category) : null;
  // Al pedir otra cita se graba enseguida; la del día espera a que la página entre.
  const delay = picked ? 0.1 : 0.45;
  const step = engraveStep(discovered && !picked);

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
        title="Biblioteca de citas"
        description={`Lo que dijeron filósofos, estrategas, científicos y atletas que marcaron su época. Subir de nivel abre más: ${data?.available.length ?? 0} de ${total}.`}
        aside={
          <div className="flex w-full max-w-[260px] flex-col gap-1.5">
            <div className="flex justify-between gap-3"><span className="text-body-sm text-on-surface-light">Desbloqueadas</span><span className="font-mono text-label-lg tabular-nums">{data?.available.length ?? 0}/{total}</span></div>
            <ProgressBar value={total ? ((data?.available.length ?? 0) / total) * 100 : 0} shine label="Citas desbloqueadas" />
            {nextLevel && <span className="text-body-sm text-on-surface-light">Siguiente al nivel {nextLevel}</span>}
          </div>
        }
      />

      {featured && fc && (
        <motion.div variants={item} className="relative flex items-stretch justify-center gap-3 lg:gap-6">
          {/* Una cita nueva aviva la luz de las antorchas un instante */}
          {discovered && <motion.span aria-hidden="true" className="pointer-events-none absolute -inset-10 rounded-[2rem] bg-[radial-gradient(closest-side,rgb(var(--lq-warning)/.3),transparent)]" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.15] }} transition={{ duration: 2.4, times: [0, 0.35, 1], delay: 0.6 }} />}
          <Column side="left" className="hidden md:flex" />
          <StoneTablet aria-label={picked ? 'Otra cita' : 'Cita del día'} className="flex min-w-0 max-w-[880px] flex-1 flex-col gap-7 px-6 py-9 md:px-12 md:py-12">
            <div className="flex flex-wrap items-center justify-center gap-2 text-center">
              <span className="text-label-lg text-on-surface">{picked ? 'Otra cita' : daily ? 'Cita del día' : 'Cita destacada'}</span>
              <Badge variant={fc.tone} icon={fc.icon}>{fc.label}</Badge>
            </div>
            {/* key: cada cita nueva se vuelve a grabar palabra a palabra */}
            <blockquote key={featured.id} className="relative flex flex-col items-center gap-6">
              <p className="lq-engraved mx-auto max-w-[26ch] text-center font-serif text-[1.75rem] font-medium leading-[1.2] [text-wrap:balance] md:text-[2.625rem]">
                <EngravedText text={`“${featured.quote}”`} delay={delay} step={step} />
              </p>
              {featured.author && (
                <motion.footer
                  className="flex flex-col items-center gap-1 text-center"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.8, delay: delay + 0.15 + featured.quote.split(/\s+/).length * step } }}
                >
                  <span aria-hidden className="mb-2 block h-px w-12 bg-secondary" />
                  <cite className="text-heading-sm not-italic text-on-background">{featured.author}</cite>
                  {featured.source && <span className="font-serif text-body-lg italic text-on-surface-light">{featured.source}</span>}
                </motion.footer>
              )}
            </blockquote>
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant={isSaved ? 'secondary' : 'primary'} aria-pressed={isSaved} onClick={toggleSave}>
                <Bookmark aria-hidden className={cn('size-4', isSaved && 'fill-current')} strokeWidth={1.75} />{isSaved ? 'Guardada' : 'Guardar'}
              </Button>
              <Button variant="ghost" onClick={another} disabled={(data?.available.length ?? 0) < 2}><Shuffle aria-hidden className="size-4" strokeWidth={1.75} />Otra cita</Button>
              {picked && <Button variant="ghost" onClick={() => setPicked(null)}><RotateCcw aria-hidden className="size-4" strokeWidth={1.75} />Volver a la del día</Button>}
              <Button variant="ghost" onClick={share}><Share2 aria-hidden className="size-4" strokeWidth={1.75} />Compartir</Button>
              <Button variant="ghost" onClick={() => navigate('/journal')}><NotebookPen aria-hidden className="size-4" strokeWidth={1.75} />Reflexionar en el diario</Button>
            </div>
          </StoneTablet>
          <Column side="right" className="hidden md:flex" />
        </motion.div>
      )}

      <motion.section variants={item} className="flex flex-col gap-6" aria-label="Biblioteca">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ChipGroup label="Categoría" options={options} value={cat} onChange={setCat} />
          <span className="text-body-sm text-on-surface-light">Guardadas: <span className="font-mono">{saved.length}</span></span>
        </div>
        {open.length === 0 && locked.length === 0 ? (
          <EmptyState icon={BookOpen} title="Nada en esta categoría" description="Sube de nivel para desbloquear más citas." />
        ) : (
          <motion.ul variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-3">
            {open.map((c) => {
              const k = catOf(c.category);
              return (
                <motion.li key={c.id} variants={enter.emerge}>
                  <Card interactive padding="lg" className="lq-stone h-full rounded-[18px_14px_20px_12px]">
                    <QuoteCard category={k.label} icon={k.icon} tone={k.tone} text={c.quote} author={c.author} source={c.source} />
                  </Card>
                </motion.li>
              );
            })}
            {locked.map((c) => {
              const k = catOf(c.category);
              return (
                <motion.li key={c.id} variants={enter.emerge}>
                  <Card padding="lg" className="lq-stone lq-dusty h-full rounded-[18px_14px_20px_12px]">
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
