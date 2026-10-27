// Diálogos de Comida (sin prototipo propio: formularios del sistema).
// AnalyzeMealDialog = CTA "Analizar comida" del prototipo, MealFormDialog =
// registro manual, comida guardada o metas. Al analizar, el servicio del chef:
// la campana cubre el plato mientras se estima y se levanta para revelarlo.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import type { Meal } from '@noutlife/shared';
import { AlertTriangle, ArrowLeft, Info, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { enter, staggerVariants } from '@/lib/motion';
import { Button, Field, Input, ResponsiveDialog, Textarea } from '@/components/ui/lq';
import { useToastStore } from '@/hooks/useToast';
import { useAuthStore } from '@/store/authStore';
import { usePlanStore } from '@/store/planStore';
import * as mealService from '@/services/meal.service';
import type { NutritionGoal, ParsedMeal, SavedMeal } from '@/services/meal.service';
import { DEFAULT_GOAL, macrosFor, mealTypeLabelFor, mealTypesFor, type FoodType } from './foodMeta';
import { ChefService } from './Restaurant';
import { solidBg } from '@/components/ui/lq/tones';
import { INTL_LOCALE, getLocale, useLocale, useText, type Copy } from '@/lib/i18n';

const es = {
  mealTime: 'Momento del día',
  typeError: 'Elige el momento del día',
  nameLabel: 'Nombre',
  nameError: 'Escribe qué comiste',
  namePh: 'Ej. Pollo con arroz y ensalada',
  calories: 'Calorías',
  invalidNumber: 'Número no válido',
  grams: 'gramos',
  addAs: (name: string): string => `Añadir ${name} como`,
  addAsOne: (name: string, label: string): string => `Añadir ${name} como ${label}`,
  alsoSave: 'Guardar también en Guardadas para repetirla',
  cancel: 'Cancelar',
  save: 'Guardar',
  savedFail: 'No se pudo guardar en Guardadas',
  logged: (label: string): string => `${label} registrado`,
  analyzeTitle: 'Analizar comida',
  connectFail: 'No pudimos conectar con el análisis. Inténtalo de nuevo o regístrala a mano.',
  ingredientsFirst: 'Cuéntame qué ingredientes lleva para volver a intentarlo.',
  saveFail: 'No se pudo guardar. Inténtalo de nuevo.',
  noticeNeeds: 'No he podido identificar este plato con seguridad. Cuéntame sus ingredientes y vuelvo a estimarlo sin inventar datos.',
  noticeOk: 'Estimación lista. Revisa y ajusta antes de guardar.',
  noticeNoMacros: 'No pudimos estimar los macros de esta descripción. Complétalos a mano o déjalos vacíos.',
  noticeNoAi: 'El análisis automático no está disponible ahora. Completa los datos a mano.',
  estimatedMacros: 'Macros estimados',
  describe: 'Describe lo que comiste y estimaremos las calorías y los macros por ti.',
  whatAte: '¿Qué comiste?',
  whatAteHelp: 'Incluye cantidades si las sabes',
  whatAteErr: 'Describe tu comida para analizarla',
  whatAtePh: 'Ej. Un plato de arroz con pollo, ensalada y un jugo de mango',
  analyzingSr: 'Analizando tu plato…',
  analyzing: 'Analizando…',
  analyze: 'Analizar',
  logByHand: 'Registrar a mano',
  ingredientsQ: '¿Qué ingredientes lleva?',
  ingredientsHelp: 'Añade cantidades aproximadas si las conoces',
  ingredientsPh: 'Ej. papa, huevo, cebolla y queso; una porción mediana',
  back: 'Volver',
  skipEstimate: 'Seguir sin estimación',
  retryAnalysis: 'Reintentar análisis',
  describeOther: 'Describir otra',
  logMeal: 'Registrar comida',
  logTitle: (label: string): string => `Registrar ${label}`,
  newSaved: 'Nueva comida guardada',
  savedOk: 'Comida guardada',
  dailyGoals: 'Metas diarias',
  saveGoals: 'Guardar metas',
  kcalPerDay: 'kcal al día',
  gramsPerDay: 'gramos al día',
  water: 'Agua',
  mlPerDay: 'ml al día',
  goalsPositive: 'Todas las metas deben ser mayores que 0.',
  mustBePositive: 'Debe ser mayor que 0',
  goalsUpdated: 'Metas actualizadas',
  goalsFail: 'No se pudieron guardar tus metas.',
};

const en: typeof es = {
  mealTime: 'Time of day',
  typeError: 'Choose a time of day',
  nameLabel: 'Name',
  nameError: 'Write what you ate',
  namePh: 'E.g. Chicken with rice and salad',
  calories: 'Calories',
  invalidNumber: 'Invalid number',
  grams: 'grams',
  addAs: (name: string): string => `Add ${name} as`,
  addAsOne: (name: string, label: string): string => `Add ${name} as ${label}`,
  alsoSave: 'Also save to Saved to repeat it',
  cancel: 'Cancel',
  save: 'Save',
  savedFail: 'Could not save to Saved',
  logged: (label: string): string => `${label} logged`,
  analyzeTitle: 'Analyze meal',
  connectFail: 'We could not reach the analysis. Try again or log it by hand.',
  ingredientsFirst: 'Tell me what ingredients it has to try again.',
  saveFail: 'Could not save. Try again.',
  noticeNeeds: 'I could not identify this dish with confidence. Tell me its ingredients and I will estimate it again without making up data.',
  noticeOk: 'Estimate ready. Review and adjust before saving.',
  noticeNoMacros: 'We could not estimate the macros for this description. Fill them in by hand or leave them empty.',
  noticeNoAi: 'Automatic analysis is not available right now. Fill in the details by hand.',
  estimatedMacros: 'Estimated macros',
  describe: 'Describe what you ate and we will estimate the calories and macros for you.',
  whatAte: 'What did you eat?',
  whatAteHelp: 'Include amounts if you know them',
  whatAteErr: 'Describe your meal to analyze it',
  whatAtePh: 'E.g. A plate of rice with chicken, salad and a mango juice',
  analyzingSr: 'Analyzing your dish…',
  analyzing: 'Analyzing…',
  analyze: 'Analyze',
  logByHand: 'Log by hand',
  ingredientsQ: 'What ingredients does it have?',
  ingredientsHelp: 'Add approximate amounts if you know them',
  ingredientsPh: 'E.g. potato, egg, onion and cheese; a medium portion',
  back: 'Back',
  skipEstimate: 'Continue without estimate',
  retryAnalysis: 'Retry analysis',
  describeOther: 'Describe another',
  logMeal: 'Log meal',
  logTitle: (label: string): string => `Log ${label}`,
  newSaved: 'New saved meal',
  savedOk: 'Meal saved',
  dailyGoals: 'Daily goals',
  saveGoals: 'Save goals',
  kcalPerDay: 'kcal per day',
  gramsPerDay: 'grams per day',
  water: 'Water',
  mlPerDay: 'ml per day',
  goalsPositive: 'All goals must be greater than 0.',
  mustBePositive: 'Must be greater than 0',
  goalsUpdated: 'Goals updated',
  goalsFail: 'Could not save your goals.',
};

const COPY: Copy<typeof es> = { es, en };

// `type` empieza vacío salvo que la persona haya tocado un momento concreto
// (un hueco de la línea de tiempo): nunca se asigna uno por la hora ni por defecto.
type Draft = { name: string; type: FoodType | null; calories: string; protein: string; carbs: string; fat: string };
const blank = (type: FoodType | null): Draft => ({ name: '', type, calories: '', protein: '', carbs: '', fat: '' });
const num = (v: string) => (v.trim() === '' ? undefined : Math.max(0, Number(v.replace(',', '.'))));
const invalidNum = (v: string) => v.trim() !== '' && !(Number(v.replace(',', '.')) >= 0);

function TypePicker({ value, onChange, error }: { value: FoodType | null; onChange: (t: FoodType) => void; error?: string }) {
  const t = useText(COPY);
  const locale = useLocale();
  return (
    <fieldset className="flex flex-col gap-2" aria-invalid={error ? true : undefined}>
      <legend className="mb-2 text-label-lg text-on-surface">{t.mealTime}</legend>
      <div role="radiogroup" aria-label={t.mealTime} aria-describedby={error ? 'meal-type-error' : undefined} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {mealTypesFor(locale).map(({ value: v, label, icon: Icon }) => {
          const on = v === value;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(v)}
              className={cn(
                'flex min-h-14 items-center justify-center gap-2 rounded-xl border px-2 text-label-lg transition-colors',
                on ? 'border-2 border-primary bg-primary/[var(--lq-soft-alpha)] text-primary-text' : 'border border-border text-on-surface hover:bg-surface-variant',
              )}
            >
              <Icon aria-hidden className="size-5" strokeWidth={1.75} />
              {label}
            </button>
          );
        })}
      </div>
      {error && <p id="meal-type-error" role="alert" className="text-body-sm text-error-text">{error}</p>}
    </fieldset>
  );
}

