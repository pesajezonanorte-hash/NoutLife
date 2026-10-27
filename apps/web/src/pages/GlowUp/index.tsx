// Espejo (con el armario dentro) — GlowUpDesktop.dc.html. "Brillo de hoy" (anillo), SegmentedControl
// Cuidado / Prendas / Presencia, rutinas con pasos que se marcan, prendas con
// filtros y autoevaluación semanal. Datos: /mirror/* (sin cambios).
// Zona ambientada: tu espejo y tocador. El reflejo se desempaña despacio; un brillo
// lo cruza muy lento y su resplandor sube de forma gradual con cada paso hecho.
// Las secciones se funden entre sí; todo con física suave (gentle).
import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Check, Droplets, Flame, Moon, Plus, Shirt, Sparkles, Star, Sun, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { blurFrom, blurTo, item, springs, stagger, useMotionReduced } from '@/lib/motion';
import { AmbientLight, ZoneShell } from '@/components/ambience';
import { Mirror } from '@/components/glowup/Mirror';
import { useToastStore } from '../../hooks/useToast';
import api from '../../lib/api';
import { Badge, Button, Card, ChipGroup, EmptyState, ErrorState, Field, IconChip, Input, Modal, ProgressBar, Select, SegmentedControl, StepItem, Textarea, type Tone, PageLoader } from '@/components/ui/lq';
import { LOADING_COPY } from '@/lib/loadingCopy';
import { Lettering } from '@/components/layout/Lettering';
import { PrivatePhotoNotice } from '@/components/privacy/PrivatePhotoNotice';
import { PhotoSourceButtons } from '@/components/media/PhotoSourceButtons';
import { compressImageToBase64 } from '@/lib/imageCompress';
import { INTL_LOCALE, useLocale, useText, type Copy } from '@/lib/i18n';

const es = {
  tabs: { style: 'Armario', care: 'Cuidado personal', presence: 'Presencia' } as Record<string, string>,
  area: 'Área',
  categories: { tops: 'Torso', bottoms: 'Piernas', shoes: 'Calzado', outerwear: 'Abrigos', accessories: 'Accesorios' } as Record<string, string>,
  times: { morning: 'Mañana', night: 'Noche', weekly: 'Semanal', custom: 'Personalizada' } as Record<string, string>,
  dayWord: (n: number): string => (n === 1 ? 'día' : 'días'),
  routinesLoadFail: 'Error cargando rutinas',
  alreadyDone: '¡Ya completaste esta rutina hoy!',
  routineDone: '¡Rutina completada! +20 XP',
  completeFail: 'No se pudo completar la rutina',
  routineCreated: 'Rutina creada',
  routineCreateFail: 'No se pudo crear la rutina',
  careTitle: 'Tus rutinas de cuidado',
  tapStep: 'Toca un paso para marcarlo',
  newRoutine: 'Nueva rutina',
  loadingRoutines: 'Preparando tus rituales…',
  routinesFail: 'No pudimos cargar tus rutinas',
  noRoutines: 'Sin rutinas aún',
  noRoutinesDesc: 'Crea tu primera rutina de cuidado y marca sus pasos cada día.',
  alsoHabits: '· También en Hábitos',
  progressOf: (name: string): string => `Progreso de ${name}`,
  doneToday: 'Completada hoy',
  markRoutine: 'Marcar rutina completa',
  routineModal: 'Nueva rutina',
  routineName: 'Nombre de la rutina',
  routineNamePh: 'Rutina de mañana',
  moment: 'Momento',
  steps: 'Pasos',
  stepAria: (i: number): string => `Paso ${i}`,
  stepPh: (i: number): string => `Paso ${i}…`,
  addStep: 'Agregar paso',
  cancel: 'Cancelar',
  create: 'Crear',
  photoReady: 'Foto lista',
  photoReadyBody: 'Se guardará de forma privada en tu armario.',
  photoFail: 'No se pudo usar esa foto',
  itemsUpdateFail: 'No se pudo actualizar tus prendas',
  itemAdded: 'Prenda añadida',
  itemAddFail: 'No se pudo añadir la prenda',
  outfitDefault: (n: number): string => `Combinación ${n}`,
  outfitSaved: 'Combinación guardada',
  outfitFail: 'No se pudo guardar la combinación',
  outfitDeleted: 'Combinación eliminada',
  outfitDeleteFail: 'No se pudo eliminar la combinación',
  useFail: 'No se pudo registrar el uso',
  itemDeleteFail: 'No se pudo eliminar la prenda',
  itemsTitle: 'Prendas',
  outfitBtn: (n: number): string => `Combinación (${n})`,
  item: 'Prenda',
  itemCategoryAria: 'Categoría de prenda',
  all: 'Todas',
  loadingWardrobe: 'Abriendo tu armario…',
  wardrobeFail: 'No pudimos cargar tus prendas',
  emptyWardrobe: 'Tu armario está vacío',
  emptyWardrobeDesc: 'Añade tus prendas para saber cuánto uso le das a cada una.',
  addItem: 'Añadir prenda',
  photoAlt: (name: string): string => `Foto de la prenda ${name}`,
  deleteAria: (name: string): string => `Eliminar ${name}`,
  use: 'uso',
  uses: 'usos',
  favorite: 'Favorita',
  inOutfit: 'En combinación',
  addToOutfit: 'Añadir a combinación',
  wearToday: 'Usar hoy',
  savedOutfits: 'Combinaciones guardadas',
  outfit: 'Combinación',
  deleteOutfitAria: (name: string): string => `Eliminar ${name}`,
  newItem: 'Nueva prenda',
  name: 'Nombre',
  namePh: 'Camiseta azul',
  category: 'Categoría',
  previewAlt: 'Vista previa de la prenda',
  anotherPhoto: 'Otra foto',
  snapItem: 'Fotografiar prenda',
  removePhoto: 'Quitar foto',
  brand: 'Marca',
  brandPh: 'Zara, Nike…',
  color: 'Color',
  colorPh: 'Azul marino',
  add: 'Añadir',
  saveOutfit: 'Guardar combinación',
  selectedItems: 'Prendas seleccionadas: ',
  lookName: 'Nombre del look',
  lookHelp: 'Opcional; puedes poner una ocasión o estilo',
  lookPh: 'Casual de fin de semana',
  saveLook: 'Guardar look',
  areas: { posture: 'Postura', voice: 'Voz', confidence: 'Confianza', communication: 'Comunicación' } as Record<string, string>,
  outOf5: (v: number): string => `${v} de 5`,
  checkinSaved: 'Autoevaluación guardada',
  checkinFail: 'No se pudo guardar la evaluación',
  loadingEvolution: 'Cargando tu evolución…',
  evolutionFail: 'No pudimos cargar tu evolución',
  noCheckins: 'Tu presencia empieza aquí',
  noCheckinsDesc: 'Guarda tu primera autoevaluación para ver cómo evolucionas semana a semana.',
  weeklyCheck: 'Autoevaluación semanal',
  weekNotes: 'Notas de la semana',
  weekNotesPh: 'Qué te funcionó esta semana…',
  saveCheck: 'Guardar evaluación',
  evolution: 'Evolución',
  personalSpace: 'Tu espacio personal',
  mirror: 'Espejo',
  mirrorDesc: 'Fotografía y clasifica tus prendas, crea combinaciones y acompaña tu estilo con rutinas de cuidado personal.',
  glowToday: 'Brillo de hoy',
  stepsOf: (done: number, total: number): string => `${done} de ${total} pasos`,
  streakDays: (n: number): string => `${n === 1 ? 'día' : 'días'} de racha`,
};

