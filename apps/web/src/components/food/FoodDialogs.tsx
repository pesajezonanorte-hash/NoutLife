// Diálogos de Comida (sin prototipo propio: formularios del sistema).
// AnalyzeMealDialog = CTA "Analizar comida" del prototipo, MealFormDialog =
// registro manual, comida guardada o metas. Al analizar, el servicio del chef:
// la campana cubre el plato mientras se estima y se levanta para revelarlo.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import type { Meal } from '@lifequest/shared';
import { AlertTriangle, ArrowLeft, Info, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { enter, staggerVariants } from '@/lib/motion';
import { Button, Field, Input, ResponsiveDialog, Textarea } from '@/components/ui/lq';
import { useToastStore } from '@/hooks/useToast';
import * as mealService from '@/services/meal.service';
import type { NutritionGoal, ParsedMeal, SavedMeal } from '@/services/meal.service';
import { DEFAULT_GOAL, MACROS, MEAL_TYPES, mealTypeLabel, type FoodType } from './foodMeta';
import { ChefService } from './Restaurant';
import { solidBg } from '@/components/ui/lq/tones';

type Draft = { name: string; type: FoodType; calories: string; protein: string; carbs: string; fat: string };
const blank = (type: FoodType): Draft => ({ name: '', type, calories: '', protein: '', carbs: '', fat: '' });
const num = (v: string) => (v.trim() === '' ? undefined : Math.max(0, Number(v.replace(',', '.'))));
const invalidNum = (v: string) => v.trim() !== '' && !(Number(v.replace(',', '.')) >= 0);

function TypePicker({ value, onChange }: { value: FoodType; onChange: (t: FoodType) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-label-lg text-on-surface">Momento del día</legend>
      <div role="radiogroup" aria-label="Momento del día" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MEAL_TYPES.map(({ value: v, label, icon: Icon }) => {
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
    </fieldset>
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
  return (
    <>
      <Field label="Nombre" error={touched && !draft.name.trim() ? 'Escribe qué comiste' : undefined}>
        <Input ref={nameRef} data-autofocus value={draft.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} placeholder="Ej. Pollo con arroz y ensalada" />
      </Field>
      {withType && <TypePicker value={draft.type} onChange={(type) => set({ type })} />}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Calorías" help="kcal" error={touched && invalidNum(draft.calories) ? 'Número no válido' : undefined}>
          <Input type="number" inputMode="numeric" min="0" value={draft.calories} onChange={(e) => set({ calories: e.target.value })} placeholder="0" className="font-mono tabular-nums" />
        </Field>
        {MACROS.map(({ key, label }) => (
          <Field key={key} label={label} help="gramos" error={touched && invalidNum(draft[key]) ? 'Número no válido' : undefined}>
            <Input type="number" inputMode="decimal" min="0" step="any" value={draft[key]} onChange={(e) => set({ [key]: e.target.value })} placeholder="0" className="font-mono tabular-nums" />
          </Field>
        ))}
      </div>
    </>
  );
}

const draftValid = (d: Draft) => d.name.trim() !== '' && !(['calories', 'protein', 'carbs', 'fat'] as const).some((k) => invalidNum(d[k]));
const draftBody = (d: Draft) => ({ name: d.name.trim(), calories: num(d.calories), protein: num(d.protein), carbs: num(d.carbs), fat: num(d.fat) });

async function logMeal(d: Draft, date: string, favorite: boolean): Promise<Meal> {
  const body = draftBody(d);
  const meal = await mealService.createMeal({ ...body, mealType: d.type, date });
  if (favorite) await mealService.createSavedMeal(body).catch(() => useToastStore.getState().error('No se pudo guardar en Guardadas'));
  useToastStore.getState().success(`${mealTypeLabel(d.type)} registrado`, body.calories ? `${body.calories} kcal` : undefined);
  return meal;
}

function FavoriteCheck({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-body-md">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5 shrink-0 cursor-pointer rounded accent-[rgb(var(--lq-primary))]" />
      Guardar también en Guardadas para repetirla
    </label>
  );
}

function Actions({ onCancel, saving, label = 'Guardar' }: { onCancel: () => void; saving: boolean; label?: string }) {
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
      <Button type="submit" loading={saving}>{label}</Button>
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
  initialType: FoodType;
  onSaved: (m: Meal) => void;
}) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedMeal | null>(null);
  const [draft, setDraft] = useState<Draft>(blank(initialType));
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setText(''); setParsed(null); setDraft(blank(initialType)); setTouched(false); setFavorite(false); setError(null);
  }, [open, initialType]);

  // Al cambiar de paso, el foco va al primer campo del paso nuevo.
  useEffect(() => { if (parsed) nameRef.current?.focus(); }, [parsed]);

  async function analyze(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) { setTouched(true); return; }
    setAnalyzing(true);
    setError(null);
    try {
      const r = await mealService.parseMeal(text.trim());
      setParsed(r);
      const s = (n: number) => (r.aiSucceeded && n > 0 ? String(n) : '');
      setDraft((d) => ({ ...d, name: r.name || text.trim().slice(0, 80), calories: s(r.estimatedCalories), protein: s(r.estimatedProtein), carbs: s(r.estimatedCarbs), fat: s(r.estimatedFat) }));
      setTouched(false);
    } catch {
      setError('No pudimos conectar con el análisis. Inténtalo de nuevo o regístrala a mano.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!draftValid(draft)) return;
    setSaving(true);
    try { onSaved(await logMeal(draft, date, favorite)); } catch { setError('No se pudo guardar. Inténtalo de nuevo.'); } finally { setSaving(false); }
  }

  const notice = parsed && (parsed.aiSucceeded
    ? { tone: 'success', icon: Sparkles, text: 'Estimación lista. Revisa y ajusta antes de guardar.' }
    : parsed.aiAvailable
      ? { tone: 'warning', icon: AlertTriangle, text: 'No pudimos estimar los macros de esta descripción. Complétalos a mano o déjalos vacíos.' }
      : { tone: 'info', icon: Info, text: 'El análisis automático no está disponible ahora. Completa los datos a mano.' });

  const fmt = (n: number) => Math.round(n).toLocaleString('es-CO');
  const served = Boolean(parsed && parsed.aiSucceeded && text.trim() && parsed.estimatedCalories > 0);

  return (
    <ResponsiveDialog open={open} onClose={onClose} title="Analizar comida" className="md:max-w-[560px]">
      {/* Servicio del chef: la misma campana pasa de cubrir el plato (analizando) a levantarse (resultado) */}
      {(analyzing || served) && parsed?.aiSucceeded !== false && (
        <ChefService state={served ? 'served' : 'cooking'} className="-mt-1 mb-1">
          {served && parsed && (
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="max-w-full truncate px-4 text-heading-sm">{parsed.name || text.trim()}</p>
              <p className="font-mono text-display-sm tabular-nums">{fmt(parsed.estimatedCalories)}<span className="text-body-md text-on-surface-light"> kcal</span></p>
              <motion.ul variants={staggerVariants(0.12, 0.55)} initial="initial" animate="animate" className="flex flex-wrap justify-center gap-2" aria-label="Macros estimados">
                {MACROS.map(({ key, label, tone }) => {
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
          <p className="text-body-md text-on-surface">Describe lo que comiste y estimaremos las calorías y los macros por ti.</p>
          <Field label="¿Qué comiste?" help="Incluye cantidades si las sabes" error={touched && !text.trim() ? 'Describe tu comida para analizarla' : undefined}>
            <Textarea ref={textRef} data-autofocus rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ej. Un plato de arroz con pollo, ensalada y un jugo de mango" />
          </Field>
          {analyzing && (
            <p role="status" className="sr-only">Analizando tu plato…</p>
          )}
          {error && <p role="alert" className="text-body-sm text-error-text">{error}</p>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => { setParsed({ name: '', estimatedCalories: 0, estimatedProtein: 0, estimatedCarbs: 0, estimatedFat: 0, aiAvailable: true, aiSucceeded: true }); setDraft((d) => ({ ...d, name: text.trim().slice(0, 80) })); }}>
              Registrar a mano
            </Button>
            <Button type="submit" loading={analyzing}>{analyzing ? 'Analizando…' : <><Sparkles aria-hidden className="size-5" strokeWidth={1.75} />Analizar</>}</Button>
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
              <ArrowLeft aria-hidden className="size-5" strokeWidth={1.75} />Describir otra
            </Button>
            <Button type="submit" loading={saving}>Registrar comida</Button>
          </div>
        </form>
      )}
    </ResponsiveDialog>
  );
}

// ───────────────────────────── Manual / guardada ─────────────────────────────

/** `kind="log"` registra una comida del día; `kind="saved"` crea una comida guardada. */
export function MealFormDialog({ open, onClose, kind, date, initialType, onSaved }: {
  open: boolean;
  onClose: () => void;
  kind: 'log' | 'saved';
  date: string;
  initialType: FoodType;
  onSaved: (m: Meal | SavedMeal) => void;
}) {
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
    if (!draftValid(draft)) return;
    setSaving(true);
    setError(null);
    try {
      if (kind === 'log') onSaved(await logMeal(draft, date, favorite));
      else {
        const s = await mealService.createSavedMeal(draftBody(draft));
        useToastStore.getState().success('Comida guardada');
        onSaved(s);
      }
    } catch {
      setError('No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onClose={onClose} title={kind === 'log' ? `Registrar ${mealTypeLabel(initialType).toLowerCase()}` : 'Nueva comida guardada'} className="md:max-w-[560px]">
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
  const fields = [
    { key: 'calories', label: 'Calorías', help: 'kcal al día' },
    ...MACROS.map(({ key, label }) => ({ key, label, help: 'gramos al día' })),
    { key: 'waterMl', label: 'Agua', help: 'ml al día' },
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
    if (fields.some(({ key }) => bad(key))) { setError('Todas las metas deben ser mayores que 0.'); return; }
    setSaving(true);
    try {
      const g = await mealService.saveNutritionGoal({
        calories: Math.round(Number(form.calories)), protein: Number(form.protein), carbs: Number(form.carbs), fat: Number(form.fat), waterMl: Math.round(Number(form.waterMl)),
      });
      useToastStore.getState().success('Metas actualizadas');
      onSaved(g);
    } catch {
      setError('No se pudieron guardar tus metas.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onClose={onClose} title="Metas diarias" className="md:max-w-[520px]">
      <form className="flex flex-col gap-6" onSubmit={(e) => void submit(e)} noValidate>
        <div className="grid grid-cols-2 gap-4">
          {fields.map(({ key, label, help }, i) => (
            <Field key={key} label={label} help={help} error={bad(key) ? 'Debe ser mayor que 0' : undefined} className={cn(i === 0 && 'col-span-2')}>
              <Input data-autofocus={i === 0 || undefined} type="number" inputMode="numeric" min="1" value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} className="font-mono tabular-nums" />
            </Field>
          ))}
        </div>
        {error && <p role="alert" className="text-body-sm text-error-text">{error}</p>}
        <Actions onCancel={onClose} saving={saving} label="Guardar metas" />
      </form>
    </ResponsiveDialog>
  );
}
