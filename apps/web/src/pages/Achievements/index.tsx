// Logros — Achievements.dc.html (móvil) / AchievementsDesktop.dc.html (desktop).
// Grid 2 col (móvil) / auto-fill 232 px; hover y foco despliegan la descripción.
// Zona ambientada: la vitrina de un museo. Un mueble lacado en jade profundo con
// filete de latón y nichos de terciopelo; al llegar se encienden los focos uno a
// uno y cada medalla cae colgada de su cinta (del color de su categoría) y se
// asienta con peso; al pasar se mece y el cristal brilla con el puntero. Debajo,
// su placa de latón grabada. Los bloqueados esperan en penumbra tras cristal
// esmerilado. Un logro conseguido desde la última visita se celebra: el cristal
// se aclara, la medalla destella y suelta motas doradas dentro de su nicho.
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type PointerEvent } from 'react';
import { motion } from 'framer-motion';
import { Check, Lock, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { item, springs, stagger } from '@/lib/motion';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { EmptyState, ErrorState, Select, SegmentedControl, PageLoader } from '@/components/ui/lq';
import { LOADING_COPY } from '@/lib/loadingCopy';
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
  const metaText = on ? `Desbloqueado el ${fmtDate(a.unlockedAt)}` : target > 0 ? `${pct}% · ${current}/${target}` : 'Bloqueado';
  const aria = `${a.title}. ${a.description.replace(/\.\s*$/, '')}. ${on ? `Desbloqueado el ${fmtDate(a.unlockedAt)}` : target > 0 ? `Bloqueado, ${pct} por ciento` : 'Bloqueado'}. ${a.xpReward} XP.`;
  const delay = 0.35 + Math.min(index, 12) * 0.08;

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
      // `group` despliega la descripción con hover y con foco (también en móvil al tocar).
      className="group relative flex flex-col items-center rounded-xl text-center outline-offset-4"
      style={{ '--rib': `var(--lq-${meta.tone})` } as CSSProperties}
    >
      {/* El nicho: terciopelo, foco cenital, cristal */}
      <div aria-hidden="true" className="lq-niche relative flex aspect-[4/5] w-full flex-col items-center justify-end overflow-hidden rounded-lg pb-[14%]">
        <motion.span
          className="lq-niche-spot absolute inset-x-0 top-0 block h-[85%]"
          initial={{ opacity: 0 }}
          animate={{ opacity: on ? [0, 1, 0.45, 1] : 0.18, transition: { duration: on ? 0.8 : 0.4, times: on ? [0, 0.3, 0.5, 1] : undefined, delay: delay - 0.15 } }}
        />
        <span className="lq-glint absolute inset-0 block" />
        {/* La medalla cae colgada de su cinta y se asienta con peso */}
        <motion.span
          className="lq-medal relative flex origin-top flex-col items-center"
          initial={{ y: -46, rotate: -10, opacity: 0 }}
          animate={{ y: 0, rotate: 0, opacity: 1, transition: { ...springs.heavy, delay, opacity: { duration: 0.2, delay } } }}
        >
          <svg viewBox="0 0 60 46" className="block h-10 w-[3.25rem] md:h-12 md:w-16">
            <path d="M8 0h16l12 40H22Z" className={cn('lq-ribbon-l', !on && 'opacity-40')} />
            <path d="M52 0H36L24 40h14Z" className={cn('lq-ribbon-r', !on && 'opacity-40')} />
          </svg>
          <span className={cn('relative -mt-3 flex size-[4.25rem] items-center justify-center rounded-full md:size-24', on ? 'lq-medal-disc' : 'lq-medal-dim')}>
            <Icon className={cn('size-7 md:size-10', on ? 'text-[rgb(var(--lq-jade-900)/.7)]' : 'text-jade-50/30')} strokeWidth={1.75} />
            {/* Bloqueado: tras cristal esmerilado. Recién desbloqueado: el cristal se aclara. */}
            {(!on || fresh) && (
              <motion.span
                className="absolute -inset-3 rounded-full bg-jade-50/[.06] backdrop-blur-[3px]"
                initial={{ opacity: 1 }}
                animate={fresh ? { opacity: 0, transition: { duration: 0.9, delay: delay + 0.35, ease: [0.16, 1, 0.3, 1] } } : { opacity: 1 }}
              />
            )}
            {fresh && (
              <>
                <span className="lq-flash absolute -inset-4 rounded-full bg-[radial-gradient(closest-side,rgb(var(--lq-secondary)/.7),transparent)]" />
                {BURST.map((b, i) => (
                  <span key={i} className="lq-burst absolute left-1/2 top-1/2 -ml-[3px] -mt-[3px] block size-1.5 rounded-full bg-secondary" style={{ '--tx': b.tx, '--ty': b.ty, '--delay': b.delay } as CSSProperties} />
                ))}
              </>
            )}
          </span>
        </motion.span>
        {/* Soporte forrado de terciopelo */}
        <span className="lq-stand relative mt-3 block h-2.5 w-[46%] rounded-sm" />
        {!on && <Lock className="absolute right-3 top-3 size-4 text-jade-50/50" strokeWidth={2} />}
        {on && <span className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-full bg-success-strong text-on-success"><Check className="size-3.5" strokeWidth={3} /></span>}
      </div>
      {/* La placa grabada y lo que dice debajo */}
      <h2 className={cn('lq-brass relative -mt-3 max-w-[92%] truncate px-3 py-1 text-label-md md:text-label-lg', !on && 'opacity-80')}>{a.title}</h2>
      <div className="mt-2 flex w-full flex-col items-center gap-1.5 px-2">
        {!on && target > 0 && (
          // Lo que falta: un hilo de latón que se llena (el porcentaje va en el texto y en la etiqueta)
          <span aria-hidden="true" className="block h-1 w-3/4 overflow-hidden rounded-full bg-jade-50/10">
            <motion.span className="block h-full origin-left rounded-full bg-secondary" initial={{ scaleX: 0 }} animate={{ scaleX: pct / 100, transition: { ...springs.gentle, delay: delay + 0.3 } }} />
          </span>
        )}
        <span className={cn('font-mono text-body-sm tabular-nums', on ? 'text-secondary' : 'text-jade-50/70')}>{metaText}</span>
        <p className="text-body-sm text-jade-50/75 md:hidden">{a.description}</p>
      </div>
      {/* Desktop: la descripción se despliega en hover/foco (grid-rows 0fr → 1fr). */}
      <div className="relative hidden w-full grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-300 ease-out group-hover:grid-rows-[1fr] group-hover:opacity-100 group-focus:grid-rows-[1fr] group-focus:opacity-100 [.reduce-motion_&]:transition-none md:grid">
        <div className="overflow-hidden">
          <p className="mt-2 border-t border-jade-50/10 px-2 pt-2 text-body-sm text-jade-50/85">
            {a.description} <span className="text-secondary">+{a.xpReward} XP</span>
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
        </div>
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
              // La vitrina: mueble lacado con filete de latón; un barrido de luz cruza el cristal cada cierto tiempo.
              <div className="lq-cabinet relative rounded-2xl px-3 pb-5 pt-4 md:px-6 md:pb-8 md:pt-5">
                <div className="mb-4 flex flex-col items-center gap-2 md:mb-6">
                  <span className="lq-brass px-4 py-1 text-label-md md:text-label-lg"><span className="font-mono">{unlocked}</span> de <span className="font-mono">{list.length}</span> obtenidos</span>
                  <span aria-hidden="true" className="block h-[3px] w-40 overflow-hidden rounded-full bg-jade-50/10">
                    <motion.span className="block h-full origin-left bg-secondary" initial={{ scaleX: 0 }} animate={{ scaleX: pct / 100, transition: { ...springs.gentle, delay: 0.5 } }} />
                  </span>
                </div>
                <motion.ul
                  key={`${filter}-${category}`}
                  variants={stagger}
                  initial="initial"
                  animate="animate"
                  className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] md:gap-x-6 md:gap-y-8"
                >
                  {shown.map((a, i) => <AchievementCard key={a.id} a={a} index={i} fresh={fresh.has(a.id)} />)}
                </motion.ul>
                <Sheen every={12} delay={2.6} className="rounded-2xl [--sheen-a:.1]" />
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
