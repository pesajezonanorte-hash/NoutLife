// Logros — Achievements.dc.html (móvil) / AchievementsDesktop.dc.html (desktop).
// Grid 2 col (móvil) / auto-fill 232 px; hover y foco despliegan la descripción.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Dumbbell, Flag, Flame, LayoutGrid, Lock, Sparkles, Star, Trophy, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { item, stagger } from '@/lib/motion';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  EmptyState, ErrorState, ProgressBar, ProgressRing, Select, SegmentedControl, Skeleton, Spinner, type Tone,
} from '@/components/ui/lq';
import { softTone } from '@/components/ui/lq/tones';
import { resolveGlyph } from '@/components/ui/glyphs';
import { fetchAchievements, type Achievement } from '@/services/achievement.service';

type Filter = 'all' | 'on' | 'off';

const CATEGORY: Record<string, { label: string; tone: Exclude<Tone, 'muted'>; icon: LucideIcon }> = {
  quest: { label: 'Misiones', tone: 'primary', icon: Flag },
  habit: { label: 'Hábitos', tone: 'warning', icon: Flame },
  level: { label: 'Nivel', tone: 'secondary', icon: Star },
  gym: { label: 'Gimnasio', tone: 'success', icon: Dumbbell },
  category: { label: 'Zonas', tone: 'info', icon: LayoutGrid },
  special: { label: 'Especiales', tone: 'error', icon: Sparkles },
};
const catMeta = (c: string) => CATEGORY[c] ?? { label: 'Otros', tone: 'primary' as const, icon: Trophy };

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '');

function progressOf(a: Achievement) {
  const target = a.target ?? a.progressTarget ?? 0;
  const current = Math.min(target, a.progress ?? 0);
  const pct = a.unlocked ? 100 : target > 0 ? Math.round((current / target) * 100) : 0;
  return { target, current, pct };
}

function AchievementCard({ a }: { a: Achievement }) {
  const meta = catMeta(a.category);
  // resolveGlyph devuelve Star para claves desconocidas: entonces se usa el ícono de la categoría.
  const glyph = a.icon ? resolveGlyph(a.icon) : null;
  const Icon = glyph && (glyph !== Star || /star|⭐|🌟/i.test(a.icon)) ? glyph : meta.icon;
  const { target, current, pct } = progressOf(a);
  const on = a.unlocked;
  const metaText = on ? `Desbloqueado · ${fmtDate(a.unlockedAt)}` : target > 0 ? `${pct}% · ${current}/${target}` : 'Bloqueado';
  const aria = `${a.title}. ${a.description.replace(/\.\s*$/, '')}. ${on ? `Desbloqueado el ${fmtDate(a.unlockedAt)}` : target > 0 ? `Bloqueado, ${pct} por ciento` : 'Bloqueado'}. ${a.xpReward} XP.`;

  return (
    <motion.li
      variants={item}
      tabIndex={0}
      aria-label={aria}
      className={cn(
        // `group` despliega la descripción con hover y con foco (también en móvil al tocar).
        'lq-lift group flex flex-col gap-3 rounded-2xl border border-border p-4 shadow-sm md:items-center md:gap-4 md:p-6 md:text-center',
        on ? 'bg-surface' : 'bg-background',
      )}
    >
      <div className="flex items-start justify-between md:justify-center">
        <span className="relative">
          <span
            aria-hidden
            className={cn(
              'lq-ichip flex size-14 items-center justify-center rounded-2xl md:size-[88px] md:rounded-[28px]',
              on ? softTone[meta.tone] : cn(softTone.muted, 'grayscale'),
            )}
          >
            <Icon className="size-7 md:size-11" strokeWidth={1.75} />
          </span>
          <span
            aria-hidden
            className={cn(
              'absolute -bottom-2 -right-2 hidden size-8 items-center justify-center rounded-full border-2 border-surface md:flex',
              on ? 'bg-success text-on-primary' : 'bg-surface-variant text-on-surface-light',
            )}
          >
            {on ? <Check className="size-4" strokeWidth={3} /> : <Lock className="size-4" strokeWidth={2} />}
          </span>
        </span>
        {!on && <Lock aria-hidden className="size-5 text-on-surface-light md:hidden" strokeWidth={1.75} />}
      </div>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-body-md font-semibold md:text-heading-sm">{a.title}</h2>
        <p className="text-body-sm text-on-surface-light md:hidden">{a.description}</p>
      </div>
      <div className="flex w-full flex-col gap-1.5">
        <ProgressBar value={pct} tone={on ? 'success' : 'primary'} />
        <span className={cn('text-body-sm tabular-nums', on ? 'text-success-text' : 'text-on-surface-light')}>{metaText}</span>
      </div>
      {/* Desktop: la descripción se despliega en hover/foco (grid-rows 0fr → 1fr). */}
      <div className="hidden w-full grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-300 ease-out group-hover:grid-rows-[1fr] group-hover:opacity-100 group-focus:grid-rows-[1fr] group-focus:opacity-100 motion-reduce:transition-none md:grid">
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
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const load = useCallback(async () => {
    setState('loading');
    try {
      setList(await fetchAchievements());
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
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-6 md:gap-12">
      <motion.section variants={item} className="flex flex-wrap items-center justify-between gap-6 md:gap-8">
        <div className="flex w-full min-w-0 flex-col gap-3 md:w-auto md:flex-[1_1_420px] md:gap-2">
          <span className="hidden text-label-lg text-primary-text md:block">Colección</span>
          <h1 className="text-display-sm md:text-display-md lg:text-display-lg">Logros</h1>
          <p className="hidden max-w-[520px] text-body-lg text-on-surface-light md:block">
            Cada medalla cuenta una parte de tu historia. Pasa el cursor o enfoca una para ver cómo se consigue.
          </p>
          {state === 'ready' && list.length > 0 && (
            <div className="flex flex-col gap-2 md:hidden">
              <div className="flex justify-between text-body-md">
                <span><b className="tabular-nums">{unlocked}</b> de {list.length} desbloqueados</span>
                <span className="text-body-sm text-on-surface-light tabular-nums">{pct}%</span>
              </div>
              <ProgressBar value={pct} />
            </div>
          )}
        </div>
        {state === 'ready' && list.length > 0 && (
          <ProgressRing value={pct} size={140} stroke={12} label="Logros obtenidos" valueText={`${unlocked} de ${list.length}`} className="hidden md:flex">
            <span className="text-heading-lg tabular-nums">{unlocked}/{list.length}</span>
            <span className="text-body-sm text-on-surface-light">obtenidos</span>
          </ProgressRing>
        )}
      </motion.section>

      <motion.div variants={item} className="flex flex-col gap-6">
        {state === 'loading' ? (
          <div className="flex flex-col gap-6" aria-busy="true" aria-label="Cargando logros">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-[repeat(auto-fill,minmax(232px,1fr))] md:gap-6">
              {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-52 rounded-2xl md:h-64" />)}
            </div>
            <div className="flex items-center justify-center gap-3"><Spinner /><span className="text-body-sm text-on-surface-light">Cargando tu colección…</span></div>
          </div>
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
              <motion.ul
                key={`${filter}-${category}`}
                variants={stagger}
                initial="initial"
                animate="animate"
                className="grid grid-cols-2 gap-4 md:grid-cols-[repeat(auto-fill,minmax(232px,1fr))] md:gap-6"
              >
                {shown.map((a) => <AchievementCard key={a.id} a={a} />)}
              </motion.ul>
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
    </motion.div>
  );
}