/**
 * Añadir una comida guardada: un botón por momento del día. El toque elige el
 * momento y registra a la vez; no hay momento por defecto.
 */
export function AddAsTypeButtons({ name, busy, onPick }: { name: string; busy: FoodType | null; onPick: (t: FoodType) => void }) {
  const t = useText(COPY);
  const locale = useLocale();
  return (
    <div role="group" aria-label={t.addAs(name)} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {mealTypesFor(locale).map(({ value, label, icon: Icon }) => (
        <Button
          key={value} variant="secondary" size="md" loading={busy === value} disabled={busy !== null && busy !== value}
          aria-label={t.addAsOne(name, label.toLowerCase())} onClick={() => onPick(value)} className="min-h-14"
        >
          <Icon aria-hidden className="size-5" strokeWidth={1.75} />{label}
        </Button>
      ))}
    </div>
  );
}

/** Nombre + kcal + macros (+ momento del día y "guardar en favoritas" si es un registro). */
function MealFields({ draft, set, touched, withType, nameRef }: {
  draft: Draft;
  set: (patch: Partial<Draft>) => void;
  touched: boolean;
  withType: boolean;
  nameRef?: React.Ref<HTMLInputElement>;
}) {
  const t = useText(COPY);
  const locale = useLocale();
  return (
    <>
      <Field label={t.nameLabel} error={touched && !draft.name.trim() ? t.nameError : undefined}>
        <Input ref={nameRef} data-autofocus value={draft.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} placeholder={t.namePh} />
      </Field>
      {withType && <TypePicker value={draft.type} onChange={(type) => set({ type })} error={touched && !draft.type ? t.typeError : undefined} />}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label={t.calories} help="kcal" error={touched && invalidNum(draft.calories) ? t.invalidNumber : undefined}>
          <Input type="number" inputMode="numeric" min="0" value={draft.calories} onChange={(e) => set({ calories: e.target.value })} placeholder="0" className="font-mono tabular-nums" />
        </Field>
        {macrosFor(locale).map(({ key, label }) => (
          <Field key={key} label={label} help={t.grams} error={touched && invalidNum(draft[key]) ? t.invalidNumber : undefined}>
            <Input type="number" inputMode="decimal" min="0" step="any" value={draft[key]} onChange={(e) => set({ [key]: e.target.value })} placeholder="0" className="font-mono tabular-nums" />
          </Field>
        ))}
      </div>
    </>
  );
}

