// Comida — Food.dc.html (móvil) / FoodDesktop.dc.html (desktop).
// Resumen kcal + macros, CTA "Analizar comida", línea de tiempo del día,
// guardadas e hidratación. Metas: /nutrition/goals (valores de referencia si no hay).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Meal } from '@lifequest/shared';
import { Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, Droplet, Minus, Pencil, Plus, Scan, Target, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { item, stagger } from '@/lib/motion';
import { dayKey } from '@/lib/lifeMeta';
import { useToastStore } from '@/hooks/useToast';
import { AnimatedValue, Button, Card, ErrorState, IconChip, ProgressBar, ProgressRing, ResponsiveDialog, PageLoader } from '@/components/ui/lq';
import { LOADING_COPY } from '@/lib/loadingCopy';
import { solidBg } from '@/components/ui/lq/tones';
import * as mealService from '@/services/meal.service';
import type { NutritionGoal, SavedMeal } from '@/services/meal.service';
import {
  MACROS, MEAL_TYPES, effectiveGoal, fmtInt, macroLine, mealTypeLabel, totals, typeForNow, type FoodType,
} from '@/components/food/foodMeta';
import { AnalyzeMealDialog, GoalDialog, MealFormDialog } from '@/components/food/FoodDialogs';

const GLASS_ML = 250;
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

function dayLabel(d: Date, offset: number) {
  const short = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');
  if (offset === 0) return `Hoy · ${short}`;
  if (offset === -1) return `Ayer · ${short}`;
  const wd = d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} · ${short}`;
}

type Entry = { kind: 'meal'; meal: Meal; at: number } | { kind: 'empty'; type: FoodType; at: number };

function FoodSkeleton() {
  return <PageLoader label="Cargando tu día…" words={LOADING_COPY.food} />;
}

export default function FoodPage() {
  const [offset, setOffset] = useState(0);
  const day = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + offset); return d; }, [offset]);
  const key = dayKey(day);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [goal, setGoal] = useState<NutritionGoal | null>(null);
  const [saved, setSaved] = useState<SavedMeal[] | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [analyze, setAnalyze] = useState<FoodType | null>(null);
  const [manual, setManual] = useState<FoodType | null>(null);
  const [newSaved, setNewSaved] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [detail, setDetail] = useState<Meal | null>(null);
  const [savedDetail, setSavedDetail] = useState<SavedMeal | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setState('loading');
    try {
      const [list, g] = await Promise.all([mealService.fetchMeals(key), mealService.fetchNutritionGoal().catch(() => null)]);
      setMeals(list);
      setGoal(g);
      setState('ready');
    } catch {
      if (!silent) setState('error');
    }
  }, [key]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { mealService.fetchSavedMeals().then(setSaved).catch(() => setSaved([])); }, []);

  const food = meals.filter((m) => m.mealType !== 'WATER');
  const water = meals.filter((m) => m.mealType === 'WATER');
  const t = totals(meals);
  const g = effectiveGoal(goal);
  const kcalPct = Math.round((t.calories / g.calories) * 100);
  const over = t.calories > g.calories;
  const glasses = Math.max(1, Math.round(g.waterMl / GLASS_ML));
  const filled = Math.min(glasses, Math.floor(t.waterMl / GLASS_ML));

  // Línea de tiempo: comidas registradas + huecos de desayuno/almuerzo/cena sin registrar.
  const entries: Entry[] = useMemo(() => {
    const list: Entry[] = food.map((m) => { const d = new Date(m.date); return { kind: 'meal', meal: m, at: d.getHours() * 60 + d.getMinutes() }; });
    for (const mt of MEAL_TYPES) {
      if (mt.value !== 'SNACK' && !food.some((m) => m.mealType === mt.value)) list.push({ kind: 'empty', type: mt.value, at: mt.at });
    }
    return list.sort((a, b) => a.at - b.at);
  }, [food]);

  const label = dayLabel(day, offset);
  const dayWord = offset === 0 ? 'hoy' : offset === -1 ? 'ayer' : `del ${day.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`;
  const toast = useToastStore.getState;

  function added(m: Meal | SavedMeal) {
    if ('mealType' in m) setMeals((list) => [...list, m]);
    setAnalyze(null); setManual(null);
    void load(true);
  }

  async function removeMeal(m: Meal) {
    setDetail(null);
    setMeals((list) => list.filter((x) => x.id !== m.id));
    try { await mealService.deleteMeal(m.id); toast().success('Comida eliminada'); } catch { toast().error('No se pudo eliminar'); void load(true); }
  }

  async function addSaved(s: SavedMeal) {
    const type = offset === 0 ? typeForNow() : 'LUNCH';
    setBusy(s.id);
    try {
      const m = await mealService.createMeal({ name: s.name, mealType: type, calories: s.calories ?? undefined, protein: s.protein ?? undefined, carbs: s.carbs ?? undefined, fat: s.fat ?? undefined, date: key });
      setMeals((list) => [...list, m]);
      toast().success(`Añadida como ${mealTypeLabel(type).toLowerCase()}`, s.name);
    } catch {
      toast().error('No se pudo añadir');
    } finally {
      setBusy(null);
    }
  }

  async function saveFavorite(m: Meal) {
    try {
      const s = await mealService.createSavedMeal({ name: m.name, calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat });
      setSaved((list) => [...(list ?? []), s].sort((a, b) => a.name.localeCompare(b.name)));
      toast().success('Guardada para repetirla');
    } catch {
      toast().error('No se pudo guardar');
    }
  }

  async function removeSaved(s: SavedMeal) {
    setSavedDetail(null);
    setSaved((list) => (list ?? []).filter((x) => x.id !== s.id));
    try { await mealService.deleteSavedMeal(s.id); } catch { toast().error('No se pudo eliminar'); mealService.fetchSavedMeals().then(setSaved).catch(() => null); }
  }

  async function addWater(ml: number) {
    setBusy('water');
    try {
      const m = await mealService.createMeal({ name: 'Agua', mealType: 'WATER', waterMl: ml, date: key });
      setMeals((list) => [...list, m]);
    } catch {
      toast().error('No se pudo registrar el agua');
    } finally {
      setBusy(null);
    }
  }

  async function removeWater() {
    const last = water[water.length - 1];
    if (!last) return;
    setMeals((list) => list.filter((x) => x.id !== last.id));
    try { await mealService.deleteMeal(last.id); } catch { toast().error('No se pudo quitar'); void load(true); }
  }

  const header = (
    <motion.section variants={item} className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1 md:gap-2">
        <span className="hidden text-label-lg text-primary-text md:block">Nutrición</span>
        <h1 className="text-display-sm md:text-display-md lg:text-display-lg">Comida</h1>
      </div>
      <div className="flex items-center gap-1" role="group" aria-label="Día">
        <Button variant="icon" aria-label="Día anterior" onClick={() => setOffset((o) => o - 1)}><ChevronLeft aria-hidden className="size-5" strokeWidth={1.75} /></Button>
        <span className="min-w-[7.5rem] text-center text-label-lg font-mono tabular-nums" aria-live="polite">{label}</span>
        <Button variant="icon" aria-label="Día siguiente" disabled={offset >= 0} onClick={() => setOffset((o) => Math.min(0, o + 1))}><ChevronRight aria-hidden className="size-5" strokeWidth={1.75} /></Button>
      </div>
    </motion.section>
  );

  const summary = (
    <Card as="section" variant="elevated" padding="none" aria-label="Resumen nutricional" className="flex flex-col gap-4 p-6 md:flex-row md:flex-wrap md:items-center md:gap-12 md:p-8">
      <div className="flex items-start justify-between gap-4 md:hidden">
        <div>
          <span className="text-body-sm text-on-surface-light">Calorías</span>
          <div className="flex items-baseline gap-2">
            <span className={cn('text-display-md font-mono tabular-nums', over && 'text-error-text')}><AnimatedValue value={t.calories} format={fmtInt} /></span>
            <span className="text-body-md text-on-surface-light font-mono tabular-nums">/ {fmtInt(g.calories)} kcal</span>
          </div>
        </div>
        <Button variant="icon" aria-label="Editar metas" onClick={() => setGoalOpen(true)} className="-mr-2 -mt-1"><Pencil aria-hidden className="size-5" strokeWidth={1.75} /></Button>
      </div>
      <ProgressRing
        value={Math.min(100, kcalPct)} tone={over ? 'error' : 'primary'} size={200} stroke={8}
        label="Calorías del día" valueText={`${fmtInt(t.calories)} de ${fmtInt(g.calories)} kcal`}
        className="hidden md:block"
      >
        <span className={cn('text-display-sm font-mono tabular-nums', over && 'text-error-text')}><AnimatedValue value={t.calories} format={fmtInt} /></span>
        <span className="text-body-sm text-on-surface-light font-mono tabular-nums">de {fmtInt(g.calories)} kcal</span>
      </ProgressRing>
      <div className="flex min-w-0 flex-col gap-4 md:flex-[1_1_320px] md:gap-5">
        {MACROS.map(({ key: k, label: name, tone }) => {
          const cur = t[k];
          const max = g[k];
          const pct = Math.round((cur / max) * 100);
          return (
            <div key={k} className="flex flex-col gap-1.5 md:gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-label-lg"><span aria-hidden className={cn('size-2.5 rounded-[3px]', solidBg[tone])} />{name}</span>
                <span className={cn('text-body-sm font-mono tabular-nums', cur > max ? 'text-error-text' : 'text-on-surface')}>
                  <b className="font-semibold text-on-background">{fmtInt(cur)} g</b> / {fmtInt(max)} g
                </span>
              </div>
              <ProgressBar value={pct} tone={cur > max ? 'error' : tone} size="lg" label={name} valueText={`${fmtInt(cur)} de ${fmtInt(max)} gramos`} />
            </div>
          );
        })}
        <div className="flex flex-wrap items-center justify-between gap-2 text-body-sm">
          <span className={over ? 'text-error-text' : 'text-on-surface-light'}>
            {over ? `Te pasaste ${fmtInt(t.calories - g.calories)} kcal` : `Te quedan ${fmtInt(g.calories - t.calories)} kcal`}
            {!goal && ' · metas de referencia'}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setGoalOpen(true)} className="hidden md:inline-flex">
            <Target aria-hidden className="size-4" strokeWidth={1.75} />{goal ? 'Editar metas' : 'Definir mis metas'}
          </Button>
        </div>
      </div>
    </Card>
  );

  const cta = (
    <>
      <Button block onClick={() => setAnalyze(offset === 0 ? typeForNow() : 'LUNCH')} className="min-h-14 text-body-lg md:hidden">
        <Scan aria-hidden className="size-5" strokeWidth={1.75} />Analizar comida
      </Button>
      <div className="hidden flex-wrap items-center gap-6 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/[var(--lq-soft-alpha)] p-8 md:flex">
        <IconChip icon={Scan} size="lg" className="size-16 rounded-[20px] bg-background animate-float [.reduce-motion_&]:animate-none [&>svg]:size-8" />
        <div className="min-w-0 flex-[1_1_240px]">
          <h2 className="text-heading-sm">Analiza tu plato</h2>
          <p className="text-body-md text-on-surface">Describe lo que comiste y calcularemos calorías y macros por ti.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => setManual(offset === 0 ? typeForNow() : 'LUNCH')}>Registrar a mano</Button>
          <Button onClick={() => setAnalyze(offset === 0 ? typeForNow() : 'LUNCH')} className="min-h-14 px-8 text-body-lg">
            <Scan aria-hidden className="size-5" strokeWidth={1.75} />Analizar comida
          </Button>
        </div>
      </div>
    </>
  );

  const timeline = (
    <Card as="section" padding="none" aria-labelledby="food-day" className="flex flex-col gap-4 border-0 bg-transparent shadow-none md:border md:bg-surface md:p-6 md:shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 id="food-day" className="text-heading-sm md:text-heading-lg">Comidas de {dayWord}</h2>
        <Button variant="ghost" size="sm" onClick={() => setManual(offset === 0 ? typeForNow() : 'LUNCH')} className="md:hidden">
          <Plus aria-hidden className="size-4" strokeWidth={2} />A mano
        </Button>
      </div>
      <motion.ol key={key} variants={stagger} initial="initial" animate="animate" className="flex flex-col">
        {entries.map((e, i) => {
          const last = i === entries.length - 1;
          const ok = e.kind === 'meal';
          const type = ok ? e.meal.mealType : e.type;
          return (
            <motion.li key={ok ? e.meal.id : e.type} variants={item} className="grid grid-cols-[48px_24px_minmax(0,1fr)] gap-x-2 md:grid-cols-[64px_24px_minmax(0,1fr)] md:gap-x-3">
              <span className="pt-3.5 text-body-sm text-on-surface-light font-mono tabular-nums md:pt-[18px]">{ok ? timeOf(e.meal.date) : '—'}</span>
              <div aria-hidden className="flex flex-col items-center">
                <span className={cn('mt-[18px] size-3 shrink-0 rounded-full border-2 md:mt-[22px] md:size-3.5', ok ? 'border-success bg-success' : 'border-border-strong bg-background')} />
                {!last && <span className="w-0.5 flex-1 bg-border" />}
              </div>
              {ok ? (
                <div className="lq-lift relative mb-3 flex items-center gap-4 rounded-2xl border border-border bg-surface px-4 py-3 md:px-5 md:py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-label-md text-on-surface-light">{mealTypeLabel(type)}</span>
                      <span className="text-body-sm text-on-surface font-mono tabular-nums md:hidden">{e.meal.calories ? `${fmtInt(e.meal.calories)} kcal` : '—'}</span>
                    </div>
                    <button type="button" aria-haspopup="dialog" onClick={() => setDetail(e.meal)} className="block max-w-full text-left text-body-lg font-semibold [overflow-wrap:anywhere] lq-stretch after:absolute after:inset-0 after:rounded-2xl after:content-[''] md:truncate">
                      {e.meal.name}
                    </button>
                    {macroLine(e.meal) && <div className="hidden text-body-sm text-on-surface-light font-mono tabular-nums md:block">{macroLine(e.meal)}</div>}
                  </div>
                  <span className="hidden text-heading-sm font-mono tabular-nums md:block">{e.meal.calories ? fmtInt(e.meal.calories) : '—'}<span className="sr-only"> kcal</span></span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAnalyze(e.type)}
                  className="mb-3 flex flex-col gap-0.5 rounded-2xl border border-dashed border-border-strong px-4 py-3 text-left transition-colors hover:bg-surface-variant/60 md:px-5 md:py-4"
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="text-label-md text-on-surface-light">{mealTypeLabel(type)}</span>
                    <span className="flex items-center gap-1 text-label-md text-primary-text"><Plus aria-hidden className="size-4" strokeWidth={2} />Registrar</span>
                  </span>
                  <span className="text-body-lg font-semibold text-on-surface-light">Sin registrar</span>
                  <span className="sr-only">. Analizar o registrar {mealTypeLabel(type).toLowerCase()}</span>
                </button>
              )}
            </motion.li>
          );
        })}
      </motion.ol>
    </Card>
  );

  const savedCard = (
    <Card as="section" padding="none" aria-labelledby="food-saved" className="flex flex-col gap-4 border-0 bg-transparent shadow-none md:border md:bg-surface md:p-6 md:shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 id="food-saved" className="text-heading-sm">Guardadas</h2>
        <Button variant="ghost" size="sm" onClick={() => setNewSaved(true)}><Plus aria-hidden className="size-4" strokeWidth={2} />Nueva</Button>
      </div>
      {saved === null ? (
        <PageLoader label="Cargando tus guardadas…" words={LOADING_COPY.food} size="sm" />
      ) : saved.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border-strong p-4 text-body-md text-on-surface-light">
          Guarda tus comidas frecuentes para añadirlas con un toque.
        </p>
      ) : (
        <motion.ul variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-2 md:gap-1">
          {saved.map((s) => (
            <motion.li key={s.id} variants={item} className="relative flex items-center gap-3 rounded-2xl border border-border bg-surface py-2 pl-4 pr-2 hover:bg-surface-variant/60 md:rounded-md md:border-0 md:bg-transparent md:px-0 md:hover:bg-transparent">
              <div className="min-w-0 flex-1">
                <button type="button" aria-haspopup="dialog" onClick={() => setSavedDetail(s)} className="block max-w-full truncate text-left text-body-lg font-semibold lq-stretch after:absolute after:inset-0 after:content-['']">{s.name}</button>
                <div className="truncate text-body-sm text-on-surface-light font-mono tabular-nums">
                  {[s.calories ? `${fmtInt(s.calories)} kcal` : null, s.protein ? `P ${fmtInt(s.protein)} g` : null].filter(Boolean).join(' · ') || 'Sin datos nutricionales'}
                </div>
              </div>
              <Button
                variant="secondary" size="md" loading={busy === s.id} aria-label={`Añadir ${s.name} a ${dayWord}`} onClick={() => void addSaved(s)}
                className="relative z-[1] px-3.5 md:hidden"
              >
                <Plus aria-hidden className="size-4" strokeWidth={2} />Añadir
              </Button>
              <Button
                variant="icon" loading={busy === s.id} aria-label={`Añadir ${s.name} a ${dayWord}`} onClick={() => void addSaved(s)}
                className="relative z-[1] hidden bg-surface-variant text-primary-text hover:bg-primary/[var(--lq-soft-alpha)] md:inline-flex"
              >
                <Plus aria-hidden className="size-5" strokeWidth={2} />
              </Button>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </Card>
  );

  const hydration = (
    <Card as="section" aria-labelledby="food-water" className="flex flex-col gap-3 md:p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <IconChip icon={Droplet} tone="info" size="sm" />
          <h2 id="food-water" className="text-heading-sm">Hidratación</h2>
        </div>
        <Button variant="icon" aria-label="Quitar el último registro de agua" disabled={!water.length} onClick={() => void removeWater()}>
          <Minus aria-hidden className="size-5" strokeWidth={1.75} />
        </Button>
      </div>
      <div className="flex gap-1.5" role="img" aria-label={`${filled} de ${glasses} vasos de agua`}>
        {Array.from({ length: glasses }, (_, i) => (
          <motion.span
            key={i}
            className={cn('h-8 flex-1 rounded-md transition-colors duration-300', i < filled ? 'bg-info' : 'bg-surface-variant')}
            initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4 + i * 0.06, type: 'spring', stiffness: 420, damping: 18 }}
          />
        ))}
      </div>
      <span className="text-body-sm text-on-surface-light font-mono tabular-nums" aria-live="polite">
        {filled} de {glasses} vasos · {(t.waterMl / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} L de {(g.waterMl / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} L
      </span>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" size="md" loading={busy === 'water'} onClick={() => void addWater(GLASS_ML)}><Plus aria-hidden className="size-4" strokeWidth={2} />1 vaso</Button>
        <Button variant="secondary" size="md" disabled={busy === 'water'} onClick={() => void addWater(500)}><Plus aria-hidden className="size-4" strokeWidth={2} />500 ml</Button>
      </div>
    </Card>
  );

  const savedMatch = (m: Meal) => (saved ?? []).some((s) => s.name.trim().toLowerCase() === m.name.trim().toLowerCase());

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-6 md:gap-8">
      {header}
      {state === 'loading' ? <FoodSkeleton /> : state === 'error' ? (
        <ErrorState title="No pudimos cargar tus comidas" onRetry={() => void load()} />
      ) : (
        <>
          <motion.div variants={item}>{summary}</motion.div>
          <motion.div variants={item} className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
            <div className="flex min-w-0 flex-col gap-6">
              {cta}
              {timeline}
            </div>
            <div className="flex min-w-0 flex-col gap-6">
              {hydration}
              {savedCard}
            </div>
          </motion.div>
        </>
      )}

      <AnalyzeMealDialog open={analyze !== null} onClose={() => setAnalyze(null)} date={key} initialType={analyze ?? 'LUNCH'} onSaved={added} />
      <MealFormDialog open={manual !== null} onClose={() => setManual(null)} kind="log" date={key} initialType={manual ?? 'LUNCH'} onSaved={added} />
      <MealFormDialog
        open={newSaved} onClose={() => setNewSaved(false)} kind="saved" date={key} initialType="LUNCH"
        onSaved={(s) => { setNewSaved(false); setSaved((list) => [...(list ?? []), s as SavedMeal].sort((a, b) => a.name.localeCompare(b.name))); }}
      />
      <GoalDialog open={goalOpen} onClose={() => setGoalOpen(false)} goal={goal} onSaved={(ng) => { setGoal(ng); setGoalOpen(false); }} />

      <ResponsiveDialog open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.name ?? ''}>
        {detail && (
          <div className="flex flex-col gap-5">
            <span className="text-display-sm font-mono tabular-nums">{detail.calories ? `${fmtInt(detail.calories)} kcal` : 'Sin calorías'}</span>
            <dl className="flex flex-col gap-1">
              {[
                ['Momento', mealTypeLabel(detail.mealType)],
                ['Hora', timeOf(detail.date)],
                ...MACROS.map(({ key: k, label: name }) => [name, detail[k] ? `${fmtInt(detail[k]!)} g` : '—']),
              ].map(([k, v]) => (
                <div key={k} className="flex min-h-10 items-center justify-between gap-4 border-b border-border last:border-0">
                  <dt className="text-body-md text-on-surface-light">{k}</dt><dd className="text-label-lg font-mono tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-col gap-3 sm:flex-row-reverse">
              <Button variant="secondary" block disabled={savedMatch(detail)} onClick={() => void saveFavorite(detail)}>
                {savedMatch(detail)
                  ? <><BookmarkCheck aria-hidden className="size-5" strokeWidth={1.75} />Ya está en Guardadas</>
                  : <><Bookmark aria-hidden className="size-5" strokeWidth={1.75} />Guardar para repetir</>}
              </Button>
              <Button variant="danger" block onClick={() => void removeMeal(detail)}><Trash2 aria-hidden className="size-5" strokeWidth={1.75} />Eliminar comida</Button>
            </div>
          </div>
        )}
      </ResponsiveDialog>

      <ResponsiveDialog open={Boolean(savedDetail)} onClose={() => setSavedDetail(null)} title={savedDetail?.name ?? ''}>
        {savedDetail && (
          <div className="flex flex-col gap-5">
            <span className="text-display-sm font-mono tabular-nums">{savedDetail.calories ? `${fmtInt(savedDetail.calories)} kcal` : 'Sin calorías'}</span>
            <p className="text-body-md text-on-surface">{macroLine(savedDetail) || 'Sin macros registrados'}</p>
            <div className="flex flex-col gap-3 sm:flex-row-reverse">
              <Button block onClick={() => { const s = savedDetail; setSavedDetail(null); void addSaved(s); }}><Plus aria-hidden className="size-5" strokeWidth={2} />Añadir a {dayWord}</Button>
              <Button variant="danger" block onClick={() => void removeSaved(savedDetail)}><Trash2 aria-hidden className="size-5" strokeWidth={1.75} />Quitar de Guardadas</Button>
            </div>
          </div>
        )}
      </ResponsiveDialog>
    </motion.div>
  );
}
