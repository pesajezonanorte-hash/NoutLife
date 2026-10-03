// Misiones — Quests.dc.html (móvil) / QuestsDesktop.dc.html (desktop).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import type { Quest } from '@lifequest/shared';
import { CheckCircle2, Flag, Plus, Search, Sparkles } from 'lucide-react';
import { item, stagger } from '@/lib/motion';
import { categoryMeta } from '@/lib/lifeMeta';
import { useDebounce } from '@/hooks/useDebounce';
import { useToastStore } from '@/hooks/useToast';
import {
  Badge, Button, Card, EmptyState, ErrorState, IconChip, Input, ProgressRing, SegmentedControl, Select, Skeleton, Spinner,
} from '@/components/ui/lq';
import { QuestCard } from '@/components/quests/QuestCard';
import { QuestDetailDialog } from '@/components/quests/QuestDetailDialog';
import { CompleteQuestDialog } from '@/components/quests/CompleteQuestDialog';
import { QuestFormDialog, type QuestFormValues } from '@/components/quests/QuestFormDialog';
import { QUEST_TYPES, isReady, isoWeek, questProgress } from '@/components/quests/questMeta';
import * as questService from '@/services/quest.service';

type Tab = 'all' | 'progress' | 'done';
const TABS: { value: Tab; label: string }[] = [
  { value: 'all', label: 'Todas' }, { value: 'progress', label: 'En progreso' }, { value: 'done', label: 'Completadas' },
];

function QuestsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Cargando misiones">
      <Skeleton className="hidden h-44 rounded-2xl md:block" />
      <div className="grid gap-4 md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] md:gap-6">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
      </div>
      <div className="flex items-center justify-center gap-3"><Spinner /><span className="text-body-sm text-on-surface-light">Cargando misiones…</span></div>
    </div>
  );
}