/** Un registro del día necesita además el momento elegido; una comida guardada, no. */
const draftValid = (d: Draft, needsType: boolean) =>
  d.name.trim() !== '' && (!needsType || d.type !== null) && !(['calories', 'protein', 'carbs', 'fat'] as const).some((k) => invalidNum(d[k]));
const draftBody = (d: Draft) => ({ name: d.name.trim(), calories: num(d.calories), protein: num(d.protein), carbs: num(d.carbs), fat: num(d.fat) });

/** Solo se llama con un borrador válido (draftValid con momento). */
async function logMeal(d: Draft, date: string, favorite: boolean): Promise<Meal> {
  const t = COPY[getLocale()];
  const body = draftBody(d);
  const meal = await mealService.createMeal({ ...body, mealType: d.type!, date });
  if (favorite) await mealService.createSavedMeal(body).catch(() => useToastStore.getState().error(t.savedFail));
  useToastStore.getState().success(t.logged(mealTypeLabelFor(d.type, getLocale())), body.calories ? `${body.calories} kcal` : undefined);
  return meal;
}

function FavoriteCheck({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const t = useText(COPY);
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-body-md">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5 shrink-0 cursor-pointer rounded accent-[rgb(var(--lq-primary))]" />
      {t.alsoSave}
    </label>
  );
}

function Actions({ onCancel, saving, label }: { onCancel: () => void; saving: boolean; label?: string }) {
  const t = useText(COPY);
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <Button variant="secondary" onClick={onCancel}>{t.cancel}</Button>
      <Button type="submit" loading={saving}>{label ?? t.save}</Button>
    </div>
  );
}

// ───────────────────────────── Analizar ─────────────────────────────