const en: typeof es = {
  tabs: { style: 'Wardrobe', care: 'Personal care', presence: 'Presence' } as Record<string, string>,
  area: 'Area',
  categories: { tops: 'Tops', bottoms: 'Bottoms', shoes: 'Shoes', outerwear: 'Outerwear', accessories: 'Accessories' } as Record<string, string>,
  times: { morning: 'Morning', night: 'Night', weekly: 'Weekly', custom: 'Custom' } as Record<string, string>,
  dayWord: (n: number): string => (n === 1 ? 'day' : 'days'),
  routinesLoadFail: 'Could not load routines',
  alreadyDone: 'You already completed this routine today!',
  routineDone: 'Routine completed! +20 XP',
  completeFail: 'Could not complete the routine',
  routineCreated: 'Routine created',
  routineCreateFail: 'Could not create the routine',
  careTitle: 'Your care routines',
  tapStep: 'Tap a step to mark it',
  newRoutine: 'New routine',
  loadingRoutines: 'Preparing your rituals…',
  routinesFail: 'We could not load your routines',
  noRoutines: 'No routines yet',
  noRoutinesDesc: 'Create your first care routine and mark its steps every day.',
  alsoHabits: '· Also in Habits',
  progressOf: (name: string): string => `Progress of ${name}`,
  doneToday: 'Done today',
  markRoutine: 'Mark routine complete',
  routineModal: 'New routine',
  routineName: 'Routine name',
  routineNamePh: 'Morning routine',
  moment: 'Time of day',
  steps: 'Steps',
  stepAria: (i: number): string => `Step ${i}`,
  stepPh: (i: number): string => `Step ${i}…`,
  addStep: 'Add step',
  cancel: 'Cancel',
  create: 'Create',
  photoReady: 'Photo ready',
  photoReadyBody: 'It will be saved privately in your wardrobe.',
  photoFail: 'Could not use that photo',
  itemsUpdateFail: 'Could not update your items',
  itemAdded: 'Item added',
  itemAddFail: 'Could not add the item',
  outfitDefault: (n: number): string => `Outfit ${n}`,
  outfitSaved: 'Outfit saved',
  outfitFail: 'Could not save the outfit',
  outfitDeleted: 'Outfit deleted',
  outfitDeleteFail: 'Could not delete the outfit',
  useFail: 'Could not record the use',
  itemDeleteFail: 'Could not delete the item',
  itemsTitle: 'Items',
  outfitBtn: (n: number): string => `Outfit (${n})`,
  item: 'Item',
  itemCategoryAria: 'Item category',
  all: 'All',
  loadingWardrobe: 'Opening your wardrobe…',
  wardrobeFail: 'We could not load your items',
  emptyWardrobe: 'Your wardrobe is empty',
  emptyWardrobeDesc: 'Add your items to see how often you wear each one.',
  addItem: 'Add item',
  photoAlt: (name: string): string => `Photo of ${name}`,
  deleteAria: (name: string): string => `Delete ${name}`,
  use: 'use',
  uses: 'uses',
  favorite: 'Favorite',
  inOutfit: 'In outfit',
  addToOutfit: 'Add to outfit',
  wearToday: 'Wear today',
  savedOutfits: 'Saved outfits',
  outfit: 'Outfit',
  deleteOutfitAria: (name: string): string => `Delete ${name}`,
  newItem: 'New item',
  name: 'Name',
  namePh: 'Blue t-shirt',
  category: 'Category',
  previewAlt: 'Item preview',
  anotherPhoto: 'Another photo',
  snapItem: 'Photograph item',
  removePhoto: 'Remove photo',
  brand: 'Brand',
  brandPh: 'Zara, Nike…',
  color: 'Color',
  colorPh: 'Navy blue',
  add: 'Add',
  saveOutfit: 'Save outfit',
  selectedItems: 'Selected items: ',
  lookName: 'Look name',
  lookHelp: 'Optional; you can add an occasion or style',
  lookPh: 'Weekend casual',
  saveLook: 'Save look',
  areas: { posture: 'Posture', voice: 'Voice', confidence: 'Confidence', communication: 'Communication' } as Record<string, string>,
  outOf5: (v: number): string => `${v} of 5`,
  checkinSaved: 'Self-check saved',
  checkinFail: 'Could not save the check',
  loadingEvolution: 'Loading your progress…',
  evolutionFail: 'We could not load your progress',
  noCheckins: 'Your presence starts here',
  noCheckinsDesc: 'Save your first self-check to see how you grow week by week.',
  weeklyCheck: 'Weekly self-check',
  weekNotes: 'Notes for the week',
  weekNotesPh: 'What worked for you this week…',
  saveCheck: 'Save check',
  evolution: 'Progress',
  personalSpace: 'Your personal space',
  mirror: 'Mirror',
  mirrorDesc: 'Photograph and sort your items, build outfits and support your style with personal care routines.',
  glowToday: "Today's glow",
  stepsOf: (done: number, total: number): string => `${done} of ${total} steps`,
  streakDays: (n: number): string => `${n === 1 ? 'day' : 'days'} streak`,
};