export default function QuestsPage() {
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
        useToastStore.getState().success('Misión creada', 'Ganarás XP al completarla');
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

  const visible = useMemo(() => quests.filter((q) => q.status !== 'ARCHIVED'), [quests]);
  const active = visible.filter((q) => q.status === 'ACTIVE');
  const shown = visible.filter((q) => (tab === 'all' ? true : tab === 'done' ? q.status === 'COMPLETED' : q.status === 'ACTIVE'));
  // Destacada: la primera lista para completar (o la activa con más progreso).
  const featured = tab !== 'done'
    ? active.find(isReady) ?? [...active].filter((q) => q.subObjectives.length > 0).sort((a, b) => questProgress(b).pct - questProgress(a).pct)[0]
    : undefined;
  const list = featured ? shown.filter((q) => q.id !== featured.id) : shown;
  const listTitle = tab === 'done' ? 'Completadas' : tab === 'progress' ? 'En progreso' : 'Todas las misiones';

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-6 md:gap-12">
      <motion.section variants={item} className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-1 md:gap-2">
          <span className="text-body-sm text-on-surface-light md:text-label-lg md:text-primary-text">
            Semana {isoWeek()}{!loading && !failed ? ` · ${active.length} ${active.length === 1 ? 'activa' : 'activas'}` : ''}
          </span>
          <h1 className="text-display-sm md:text-display-md lg:text-display-lg">Misiones</h1>
          <p className="max-w-[520px] text-body-md text-on-surface-light md:text-body-lg">
            <span className="md:hidden">Completa objetivos y gana XP extra.</span>
            <span className="hidden md:inline">Objetivos más grandes que un hábito. Termínalos para ganar XP extra y subir de nivel.</span>
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 md:w-auto md:min-w-[440px] md:items-end">
          <Button size="md" className="hidden md:inline-flex" onClick={() => setForm({ open: true, quest: null })}>
            <Plus aria-hidden className="size-4" strokeWidth={2} />Nueva misión
          </Button>
          <SegmentedControl label="Estado" value={tab} onChange={setTab} options={TABS} className="w-full" />
        </div>
      </motion.section>

      <motion.div variants={item} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-4 top-3 size-6 text-on-surface-light" strokeWidth={1.75} />
          <Input type="search" aria-label="Buscar misiones" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar misión…" className="pl-12" />
        </div>
        <Select aria-label="Tipo de misión" value={type} onChange={(e) => setType(e.target.value)} className="sm:w-52">
          <option value="">Todos los tipos</option>
          {QUEST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}s</option>)}
        </Select>
      </motion.div>

      <motion.div variants={item} className="flex flex-col gap-6 md:gap-12">
        {loading ? <QuestsSkeleton /> : failed ? (
          <ErrorState title="No pudimos cargar tus misiones" onRetry={() => void load()} />
        ) : (
          <>
            {featured && (
              <Card
                as="section"
                variant="elevated"
                padding="none"
                aria-label="Misión destacada"
                className="hidden flex-wrap items-center gap-8 border-primary/35 p-8 md:flex"
              >
                <ProgressRing value={questProgress(featured).pct} tone={isReady(featured) ? 'success' : 'primary'} size={148} stroke={12} label="Progreso" valueText={questProgress(featured).text}>
                  <IconChip icon={isReady(featured) ? CheckCircle2 : Flag} tone={isReady(featured) ? 'success' : 'primary'} className="lq-halo size-20 rounded-full" />
                </ProgressRing>
                <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={categoryMeta(featured.category).tone}>{categoryMeta(featured.category).label}</Badge>
                    {isReady(featured)
                      ? <Badge variant="success" icon={CheckCircle2}>Lista para completar</Badge>
                      : <Badge variant="primary">La más avanzada</Badge>}
                  </div>
                  <h2 className="text-display-sm">{featured.title}</h2>
                  <p className="text-body-md text-on-surface-light">{questProgress(featured).text}{featured.description ? ` · ${featured.description}` : ''}</p>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <span className="flex items-center gap-1 text-display-md text-primary-text tabular-nums">
                    <Sparkles aria-hidden className="size-7" strokeWidth={1.75} />+{featured.xpReward} XP
                  </span>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="md" onClick={() => setDetailId(featured.id)}>Ver detalle</Button>
                    <Button size="md" onClick={() => setCompleting(featured)}><CheckCircle2 aria-hidden className="size-5" strokeWidth={1.75} />Completar misión</Button>
                  </div>
                </div>
              </Card>
            )}

            <section className="flex flex-col gap-4 md:gap-6" aria-labelledby="quest-list-title">
              <h2 id="quest-list-title" className="hidden text-heading-lg md:block">{listTitle}</h2>
              {(featured ? [featured, ...list] : list).length > 0 ? (
                <motion.ul
                  key={`${tab}-${type}`}
                  variants={stagger}
                  initial="initial"
                  animate="animate"
                  className="grid gap-4 md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] md:gap-6"
                >
                  {/* En móvil la destacada va como una tarjeta más (no hay hero). */}
                  {featured && (
                    <QuestCard className="md:hidden" quest={featured} onOpen={() => setDetailId(featured.id)} onComplete={() => setCompleting(featured)} />
                  )}
                  {list.map((q) => (
                    <QuestCard key={q.id} quest={q} onOpen={() => setDetailId(q.id)} onComplete={() => setCompleting(q)} />
                  ))}
                </motion.ul>
              ) : (
                <EmptyState
                  icon={tab === 'done' ? CheckCircle2 : Flag}
                  tone={tab === 'done' ? 'muted' : 'primary'}
                  title={search || type ? 'Sin resultados' : tab === 'done' ? 'Aún no completas misiones' : 'Sin misiones disponibles'}
                  description={search || type ? 'Prueba con otra búsqueda o tipo.' : 'Crea una misión para tus objetivos más grandes.'}
                  action={!(search || type) && tab !== 'done'
                    ? <Button onClick={() => setForm({ open: true, quest: null })}><Plus aria-hidden className="size-4" strokeWidth={2} />Nueva misión</Button>
                    : undefined}
                  className="py-12 md:py-16"
                />
              )}
            </section>
          </>
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
    </motion.div>
  );
}
