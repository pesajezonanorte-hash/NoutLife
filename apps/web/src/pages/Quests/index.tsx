// Misiones — el mapa de tu vida. Cada misión cumplida es un lugar que ya
// visitaste (la lista de lo que has hecho, con su fecha), cada misión activa es
// un destino por explorar y en la niebla marcas uno nuevo. Al lado, el cuaderno
// de viaje con las cifras del viaje, la próxima parada y la leyenda del mapa.
// «Todo el mapa / Por explorar / Visitados», la búsqueda y el tipo filtran el
// mapa. Detalle, completar y formulario son los de siempre (quest.service).
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import type { Quest } from '@noutlife/shared';
import { Plus, Search, X } from 'lucide-react';
import { item } from '@/lib/motion';
import { useDebounce } from '@/hooks/useDebounce';
import { useToastStore } from '@/hooks/useToast';
import { useAuthStore } from '@/store/authStore';
import { Button, Card, EmptyState, ErrorState, Input, ProgressBar, SegmentedControl, Select, PageLoader } from '@/components/ui/lq';
import { useLoadingCopy } from '@/lib/loadingCopy';
import { AmbientLight, ZoneShell } from '@/components/ambience';
import { AvatarDisplay } from '@/components/character/AvatarDisplay';
import { Lettering } from '@/components/layout/Lettering';
import { AdventureMap } from '@/components/quests/AdventureMap';
import { QuestDetailDialog } from '@/components/quests/QuestDetailDialog';
import { CompleteQuestDialog } from '@/components/quests/CompleteQuestDialog';
import { QuestFormDialog, type QuestFormValues } from '@/components/quests/QuestFormDialog';
import { questTypesFor, isReady, isoWeek, questProgress } from '@/components/quests/questMeta';
import * as questService from '@/services/quest.service';
import { INTL_LOCALE, useLocale, useText, type Copy } from '@/lib/i18n';

const es = {
  tabs: { all: 'Todo el mapa', progress: 'Por explorar', done: 'Visitados' },
  week: (w: number) => `Semana ${w}`,
  toExplore: (n: number) => ` · ${n} por explorar`,
  headline: 'Misiones',
  intro: 'El mapa de tu vida: lo que ya viviste y lo que viene. Cada misión cumplida es un lugar que visitaste.',
  newMission: 'Nueva misión',
  mapFilter: 'Qué mostrar del mapa',
  searchLabel: 'Buscar en el mapa',
  searchPh: 'Buscar un lugar o destino…',
  typeLabel: 'Tipo de misión',
  allTypes: 'Todos los tipos',
  loading: 'Desplegando tu mapa…',
  loadFailed: 'No pudimos cargar tu mapa',
  loadFailedBody: 'Tus misiones siguen guardadas.',
  noMatch: 'Ningún lugar con ese nombre',
  noMatchBody: 'Prueba con otra búsqueda o tipo.',
  journal: 'Cuaderno de viaje',
  visited: 'Lugares visitados',
  toExploreLabel: 'Por explorar',
  journeyXp: 'XP del viaje',
  nextStop: 'Próxima parada',
  progressOf: (t: string) => `Progreso de ${t}`,
  legend: 'Leyenda',
  legendVisited: 'Lugar visitado',
  legendOpen: 'Destino por explorar',
  legendClosed: 'Camino cerrado',
  legendPast: 'Camino recorrido',
  legendAhead: 'Camino por recorrer',
  updated: 'Misión actualizada',
  destinationMarked: 'Destino marcado en tu mapa',
  xpOnComplete: 'Ganarás XP al completarlo',
  saveFailed: 'No se pudo guardar la misión',
  updateFailed: 'No se pudo actualizar la misión',
  archived: 'Misión archivada',
  archiveFailed: 'No se pudo archivar la misión',
  plural: (label: string) => `${label}s`,
};

