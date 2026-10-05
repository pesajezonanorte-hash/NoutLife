// Logros — Achievements.dc.html (móvil) / AchievementsDesktop.dc.html (desktop).
// Grid 2 col (móvil) / auto-fill 232 px; hover y foco despliegan la descripción.
// Zona ambientada: una vitrina de trofeos. Al llegar se encienden los focos y
// cada trofeo sube a su pedestal; los bloqueados esperan tras cristal
// esmerilado. Un logro conseguido desde la última visita se celebra: el cristal
// se aclara, el trofeo destella y suelta unas motas doradas dentro de su vitrina.
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type PointerEvent } from 'react';
import { motion } from 'framer-motion';
import { Check, Lock, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { item, springs, stagger } from '@/lib/motion';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { EmptyState, ErrorState, ProgressBar, ProgressRing, Select, SegmentedControl, PageLoader } from '@/components/ui/lq';
import { LOADING_COPY } from '@/lib/loadingCopy';
import { softTone } from '@/components/ui/lq/tones';
import { AmbientLight, Particles, Sheen, ZoneShell, useParticleBudget } from '@/components/ambience';
import { fetchAchievements, type Achievement } from '@/services/achievement.service';
import { achievementCategory as catMeta, achievementIcon, achievementProgress as progressOf } from '@/components/achievements/achievementMeta';

type Filter = 'all' | 'on' | 'off';

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '');

/** Logros ya celebrados en este navegador (solo para no repetir la celebración). */
const SEEN_KEY = 'lq-ach-seen';
function readSeen(): Set<string> | null {
  try { const raw = localStorage.getItem(SEEN_KEY); return raw ? new Set(JSON.parse(raw) as string[]) : null; } catch { return null; }
}
function writeSeen(ids: string[]) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(ids)); } catch { /* sin almacenamiento: se celebra de nuevo */ }
}

/** Motas doradas que salen del trofeo recién desbloqueado (decorativas). */
const BURST = Array.from({ length: 10 }, (_, i) => {
  const ang = (i / 10) * Math.PI * 2 + 0.3;
  const r = 34 + (i % 3) * 10;
  return { tx: `${Math.cos(ang) * r}px`, ty: `${Math.sin(ang) * r - 8}px`, delay: `${0.42 + (i % 4) * 0.04}s` };
});