const COPY: Copy<typeof es> = { es, en };

interface CareRoutine {
  id: string; name: string; timeOfDay: string;
  currentStreak: number; longestStreak: number; lastDoneAt?: string;
  steps: { id: string; name: string; product?: string; order: number }[];
  /** Hábito enlazado en la Libreta (Higiene Personal), si lo hay. */
  habit?: { id: string } | null;
}

interface ClothingItem {
  id: string; name: string; category: string; color?: string | null; photoData?: string | null;
  brand?: string | null; timesWorn: number; isFavorite: boolean;
}
interface ClothingOutfit {
  id: string; name?: string | null; occasion?: string | null;
  items: Array<{ clothingItem: ClothingItem }>;
}

interface PresenceCheckin {
  id: string; week: string;
  posture: number; voice: number; confidence: number; communication: number;
}

type Tab = 'care' | 'style' | 'presence';
const TAB_IDS: Tab[] = ['style', 'care', 'presence'];

const CATEGORIES = ['tops', 'bottoms', 'shoes', 'outerwear', 'accessories'];
const TIME_OF_DAY = ['morning', 'night', 'weekly', 'custom'];
const TIME_META: Record<string, { tone: Tone; icon: typeof Sun }> = {
  morning: { tone: 'warning', icon: Sun },
  night: { tone: 'forest', icon: Moon },
  weekly: { tone: 'info', icon: Droplets },
  custom: { tone: 'primary', icon: Sparkles },
};

const todayKey = () => new Date().toISOString().slice(0, 10);
const isToday = (iso?: string) => !!iso && new Date(iso).toDateString() === new Date().toDateString();

// TODO(api): no hay endpoint para marcar pasos sueltos; se guardan en el dispositivo
// por día y, al completar todos, se llama a /mirror/routines/:id/complete.
const STEPS_KEY = 'lq-glow-steps';
function readSteps(): Record<string, boolean> {
  try {
    const raw = JSON.parse(localStorage.getItem(STEPS_KEY) ?? '{}');
    return raw.day === todayKey() ? raw.done ?? {} : {};
  } catch { return {}; }
}
function writeSteps(done: Record<string, boolean>) {
  try { localStorage.setItem(STEPS_KEY, JSON.stringify({ day: todayKey(), done })); } catch { /* sin storage */ }
}

// ─── Care Section ────────────────────────────────────────────────────────────

interface CareProps { onProgress: (done: number, total: number, streak: number) => void }

