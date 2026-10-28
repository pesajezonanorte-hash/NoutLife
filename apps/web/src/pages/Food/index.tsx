// Comida — Food.dc.html (móvil) / FoodDesktop.dc.html (desktop).
// Resumen kcal + macros, CTA "Analizar comida", línea de tiempo del día,
// guardadas e hidratación. Metas: /nutrition/goals (valores de referencia si no hay).
// Zona ambientada: la Posada como restaurante de alta gama. Las comidas del día
// son la carta (nombre, línea de puntos y kcal), los macros se sirven en platos
// y "Analizar" es el servicio del chef: la campana se levanta y revela el plato.
// Cambiar de día pasa la página de la carta.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Meal } from '@noutlife/shared';
import { Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, Droplet, Minus, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { enter, item, springs, stagger, zoneExit } from '@/lib/motion';
import { dayKey } from '@/lib/lifeMeta';
import { useToastStore } from '@/hooks/useToast';
import { AnimatedValue, Button, Card, ErrorState, IconChip, ProgressRing, ResponsiveDialog, PageLoader } from '@/components/ui/lq';
import { useLoadingCopy } from '@/lib/loadingCopy';
import * as mealService from '@/services/meal.service';
import type { NutritionGoal, SavedMeal } from '@/services/meal.service';
import {
  effectiveGoal, mealTypeLabelFor, mealTypesFor, macrosFor, fmtIntFor, macroLine, totals, type FoodType,
} from '@/components/food/foodMeta';
import { AddAsTypeButtons, AnalyzeMealDialog, GoalDialog, MealFormDialog } from '@/components/food/FoodDialogs';
import { ClocheIcon, MacroPlate, Steam } from '@/components/food/Restaurant';
import { ZoneAmbience } from '@/components/ambience';
import { Lettering } from '@/components/layout/Lettering';
import { CategoryChecklists } from '@/components/checklists/CategoryChecklists';
import { INTL_LOCALE, useLocale, useText, type Copy, type Locale } from '@/lib/i18n';

const COPY: Copy<{
  headline: string; loading: string; loadFailed: string; loadFailedBody: string;
  dayLabel: string; dayPrev: string; dayNext: string; today: string; yesterday: string;
  cardOfToday: string; cardOfYesterday: string; cardOfDay: (d: string) => string;
  dayWordOfDay: (d: string) => string; dayWordToday: string; dayWordYesterday: string;
  calories: string; kcal: string; ofKcal: (n: string) => string; editGoals: string; caloriesOfDay: string;
  overBy: (n: string) => string; leftBy: (n: string) => string; referenceGoals: string; defineGoals: string;
  analyzeMeal: string; chefService: string; chefBody: string; manualLog: string; manualShort: string;
  dayMealsTitle: (d: string) => string; register: string; notLogged: string; analyzeOrLog: (m: string) => string;
  unrecorded: string; savedTitle: string; newSaved: string; savedEmpty: string; noNutrition: string;
  addWithDay: (n: string, d: string) => string; addShort: string; savedRepeat: string;
  hydrationTitle: string; removeWater: string; glassOf: (f: number, g: number) => string; oneGlass: string; ml500: string;
  glassesLabel: (f: number, g: number) => string; litersOf: (a: string, b: string) => string;
  shopList: string; shopBody: string;
  referenceNote: string; momentLabel: string; hour: string; noCalories: string; noMacros: string;
  savedAlready: string; saveForRepeat: string; deleteMeal: string; removeSaved: string; addDayAs: (d: string) => string;
  added: (type: string) => string; addFailed: string; deleted: string; deleteFailed: string;
  waterFailed: string; waterRemoveFailed: string; savedFailed: string; saveFailed: string;
  savedToast: string; loadingSaved: string;




}> = {
  es: {
    headline: 'Comida', loading: 'Cargando tu día…', loadFailed: 'No pudimos cargar tus comidas', loadFailedBody: 'Tus registros siguen guardados.',
    dayLabel: 'Día', dayPrev: 'Día anterior', dayNext: 'Día siguiente', today: 'Hoy', yesterday: 'Ayer',
    cardOfToday: 'La carta de hoy', cardOfYesterday: 'La carta de ayer', cardOfDay: (d) => `La carta del ${d}`,
    dayWordOfDay: (d) => `del ${d}`, dayWordToday: 'hoy', dayWordYesterday: 'ayer',
    calories: 'Calorías', kcal: 'kcal', ofKcal: (n) => `/ ${n} kcal`, editGoals: 'Editar metas', caloriesOfDay: 'Calorías del día',
    overBy: (n) => `Te pasaste ${n} kcal`, leftBy: (n) => `Te quedan ${n} kcal`, referenceGoals: ' · metas de referencia', defineGoals: 'Definir mis metas',
    analyzeMeal: 'Analizar comida', chefService: 'Servicio del chef', chefBody: 'Describe lo que comiste o tómale una foto, y el chef estimará las calorías y los macros.',
    manualLog: 'Registrar a mano', manualShort: 'A mano',
    dayMealsTitle: (d) => `Comidas de ${d}`, register: 'Registrar', notLogged: 'Sin registrar',
    analyzeOrLog: (m) => `. Analizar o registrar ${m}`, unrecorded: 'Sin registrar',
    savedTitle: 'Guardadas', newSaved: 'Nueva', savedEmpty: 'Guarda tus comidas frecuentes para añadirlas con un toque.', noNutrition: 'Sin datos nutricionales',
    addWithDay: (n, d) => `Añadir ${n} a ${d}`, addShort: 'Añadir', savedRepeat: 'Guarda tus comidas frecuentes para añadirlas con un toque.',
    hydrationTitle: 'Hidratación', removeWater: 'Quitar el último registro de agua', glassOf: (f, g) => `${f} de ${g} vasos de agua`,
    oneGlass: '1 vaso', ml500: '500 ml', glassesLabel: (f, g) => `${f} de ${g} vasos`,
    litersOf: (a, b) => `${a} L de ${b} L`,
    shopList: 'Lista de compras', shopBody: 'Lo que falta en la despensa.',
    referenceNote: 'Metas de referencia', momentLabel: 'Momento', hour: 'Hora', noCalories: 'Sin calorías', noMacros: 'Sin macros registrados',
    savedAlready: 'Ya está en Guardadas', saveForRepeat: 'Guardar para repetir', deleteMeal: 'Eliminar comida', removeSaved: 'Quitar de Guardadas',
    addDayAs: (d) => `Añadir a ${d} como`,
    added: (type) => `Añadida como ${type}`, addFailed: 'No se pudo añadir', deleted: 'Comida eliminada', deleteFailed: 'No se pudo eliminar',
    waterFailed: 'No se pudo registrar el agua', waterRemoveFailed: 'No se pudo quitar', savedFailed: 'No se pudo guardar',
    saveFailed: 'No se pudo eliminar', savedToast: 'Guardada para repetirla', loadingSaved: 'Cargando tus guardadas…',


  },
  en: {
    headline: 'Food', loading: 'Loading your day…', loadFailed: "We couldn't load your meals", loadFailedBody: 'Your records are still saved.',
    dayLabel: 'Day', dayPrev: 'Previous day', dayNext: 'Next day', today: 'Today', yesterday: 'Yesterday',
    cardOfToday: "Today's menu", cardOfYesterday: "Yesterday's menu", cardOfDay: (d) => `The menu for ${d}`,
    dayWordOfDay: (d) => `of ${d}`, dayWordToday: 'today', dayWordYesterday: 'yesterday',
    calories: 'Calories', kcal: 'kcal', ofKcal: (n) => `/ ${n} kcal`, editGoals: 'Edit goals', caloriesOfDay: 'Calories for the day',
    overBy: (n) => `You went over by ${n} kcal`, leftBy: (n) => `${n} kcal left`, referenceGoals: ' · reference goals', defineGoals: 'Set my goals',
    analyzeMeal: 'Analyze meal', chefService: 'The chef’s service', chefBody: 'Describe what you ate or snap a photo, and the chef will estimate the calories and macros.',
    manualLog: 'Log manually', manualShort: 'Manual',
    dayMealsTitle: (d) => `Meals ${d}`, register: 'Log', notLogged: 'Not logged',
    analyzeOrLog: (m) => `. Analyze or log ${m}`, unrecorded: 'Not logged',
    savedTitle: 'Saved', newSaved: 'New', savedEmpty: 'Save the meals you eat often to add them in one tap.', noNutrition: 'No nutrition data',
    addWithDay: (n, d) => `Add ${n} ${d}`, addShort: 'Add', savedRepeat: 'Save the meals you eat often to add them in one tap.',
    hydrationTitle: 'Hydration', removeWater: 'Remove the last water entry', glassOf: (f, g) => `${f} of ${g} glasses of water`,
    oneGlass: '1 glass', ml500: '500 ml', glassesLabel: (f, g) => `${f} of ${g} glasses`,
    litersOf: (a, b) => `${a} L of ${b} L`,
    shopList: 'Shopping list', shopBody: 'What the pantry is missing.',
    referenceNote: 'Reference goals', momentLabel: 'Meal', hour: 'Time', noCalories: 'No calories', noMacros: 'No macros logged',
    savedAlready: 'Already in Saved', saveForRepeat: 'Save to repeat', deleteMeal: 'Delete meal', removeSaved: 'Remove from Saved',
    addDayAs: (d) => `Add to ${d} as`,
    added: (type) => `Added as ${type}`, addFailed: "We couldn't add it", deleted: 'Meal deleted', deleteFailed: "We couldn't delete it",
    waterFailed: "We couldn't log the water", waterRemoveFailed: "We couldn't remove it", savedFailed: "We couldn't save it",
    saveFailed: "We couldn't delete it", savedToast: 'Saved to repeat', loadingSaved: 'Loading your saved meals…',


  },
};

const GLASS_ML = 250;
/** Servida hace menos de dos horas: todavía humea. */
const RECENT_MS = 2 * 60 * 60 * 1000;

type Entry = { kind: 'meal'; meal: Meal; at: number } | { kind: 'empty'; type: FoodType; at: number };

export default function FoodPage() {
  const t = useText(COPY);
  const locale: Locale = useLocale();
  const loadingCopy = useLoadingCopy();
  const mealTypes = mealTypesFor(locale);
  const macros = macrosFor(locale);
  const fmt = (n: number) => fmtIntFor(n, locale);
  const mealLabel = (type: string | null | undefined) => mealTypeLabelFor(type, locale);
  const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(INTL_LOCALE[locale], { hour: '2-digit', minute: '2-digit' });

  const [offset, setOffset] = useState(0);
  /** -1 = día anterior, 1 = siguiente: la carta pasa la página en ese sentido. */
  const turn = useRef(0);
  const goDay = (d: -1 | 1) => { turn.current = d; setOffset((o) => Math.min(0, o + d)); };
  const day = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + offset); return d; }, [offset]);
  const key = dayKey(day);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [goal, setGoal] = useState<NutritionGoal | null>(null);
  const [saved, setSaved] = useState<SavedMeal[] | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  // Diálogo abierto con el momento que se tocó (un hueco de la línea de tiempo) o sin momento: se elige dentro.
  const [analyze, setAnalyze] = useState<{ type: FoodType | null } | null>(null);
  const [manual, setManual] = useState<{ type: FoodType | null } | null>(null);
  const [addingAs, setAddingAs] = useState<FoodType | null>(null);
  const [newSaved, setNewSaved] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [detail, setDetail] = useState<Meal | null>(null);
  const [savedDetail, setSavedDetail] = useState<SavedMeal | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /** Tras la primera carga, cambiar de día no vuelve al cargador: la carta pasa la página. */
  const loaded = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setState('loading');
    try {
      const [list, g] = await Promise.all([mealService.fetchMeals(key), mealService.fetchNutritionGoal().catch(() => null)]);
      setMeals(list);
      setGoal(g);
      setState('ready');
      loaded.current = true;
    } catch {
      if (!silent) setState('error');
    }
  }, [key]);
  useEffect(() => { void load(loaded.current); }, [load]);
  useEffect(() => { mealService.fetchSavedMeals().then(setSaved).catch(() => setSaved([])); }, []);

  const food = meals.filter((m) => m.mealType !== 'WATER');
  const water = meals.filter((m) => m.mealType === 'WATER');
  const tot = totals(meals);
  const g = effectiveGoal(goal);
  const kcalPct = Math.round((tot.calories / g.calories) * 100);
  const over = tot.calories > g.calories;
  const glasses = Math.max(1, Math.round(g.waterMl / GLASS_ML));
  const filled = Math.min(glasses, Math.floor(tot.waterMl / GLASS_ML));

  // Línea de tiempo: comidas registradas + huecos de desayuno/almuerzo/cena sin registrar.
  const entries: Entry[] = useMemo(() => {
    const list: Entry[] = food.map((m) => { const d = new Date(m.date); return { kind: 'meal', meal: m, at: d.getHours() * 60 + d.getMinutes() }; });
    for (const mt of mealTypes) {
      if (mt.value !== 'SNACK' && !food.some((m) => m.mealType === mt.value)) list.push({ kind: 'empty', type: mt.value, at: mt.at });
    }
    return list.sort((a, b) => a.at - b.at);
  }, [food, mealTypes]);

  const shortDate = day.toLocaleDateString(INTL_LOCALE[locale], { day: 'numeric', month: 'short' }).replace('.', '');
  const longDay = day.toLocaleDateString(INTL_LOCALE[locale], { day: 'numeric', month: 'long' });
  const weekday = day.toLocaleDateString(INTL_LOCALE[locale], { weekday: 'short' }).replace('.', '');
  const label = offset === 0
    ? `${t.today} · ${shortDate}`
    : offset === -1
      ? `${t.yesterday} · ${shortDate}`
      : `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} · ${shortDate}`;
  const dayWord = offset === 0 ? t.dayWordToday : offset === -1 ? t.dayWordYesterday : t.dayWordOfDay(longDay);
  const cardTitle = offset === 0 ? t.cardOfToday : offset === -1 ? t.cardOfYesterday : t.cardOfDay(longDay);
  const toast = useToastStore.getState;

  function added(m: Meal | SavedMeal) {
    if ('mealType' in m) setMeals((list) => [...list, m]);
    setAnalyze(null); setManual(null);
    void load(true);
  }

  async function removeMeal(m: Meal) {
    setDetail(null);
    setMeals((list) => list.filter((x) => x.id !== m.id));
    try { await mealService.deleteMeal(m.id); toast().success(t.deleted); } catch { toast().error(t.deleteFailed); void load(true); }
  }

  /** Registra una guardada en el momento que la persona eligió (nunca uno por defecto). */
  async function addSaved(s: SavedMeal, type: FoodType) {
    setAddingAs(type);
    try {
      const m = await mealService.createMeal({ name: s.name, mealType: type, calories: s.calories ?? undefined, protein: s.protein ?? undefined, carbs: s.carbs ?? undefined, fat: s.fat ?? undefined, date: key });
      setMeals((list) => [...list, m]);
      setSavedDetail(null);
      toast().success(t.added(mealLabel(type).toLowerCase()), s.name);
    } catch {
      toast().error(t.addFailed);
    } finally {
      setAddingAs(null);
    }
  }

  async function saveFavorite(m: Meal) {
    try {
      const s = await mealService.createSavedMeal({ name: m.name, calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat });
      setSaved((list) => [...(list ?? []), s].sort((a, b) => a.name.localeCompare(b.name)));
      toast().success(t.savedToast);
    } catch {
      toast().error(t.savedFailed);
    }
  }

  async function removeSaved(s: SavedMeal) {
    setSavedDetail(null);
    setSaved((list) => (list ?? []).filter((x) => x.id !== s.id));
    try { await mealService.deleteSavedMeal(s.id); } catch { toast().error(t.saveFailed); mealService.fetchSavedMeals().then(setSaved).catch(() => null); }
  }

  async function addWater(ml: number) {
    setBusy('water');
    try {
      const m = await mealService.createMeal({ name: 'Agua', mealType: 'WATER', waterMl: ml, date: key });
      setMeals((list) => [...list, m]);
    } catch {
      toast().error(t.waterFailed);
    } finally {
      setBusy(null);
    }
  }

  async function removeWater() {
    const last = water[water.length - 1];
    if (!last) return;
    setMeals((list) => list.filter((x) => x.id !== last.id));
    try { await mealService.deleteMeal(last.id); } catch { toast().error(t.waterRemoveFailed); void load(true); }
  }

  const header = (
    <motion.section variants={item} className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1 md:gap-2">
        <span className="hidden text-label-lg text-primary-text md:block">{cardTitle}</span>
        <h1 className="text-display-sm md:text-display-md lg:text-display-lg"><Lettering text={t.headline} /></h1>
      </div>
      <div className="flex items-center gap-1" role="group" aria-label={t.dayLabel}>
        <Button variant="icon" aria-label={t.dayPrev} onClick={() => goDay(-1)}><ChevronLeft aria-hidden className="size-5" strokeWidth={1.75} /></Button>
        <span className="min-w-[7.5rem] text-center text-label-lg font-mono tabular-nums" aria-live="polite">{label}</span>
        <Button variant="icon" aria-label={t.dayNext} disabled={offset >= 0} onClick={() => goDay(1)}><ChevronRight aria-hidden className="size-5" strokeWidth={1.75} /></Button>
      </div>
    </motion.section>
  );

  const summary = (
    <Card as="section" variant="elevated" padding="none" aria-label={t.calories} className="flex flex-col gap-4 p-6 md:flex-row md:flex-wrap md:items-center md:gap-12 md:p-8">
      <div className="flex items-start justify-between gap-4 md:hidden">
        <div>
          <span className="text-body-sm text-on-surface-light">{t.calories}</span>
          <div className="flex items-baseline gap-2">
            <span className={cn('text-display-md font-mono tabular-nums', over && 'text-error-text')}><AnimatedValue value={tot.calories} format={fmt} /></span>
            <span className="text-body-md text-on-surface-light font-mono tabular-nums">{t.ofKcal(fmt(g.calories))}</span>
          </div>
        </div>
        <Button variant="icon" aria-label={t.editGoals} onClick={() => setGoalOpen(true)} className="-mr-2 -mt-1"><Pencil aria-hidden className="size-5" strokeWidth={1.75} /></Button>
      </div>
      <ProgressRing
        value={Math.min(100, kcalPct)} tone={over ? 'error' : 'primary'} size={200} stroke={8}
        label={t.caloriesOfDay} valueText={`${fmt(tot.calories)} / ${fmt(g.calories)} ${t.kcal}`}
        className="hidden md:block"
      >
        <span className={cn('text-display-sm font-mono tabular-nums', over && 'text-error-text')}><AnimatedValue value={tot.calories} format={fmt} /></span>
        <span className="text-body-sm text-on-surface-light font-mono tabular-nums">/ {fmt(g.calories)} {t.kcal}</span>
      </ProgressRing>
      <div className="flex min-w-0 flex-col gap-5 md:flex-[1_1_320px] md:gap-6">
        <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-3 gap-2 md:gap-4">
          {macros.map(({ key: k, label: name, tone }) => (
            <motion.div key={k} variants={enter.serve}>
              <MacroPlate label={name} value={tot[k]} max={g[k]} tone={tone} size={84} />
            </motion.div>
          ))}
        </motion.div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-body-sm">
          <span className={over ? 'text-error-text' : 'text-on-surface-light'}>
            {over ? t.overBy(fmt(tot.calories - g.calories)) : t.leftBy(fmt(g.calories - tot.calories))}
            {!goal && t.referenceGoals}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setGoalOpen(true)} className="hidden md:inline-flex">
            <Target aria-hidden className="size-4" strokeWidth={1.75} />{goal ? t.editGoals : t.defineGoals}
          </Button>
        </div>
      </div>
    </Card>
  );

  const cta = (
    <>
      <Button block onClick={() => setAnalyze({ type: null })} className="group min-h-14 text-body-lg md:hidden">
        <ClocheIcon className="size-6" />{t.analyzeMeal}
      </Button>
      <div className="lq-tex-linen relative hidden flex-wrap items-center gap-6 overflow-hidden rounded-2xl border border-border bg-surface p-8 shadow-sm md:flex">
        <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 block size-56 rounded-full bg-[radial-gradient(closest-side,rgb(var(--lq-warning)/.12),transparent)]" />
        <span className="relative flex size-16 shrink-0 items-center justify-center rounded-[20px] bg-surface-variant text-primary-text">
          <ClocheIcon className="size-9" />
        </span>
        <div className="relative min-w-0 flex-[1_1_240px]">
          <h2 className="text-heading-sm">{t.chefService}</h2>
          <p className="text-body-md text-on-surface">{t.chefBody}</p>
        </div>
        <div className="relative flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => setManual({ type: null })}>{t.manualLog}</Button>
          <Button onClick={() => setAnalyze({ type: null })} className="group min-h-14 px-8 text-body-lg">
            <ClocheIcon className="size-6" />{t.analyzeMeal}
          </Button>
        </div>
      </div>
    </>
  );

  const now = Date.now();
  const timeline = (
    // La carta se despliega desde arriba al llegar.
    <motion.div
      style={{ transformPerspective: 1100, originY: 0 }}
      initial={{ opacity: 0, rotateX: -14, y: -6 }}
      animate={{ opacity: 1, rotateX: 0, y: 0, transition: { ...springs.heavy, delay: 0.1 } }}
    >
      <Card as="section" padding="none" aria-labelledby="food-day" className="relative flex flex-col gap-4 overflow-hidden border-0 bg-transparent shadow-none md:lq-tex-paper md:border md:p-8 md:shadow-sm">
        {/* Marco de carta */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-3 hidden rounded-xl border border-border md:block" />
        <div className="relative flex items-center justify-between gap-2">
          <h2 id="food-day" className="text-heading-sm md:text-heading-lg">{t.dayMealsTitle(dayWord)}</h2>
          <Button variant="ghost" size="sm" onClick={() => setManual({ type: null })} className="md:hidden">
            <Plus aria-hidden className="size-4" strokeWidth={2} />{t.manualShort}
          </Button>
        </div>
        {/* Cambiar de día pasa la página de la carta */}
        <AnimatePresence mode="wait" custom={turn.current}>
          <motion.ol
            key={key}
            custom={turn.current}
            variants={{
              initial: (d: number) => ({ opacity: 0, x: d * 28, rotateY: d * -10 }),
              animate: { opacity: 1, x: 0, rotateY: 0, transition: { ...springs.heavy, staggerChildren: 0.09, delayChildren: 0.12 } },
              exit: (d: number) => ({ opacity: 0, x: d * -18, rotateY: d * 6, transition: { duration: 0.18 } }),
            }}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ transformPerspective: 1200 }}
            className="relative flex flex-col"
          >
            {entries.map((e, i) => {
              const last = i === entries.length - 1;
              const ok = e.kind === 'meal';
              const type = ok ? e.meal.mealType : e.type;
              const recent = ok && offset === 0 && now - new Date(e.meal.date).getTime() < RECENT_MS;
              return (
                <motion.li key={ok ? e.meal.id : e.type} variants={enter.serve} className="grid grid-cols-[48px_24px_minmax(0,1fr)] gap-x-2 md:grid-cols-[64px_24px_minmax(0,1fr)] md:gap-x-3">
                  <span className="pt-3.5 text-body-sm text-on-surface-light font-mono tabular-nums md:pt-[18px]">{ok ? timeOf(e.meal.date) : '—'}</span>
                  <div aria-hidden className="flex flex-col items-center">
                    <span className={cn('mt-[18px] size-3 shrink-0 rounded-full border-2 md:mt-[22px] md:size-3.5', ok ? 'border-success bg-success' : 'border-border-strong bg-background')} />
                    {!last && <span className="w-0.5 flex-1 bg-border" />}
                  </div>
                  {ok ? (
                    // Una línea de la carta: nombre, línea de puntos y kcal. Al pasar el cursor el plato se eleva un poco.
                    <div className="relative mb-2 flex flex-col gap-0.5 rounded-xl px-3 py-3 transition-[background-color,transform] duration-[560ms] ease-[var(--lq-ease-natural)] hover:-translate-y-0.5 hover:bg-surface-variant/50 md:px-4">
                      <span className="text-label-md text-on-surface-light">{mealLabel(type)}</span>
                      <div className="flex min-w-0 items-baseline gap-2">
                        <button type="button" aria-haspopup="dialog" onClick={() => setDetail(e.meal)} className="min-w-0 text-left text-body-lg font-semibold [overflow-wrap:anywhere] lq-stretch after:absolute after:inset-0 after:rounded-xl after:content-[''] md:truncate">
                          {e.meal.name}
                        </button>
                        <span aria-hidden className="mx-1 hidden min-w-6 flex-1 -translate-y-1 border-b border-dotted border-on-surface-light/50 md:block" />
                        <span className="ml-auto shrink-0 font-mono text-body-md tabular-nums md:text-heading-sm">
                          {e.meal.calories ? fmt(e.meal.calories) : '—'}<span className="text-body-sm text-on-surface-light"> {t.kcal}</span>
                        </span>
                        {recent && <Steam className="-mb-0.5 shrink-0" />}
                      </div>
                      {macroLine(e.meal) && <div className="text-body-sm text-on-surface-light font-mono tabular-nums">{macroLine(e.meal)}</div>}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAnalyze({ type: e.type })}
                      className="mb-3 flex flex-col gap-0.5 rounded-xl border border-dashed border-border-strong px-4 py-3 text-left transition-[background-color,transform] duration-[560ms] ease-[var(--lq-ease-natural)] hover:-translate-y-0.5 hover:bg-surface-variant/60 md:px-5 md:py-4"
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="text-label-md text-on-surface-light">{mealLabel(type)}</span>
                        <span className="flex items-center gap-1 text-label-md text-primary-text"><Plus aria-hidden className="size-4" strokeWidth={2} />{t.register}</span>
                      </span>
                      <span className="text-body-lg font-semibold text-on-surface-light">{t.unrecorded}</span>
                      <span className="sr-only">{t.analyzeOrLog(mealLabel(type).toLowerCase())}</span>
                    </button>
                  )}
                </motion.li>
              );
            })}
          </motion.ol>
        </AnimatePresence>
      </Card>
    </motion.div>
  );

  const savedCard = (
    <Card as="section" padding="none" aria-labelledby="food-saved" className="flex flex-col gap-4 border-0 bg-transparent shadow-none md:border md:bg-surface md:p-6 md:shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 id="food-saved" className="text-heading-sm">{t.savedTitle}</h2>
        <Button variant="ghost" size="sm" onClick={() => setNewSaved(true)}><Plus aria-hidden className="size-4" strokeWidth={2} />{t.newSaved}</Button>
      </div>
      {saved === null ? (
        <PageLoader label={t.loadingSaved} words={loadingCopy.food} size="sm" />
      ) : saved.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border-strong p-4 text-body-md text-on-surface-light">{t.savedEmpty}</p>
      ) : (
        <motion.ul variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-2 md:gap-1">
          {saved.map((s) => (
            <motion.li key={s.id} variants={item} className="relative flex items-center gap-3 rounded-2xl border border-border bg-surface py-2 pl-4 pr-2 hover:bg-surface-variant/60 md:rounded-md md:border-0 md:bg-transparent md:px-0 md:hover:bg-transparent">
              <div className="min-w-0 flex-1">
                <button type="button" aria-haspopup="dialog" onClick={() => setSavedDetail(s)} className="block max-w-full truncate text-left text-body-lg font-semibold lq-stretch after:absolute after:inset-0 after:content-['']">{s.name}</button>
                <div className="truncate text-body-sm text-on-surface-light font-mono tabular-nums">
                  {[s.calories ? `${fmt(s.calories)} ${t.kcal}` : null, s.protein ? `P ${fmt(s.protein)} g` : null].filter(Boolean).join(' · ') || t.noNutrition}
                </div>
              </div>
              <Button
                variant="secondary" size="md" aria-haspopup="dialog" aria-label={t.addWithDay(s.name, dayWord)} onClick={() => setSavedDetail(s)}
                className="relative z-[1] px-3.5 md:hidden"
              >
                <Plus aria-hidden className="size-4" strokeWidth={2} />{t.addShort}
              </Button>
              <Button
                variant="icon" aria-haspopup="dialog" aria-label={t.addWithDay(s.name, dayWord)} onClick={() => setSavedDetail(s)}
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
          <h2 id="food-water" className="text-heading-sm">{t.hydrationTitle}</h2>
        </div>
        <Button variant="icon" aria-label={t.removeWater} disabled={!water.length} onClick={() => void removeWater()}>
          <Minus aria-hidden className="size-5" strokeWidth={1.75} />
        </Button>
      </div>
      <div className="flex gap-1.5" role="img" aria-label={t.glassOf(filled, glasses)}>
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
        {t.glassesLabel(filled, glasses)} · {t.litersOf((tot.waterMl / 1000).toLocaleString(INTL_LOCALE[locale], { maximumFractionDigits: 1 }), (g.waterMl / 1000).toLocaleString(INTL_LOCALE[locale], { maximumFractionDigits: 1 }))}
      </span>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" size="md" loading={busy === 'water'} onClick={() => void addWater(GLASS_ML)}><Plus aria-hidden className="size-4" strokeWidth={2} />{t.oneGlass}</Button>
        <Button variant="secondary" size="md" disabled={busy === 'water'} onClick={() => void addWater(500)}><Plus aria-hidden className="size-4" strokeWidth={2} />{t.ml500}</Button>
      </div>
    </Card>
  );

  const savedMatch = (m: Meal) => (saved ?? []).some((s) => s.name.trim().toLowerCase() === m.name.trim().toLowerCase());

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" exit={zoneExit} className="relative">
      {/* Restaurante: mantel de lino, luz cálida muy tenue y, de noche, una vela */}
      <ZoneAmbience
        zone="food"
        view={(
          <>
            <span className="lq-amb-breathe absolute left-[10%] top-[-12%] block h-[60vh] w-[80%] rounded-full bg-[radial-gradient(closest-side,rgb(var(--lq-warning)/.10),transparent)] [--d:16s] [--hi:1] [--lo:.6] dark:hidden" />
            <span className="lq-candle absolute right-[6%] top-[18%] hidden h-[46vh] w-[46vh] rounded-full bg-[radial-gradient(closest-side,rgb(var(--lq-warning)/.13),rgb(var(--lq-secondary)/.05)_45%,transparent)] dark:block" />
          </>
        )}
      >
        <span className="lq-tex-linen absolute inset-0 block opacity-70 [mask-image:radial-gradient(120%_70%_at_50%_0%,#000_35%,transparent_75%)]" />
      </ZoneAmbience>
      <div className="relative flex flex-col gap-6 md:gap-8">
      {header}
      {state === 'loading' ? <PageLoader label={t.loading} words={loadingCopy.food} /> : state === 'error' ? (
        <ErrorState title={t.loadFailed} description={t.loadFailedBody} onRetry={() => void load()} />
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
              <CategoryChecklists category="Compras" title={t.shopList} description={t.shopBody} />
            </div>
          </motion.div>
        </>
      )}
      </div>

      <AnalyzeMealDialog open={analyze !== null} onClose={() => setAnalyze(null)} date={key} initialType={analyze?.type ?? null} onSaved={added} />
      <MealFormDialog open={manual !== null} onClose={() => setManual(null)} kind="log" date={key} initialType={manual?.type ?? null} onSaved={added} />
      <MealFormDialog
        open={newSaved} onClose={() => setNewSaved(false)} kind="saved" date={key}
        onSaved={(s) => { setNewSaved(false); setSaved((list) => [...(list ?? []), s as SavedMeal].sort((a, b) => a.name.localeCompare(b.name))); }}
      />
      <GoalDialog open={goalOpen} onClose={() => setGoalOpen(false)} goal={goal} onSaved={(ng) => { setGoal(ng); setGoalOpen(false); }} />

      <ResponsiveDialog open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.name ?? ''}>
        {detail && (
          <div className="flex flex-col gap-5">
            <span className="text-display-sm font-mono tabular-nums">{detail.calories ? `${fmt(detail.calories)} ${t.kcal}` : t.noCalories}</span>
            <dl className="flex flex-col gap-1">
              {[
                [t.momentLabel, mealLabel(detail.mealType)],
                [t.hour, timeOf(detail.date)],
                ...macros.map(({ key: k, label: name }) => [name, detail[k] ? `${fmt(detail[k]!)} g` : '—']),
              ].map(([k, v]) => (
                <div key={k} className="flex min-h-10 items-center justify-between gap-4 border-b border-border last:border-0">
                  <dt className="text-body-md text-on-surface-light">{k}</dt><dd className="text-label-lg font-mono tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-col gap-3 sm:flex-row-reverse">
              <Button variant="secondary" block disabled={savedMatch(detail)} onClick={() => void saveFavorite(detail)}>
                {savedMatch(detail)
                  ? <><BookmarkCheck aria-hidden className="size-5" strokeWidth={1.75} />{t.savedAlready}</>
                  : <><Bookmark aria-hidden className="size-5" strokeWidth={1.75} />{t.saveForRepeat}</>}
              </Button>
              <Button variant="danger" block onClick={() => void removeMeal(detail)}><Trash2 aria-hidden className="size-5" strokeWidth={1.75} />{t.deleteMeal}</Button>
            </div>
          </div>
        )}
      </ResponsiveDialog>

      <ResponsiveDialog open={Boolean(savedDetail)} onClose={() => setSavedDetail(null)} title={savedDetail?.name ?? ''}>
        {savedDetail && (
          <div className="flex flex-col gap-5">
            <span className="text-display-sm font-mono tabular-nums">{savedDetail.calories ? `${fmt(savedDetail.calories)} ${t.kcal}` : t.noCalories}</span>
            <p className="text-body-md text-on-surface">{macroLine(savedDetail) || t.noMacros}</p>
            <div className="flex flex-col gap-2">
              <p className="text-label-lg text-on-surface">{t.addDayAs(dayWord)}</p>
              <AddAsTypeButtons name={savedDetail.name} busy={addingAs} onPick={(type) => void addSaved(savedDetail, type)} />
            </div>
            <Button variant="danger" block disabled={addingAs !== null} onClick={() => void removeSaved(savedDetail)}><Trash2 aria-hidden className="size-5" strokeWidth={1.75} />{t.removeSaved}</Button>
          </div>
        )}
      </ResponsiveDialog>
    </motion.div>
  );
}