const en: typeof es = {
  tabs: { all: 'Whole map', progress: 'To explore', done: 'Visited' },
  week: (w) => `Week ${w}`,
  toExplore: (n) => ` · ${n} to explore`,
  headline: 'Goals',
  intro: 'The map of your life: what you already lived and what is ahead. Every completed goal is a place you visited.',
  newMission: 'New goal',
  mapFilter: 'What to show on the map',
  searchLabel: 'Search the map',
  searchPh: 'Search a place or destination…',
  typeLabel: 'Goal type',
  allTypes: 'All types',
  loading: 'Unrolling your map…',
  loadFailed: "We couldn't load your map",
  loadFailedBody: 'Your goals are still saved.',
  noMatch: 'No place with that name',
  noMatchBody: 'Try another search or type.',
  journal: 'Travel journal',
  visited: 'Places visited',
  toExploreLabel: 'To explore',
  journeyXp: 'Journey XP',
  nextStop: 'Next stop',
  progressOf: (t: string) => `Progress of ${t}`,
  legend: 'Legend',
  legendVisited: 'Place visited',
  legendOpen: 'Destination to explore',
  legendClosed: 'Closed path',
  legendPast: 'Path traveled',
  legendAhead: 'Path ahead',
  updated: 'Goal updated',
  destinationMarked: 'Destination marked on your map',
  xpOnComplete: 'You will earn XP when you complete it',
  saveFailed: "We couldn't save the goal",
  updateFailed: "We couldn't update the goal",
  archived: 'Goal archived',
  archiveFailed: "We couldn't archive the goal",
  plural: (label: string) => `${label}s`,
};

const COPY: Copy<typeof es> = { es, en };

type Tab = 'all' | 'progress' | 'done';

const time = (iso?: string) => (iso ? new Date(iso).getTime() : Number.POSITIVE_INFINITY);
/** El destino más cercano primero: lo que ya puedes completar, lo que vence antes y lo más avanzado. */
const byNearest = (a: Quest, b: Quest) =>
  Number(isReady(b)) - Number(isReady(a)) || time(a.deadline) - time(b.deadline) || questProgress(b).pct - questProgress(a).pct || time(a.createdAt) - time(b.createdAt);
/** Lo vivido, de lo más reciente a lo más antiguo. */
const byRecent = (a: Quest, b: Quest) => time(b.completedAt ?? b.updatedAt) - time(a.completedAt ?? a.updatedAt);

function Legend({ mark, children }: { mark: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 text-body-sm text-on-surface">
      <span aria-hidden className="flex w-7 shrink-0 justify-center">{mark}</span>
      {children}
    </li>
  );
}