/**
 * "Analizar comida": describe el plato → /nutrition/ai-parse estima kcal y
 * macros → se revisan y se registran.
 * TODO(api): el prototipo analiza una foto; la API solo acepta texto.
 */
export function AnalyzeMealDialog({ open, onClose, date, initialType, onSaved }: {
  open: boolean;
  onClose: () => void;
  date: string;
  /** Momento que la persona tocó (hueco de la línea de tiempo) o null: entonces lo elige en el formulario. */
  initialType: FoodType | null;
  onSaved: (m: Meal) => void;
}) {
  const t = useText(COPY);
  const [text, setText] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [parsed, setParsed] = useState<ParsedMeal | null>(null);
  const [draft, setDraft] = useState<Draft>(blank(initialType));
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  // El análisis es IA: en NoutLife Lite se va directo al diálogo de Pro (la API también lo bloquea).
  const lite = useAuthStore((s) => s.user?.subscription?.plan === 'lite');
  useEffect(() => {
    if (!open || !lite) return;
    onClose();
    usePlanStore.getState().openUpgrade('ai');
  }, [open, lite, onClose]);
  const ingredientsRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setText(''); setIngredients(''); setParsed(null); setDraft(blank(initialType)); setTouched(false); setFavorite(false); setError(null);
  }, [open, initialType]);

  // Al cambiar de paso, el foco va al primer campo del paso nuevo.
  useEffect(() => {
    if (parsed?.needsIngredients) ingredientsRef.current?.focus();
    else if (parsed) nameRef.current?.focus();
  }, [parsed]);

  async function requestAnalysis(description: string) {
    setAnalyzing(true);
    setError(null);
    try {
      const r = await mealService.parseMeal(description);
      setParsed(r);
      const s = (n: number) => (r.aiSucceeded && r.recognized && n > 0 ? String(n) : '');
      setDraft((d) => ({ ...d, name: r.name || text.trim().slice(0, 80), calories: s(r.estimatedCalories), protein: s(r.estimatedProtein), carbs: s(r.estimatedCarbs), fat: s(r.estimatedFat) }));
      setTouched(false);
    } catch {
      setError(t.connectFail);
    } finally {
      setAnalyzing(false);
    }
  }

  async function analyze(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) { setTouched(true); return; }
    await requestAnalysis(text.trim());
  }

  async function retryWithIngredients() {
    if (!ingredients.trim()) { setError(t.ingredientsFirst); return; }
    await requestAnalysis(`${text.trim()}\nIngredientes indicados por el usuario: ${ingredients.trim()}`);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!draftValid(draft, true)) return;
    setSaving(true);
    try { onSaved(await logMeal(draft, date, favorite)); } catch { setError(t.saveFail); } finally { setSaving(false); }
  }

  const notice = parsed && (parsed.needsIngredients
    ? { tone: 'warning', icon: AlertTriangle, text: t.noticeNeeds }
    : parsed.aiSucceeded
      ? { tone: 'success', icon: Sparkles, text: t.noticeOk }
      : parsed.aiAvailable
        ? { tone: 'warning', icon: AlertTriangle, text: t.noticeNoMacros }
        : { tone: 'info', icon: Info, text: t.noticeNoAi });

  const locale = useLocale();
  const fmt = (n: number) => Math.round(n).toLocaleString(INTL_LOCALE[locale]);
  const served = Boolean(parsed && parsed.aiSucceeded && parsed.recognized && !parsed.needsIngredients && text.trim() && parsed.estimatedCalories > 0);

  return (
    <ResponsiveDialog open={open} onClose={onClose} title={t.analyzeTitle} className="md:max-w-[560px]">
      {/* Servicio del chef: la misma campana pasa de cubrir el plato (analizando) a levantarse (resultado) */}
      {(analyzing || served) && parsed?.aiSucceeded !== false && (
        <ChefService state={served ? 'served' : 'cooking'} className="-mt-1 mb-1">
          {served && parsed && (
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="max-w-full truncate px-4 text-heading-sm">{parsed.name || text.trim()}</p>
              <p className="font-mono text-display-sm tabular-nums">{fmt(parsed.estimatedCalories)}<span className="text-body-md text-on-surface-light"> kcal</span></p>
              <motion.ul variants={staggerVariants(0.12, 0.55)} initial="initial" animate="animate" className="flex flex-wrap justify-center gap-2" aria-label={t.estimatedMacros}>
                {macrosFor(locale).map(({ key, label, tone }) => {
                  const v = key === 'protein' ? parsed.estimatedProtein : key === 'carbs' ? parsed.estimatedCarbs : parsed.estimatedFat;
                  return (
                    <motion.li key={key} variants={enter.serve} className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 shadow-sm">
                      <span aria-hidden className={cn('size-2.5 rounded-full', solidBg[tone])} />
                      <span className="text-label-md text-on-surface-light">{label}</span>
                      <span className="font-mono text-label-lg tabular-nums">{fmt(v)} g</span>
                    </motion.li>
                  );
                })}
              </motion.ul>
            </div>
          )}
        </ChefService>
      )}
      {!parsed ? (
        <form className="flex flex-col gap-6" onSubmit={(e) => void analyze(e)} noValidate>
          <p className="text-body-md text-on-surface">{t.describe}</p>
          <Field label={t.whatAte} help={t.whatAteHelp} error={touched && !text.trim() ? t.whatAteErr : undefined}>
            <Textarea ref={textRef} data-autofocus rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={t.whatAtePh} />
          </Field>
          {analyzing && (
            <p role="status" className="sr-only">{t.analyzingSr}</p>
          )}
          {error && <p role="alert" className="text-body-sm text-error-text">{error}</p>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => { setParsed({ name: '', estimatedCalories: 0, estimatedProtein: 0, estimatedCarbs: 0, estimatedFat: 0, aiAvailable: true, aiSucceeded: false, recognized: true, needsIngredients: false }); setDraft((d) => ({ ...d, name: text.trim().slice(0, 80) })); }}>
              {t.logByHand}
            </Button>
            <Button type="submit" loading={analyzing}>{analyzing ? t.analyzing : <><Sparkles aria-hidden className="size-5" strokeWidth={1.75} />{t.analyze}</>}</Button>
          </div>
        </form>
      ) : parsed.needsIngredients ? (
        <form className="flex flex-col gap-6" onSubmit={(e) => { e.preventDefault(); void retryWithIngredients(); }} noValidate>
          {notice && text.trim() && (
            <div role="status" className="flex items-start gap-3 rounded-xl bg-warning/[var(--lq-soft-alpha)] p-3">
              <notice.icon aria-hidden className="mt-0.5 size-5 shrink-0 text-warning-text" strokeWidth={1.75} />
              <p className="text-body-md text-on-surface">{notice.text}</p>
            </div>
          )}
          <Field label={t.ingredientsQ} help={t.ingredientsHelp} error={error ?? undefined}>
            <Textarea ref={ingredientsRef} rows={3} value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder={t.ingredientsPh} />
          </Field>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => { setParsed(null); setTimeout(() => textRef.current?.focus()); }}>
              <ArrowLeft aria-hidden className="size-5" strokeWidth={1.75} />{t.back}
            </Button>
            <Button type="button" variant="secondary" onClick={() => {
              setParsed({ ...parsed, aiSucceeded: false, recognized: true, needsIngredients: false });
              setDraft((d) => ({ ...d, name: text.trim().slice(0, 80), calories: '', protein: '', carbs: '', fat: '' }));
              setError(null);
            }}>{t.skipEstimate}</Button>
            <Button type="submit" loading={analyzing} disabled={!ingredients.trim()}>{t.retryAnalysis}</Button>
          </div>
        </form>
      ) : (
        <form className="flex flex-col gap-6" onSubmit={(e) => void save(e)} noValidate>
          {notice && text.trim() && (
            <div role="status" className={cn('flex items-start gap-3 rounded-xl p-3', notice.tone === 'success' ? 'bg-success/[var(--lq-soft-alpha)]' : notice.tone === 'warning' ? 'bg-warning/[var(--lq-soft-alpha)]' : 'bg-info/[var(--lq-soft-alpha)]')}>
              <notice.icon aria-hidden className={cn('mt-0.5 size-5 shrink-0', notice.tone === 'success' ? 'text-success-text' : notice.tone === 'warning' ? 'text-warning-text' : 'text-info-text')} strokeWidth={1.75} />
              <p className="text-body-md text-on-surface">{notice.text}</p>
            </div>
          )}
          <MealFields draft={draft} set={(p) => setDraft((d) => ({ ...d, ...p }))} touched={touched} withType nameRef={nameRef} />
          <FavoriteCheck checked={favorite} onChange={setFavorite} />
          {error && <p role="alert" className="text-body-sm text-error-text">{error}</p>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" onClick={() => { setParsed(null); setTimeout(() => textRef.current?.focus()); }}>
              <ArrowLeft aria-hidden className="size-5" strokeWidth={1.75} />{t.describeOther}
            </Button>
            <Button type="submit" loading={saving}>{t.logMeal}</Button>
          </div>
        </form>
      )}
    </ResponsiveDialog>
  );
}