function AchievementCard({ a, index, fresh }: { a: Achievement; index: number; fresh: boolean }) {
  const meta = catMeta(a.category);
  const Icon = achievementIcon(a);
  const { target, current, pct } = progressOf(a);
  const on = a.unlocked;
  const metaText = on ? `Desbloqueado · ${fmtDate(a.unlockedAt)}` : target > 0 ? `${pct}% · ${current}/${target}` : 'Bloqueado';
  const aria = `${a.title}. ${a.description.replace(/\.\s*$/, '')}. ${on ? `Desbloqueado el ${fmtDate(a.unlockedAt)}` : target > 0 ? `Bloqueado, ${pct} por ciento` : 'Bloqueado'}. ${a.xpReward} XP.`;
  const delay = 0.3 + Math.min(index, 12) * 0.06;

  // El brillo del cristal sigue al puntero.
  const glint = (e: PointerEvent<HTMLLIElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    e.currentTarget.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  return (
    <motion.li
      variants={item}
      tabIndex={0}
      aria-label={aria}
      onPointerMove={glint}
      className={cn(
        // `group` despliega la descripción con hover y con foco (también en móvil al tocar).
        'lq-lift group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border p-4 shadow-sm md:items-center md:gap-4 md:p-6 md:text-center',
        on ? 'bg-surface' : 'bg-background',
      )}
    >
      {/* Vitrina: foco cenital (se enciende al llegar) y brillo del cristal */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0">
        {on && (
          <motion.span
            className="absolute inset-x-[10%] -top-6 block h-40 bg-[radial-gradient(50%_70%_at_50%_0%,rgb(var(--lq-secondary)/.22),transparent_75%)] dark:bg-[radial-gradient(50%_70%_at_50%_0%,rgb(var(--lq-secondary)/.14),transparent_75%)]"
            initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.6, delay: delay - 0.2 } }}
          />
        )}
        <span className="lq-glint absolute inset-0 block" />
      </span>

      <div className="relative flex items-start justify-between md:justify-center">
        <span className="relative flex flex-col items-center">
          {/* El trofeo sube a su pedestal */}
          <motion.span
            aria-hidden
            className="lq-medal relative block origin-top"
            initial={{ y: 22, opacity: 0 }}
            animate={{ y: 0, opacity: 1, transition: { ...springs.heavy, delay, opacity: { duration: 0.25, delay } } }}
          >
            <span
              className={cn(
                'lq-ichip flex size-14 items-center justify-center rounded-2xl md:size-[88px] md:rounded-[28px]',
                on ? softTone[meta.tone] : cn(softTone.muted, 'grayscale'),
              )}
            >
              <Icon className={cn('size-7 md:size-11', !on && 'opacity-60')} strokeWidth={1.75} />
            </span>
            {/* Bloqueado: silueta tras cristal esmerilado. Recién desbloqueado: el cristal se aclara. */}
            {(!on || fresh) && (
              <motion.span
                className="absolute inset-0 rounded-2xl border border-on-background/[.06] bg-surface/40 backdrop-blur-[3px] md:rounded-[28px]"
                initial={{ opacity: 1 }}
                animate={fresh ? { opacity: 0, transition: { duration: 0.9, delay: delay + 0.25, ease: [0.16, 1, 0.3, 1] } } : { opacity: 1 }}
              />
            )}
            {fresh && (
              <>
                <span className="lq-flash absolute -inset-3 rounded-full bg-[radial-gradient(closest-side,rgb(var(--lq-secondary)/.6),transparent)]" />
                {BURST.map((b, i) => (
                  <span key={i} className="lq-burst absolute left-1/2 top-1/2 -ml-[3px] -mt-[3px] block size-1.5 rounded-full bg-secondary" style={{ '--tx': b.tx, '--ty': b.ty, '--delay': b.delay } as CSSProperties} />
                ))}
              </>
            )}
          </motion.span>
          {/* Pedestal */}
          <motion.span
            aria-hidden
            className="mt-2 block h-1.5 w-12 rounded-full bg-on-background/10 blur-[1px] md:w-16"
            initial={{ scaleX: 0.4, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1, transition: { ...springs.natural, delay: delay + 0.12 } }}
          />
          <span
            aria-hidden
            className={cn(
              'absolute -right-2 top-[2.6rem] hidden size-8 items-center justify-center rounded-full border-2 border-surface md:top-[3.9rem] md:flex',
              on ? 'bg-success text-on-primary' : 'bg-surface-variant text-on-surface-light',
            )}
          >
            {on ? <Check className="size-4" strokeWidth={3} /> : <Lock className="size-4" strokeWidth={2} />}
          </span>
        </span>
        {!on && <Lock aria-hidden className="size-5 text-on-surface-light md:hidden" strokeWidth={1.75} />}
      </div>
      <div className="relative flex flex-col gap-0.5">
        <h2 className="text-body-md font-semibold md:text-heading-sm">{a.title}</h2>
        <p className="text-body-sm text-on-surface-light md:hidden">{a.description}</p>
      </div>
      <div className="relative flex w-full flex-col gap-1.5">
        <ProgressBar value={pct} tone={on ? 'success' : 'primary'} />
        <span className={cn('text-body-sm font-mono tabular-nums', on ? 'text-success-text' : 'text-on-surface-light')}>{metaText}</span>
      </div>
      {/* Desktop: la descripción se despliega en hover/foco (grid-rows 0fr → 1fr). */}
      <div className="relative hidden w-full grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-300 ease-out group-hover:grid-rows-[1fr] group-hover:opacity-100 group-focus:grid-rows-[1fr] group-focus:opacity-100 [.reduce-motion_&]:transition-none md:grid">
        <div className="overflow-hidden">
          <p className="border-t border-border pt-3 text-body-sm text-on-surface">
            {a.description} <span className="text-primary-text">+{a.xpReward} XP</span>
          </p>
        </div>
      </div>
    </motion.li>
  );
}