function CareSection({ onProgress }: CareProps) {
  const t = useText(COPY);
  const toast = useToastStore();
  const [routines, setRoutines] = useState<CareRoutine[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', timeOfDay: 'morning', steps: [''] });
  const [completing, setCompleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ticks, setTicks] = useState<Record<string, boolean>>(readSteps);

  const load = useCallback(async (silent = false) => {
    if (!silent) setState('loading');
    try {
      const { data } = await api.get('/mirror/routines');
      setRoutines(data);
      setState('ready');
    } catch {
      if (!silent) setState('error');
      else toast.error(t.routinesLoadFail);
    }
  }, [toast, t]);

  useEffect(() => { void load(); }, [load]);
  // Los hábitos de Higiene Personal pueden marcar estas rutinas: al volver a la pestaña se relee.
  useEffect(() => {
    const onFocus = () => { void load(true); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const doneOf = useCallback((r: CareRoutine) => (
    isToday(r.lastDoneAt) ? r.steps.length : r.steps.filter((s) => ticks[`${r.id}:${s.id}`]).length
  ), [ticks]);

  useEffect(() => {
    const total = routines.reduce((a, r) => a + r.steps.length, 0);
    const done = routines.reduce((a, r) => a + doneOf(r), 0);
    onProgress(done, total, Math.max(0, ...routines.map((r) => r.currentStreak)));
  }, [routines, doneOf, onProgress]);

  async function handleComplete(id: string) {
    setCompleting(id);
    try {
      const { data } = await api.post(`/mirror/routines/${id}/complete`);
      if (data.alreadyDone) toast.info(t.alreadyDone);
      else { toast.success(t.routineDone); void load(true); }
    } catch { toast.error(t.completeFail); }
    finally { setCompleting(null); }
  }

  function toggleStep(r: CareRoutine, stepId: string) {
    if (isToday(r.lastDoneAt)) return;
    const key = `${r.id}:${stepId}`;
    const next = { ...ticks, [key]: !ticks[key] };
    setTicks(next);
    writeSteps(next);
    if (r.steps.every((s) => next[`${r.id}:${s.id}`])) void handleComplete(r.id);
  }

  async function handleCreate() {
    setSaving(true);
    try {
      await api.post('/mirror/routines', {
        name: form.name,
        timeOfDay: form.timeOfDay,
        steps: form.steps.filter(Boolean).map((s, i) => ({ name: s, order: i })),
      });
      setShowNew(false);
      setForm({ name: '', timeOfDay: 'morning', steps: [''] });
      void load(true);
      toast.success(t.routineCreated);
    } catch { toast.error(t.routineCreateFail); }
    finally { setSaving(false); }
  }

  return (
    <section className="flex flex-col gap-6" aria-labelledby="glow-care">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="glow-care" className="text-heading-lg">{t.careTitle}</h2>
        <div className="flex items-center gap-3">
          <span className="hidden text-body-sm text-on-surface-light sm:inline">{t.tapStep}</span>
          <Button size="md" onClick={() => setShowNew(true)}><Plus aria-hidden className="size-4" />{t.newRoutine}</Button>
        </div>
      </div>

      {state === 'loading' ? (
        <PageLoader label={t.loadingRoutines} words={LOADING_COPY.glowUpRoutines} />
      ) : state === 'error' ? (
        <ErrorState title={t.routinesFail} onRetry={() => void load()} />
      ) : routines.length === 0 ? (
        <Card variant="elevated" padding="lg">
          <EmptyState icon={Droplets} tone="forest" title={t.noRoutines} description={t.noRoutinesDesc}
            action={<Button onClick={() => setShowNew(true)}><Plus aria-hidden className="size-4" />{t.newRoutine}</Button>} className="py-6" />
        </Card>
      ) : (
        <motion.ul variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {routines.map((r) => {
            const meta = TIME_META[r.timeOfDay] ?? TIME_META.custom;
            const n = doneOf(r);
            const full = r.steps.length > 0 && n === r.steps.length;
            const pct = r.steps.length ? Math.round((n / r.steps.length) * 100) : isToday(r.lastDoneAt) ? 100 : 0;
            return (
              <motion.li key={r.id} variants={item}>
                <Card as="article" padding="lg" interactive aria-labelledby={`r-${r.id}`} className="lq-marble lq-tray flex h-full flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <IconChip icon={meta.icon} tone={meta.tone} />
                    <div className="min-w-0 flex-1">
                      <h3 id={`r-${r.id}`} className="truncate text-heading-sm">{r.name}</h3>
                      <p className="text-body-sm text-on-surface-light">
                        {t.times[r.timeOfDay] ?? t.times.custom}
                        {r.currentStreak > 0 && <span className="ml-2 inline-flex items-center gap-1 text-warning-text"><Flame aria-hidden className="size-3.5" /><span className="font-mono tabular-nums">{r.currentStreak}</span> {t.dayWord(r.currentStreak)}</span>}
                        {r.habit && <span className="ml-2 text-body-sm text-on-surface-light">{t.alsoHabits}</span>}
                      </p>
                    </div>
                    {r.steps.length > 0 && <Badge variant={full ? 'success' : 'neutral'} icon={full ? Check : undefined}><span className="font-mono tabular-nums">{n}/{r.steps.length}</span></Badge>}
                  </div>
                  <ProgressBar value={pct} tone={full ? 'success' : 'primary'} label={t.progressOf(r.name)} />
                  {r.steps.length > 0 && (
                    <div className="flex flex-col">
                      {[...r.steps].sort((a, b) => a.order - b.order).map((s) => (
                        <StepItem key={s.id} checked={isToday(r.lastDoneAt) || !!ticks[`${r.id}:${s.id}`]} onToggle={() => toggleStep(r, s.id)} disabled={completing === r.id || isToday(r.lastDoneAt)} meta={s.product}>
                          {s.name}
                        </StepItem>
                      ))}
                    </div>
                  )}
                  <div className="mt-auto pt-2">
                    {isToday(r.lastDoneAt) ? (
                      <Badge variant="success" size="lg" icon={Check}>{t.doneToday}</Badge>
                    ) : (
                      <Button variant="secondary" size="md" block loading={completing === r.id} onClick={() => void handleComplete(r.id)}>
                        <Check aria-hidden className="size-4" />{t.markRoutine}
                      </Button>
                    )}
                  </div>
                </Card>
              </motion.li>
            );
          })}
        </motion.ul>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title={t.routineModal}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void handleCreate(); }}>
          <Field label={t.routineName}><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t.routineNamePh} autoFocus /></Field>
          <Field label={t.moment}>
            <Select value={form.timeOfDay} onChange={(e) => setForm((f) => ({ ...f, timeOfDay: e.target.value }))}>
              {TIME_OF_DAY.map((k) => <option key={k} value={k}>{t.times[k]}</option>)}
            </Select>
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-label-lg text-on-surface">{t.steps}</legend>
            {form.steps.map((s, i) => (
              <Input key={i} aria-label={t.stepAria(i + 1)} placeholder={t.stepPh(i + 1)} value={s}
                onChange={(e) => setForm((f) => { const steps = [...f.steps]; steps[i] = e.target.value; return { ...f, steps }; })} />
            ))}
            <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setForm((f) => ({ ...f, steps: [...f.steps, ''] }))}><Plus aria-hidden className="size-4" />{t.addStep}</Button>
          </fieldset>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowNew(false)}>{t.cancel}</Button>
            <Button type="submit" className="flex-1" disabled={!form.name.trim()} loading={saving}>{t.create}</Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

// ─── Style Section ────────────────────────────────────────────────────────────

function StyleSection({ autoOpenAdd, onAddOpened }: { autoOpenAdd?: boolean; onAddOpened?: () => void }) {
  const t = useText(COPY);
  const toast = useToastStore();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [outfits, setOutfits] = useState<ClothingOutfit[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [showOutfit, setShowOutfit] = useState(false);
  const [outfitName, setOutfitName] = useState('');
  const [savingOutfit, setSavingOutfit] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'tops', color: '', brand: '', photoData: '' });

  // Llegar con ?add=prenda (desde Finanzas → «Ir al Espejo») abre directamente
  // el formulario de nueva prenda, para registrar la compra recién hecha.
  useEffect(() => {
    if (!autoOpenAdd) return;
    setShowNew(true);
    onAddOpened?.();
    // Solo al montar: el alta se ofrece una vez por navegación.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setState('loading');
    try {
      const [{ data: wardrobe }, { data: savedOutfits }] = await Promise.all([
        api.get('/mirror/wardrobe'),
        api.get('/mirror/outfits'),
      ]);
      setItems(wardrobe);
      setOutfits(savedOutfits);
      setState('ready');
    } catch {
      if (!silent) setState('error');
      else toast.error(t.itemsUpdateFail);
    }
  }, [toast, t]);

  useEffect(() => { void load(); }, [load]);

  const displayed = activeCategory === 'all' ? items : items.filter((i) => i.category === activeCategory);
  const options = useMemo(() => [
    { value: 'all', label: t.all, count: items.length },
    ...CATEGORIES.map((c) => ({ value: c, label: t.categories[c], count: items.filter((i) => i.category === c).length })),
  ], [items, t]);

  async function handlePhotoChange(file?: File) {
    if (!file) return;
    setPhotoProcessing(true);
    try {
      const photoData = await compressImageToBase64(file);
      setForm((current) => ({ ...current, photoData }));
      toast.success(t.photoReady, t.photoReadyBody);
    } catch (error) {
      toast.error(t.photoFail, error instanceof Error ? error.message : undefined);
    } finally {
      setPhotoProcessing(false);
    }
  }

  async function handleCreate() {
    setSaving(true);
    try {
      await api.post('/mirror/wardrobe', { ...form, photoData: form.photoData || undefined });
      setShowNew(false);
      setForm({ name: '', category: 'tops', color: '', brand: '', photoData: '' });
      void load(true);
      toast.success(t.itemAdded);
    } catch { toast.error(t.itemAddFail); }
    finally { setSaving(false); }
  }

  function toggleSelected(id: string) {
    setSelectedItemIds((ids) => ids.includes(id) ? ids.filter((itemId) => itemId !== id) : [...ids, id]);
  }

  async function handleCreateOutfit() {
    if (selectedItemIds.length < 2) return;
    setSavingOutfit(true);
    try {
      await api.post('/mirror/outfits', {
        name: outfitName.trim() || t.outfitDefault(outfits.length + 1),
        itemIds: selectedItemIds,
      });
      setSelectedItemIds([]);
      setOutfitName('');
      setShowOutfit(false);
      await load(true);
      toast.success(t.outfitSaved);
    } catch { toast.error(t.outfitFail); }
    finally { setSavingOutfit(false); }
  }

  async function handleDeleteOutfit(id: string) {
    try {
      await api.delete(`/mirror/outfits/${id}`);
      setOutfits((current) => current.filter((outfit) => outfit.id !== id));
      toast.success(t.outfitDeleted);
    } catch { toast.error(t.outfitDeleteFail); }
  }

  async function handleWorn(id: string) {
    try { await api.post(`/mirror/wardrobe/${id}/worn`); void load(true); } catch { toast.error(t.useFail); }
  }

  async function handleDelete(id: string) {
    try { await api.delete(`/mirror/wardrobe/${id}`); void load(true); } catch { toast.error(t.itemDeleteFail); }
  }

  return (
    <section className="flex flex-col gap-6" aria-labelledby="glow-style">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="glow-style" className="text-heading-lg">{t.itemsTitle}</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="md" disabled={selectedItemIds.length < 2} onClick={() => setShowOutfit(true)}>
            <Sparkles aria-hidden className="size-4" />{t.outfitBtn(selectedItemIds.length)}
          </Button>
          <Button size="md" onClick={() => setShowNew(true)}><Plus aria-hidden className="size-4" />{t.item}</Button>
        </div>
      </div>
      <PrivatePhotoNotice />
      <ChipGroup label={t.itemCategoryAria} options={options} value={activeCategory} onChange={setActiveCategory} />

      {state === 'loading' ? (
        <PageLoader label={t.loadingWardrobe} words={LOADING_COPY.glowUpWardrobe} />
      ) : state === 'error' ? (
        <ErrorState title={t.wardrobeFail} onRetry={() => void load()} />
      ) : displayed.length === 0 ? (
        <Card variant="elevated" padding="lg">
          <EmptyState icon={Shirt} tone="info" title={t.emptyWardrobe} description={t.emptyWardrobeDesc}
            action={<Button onClick={() => setShowNew(true)}><Plus aria-hidden className="size-4" />{t.addItem}</Button>} className="py-6" />
        </Card>
      ) : (
        <motion.ul variants={stagger} initial="initial" animate="animate" className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {displayed.map((it) => {
            const selected = selectedItemIds.includes(it.id);
            return (
              <motion.li key={it.id} variants={item}>
                <Card as="article" padding="sm" interactive className="flex h-full flex-col gap-2">
                  {it.photoData ? (
                    <img src={`data:image/jpeg;base64,${it.photoData}`} alt={t.photoAlt(it.name)} className="aspect-[4/3] w-full rounded-xl border border-border object-cover" />
                  ) : (
                    <div aria-hidden className="flex aspect-[4/3] items-center justify-center rounded-xl bg-surface-variant text-on-surface-light"><Shirt className="size-10" strokeWidth={1.25} /></div>
                  )}
                  <div className="flex items-start justify-between gap-1">
                    <h3 className="min-w-0 truncate text-label-lg">{it.name}</h3>
                    <Button variant="icon" size="sm" aria-label={t.deleteAria(it.name)} onClick={() => void handleDelete(it.id)} className="-mr-2 -mt-2 size-11 md:size-9">
                      <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
                    </Button>
                  </div>
                  <p className="text-body-sm text-on-surface">{t.categories[it.category] ?? it.category}</p>
                  {it.brand && <p className="text-body-sm text-on-surface-light">{it.brand}</p>}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-body-sm text-on-surface-light">
                      <span className="font-mono tabular-nums">{it.timesWorn}</span> {it.timesWorn === 1 ? t.use : t.uses}
                    </p>
                    {it.isFavorite && <Star aria-label={t.favorite} className="size-4 shrink-0 fill-warning text-warning" />}
                  </div>
                  <Button variant={selected ? 'primary' : 'secondary'} size="sm" block aria-pressed={selected} onClick={() => toggleSelected(it.id)}>
                    {selected ? <><Check aria-hidden className="size-4" />{t.inOutfit}</> : t.addToOutfit}
                  </Button>
                  <Button variant="secondary" size="sm" block className="mt-auto" onClick={() => void handleWorn(it.id)}>{t.wearToday}</Button>
                </Card>
              </motion.li>
            );
          })}
        </motion.ul>
      )}

      {outfits.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="saved-outfits">
          <h3 id="saved-outfits" className="text-heading-sm">{t.savedOutfits}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {outfits.map((outfit) => (
              <Card key={outfit.id} as="article" padding="sm" className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-label-lg">{outfit.name || t.outfit}</h4>
                    {outfit.occasion && <p className="text-body-sm text-on-surface-light">{outfit.occasion}</p>}
                  </div>
                  <Button variant="icon" size="sm" aria-label={t.deleteOutfitAria(outfit.name || t.outfit)} onClick={() => void handleDeleteOutfit(outfit.id)}>
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {outfit.items.map(({ clothingItem }) => (
                    <div key={clothingItem.id} className="flex min-w-0 flex-col gap-1">
                      {clothingItem.photoData ? (
                        <img src={`data:image/jpeg;base64,${clothingItem.photoData}`} alt={t.photoAlt(clothingItem.name)} className="aspect-square w-full rounded-lg object-cover" />
                      ) : (
                        <div aria-hidden className="flex aspect-square items-center justify-center rounded-lg bg-surface-variant text-on-surface-light"><Shirt className="size-6" /></div>
                      )}
                      <span className="truncate text-body-sm">{clothingItem.name}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title={t.newItem}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void handleCreate(); }}>
          <Field label={t.name}><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t.namePh} autoFocus /></Field>
          <Field label={t.category}>
            <Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{t.categories[c]}</option>)}
            </Select>
          </Field>
          <div className="flex flex-col gap-2">
            {form.photoData && <img src={`data:image/jpeg;base64,${form.photoData}`} alt={t.previewAlt} className="aspect-[4/3] max-h-56 w-full rounded-xl border border-border object-cover" />}
            <div className="flex flex-wrap gap-2">
              <PhotoSourceButtons loading={photoProcessing} cameraLabel={form.photoData ? t.anotherPhoto : t.snapItem} onPick={(file) => void handlePhotoChange(file)} />
              {form.photoData && <Button type="button" variant="ghost" onClick={() => setForm((f) => ({ ...f, photoData: '' }))}>{t.removePhoto}</Button>}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.brand}><Input value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} placeholder={t.brandPh} /></Field>
            <Field label={t.color}><Input value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} placeholder={t.colorPh} /></Field>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowNew(false)}>{t.cancel}</Button>
            <Button type="submit" className="flex-1" disabled={!form.name.trim() || photoProcessing} loading={saving}>{t.add}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showOutfit} onClose={() => setShowOutfit(false)} title={t.saveOutfit}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void handleCreateOutfit(); }}>
          <p className="text-body-sm text-on-surface-light">{t.selectedItems}{selectedItemIds.map((id) => items.find((entry) => entry.id === id)?.name).filter(Boolean).join(', ')}</p>
          <Field label={t.lookName} help={t.lookHelp}>
            <Input value={outfitName} onChange={(e) => setOutfitName(e.target.value)} placeholder={t.lookPh} autoFocus />
          </Field>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setShowOutfit(false)}>{t.cancel}</Button>
            <Button type="submit" loading={savingOutfit}>{t.saveLook}</Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