export default function QuestsPage() {
  const t = useText(COPY);
  const locale = useLocale();
  const loadingCopy = useLoadingCopy();
  const user = useAuthStore((s) => s.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>('all');
  const [type, setType] = useState(() => (searchParams.get('filter') === 'meta' ? 'META' : ''));
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [completing, setCompleting] = useState<Quest | null>(null);
  const [form, setForm] = useState<{ open: boolean; quest: Quest | null }>({ open: false, quest: null });

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setFailed(false);
    try {
      const filters: questService.QuestFilters = {};
      if (type) filters.type = type;
      if (debounced) filters.search = debounced;
      setQuests(await questService.fetchQuests(filters));
    } catch {
      if (!silent) setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [type, debounced]);

  useEffect(() => { void load(); }, [load]);

  // ?new=1 (acciones rápidas, paleta): abre el formulario de nueva misión.
  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    setForm({ open: true, quest: null });
    setSearchParams((p) => { p.delete('new'); return p; }, { replace: true });
  }, [searchParams, setSearchParams]);

  const patch = (q: Quest) => setQuests((prev) => prev.map((x) => (x.id === q.id ? q : x)));
  const detail = quests.find((q) => q.id === detailId) ?? null;
  const openNew = () => setForm({ open: true, quest: null });

  async function handleSubmit(v: QuestFormValues) {
    const payload = {
      type: v.type,
      title: v.title,
      description: v.description || undefined,
      category: v.category,
      difficulty: v.difficulty,
      deadline: v.deadline || undefined,
      subObjectives: v.subObjectives.filter(Boolean).map((title, i) => ({ id: String(i + 1), title, completed: false })),
    };
    try {
      if (form.quest) {
        // Conserva el estado "hecho" de los pasos que no cambiaron de nombre.
        const prev = new Map(form.quest.subObjectives.map((s) => [s.title, s.completed]));
        payload.subObjectives = payload.subObjectives.map((s) => ({ ...s, completed: prev.get(s.title) ?? false }));
        patch(await questService.updateQuest(form.quest.id, payload));
        useToastStore.getState().success(t.updated);
      } else {
        const created = await questService.createQuest(payload);
        setQuests((prev) => [created, ...prev]);
        useToastStore.getState().success(t.destinationMarked, t.xpOnComplete);
      }
      setForm({ open: false, quest: null });
    } catch {
      useToastStore.getState().error(t.saveFailed);
    }
  }

  async function handleFail(q: Quest) {
    setDetailId(null);
    patch({ ...q, status: 'FAILED' });
    try { patch(await questService.failQuest(q.id)); } catch { patch(q); useToastStore.getState().error(t.updateFailed); }
  }

  async function handleArchive(q: Quest) {
    setDetailId(null);
    setQuests((prev) => prev.filter((x) => x.id !== q.id));
    try {
      await questService.archiveQuest(q.id);
      useToastStore.getState().success(t.archived);
    } catch {
      void load(true);
      useToastStore.getState().error(t.archiveFailed);
    }
  }

  const ahead = useMemo(() => quests.filter((q) => q.status === 'ACTIVE').sort(byNearest), [quests]);
  const behind = useMemo(() => quests.filter((q) => q.status === 'COMPLETED' || q.status === 'FAILED').sort(byRecent), [quests]);
  const visited = behind.filter((q) => q.status === 'COMPLETED');
  const journeyXp = visited.reduce((s, q) => s + q.xpReward, 0);
  const next = ahead[0];
  const shownAhead = tab === 'done' ? [] : ahead;
  const shownBehind = tab === 'progress' ? [] : behind;
  const filtering = Boolean(search || type);
  const fmt = (n: number) => n.toLocaleString(INTL_LOCALE[locale]);
  const tabOptions = (['all', 'progress', 'done'] as Tab[]).map((value) => ({ value, label: t.tabs[value] }));

  return (
    <ZoneShell zone="quests" contentClassName="gap-6 md:gap-10" ambience={<AmbientLight tone="warning" alpha={0.09} darkAlpha={0.06} d={16} className="left-[8%] top-[6%] h-[36rem] w-[72%]" />}>
      <motion.section variants={item} className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-1 md:gap-2">
          <span className="text-body-sm text-on-surface-light md:text-label-lg md:text-primary-text">
            {t.week(isoWeek())}{!loading && !failed ? t.toExplore(ahead.length) : ''}
          </span>
          <h1 className="text-display-sm md:text-display-md lg:text-display-lg"><Lettering text={t.headline} /></h1>
          <p className="max-w-[540px] text-body-md text-on-surface-light md:text-body-lg">{t.intro}</p>
        </div>
        <div className="flex w-full flex-col gap-3 md:w-auto md:min-w-[440px] md:items-end">
          <Button size="md" className="hidden md:inline-flex" onClick={openNew}>
            <Plus aria-hidden className="size-4" strokeWidth={2} />{t.newMission}
          </Button>
          <SegmentedControl label={t.mapFilter} value={tab} onChange={setTab} options={tabOptions} className="w-full" />
        </div>
      </motion.section>

      <motion.div variants={item} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-4 top-3 size-6 text-on-surface-light" strokeWidth={1.75} />
          <Input type="search" aria-label={t.searchLabel} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.searchPh} className="pl-12" />
        </div>
        <Select aria-label={t.typeLabel} value={type} onChange={(e) => setType(e.target.value)} className="sm:w-52">
          <option value="">{t.allTypes}</option>
          {questTypesFor(locale).map((typeOption) => <option key={typeOption.value} value={typeOption.value}>{t.plural(typeOption.label)}</option>)}
        </Select>
      </motion.div>

      <motion.div variants={item}>
        {loading ? <PageLoader label={t.loading} words={loadingCopy.quests} /> : failed ? (
          <ErrorState title={t.loadFailed} description={t.loadFailedBody} onRetry={() => void load()} />
        ) : filtering && shownAhead.length + shownBehind.length === 0 ? (
          <EmptyState icon={Search} tone="muted" title={t.noMatch} description={t.noMatchBody} className="py-12 md:py-16" />
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <AdventureMap
              ahead={shownAhead}
              behind={shownBehind}
              startedAt={user?.createdAt}
              traveler={<AvatarDisplay avatarConfig={user?.avatarConfig} avatarUrl={user?.avatarUrl} size={56} animate="none" className="size-full" />}
              onOpen={(q) => setDetailId(q.id)}
              onComplete={setCompleting}
              onNew={tab === 'done' ? undefined : openNew}
            />

            {/* Cuaderno de viaje */}
            <aside className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-24">
              <Card as="section" padding="lg" aria-labelledby="journal-title" className="lq-tex-parchment flex flex-col gap-4">
                <h2 id="journal-title" className="text-heading-sm">{t.journal}</h2>
                <dl className="grid grid-cols-3 gap-3 lg:grid-cols-1">
                  {[
                    [t.visited, fmt(visited.length)],
                    [t.toExploreLabel, fmt(ahead.length)],
                    [t.journeyXp, `+${fmt(journeyXp)}`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex flex-col gap-0.5 lg:flex-row lg:items-baseline lg:justify-between">
                      <dt className="text-body-sm text-on-surface-light">{label}</dt>
                      <dd className="font-mono text-heading-sm tabular-nums text-on-background">{value}</dd>
                    </div>
                  ))}
                </dl>
                {next && (
                  <div className="flex flex-col gap-2 border-t border-border pt-4">
                    <span className="text-body-sm text-on-surface-light">{t.nextStop}</span>
                    <button type="button" aria-haspopup="dialog" onClick={() => setDetailId(next.id)} className="text-left text-label-lg text-on-background hover:underline">{next.title}</button>
                    <ProgressBar value={questProgress(next, locale).pct} tone={isReady(next) ? 'success' : 'primary'} label={t.progressOf(next.title)} valueText={questProgress(next, locale).text} />
                    <span className="text-body-sm text-on-surface-light">{questProgress(next, locale).text}</span>
                  </div>
                )}
              </Card>
              <Card as="section" padding="lg" aria-labelledby="legend-title" className="hidden flex-col gap-3 lg:flex">
                <h2 id="legend-title" className="text-heading-sm">{t.legend}</h2>
                <ul className="flex flex-col gap-2.5">
                  <Legend mark={<span className="block size-6 rounded-full border-[2.5px] border-primary bg-surface" />}>{t.legendVisited}</Legend>
                  <Legend mark={<span className="block size-6 rounded-full border-2 border-dashed border-on-surface-light/70 bg-surface" />}>{t.legendOpen}</Legend>
                  <Legend mark={<span className="flex size-6 items-center justify-center rounded-full border-2 border-dashed border-on-surface-light/50 text-on-surface-light"><X className="size-3" strokeWidth={2.5} /></span>}>{t.legendClosed}</Legend>
                  <Legend mark={<svg viewBox="0 0 28 8" className="h-2 w-7"><path d="M2 4h24" className="lq-trail lq-trail-past" /></svg>}>{t.legendPast}</Legend>
                  <Legend mark={<svg viewBox="0 0 28 8" className="h-2 w-7"><path d="M2 4h24" className="lq-trail lq-trail-ahead" /></svg>}>{t.legendAhead}</Legend>
                </ul>
              </Card>
            </aside>
          </div>
        )}
      </motion.div>

      <QuestDetailDialog
        quest={detail}
        onClose={() => setDetailId(null)}
        onChange={patch}
        onComplete={(q) => { setDetailId(null); setCompleting(q); }}
        onEdit={(q) => { setDetailId(null); setForm({ open: true, quest: q }); }}
        onFail={(q) => void handleFail(q)}
        onArchive={(q) => void handleArchive(q)}
      />
      <CompleteQuestDialog
        quest={completing}
        onClose={() => setCompleting(null)}
        onCompleted={(q) => patch({ ...q, status: 'COMPLETED', completedAt: new Date().toISOString() })}
      />
      <QuestFormDialog open={form.open} quest={form.quest} onClose={() => setForm({ open: false, quest: null })} onSubmit={handleSubmit} />
    </ZoneShell>
  );
}