// ───────────────────────────── Manual / guardada ─────────────────────────────

/** `kind="log"` registra una comida del día; `kind="saved"` crea una comida guardada. */
export function MealFormDialog({ open, onClose, kind, date, initialType = null, onSaved }: {
  open: boolean;
  onClose: () => void;
  kind: 'log' | 'saved';
  date: string;
  /** Solo para `kind="log"`: el momento tocado o null (se elige en el formulario). */
  initialType?: FoodType | null;
  onSaved: (m: Meal | SavedMeal) => void;
}) {
  const t = useText(COPY);
  const locale = useLocale();
  const [draft, setDraft] = useState<Draft>(blank(initialType));
  const [touched, setTouched] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(blank(initialType)); setTouched(false); setFavorite(false); setError(null);
  }, [open, initialType]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!draftValid(draft, kind === 'log')) return;
    setSaving(true);
    setError(null);
    try {
      if (kind === 'log') onSaved(await logMeal(draft, date, favorite));
      else {
        const s = await mealService.createSavedMeal(draftBody(draft));
        useToastStore.getState().success(t.savedOk);
        onSaved(s);
      }
    } catch {
      setError(t.saveFail);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onClose={onClose} title={kind === 'log' ? t.logTitle(mealTypeLabelFor(initialType, locale).toLowerCase()) : t.newSaved} className="md:max-w-[560px]">
      <form className="flex flex-col gap-6" onSubmit={(e) => void submit(e)} noValidate>
        <MealFields draft={draft} set={(p) => setDraft((d) => ({ ...d, ...p }))} touched={touched} withType={kind === 'log'} />
        {kind === 'log' && <FavoriteCheck checked={favorite} onChange={setFavorite} />}
        {error && <p role="alert" className="text-body-sm text-error-text">{error}</p>}
        <Actions onCancel={onClose} saving={saving} />
      </form>
    </ResponsiveDialog>
  );
}