// ─── Presence Section ─────────────────────────────────────────────────────────

const AREA_KEYS = ['posture', 'voice', 'confidence', 'communication'] as const;

function Rating({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const t = useText(COPY);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="flex w-full items-center justify-between text-label-lg">
        <span>{label}</span><span className="font-mono tabular-nums text-primary-text">{value}/5</span>
      </legend>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v} type="button" role="radio" aria-checked={value === v} aria-label={t.outOf5(v)} onClick={() => onChange(v)}
            className={cn('min-h-11 rounded-md font-mono text-label-lg tabular-nums transition-colors', value >= v ? 'bg-primary-strong text-on-primary' : 'bg-surface-variant text-on-surface hover:bg-border')}
          >{v}</button>
        ))}
      </div>
    </fieldset>
  );
}

function PresenceSection() {
  const t = useText(COPY);
  const locale = useLocale();
  const toast = useToastStore();
  const [checkins, setCheckins] = useState<PresenceCheckin[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [form, setForm] = useState({ posture: 3, voice: 3, confidence: 3, communication: 3, notes: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setState('loading');
    try {
      const { data } = await api.get('/mirror/checkins');
      setCheckins(data);
      setState('ready');
    } catch { if (!silent) setState('error'); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      const week = new Date();
      week.setHours(0, 0, 0, 0);
      week.setDate(week.getDate() - week.getDay());
      await api.post('/mirror/checkins', { week: week.toISOString(), ...form });
      toast.success(t.checkinSaved);
      void load(true);
    } catch { toast.error(t.checkinFail); }
    finally { setSaving(false); }
  }

  let history: ReactNode = null;
  if (state === 'loading') history = <PageLoader label={t.loadingEvolution} words={LOADING_COPY.glowUpRoutines} size="sm" />;
  else if (state === 'error') history = <ErrorState title={t.evolutionFail} onRetry={() => void load()} />;
  else if (checkins.length === 0) history = <EmptyState icon={Sparkles} tone="forest" title={t.noCheckins} description={t.noCheckinsDesc} className="py-4" />;
  else history = (
    <ul className="flex flex-col">
      {checkins.slice(0, 6).map((c) => {
        const avg = Math.round((c.posture + c.voice + c.confidence + c.communication) / 4 * 20);
        return (
          <li key={c.id} className="flex min-h-14 items-center gap-3 border-b border-border py-2 last:border-0">
            <span className="w-16 shrink-0 text-body-sm text-on-surface-light">{new Date(c.week).toLocaleDateString(INTL_LOCALE[locale], { day: 'numeric', month: 'short' }).replace('.', '')}</span>
            <div className="grid flex-1 grid-cols-4 gap-1 text-center">
              {AREA_KEYS.map((k) => (
                <div key={k}>
                  <div className="font-mono text-label-lg tabular-nums text-primary-text">{c[k]}</div>
                  <div className="text-label-md text-on-surface-light">{t.areas[k].slice(0, 3)}</div>
                </div>
              ))}
            </div>
            <Badge variant={avg >= 60 ? 'success' : 'warning'}><span className="font-mono tabular-nums">{avg}%</span></Badge>
          </li>
        );
      })}
    </ul>
  );

  return (
    <section className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2" aria-labelledby="glow-presence">
      <Card as="form" padding="lg" className="flex flex-col gap-5" onSubmit={(e: React.FormEvent) => { e.preventDefault(); void handleSave(); }}>
        <h2 id="glow-presence" className="text-heading-lg">{t.weeklyCheck}</h2>
        {AREA_KEYS.map((k) => <Rating key={k} label={t.areas[k]} value={form[k]} onChange={(v) => setForm((f) => ({ ...f, [k]: v }))} />)}
        <Field label={t.weekNotes}><Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder={t.weekNotesPh} /></Field>
        <Button type="submit" loading={saving}>{t.saveCheck}</Button>
      </Card>
      <Card as="section" padding="lg" aria-labelledby="glow-evol" className="flex flex-col gap-3">
        <h2 id="glow-evol" className="text-heading-lg">{t.evolution}</h2>
        {history}
      </Card>
    </section>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GlowUpPage() {
  const t = useText(COPY);
  // ?add=prenda (botón «Ir al Espejo» en Finanzas) abre la pestaña del armario
  // con el formulario de nueva prenda listo para la compra recién hecha.
  const [searchParams, setSearchParams] = useSearchParams();
  const autoOpenAdd = searchParams.get('add') === 'prenda';
  const clearAddParam = useCallback(() => {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      next.delete('add');
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const [tab, setTab] = useState<Tab>('style');
  const motionReduced = useMotionReduced();
  const [progress, setProgress] = useState({ done: 0, total: 0, streak: 0 });
  const onProgress = useCallback((done: number, total: number, streak: number) => {
    setProgress((p) => (p.done === done && p.total === total && p.streak === streak ? p : { done, total, streak }));
  }, []);
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const TABS = TAB_IDS.map((value) => ({ value, label: t.tabs[value] }));

  return (
    <ZoneShell
      zone="espejo"
      contentClassName="gap-6 md:gap-8"
      ambience={<AmbientLight tone="jade-200" alpha={0.5} darkAlpha={0.08} d={12} className="right-[-4%] top-[-10%] h-[30rem] w-[44%]" />}
    >
      <motion.section variants={item} className="flex flex-wrap items-center justify-between gap-6 md:gap-8">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-2">
          <span className="text-label-lg text-primary-text">{t.personalSpace}</span>
          <h1 className="text-display-sm md:text-display-md lg:text-display-lg"><Lettering text={t.mirror} /></h1>
          <p className="max-w-[540px] text-body-lg text-on-surface-light">{t.mirrorDesc}</p>
        </div>
        {/* El tocador: cada paso completado enciende otra bombilla y aclara el vidrio */}
        <Mirror brightness={pct} className="w-full sm:w-[22rem]">
          <div className="flex flex-col items-center gap-1 text-center" role="group" aria-label={t.glowToday}>
            <span className="text-label-lg text-on-surface">{t.glowToday}</span>
            <span aria-live="polite" className="font-mono text-display-sm font-bold tabular-nums md:text-display-md">{pct}%</span>
            <span className="font-mono text-body-sm tabular-nums text-on-surface-light">{t.stepsOf(progress.done, progress.total)}</span>
            {progress.streak > 0 && (
              <span className="mt-1 flex items-center gap-1.5 text-body-sm text-warning-text"><Flame aria-hidden className="size-4" /><span className="font-mono tabular-nums">{progress.streak}</span> {t.streakDays(progress.streak)}</span>
            )}
          </div>
        </Mirror>
      </motion.section>

      <motion.div variants={item}>
        <SegmentedControl options={TABS} value={tab} onChange={setTab} label={t.area} className="max-w-[560px]" />
      </motion.div>

      {/* Las secciones se funden entre sí, sin saltos. Con «Reducir movimiento»
          solo hay un fundido de opacidad: sin blur, la pantalla queda nítida. */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab} role="tabpanel"
          initial={motionReduced ? { opacity: 0 } : { opacity: 0, ...blurFrom(6) }}
          animate={motionReduced
            ? { opacity: 1, transition: { duration: 0.2 } }
            : { opacity: 1, ...blurTo(), transition: springs.gentle }}
          exit={motionReduced ? { opacity: 0, transition: { duration: 0.15 } } : { opacity: 0, ...blurFrom(4), transition: { duration: 0.2 } }}
        >
          {tab === 'care' && <CareSection onProgress={onProgress} />}
          {tab === 'style' && <StyleSection autoOpenAdd={autoOpenAdd} onAddOpened={clearAddParam} />}
          {tab === 'presence' && <PresenceSection />}
        </motion.div>
      </AnimatePresence>
    </ZoneShell>
  );
}
