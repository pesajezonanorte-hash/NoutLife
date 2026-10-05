// Misiones — el mapa de tu vida. Cada misión cumplida es un lugar que ya
// visitaste (la lista de lo que has hecho, con su fecha), cada misión activa es
// un destino por explorar y en la niebla marcas uno nuevo. Al lado, el cuaderno
// de viaje con las cifras del viaje, la próxima parada y la leyenda del mapa.
// «Todo el mapa / Por explorar / Visitados», la búsqueda y el tipo filtran el
// mapa. Detalle, completar y formulario son los de siempre (quest.service).
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import type { Quest } from '@lifequest/shared';
import { Plus, Search, X } from 'lucide-react';
import { item } from '@/lib/motion';
import { useDebounce } from '@/hooks/useDebounce';
import { useToastStore } from '@/hooks/useToast';
import { useAuthStore } from '@/store/authStore';
import { Button, Card, EmptyState, ErrorState, Input, ProgressBar, SegmentedControl, Select, PageLoader } from '@/components/ui/lq';
import { LOADING_COPY } from '@/lib/loadingCopy';
import { AmbientLight, ZoneShell } from '@/components/ambience';
import { AvatarDisplay } from '@/components/character/AvatarDisplay';
import { Lettering } from '@/components/layout/Lettering';
import { AdventureMap } from '@/components/quests/AdventureMap';
import { QuestDetailDialog } from '@/components/quests/QuestDetailDialog';
import { CompleteQuestDialog } from '@/components/quests/CompleteQuestDialog';
import { QuestFormDialog, type QuestFormValues } from '@/components/quests/QuestFormDialog';
import { QUEST_TYPES, isReady, isoWeek, questProgress } from '@/components/quests/questMeta';
import * as questService from '@/services/quest.service';