// ───────────────────────────── Metas ─────────────────────────────

export function GoalDialog({ open, onClose, goal, onSaved }: {
  open: boolean;
  onClose: () => void;
  goal: NutritionGoal | null;
  onSaved: (g: NutritionGoal) => void;
}) {
  const t = useText(COPY);
  const locale = useLocale();
  const fields = [
    { key: 'calories', label: t.calories, help: t.kcalPerDay },
    ...macrosFor(locale).map(({ key, label }) => ({ key, label, help: t.gramsPerDay })),
    { key: 'waterMl', label: t.water, help: t.mlPerDay },
  ] as const;
  type Key = (typeof fields)[number]['key'];
  const initial = () => Object.fromEntries(fields.map(({ key }) => [key, String(goal?.[key] || DEFAULT_GOAL[key])])) as Record<Key, string>;
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) { setForm(initial()); setError(null); } }, [open]);

  const bad = (k: Key) => !(Number(form[k]) > 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (fields.some(({ key }) => bad(key))) { setError(t.goalsPositive); return; }
    setSaving(true);
    try {
      const g = await mealService.saveNutritionGoal({
        calories: Math.round(Number(form.calories)), protein: Number(form.protein), carbs: Number(form.carbs), fat: Number(form.fat), waterMl: Math.round(Number(form.waterMl)),
      });
      useToastStore.getState().success(t.goalsUpdated);
      onSaved(g);
    } catch {
      setError(t.goalsFail);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onClose={onClose} title={t.dailyGoals} className="md:max-w-[520px]">
      <form className="flex flex-col gap-6" onSubmit={(e) => void submit(e)} noValidate>
        <div className="grid grid-cols-2 gap-4">
          {fields.map(({ key, label, help }, i) => (
            <Field key={key} label={label} help={help} error={bad(key) ? t.mustBePositive : undefined} className={cn(i === 0 && 'col-span-2')}>
              <Input data-autofocus={i === 0 || undefined} type="number" inputMode="numeric" min="1" value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} className="font-mono tabular-nums" />
            </Field>
          ))}
        </div>
        {error && <p role="alert" className="text-body-sm text-error-text">{error}</p>}
        <Actions onCancel={onClose} saving={saving} label={t.saveGoals} />
      </form>
    </ResponsiveDialog>
  );
}