export default function AchievementsPage() {
  const [list, setList] = useState<Achievement[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [filter, setFilter] = useState<Filter>('all');
  const [category, setCategory] = useState('');
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const budget = useParticleBudget();

  const load = useCallback(async () => {
    setState('loading');
    try {
      const data = await fetchAchievements();
      setList(data);
      // Recién desbloqueados desde la última visita. La primera vez no se celebra nada (sin historial).
      const ids = data.filter((a) => a.unlocked).map((a) => a.id);
      const seen = readSeen();
      if (seen) setFresh(new Set(ids.filter((id) => !seen.has(id))));
      writeSeen(ids);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const unlocked = list.filter((a) => a.unlocked).length;
  const pct = list.length ? Math.round((unlocked / list.length) * 100) : 0;
  const categories = useMemo(() => [...new Set(list.map((a) => a.category))], [list]);
  // Orden: obtenidos más recientes primero, luego bloqueados por cercanía.
  const shown = list
    .filter((a) => (filter === 'all' ? true : filter === 'on' ? a.unlocked : !a.unlocked))
    .filter((a) => !category || a.category === category)
    .sort((a, b) => Number(b.unlocked) - Number(a.unlocked)
      || (a.unlocked ? (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? '') : progressOf(b).pct - progressOf(a).pct));

  return (
    <ZoneShell
      zone="achievements"
      ambience={(
        <>
          {/* Focos de la vitrina */}
          <AmbientLight tone="secondary" alpha={0.12} darkAlpha={0.08} d={12} className="left-[8%] top-[-6%] h-[26rem] w-[34%]" />
          <AmbientLight tone="secondary" alpha={0.09} darkAlpha={0.06} d={15} className="right-[6%] top-[-4%] h-[22rem] w-[30%]" />
        </>
      )}
      view={(
        // Motas doradas muy discretas suspendidas en la luz.
        <Particles
          count={budget(12)} kind="drift" seed={41} y={[8, 70]} duration={[9, 15]} alpha={[0.25, 0.5]} size={[2, 3.5]} sx={[-16, 16]} sy={[-22, 10]}
          render={(s) => <span className="block rounded-full bg-secondary" style={{ width: s, height: s }} />}
        />
      )}
    >
      <motion.section variants={item} className="flex flex-wrap items-center justify-between gap-6 md:gap-8">
        <div className="flex w-full min-w-0 flex-col gap-3 md:w-auto md:flex-[1_1_420px] md:gap-2">
          <span className="hidden text-label-lg text-primary-text md:block">Vitrina</span>
          <h1 className="text-display-sm md:text-display-md lg:text-display-lg">Logros</h1>
          <p className="hidden max-w-[520px] text-body-lg text-on-surface-light md:block">
            Cada medalla cuenta una parte de tu historia. Pasa el cursor o enfoca una para ver cómo se consigue.
          </p>
          {state === 'ready' && list.length > 0 && (
            <div className="flex flex-col gap-2 md:hidden">
              <div className="flex justify-between text-body-md">
                <span><b className="font-mono tabular-nums">{unlocked}</b> de {list.length} desbloqueados</span>
                <span className="text-body-sm text-on-surface-light font-mono tabular-nums">{pct}%</span>
              </div>
              <ProgressBar value={pct} />
            </div>
          )}
        </div>
        {state === 'ready' && list.length > 0 && (
          <ProgressRing value={pct} size={140} stroke={12} label="Logros obtenidos" valueText={`${unlocked} de ${list.length}`} className="hidden md:flex">
            <span className="text-heading-lg font-mono tabular-nums">{unlocked}/{list.length}</span>
            <span className="text-body-sm text-on-surface-light">obtenidos</span>
          </ProgressRing>
        )}
      </motion.section>

      <motion.div variants={item} className="flex flex-col gap-6">
        {state === 'loading' ? (
          <PageLoader label="Cargando tu colección…" words={LOADING_COPY.achievements} />
        ) : state === 'error' ? (
          <ErrorState title="No pudimos cargar tus logros" onRetry={() => void load()} />
        ) : list.length === 0 ? (
          <EmptyState icon={Trophy} title="Aún no hay logros" description="Completa hábitos y misiones para empezar tu colección." className="py-16" />
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <SegmentedControl
                label="Filtro"
                value={filter}
                onChange={setFilter}
                options={[{ value: 'all', label: 'Todos' }, { value: 'on', label: isDesktop ? 'Desbloqueados' : 'Obtenidos' }, { value: 'off', label: 'Bloqueados' }]}
                className="w-full sm:max-w-[480px]"
              />
              {categories.length > 1 && (
                <Select aria-label="Categoría" value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-52">
                  <option value="">Todas las categorías</option>
                  {categories.map((c) => <option key={c} value={c}>{catMeta(c).label}</option>)}
                </Select>
              )}
            </div>
            {shown.length > 0 ? (
              // El cristal de la vitrina: un barrido de luz cruza cada cierto tiempo.
              <div className="relative">
                <motion.ul
                  key={`${filter}-${category}`}
                  variants={stagger}
                  initial="initial"
                  animate="animate"
                  className="grid grid-cols-2 gap-4 md:grid-cols-[repeat(auto-fill,minmax(232px,1fr))] md:gap-6"
                >
                  {shown.map((a, i) => <AchievementCard key={a.id} a={a} index={i} fresh={fresh.has(a.id)} />)}
                </motion.ul>
                <Sheen every={12} delay={2.2} className="rounded-2xl [--sheen-a:.16]" />
              </div>
            ) : (
              <EmptyState
                icon={filter === 'on' ? Trophy : Lock}
                tone="muted"
                title={filter === 'on' ? 'Todavía sin medallas aquí' : '¡Lo tienes todo!'}
                description={filter === 'on' ? 'Sigue completando hábitos y misiones.' : 'No te quedan logros bloqueados en este filtro.'}
                className="py-12"
              />
            )}
          </>
        )}
      </motion.div>
    </ZoneShell>
  );
}