type Tab = 'all' | 'progress' | 'done';
const TABS: { value: Tab; label: string }[] = [
  { value: 'all', label: 'Todo el mapa' }, { value: 'progress', label: 'Por explorar' }, { value: 'done', label: 'Visitados' },
];

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
        useToastStore.getState().success('Misión actualizada');
      } else {
        const created = await questService.createQuest(payload);
        setQuests((prev) => [created, ...prev]);
        useToastStore.getState().success('Destino marcado en tu mapa', 'Ganarás XP al completarlo');
      }
      setForm({ open: false, quest: null });
    } catch {
      useToastStore.getState().error('No se pudo guardar la misión');
    }
  }

  async function handleFail(q: Quest) {
    setDetailId(null);
    patch({ ...q, status: 'FAILED' });
    try { patch(await questService.failQuest(q.id)); } catch { patch(q); useToastStore.getState().error('No se pudo actualizar la misión'); }
  }

  async function handleArchive(q: Quest) {
    setDetailId(null);
    setQuests((prev) => prev.filter((x) => x.id !== q.id));
    try {
      await questService.archiveQuest(q.id);
      useToastStore.getState().success('Misión archivada');
    } catch {
      void load(true);
      useToastStore.getState().error('No se pudo archivar la misión');
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
  const fmt = (n: number) => n.toLocaleString('es-CO');

  return (
    <ZoneShell zone="quests" contentClassName="gap-6 md:gap-10" ambience={<AmbientLight tone="warning" alpha={0.09} darkAlpha={0.06} d={16} className="left-[8%] top-[6%] h-[36rem] w-[72%]" />}>
      <motion.section variants={item} className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-1 md:gap-2">
          <span className="text-body-sm text-on-surface-light md:text-label-lg md:text-primary-text">
            Semana {isoWeek()}{!loading && !failed ? ` · ${ahead.length} por explorar` : ''}
          </span>
          <h1 className="text-display-sm md:text-display-md lg:text-display-lg"><Lettering text="Misiones" /></h1>
          <p className="max-w-[540px] text-body-md text-on-surface-light md:text-body-lg">
            El mapa de tu vida: lo que ya viviste y lo que viene. Cada misión cumplida es un lugar que visitaste.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 md:w-auto md:min-w-[440px] md:items-end">
          <Button size="md" className="hidden md:inline-flex" onClick={openNew}>
            <Plus aria-hidden className="size-4" strokeWidth={2} />Nueva misión
          </Button>
          <SegmentedControl label="Qué mostrar del mapa" value={tab} onChange={setTab} options={TABS} className="w-full" />
        </div>
      </motion.section>

      <motion.div variants={item} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-4 top-3 size-6 text-on-surface-light" strokeWidth={1.75} />
          <Input type="search" aria-label="Buscar en el mapa" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar un lugar o destino…" className="pl-12" />
        </div>
        <Select aria-label="Tipo de misión" value={type} onChange={(e) => setType(e.target.value)} className="sm:w-52">
          <option value="">Todos los tipos</option>
          {QUEST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}s</option>)}
        </Select>
      </motion.div>

      <motion.div variants={item}>
        {loading ? <PageLoader label="Desplegando tu mapa…" words={LOADING_COPY.quests} /> : failed ? (
          <ErrorState title="No pudimos cargar tu mapa" description="Tus misiones siguen guardadas." onRetry={() => void load()} />
        ) : filtering && shownAhead.length + shownBehind.length === 0 ? (
          <EmptyState icon={Search} tone="muted" title="Ningún lugar con ese nombre" description="Prueba con otra búsqueda o tipo." className="py-12 md:py-16" />
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
                <h2 id="journal-title" className="text-heading-sm">Cuaderno de viaje</h2>
                <dl className="grid grid-cols-3 gap-3 lg:grid-cols-1">
                  {[
                    ['Lugares visitados', fmt(visited.length)],
                    ['Por explorar', fmt(ahead.length)],
                    ['XP del viaje', `+${fmt(journeyXp)}`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex flex-col gap-0.5 lg:flex-row lg:items-baseline lg:justify-between">
                      <dt className="text-body-sm text-on-surface-light">{label}</dt>
                      <dd className="font-mono text-heading-sm tabular-nums text-on-background">{value}</dd>
                    </div>
                  ))}
                </dl>
                {next && (
                  <div className="flex flex-col gap-2 border-t border-border pt-4">
                    <span className="text-body-sm text-on-surface-light">Próxima parada</span>
                    <button type="button" aria-haspopup="dialog" onClick={() => setDetailId(next.id)} className="text-left text-label-lg text-on-background hover:underline">{next.title}</button>
                    <ProgressBar value={questProgress(next).pct} tone={isReady(next) ? 'success' : 'primary'} label={`Progreso de ${next.title}`} valueText={questProgress(next).text} />
                    <span className="text-body-sm text-on-surface-light">{questProgress(next).text}</span>
                  </div>
                )}
              </Card>
              <Card as="section" padding="lg" aria-labelledby="legend-title" className="hidden flex-col gap-3 lg:flex">
                <h2 id="legend-title" className="text-heading-sm">Leyenda</h2>
                <ul className="flex flex-col gap-2.5">
                  <Legend mark={<span className="block size-6 rounded-full border-[2.5px] border-primary bg-surface" />}>Lugar visitado</Legend>
                  <Legend mark={<span className="block size-6 rounded-full border-2 border-dashed border-on-surface-light/70 bg-surface" />}>Destino por explorar</Legend>
                  <Legend mark={<span className="flex size-6 items-center justify-center rounded-full border-2 border-dashed border-on-surface-light/50 text-on-surface-light"><X className="size-3" strokeWidth={2.5} /></span>}>Camino cerrado</Legend>
                  <Legend mark={<svg viewBox="0 0 28 8" className="h-2 w-7"><path d="M2 4h24" className="lq-trail lq-trail-past" /></svg>}>Camino recorrido</Legend>
                  <Legend mark={<svg viewBox="0 0 28 8" className="h-2 w-7"><path d="M2 4h24" className="lq-trail lq-trail-ahead" /></svg>}>Camino por recorrer</Legend>
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
