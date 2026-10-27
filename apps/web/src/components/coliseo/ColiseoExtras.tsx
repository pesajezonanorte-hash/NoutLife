// Extras del Coliseo: descanso entre series, peso corporal, 1RM, discos, series
// efectivas por músculo, balance empuje/tirón/pierna y fotos de progreso. Los
// cálculos viven en lib/coliseo; los datos, en coliseo.service.
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, BarChart3, Camera, Check, Disc, Dumbbell, Gauge, Plus, Scale, Timer as TimerIcon, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { heavy } from '@/lib/motion';
import {
  MUSCLE_IDS, WEEKLY_RANGE, muscleLabelFor, oneRepMax, platesPerSide, rangeOf,
  type Balance, type Muscle, type MuscleState, type OneRmFormula,
} from '@/lib/coliseo';
import { INTL_LOCALE, useLocale, useText, type Copy } from '@/lib/i18n';
import { Button, Card, EmptyState, Field, IconChip, Input, LineChart, Modal, ProgressRing, SegmentedControl, chipClasses, type LinePoint, type SegmentOption, PageLoader } from '@/components/ui/lq';
import { useLoadingCopy } from '@/lib/loadingCopy';
import { useToastStore } from '@/hooks/useToast';
import * as coliseo from '../../services/coliseo.service';
import { PrivatePhotoNotice } from '@/components/privacy/PrivatePhotoNotice';
import { PhotoSourceButtons } from '@/components/media/PhotoSourceButtons';
import { compressImageToBase64 } from '@/lib/imageCompress';

const es = {
  // Descanso
  restTitle: 'Descanso entre series',
  restIntro: 'Recupera el ritmo antes de tu siguiente serie.',
  restRemaining: 'Tiempo de descanso restante',
  seconds: 'segundos',
  secondsValue: (n: number): string => `${n} segundos`,
  duration: 'Duración',
  otherTimeAria: 'Otro tiempo en segundos',
  otherTime: 'Otro tiempo (s)',
  apply: 'Aplicar',
  done: '¡Listo! Siguiente serie',
  stopTimer: 'Detener temporizador',
  startTimer: (n: number): string => `Iniciar ${n}s`,
  // Peso corporal
  weightTitle: 'Peso corporal',
  weightErr: 'No se pudo registrar el peso',
  deleteEntryErr: 'No se pudo eliminar el registro',
  totalChange: 'kg total',
  weightLoading: 'Leyendo tu peso…',
  weightChart: (a: number, b: number): string => `Peso corporal: de ${a} a ${b} kg`,
  weightLabel: 'Peso (kg)',
  noteLabel: 'Nota (opcional)',
  fasting: 'En ayunas',
  log: 'Registrar',
  deleteEntryAria: (d: string): string => `Eliminar registro del ${d}`,
  // 1RM
  oneRmTitle: 'Calculadora 1RM',
  repsLabel: 'Repeticiones',
  formulaLabel: '1RM formula',
  brzyckiLimit: 'Brzycki solo vale hasta 36 repeticiones: usa Epley.',
  oneRmHint: 'Escribe el peso y las repeticiones de una serie dura y verás tu 1RM al momento.',
  estimated1rm: 'kg · 1RM estimado',
  withFormula: (name: string, v: string): string => `Con ${name}: ${v}`,
  // Discos
  platesTitle: 'Calculadora de discos',
  totalWeight: 'Peso total con la barra (kg)',
  barWeight: 'Peso de la barra',
  barAbs: (n: number): string => `Barra ${n} kg`,
  barPlain: (n: number): string => `${n} kg`,
  platesHint: 'Escribe el peso que quieres levantar y te digo qué discos poner en cada lado.',
  lessThanBar: (v: string): string => `Es menos que la barra sola (${v}).`,
  perSide: 'Por lado:',
  barOnly: 'Solo la barra.',
  notExact: (a: string, b: string): string => `No cuadra exacto con discos de 1,25 kg: carga ${a} o ${b}.`,
  // Series por semana
  setsTitle: 'Series efectivas por semana',
  setsIntro: (inRange: number, total: number, lo: number, hi: number): string => `${inRange} de ${total} músculos en el rango de hipertrofia (${lo}–${hi} series en 7 días). El calentamiento no cuenta; como músculo secundario, una serie suma media.`,
  rangeLow: 'Bajo',
  rangeOptimal: 'Óptimo',
  rangeHigh: 'Alto',
  setsWord: 'series',
  rangeLegend: (lo: number, hi: number): string => `Rango ${lo}–${hi} series`,
  // Balance
  balanceTitle: 'Balance muscular',
  balanceIntro: 'Series efectivas de las últimas 4 semanas, según el músculo principal de cada ejercicio.',
  noStrength: 'Aún no hay series de fuerza en las últimas 4 semanas.',
  splitPush: 'Empuje',
  splitPull: 'Tirón',
  splitLegs: 'Pierna',
  goodBalance: 'Buen balance entre empuje, tirón y pierna.',
  balanceHint: 'Con 6 series o más te digo si hay desequilibrio.',
  // Fotos
  photosTitle: 'Progreso visual',
  photoErr: 'No se pudo subir la foto',
  photosLoading: 'Buscando tus fotos…',
  noPhotosTitle: 'Aún no hay fotos',
  noPhotosBody: 'Sube tu primera foto para ver tu cambio con el tiempo.',
  before: 'Antes',
  after: 'Después',
  photoAlt: (side: string, date: string): string => `Foto ${side} de ${date}`,
  photoAltBefore: 'anterior',
  photoAltAfter: 'posterior',
  closeCompare: 'Cerrar comparación',
  photoAria: (date: string, selected: boolean): string => `Foto de ${date}${selected ? ', seleccionada' : ''}`,
  selectedTag: ', seleccionada',
  compareHint: 'Toca 2 fotos para comparar',
};

const en: typeof es = {
  restTitle: 'Rest between sets',
  restIntro: 'Catch your breath before your next set.',
  restRemaining: 'Rest time left',
  seconds: 'seconds',
  secondsValue: (n: number): string => `${n} seconds`,
  duration: 'Duration',
  otherTimeAria: 'Another time in seconds',
  otherTime: 'Another time (s)',
  apply: 'Apply',
  done: 'Done! Next set',
  stopTimer: 'Stop timer',
  startTimer: (n: number): string => `Start ${n}s`,
  weightTitle: 'Body weight',
  weightErr: 'Could not log the weight',
  deleteEntryErr: 'Could not delete the entry',
  totalChange: 'kg total',
  weightLoading: 'Reading your weight…',
  weightChart: (a: number, b: number): string => `Body weight: from ${a} to ${b} kg`,
  weightLabel: 'Weight (kg)',
  noteLabel: 'Note (optional)',
  fasting: 'Fasting',
  log: 'Log',
  deleteEntryAria: (d: string): string => `Delete entry from ${d}`,
  oneRmTitle: '1RM calculator',
  repsLabel: 'Reps',
  formulaLabel: '1RM formula',
  brzyckiLimit: 'Brzycki only works up to 36 reps: use Epley.',
  oneRmHint: 'Enter the weight and reps of a hard set and you will see your 1RM right away.',
  estimated1rm: 'kg · estimated 1RM',
  withFormula: (name: string, v: string): string => `With ${name}: ${v}`,
  platesTitle: 'Plate calculator',
  totalWeight: 'Total weight including the bar (kg)',
  barWeight: 'Bar weight',
  barAbs: (n: number): string => `${n} kg bar`,
  barPlain: (n: number): string => `${n} kg`,
  platesHint: 'Enter the weight you want to lift and I will tell you which plates to put on each side.',
  lessThanBar: (v: string): string => `Less than the bar alone (${v}).`,
  perSide: 'Per side:',
  barOnly: 'Bar only.',
  notExact: (a: string, b: string): string => `Does not add up exactly with 1.25 kg plates: load ${a} or ${b}.`,
  setsTitle: 'Effective sets per week',
  setsIntro: (inRange: number, total: number, lo: number, hi: number): string => `${inRange} of ${total} muscles in the hypertrophy range (${lo}–${hi} sets in 7 days). Warm-ups do not count; as a secondary muscle, a set counts as half.`,
  rangeLow: 'Low',
  rangeOptimal: 'Optimal',
  rangeHigh: 'High',
  setsWord: 'sets',
  rangeLegend: (lo: number, hi: number): string => `Range ${lo}–${hi} sets`,
  balanceTitle: 'Muscle balance',
  balanceIntro: 'Effective sets from the last 4 weeks, based on the main muscle of each exercise.',
  noStrength: 'No strength sets in the last 4 weeks yet.',
  splitPush: 'Push',
  splitPull: 'Pull',
  splitLegs: 'Legs',
  goodBalance: 'Good balance across push, pull and legs.',
  balanceHint: 'With 6 sets or more I will tell you if something is unbalanced.',
  photosTitle: 'Visual progress',
  photoErr: 'Could not upload the photo',
  photosLoading: 'Finding your photos…',
  noPhotosTitle: 'No photos yet',
  noPhotosBody: 'Upload your first photo to see your change over time.',
  before: 'Before',
  after: 'After',
  photoAlt: (side: string, date: string): string => `Photo ${side} from ${date}`,
  photoAltBefore: 'before',
  photoAltAfter: 'after',
  closeCompare: 'Close comparison',
  photoAria: (date: string, selected: boolean): string => `Photo from ${date}${selected ? ', selected' : ''}`,
  selectedTag: ', selected',
  compareHint: 'Tap 2 photos to compare',
};

const COPY: Copy<typeof es> = { es, en };

// ─── Rest Timer ────────────────────────────────────────────────────────────────

const TIMER_PRESETS = [60, 90, 120, 180];

export function RestTimer({ onClose }: { onClose: () => void }) {
  const t = useText(COPY);
  const [duration, setDuration] = useState(90);
  const [custom, setCustom] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);

  function playBeep() {
    try {
      if (!audioCtx.current) audioCtx.current = new AudioContext();
      const oscillator = audioCtx.current.createOscillator();
      const gain = audioCtx.current.createGain();
      oscillator.connect(gain);
      gain.connect(audioCtx.current.destination);
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, audioCtx.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.current.currentTime + 0.6);
      oscillator.start();
      oscillator.stop(audioCtx.current.currentTime + 0.6);
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
    } catch {
      // Audio feedback is optional on unsupported devices.
    }
  }

  const start = useCallback((seconds?: number) => {
    const total = seconds ?? duration;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRemaining(total);
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setRemaining((previous) => {
        if (previous === null || previous <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setRunning(false);
          playBeep();
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
  }, [duration]);

  function stop() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    setRemaining(null);
  }

  function chooseDuration(seconds: number) {
    stop();
    setDuration(seconds);
    setCustom('');
  }

  function applyCustomDuration() {
    const seconds = Number(custom);
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    chooseDuration(Math.round(seconds));
  }

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const shown = remaining ?? duration;
  const pct = remaining !== null ? (remaining / duration) * 100 : 100;
  const tone = remaining !== null && remaining <= 10 ? 'error' : remaining !== null && remaining <= 30 ? 'warning' : 'success';

  return (
    <Modal open onClose={onClose} title={t.restTitle}>
      <p className="-mt-2 text-body-sm text-on-surface-light">{t.restIntro}</p>
      <div className="flex justify-center">
        <ProgressRing value={pct} tone={tone} size={144} stroke={10} label={t.restRemaining} valueText={t.secondsValue(shown)}>
          <span className="flex flex-col items-center">
            <span className="font-mono text-display-sm font-bold tabular-nums">{shown}</span>
            <span className="text-label-md text-on-surface-light">{t.seconds}</span>
          </span>
        </ProgressRing>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label-lg text-on-surface">{t.duration}</legend>
        <div className="grid grid-cols-4 gap-2">
          {TIMER_PRESETS.map((seconds) => (
            <button
              key={seconds}
              type="button"
              aria-pressed={duration === seconds}
              onClick={() => chooseDuration(seconds)}
              className={cn(chipClasses(duration === seconds), 'justify-center px-0 font-mono tabular-nums')}
            >
              {seconds}s
            </button>
          ))}
        </div>
        <div className="mt-1 flex gap-2">
          <Input
            type="number" min="1" inputMode="numeric" aria-label={t.otherTimeAria}
            value={custom} onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyCustomDuration()}
            placeholder={t.otherTime} className="min-w-0 flex-1"
          />
          <Button variant="secondary" size="md" onClick={applyCustomDuration} disabled={!custom || Number(custom) <= 0}>{t.apply}</Button>
        </div>
      </fieldset>

      <p role="status" className="min-h-6 text-center text-label-lg text-success-text">
        {remaining === 0 ? t.done : ''}
      </p>

      {running ? (
        <Button variant="danger" block onClick={stop}>{t.stopTimer}</Button>
      ) : (
        <Button block onClick={() => start()}><TimerIcon aria-hidden className="size-4" />{t.startTimer(duration)}</Button>
      )}
    </Modal>
  );
}

// ─── Body Weight Tracker ───────────────────────────────────────────────────────

export function BodyWeightTracker() {
  const t = useText(COPY);
  const loading = useLoadingCopy();
  const nf = INTL_LOCALE[useLocale()];
  const [records, setRecords] = useState<coliseo.BodyWeight[]>([]);
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    coliseo.fetchBodyWeights().then(setRecords).finally(() => setLoadingRecords(false));
  }, []);

  async function handleSave() {
    if (!weight) return;
    setSaving(true);
    try {
      const rec = await coliseo.logBodyWeight(parseFloat(weight), new Date().toISOString().slice(0, 10), notes || undefined);
      setRecords((prev) => [...prev, rec].sort((a, b) => a.date.localeCompare(b.date)));
      setWeight('');
      setNotes('');
    } catch {
      useToastStore.getState().error(t.weightErr);
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    try {
      await coliseo.deleteBodyWeight(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
    } catch {
      useToastStore.getState().error(t.deleteEntryErr);
    }
  }

  const points: LinePoint[] = records.map((r) => {
    const label = new Date(r.date).toLocaleDateString(nf, { month: 'short', day: 'numeric' }).replace('.', '');
    return { label, value: r.weight, tip: `${label} · ${r.weight} kg` };
  });
  const latest = records[records.length - 1];
  const first = records[0];
  const change = latest && first && records.length > 1 ? latest.weight - first.weight : null;
  const lo = Math.floor(Math.min(...records.map((r) => r.weight)) - 1);
  const hi = Math.ceil(Math.max(...records.map((r) => r.weight)) + 1);

  return (
    <Card as="section" aria-labelledby="coliseo-weight" padding="lg" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconChip icon={Scale} tone="info" size="sm" />
          <h3 id="coliseo-weight" className="text-heading-sm">{t.weightTitle}</h3>
        </div>
        {latest && (
          <div className="text-right">
            <p className="font-mono text-heading-sm font-bold tabular-nums">{latest.weight} kg</p>
            {change !== null && (
              <p className={cn('text-label-md font-mono tabular-nums', change < 0 ? 'text-success-text' : change > 0 ? 'text-warning-text' : 'text-on-surface-light')}>
                {change > 0 ? '+' : ''}{change.toFixed(1)} {t.totalChange}
              </p>
            )}
          </div>
        )}
      </div>

      {loadingRecords ? <PageLoader label={t.weightLoading} words={loading.coliseo} size="sm" /> : records.length > 1 && (
        <LineChart data={points} min={lo} max={hi} label={t.weightChart(first.weight, latest.weight)} tone="info" height={140} dots />
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
        <Field label={t.weightLabel}><Input type="number" inputMode="decimal" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="72.5" /></Field>
        <Field label={t.noteLabel}><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t.fasting} /></Field>
        <Button onClick={() => void handleSave()} disabled={!weight} loading={saving}><Plus aria-hidden className="size-4" />{t.log}</Button>
      </div>

      {records.length > 0 && (
        <ul className="flex max-h-48 flex-col overflow-y-auto">
          {[...records].reverse().slice(0, 8).map((r) => (
            <li key={r.id} className="flex min-h-11 items-center gap-3 border-b border-border last:border-0">
              <span className="w-20 text-body-sm text-on-surface-light">{new Date(r.date).toLocaleDateString(nf, { day: 'numeric', month: 'short' }).replace('.', '')}</span>
              <span className="font-mono text-label-lg tabular-nums">{r.weight} kg</span>
              {r.notes && <span className="min-w-0 flex-1 truncate text-body-sm text-on-surface-light">{r.notes}</span>}
              <Button variant="icon" size="sm" aria-label={t.deleteEntryAria(new Date(r.date).toLocaleDateString(nf))} onClick={() => void handleDelete(r.id)} className="ml-auto">
                <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ─── 1RM Calculator ────────────────────────────────────────────────────────────

const FORMULAS: SegmentOption<OneRmFormula>[] = [{ value: 'epley', label: 'Epley' }, { value: 'brzycki', label: 'Brzycki' }];

/** 1RM automático: se recalcula al escribir, con la fórmula elegida y la otra como referencia. */
export function OneRMCalculator() {
  const t = useText(COPY);
  const nf = INTL_LOCALE[useLocale()];
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [formula, setFormula] = useState<OneRmFormula>('epley');
  const w = parseFloat(weight.replace(',', '.'));
  const r = parseInt(reps, 10);
  const result = Math.round(oneRepMax(w, r, formula)) || null;
  const other = formula === 'epley' ? 'brzycki' : 'epley';
  const otherResult = Math.round(oneRepMax(w, r, other));

  const percentages = result ? [100, 95, 90, 85, 80, 75, 70].map((pct) => ({
    pct,
    weight: Math.round(result * pct / 100 * 2) / 2,
    reps: pct === 100 ? 1 : pct >= 90 ? 3 : pct >= 85 ? 4 : pct >= 80 ? 6 : pct >= 75 ? 8 : 10,
  })) : [];

  return (
    <Card as="section" aria-labelledby="coliseo-1rm" padding="lg" className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <IconChip icon={Dumbbell} tone="warning" size="sm" />
        <h3 id="coliseo-1rm" className="text-heading-sm">{t.oneRmTitle}</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.weightLabel}><Input type="number" inputMode="decimal" step="0.5" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="80" /></Field>
        <Field label={t.repsLabel}><Input type="number" inputMode="numeric" min="1" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="5" /></Field>
      </div>
      <SegmentedControl label={t.formulaLabel} role="radiogroup" options={FORMULAS} value={formula} onChange={setFormula} />
      {result === null ? (
        <p className="text-body-sm text-on-surface-light">
          {formula === 'brzycki' && r >= 37 ? t.brzyckiLimit : t.oneRmHint}
        </p>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4" aria-live="polite">
          <p className="text-center">
            <span className="font-mono text-display-sm font-bold tabular-nums text-primary-text">{result}</span>
            <span className="ml-2 text-body-sm text-on-surface-light">{t.estimated1rm}</span>
            {otherResult > 0 && otherResult !== result && (
              <span className="block text-body-sm text-on-surface-light">{t.withFormula(other === 'epley' ? 'Epley' : 'Brzycki', '')}<span className="font-mono tabular-nums">{otherResult} kg</span></span>
            )}
          </p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {percentages.map(({ pct, weight: w, reps: r }) => (
              <li key={pct} className="rounded-xl bg-surface-variant p-3 text-center">
                <p className="text-label-md text-on-surface-light">{pct}%</p>
                <p className="font-mono text-label-lg tabular-nums">{w.toLocaleString(nf)} kg</p>
                <p className="font-mono text-label-md tabular-nums text-on-surface-light">×{r}</p>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </Card>
  );
}

// ─── Plate Calculator ──────────────────────────────────────────────────────────

/** Código de color de competición (IWF) sobre los tonos del tema: 25 rojo, 20 azul, 15 amarillo, 10 verde… */
const PLATE_LOOK: Record<number, string> = {
  25: 'h-16 bg-error', 20: 'h-14 bg-info', 15: 'h-12 bg-warning', 10: 'h-10 bg-success',
  5: 'h-8 border border-border-strong bg-background', 2.5: 'h-7 bg-on-surface', 1.25: 'h-6 bg-on-surface-light/50',
};

export function PlateCalculator() {
  const t = useText(COPY);
  const nf = INTL_LOCALE[useLocale()];
  const kgText = (n: number) => `${n.toLocaleString(nf)} kg`;
  const BARS: SegmentOption<'20' | '15' | '10'>[] = [{ value: '20', label: t.barAbs(20) }, { value: '15', label: t.barPlain(15) }, { value: '10', label: t.barPlain(10) }];
  const [total, setTotal] = useState('');
  const [bar, setBar] = useState<'20' | '15' | '10'>('20');
  const load = Number(total.replace(',', '.'));
  const barKg = Number(bar);
  const { plates, rest } = platesPerSide(load, barKg);

  return (
    <Card as="section" aria-labelledby="coliseo-plates" padding="lg" className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <IconChip icon={Disc} tone="info" size="sm" />
        <h3 id="coliseo-plates" className="text-heading-sm">{t.platesTitle}</h3>
      </div>
      <Field label={t.totalWeight}>
        <Input type="number" inputMode="decimal" step="1.25" min="0" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="100" />
      </Field>
      <SegmentedControl label={t.barWeight} role="radiogroup" options={BARS} value={bar} onChange={setBar} />
      <div aria-live="polite" className="flex min-h-24 flex-col justify-center gap-3">
        {!(load > 0) ? (
          <p className="text-body-sm text-on-surface-light">{t.platesHint}</p>
        ) : load < barKg ? (
          <p className="text-body-sm text-warning-text">{t.lessThanBar(kgText(barKg))}</p>
        ) : (
          <>
            <div aria-hidden className="flex h-16 items-center">
              <span className="h-2 w-8 rounded-l-full bg-on-surface-light/40" />
              <span className="h-10 w-2 rounded-sm bg-on-surface-light/70" />
              {plates.map((p, i) => (
                <motion.span
                  key={`${i}-${p}`} className={cn('ml-0.5 w-3.5 rounded-sm', PLATE_LOOK[p])}
                  initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ ...heavy, delay: i * 0.06 }}
                />
              ))}
              <span className="h-2 flex-1 rounded-r-full bg-on-surface-light/25" />
            </div>
            <p className="text-body-md">
              {plates.length ? <>{t.perSide} <span className="font-mono font-semibold tabular-nums">{plates.map((p) => p.toLocaleString(nf)).join(' + ')}</span> kg</> : t.barOnly}
            </p>
            {rest > 0 && (
              <p className="text-body-sm text-warning-text">{t.notExact(kgText(load - rest), kgText(load - rest + 2.5))}</p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

// ─── Weekly effective sets vs. hypertrophy range ───────────────────────────────

const RANGE_STYLE = {
  low: { bar: 'bg-info', text: 'text-info-text' },
  optimal: { bar: 'bg-success', text: 'text-success-text' },
  high: { bar: 'bg-warning', text: 'text-warning-text' },
} as const;
const SCALE = 25;

export function WeeklySets({ states }: { states: Record<Muscle, MuscleState> }) {
  const t = useText(COPY);
  const locale = useLocale();
  const nf = INTL_LOCALE[locale];
  const rangeLabel = { low: t.rangeLow, optimal: t.rangeOptimal, high: t.rangeHigh } as const;
  const setsText = (n: number) => n.toLocaleString(nf, { maximumFractionDigits: 1 });
  const [lo, hi] = WEEKLY_RANGE;
  const inRange = MUSCLE_IDS.filter((m) => rangeOf(states[m].weekSets) === 'optimal').length;
  return (
    <Card as="section" aria-labelledby="coliseo-sets" padding="lg" className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <IconChip icon={BarChart3} tone="primary" size="sm" />
        <h3 id="coliseo-sets" className="text-heading-sm">{t.setsTitle}</h3>
      </div>
      <p className="-mt-2 text-body-sm text-on-surface-light">{t.setsIntro(inRange, MUSCLE_IDS.length, lo, hi)}</p>
      <ul className="flex flex-col gap-1.5">
        {MUSCLE_IDS.map((m, i) => {
          const n = states[m].weekSets;
          const range = rangeOf(n);
          const look = RANGE_STYLE[range];
          return (
            <li key={m} className="grid grid-cols-[minmax(0,6.5rem)_1fr_2.25rem_3.25rem] items-center gap-2 sm:gap-3">
              <span className="truncate text-body-sm">{muscleLabelFor(m, locale)}</span>
              <span aria-hidden className="relative h-2.5 overflow-hidden rounded-full bg-surface-variant">
                <span className="absolute inset-y-0 bg-success/[var(--lq-soft-alpha)]" style={{ left: `${(lo / SCALE) * 100}%`, width: `${((hi - lo) / SCALE) * 100}%` }} />
                <motion.span
                  className={cn('absolute inset-0 rounded-full', look.bar)} style={{ originX: 0 }}
                  initial={{ scaleX: 0 }} animate={{ scaleX: Math.min(n, SCALE) / SCALE }} transition={{ ...heavy, delay: 0.1 + i * 0.03 }}
                />
                {[lo, hi].map((x) => <span key={x} className="absolute inset-y-0 w-px bg-on-surface-light/70" style={{ left: `${(x / SCALE) * 100}%` }} />)}
              </span>
              <span className="text-right font-mono text-label-md tabular-nums">{setsText(n)}<span className="sr-only"> {t.setsWord}</span></span>
              <span className={cn('text-label-md', look.text)}>{rangeLabel[range]}</span>
            </li>
          );
        })}
      </ul>
      <p className="flex items-center gap-2 text-label-md text-on-surface-light">
        <span aria-hidden className="h-2.5 w-6 rounded-sm border-x border-on-surface-light/70 bg-success/[var(--lq-soft-alpha)]" />
        {t.rangeLegend(lo, hi)}
      </p>
    </Card>
  );
}

// ─── Push / pull / legs balance ────────────────────────────────────────────────

const SPLIT_DOTS = [
  // Un solo tono en tres intensidades: se distinguen en cualquier tema y no chocan con los colores de estado.
  { key: 'push', dot: 'bg-primary' },
  { key: 'pull', dot: 'bg-primary/55' },
  { key: 'legs', dot: 'bg-primary/25' },
] as const;

export function BalanceCard({ balance }: { balance: Balance }) {
  const t = useText(COPY);
  const { total } = balance;
  const splits = [
    { ...SPLIT_DOTS[0], label: t.splitPush },
    { ...SPLIT_DOTS[1], label: t.splitPull },
    { ...SPLIT_DOTS[2], label: t.splitLegs },
  ];
  return (
    <Card as="section" aria-labelledby="coliseo-balance" padding="lg" className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <IconChip icon={Gauge} tone="forest" size="sm" />
        <h3 id="coliseo-balance" className="text-heading-sm">{t.balanceTitle}</h3>
      </div>
      <p className="-mt-2 text-body-sm text-on-surface-light">{t.balanceIntro}</p>
      {total === 0 ? (
        <p className="text-body-sm text-on-surface">{t.noStrength}</p>
      ) : (
        <>
          <div aria-hidden className="flex h-3 gap-0.5 overflow-hidden rounded-full">
            {splits.filter((s) => balance[s.key] > 0).map((s) => (
              <span key={s.key} className={s.dot} style={{ width: `${(balance[s.key] / total) * 100}%` }} />
            ))}
          </div>
          <dl className="grid grid-cols-3 gap-2">
            {splits.map((s) => (
              <div key={s.key} className="flex flex-col gap-0.5">
                <dt className="flex items-center gap-1.5 text-label-md text-on-surface"><span aria-hidden className={cn('size-2.5 rounded-full', s.dot)} />{s.label}</dt>
                <dd className="font-mono text-heading-sm tabular-nums">
                  {balance[s.key]}<span className="ml-1 text-label-md text-on-surface-light">{Math.round((balance[s.key] / total) * 100)} %</span>
                </dd>
              </div>
            ))}
          </dl>
          {balance.notes.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {balance.notes.map((n) => (
                <li key={n} className="flex gap-2 text-body-sm text-warning-text"><AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />{n}</li>
              ))}
            </ul>
          ) : total >= 6 ? (
            <p className="flex gap-2 text-body-sm text-success-text"><Check aria-hidden className="mt-0.5 size-4 shrink-0" />{t.goodBalance}</p>
          ) : (
            <p className="text-body-sm text-on-surface-light">{t.balanceHint}</p>
          )}
        </>
      )}
    </Card>
  );
}

// ─── Progress Photos ───────────────────────────────────────────────────────────

export function ProgressPhotos() {
  const t = useText(COPY);
  const loading = useLoadingCopy();
  const nf = INTL_LOCALE[useLocale()];
  const [photos, setPhotos] = useState<coliseo.ProgressPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [compare, setCompare] = useState<[string, string] | null>(null);
  useEffect(() => {
    coliseo.fetchProgressPhotos().then(setPhotos).finally(() => setLoadingPhotos(false));
  }, []);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      // La foto de la cámara pesa varios MB: se comprime antes de subirla.
      const base64 = await compressImageToBase64(file);
      await coliseo.saveProgressPhoto(base64, new Date().toISOString().slice(0, 10));
      setPhotos(await coliseo.fetchProgressPhotos());
    } catch (error) {
      useToastStore.getState().error(t.photoErr, error instanceof Error ? error.message : undefined);
    } finally {
      setUploading(false);
    }
  }

  function toggleCompare(id: string) {
    if (!compare) { setCompare([id, '']); return; }
    const [a, b] = compare;
    if (!a) { setCompare([id, b]); return; }
    if (!b && id !== a) { setCompare([a, id]); return; }
    setCompare(null);
  }

  const monthYear = (d: string, y: 'numeric' | '2-digit' = 'numeric') => new Date(d).toLocaleDateString(nf, { month: 'short', year: y }).replace('.', '');
  const selected = (id: string) => !!compare && (compare[0] === id || compare[1] === id);

  return (
    <Card as="section" aria-labelledby="coliseo-photos" padding="lg" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconChip icon={Camera} tone="success" size="sm" />
          <h3 id="coliseo-photos" className="text-heading-sm">{t.photosTitle}</h3>
        </div>
        <PhotoSourceButtons size="sm" loading={uploading} onPick={(file) => void handleUpload(file)} />
      </div>
      <PrivatePhotoNotice />

      {loadingPhotos ? <PageLoader label={t.photosLoading} words={loading.coliseo} size="sm" /> : photos.length === 0 ? (
        <EmptyState icon={Camera} tone="success" title={t.noPhotosTitle} description={t.noPhotosBody} className="py-4" />
      ) : (
        <>
          {compare && compare[0] && compare[1] && (
            <div className="grid grid-cols-2 gap-3">
              {[compare[0], compare[1]].map((id, i) => {
                const p = photos.find((ph) => ph.id === id);
                return p ? (
                  <figure key={id} className="flex flex-col gap-1">
                    <figcaption className="text-label-md text-on-surface-light">{i === 0 ? t.before : t.after} · {monthYear(p.date)}</figcaption>
                    <img src={`data:image/jpeg;base64,${p.photoData}`} className="aspect-square w-full rounded-xl border border-border object-cover" alt={t.photoAlt(i === 0 ? t.photoAltBefore : t.photoAltAfter, monthYear(p.date))} />
                  </figure>
                ) : null;
              })}
              <Button variant="ghost" size="sm" className="col-span-2" onClick={() => setCompare(null)}>{t.closeCompare}</Button>
            </div>
          )}
          <ul className="grid grid-cols-3 gap-3">
            {photos.map((p) => (
              <li key={p.id}>
                <button
                  type="button" aria-pressed={selected(p.id)} aria-label={t.photoAria(monthYear(p.date), selected(p.id))}
                  onClick={() => toggleCompare(p.id)}
                  className={cn('relative block w-full overflow-hidden rounded-xl border-2 transition-colors', selected(p.id) ? 'border-primary' : 'border-border hover:border-primary/40')}
                >
                  <img src={`data:image/jpeg;base64,${p.photoData}`} className="aspect-square w-full object-cover" alt="" />
                  <span className="absolute inset-x-0 bottom-0 bg-on-background/70 py-0.5 text-center text-label-md text-background">{monthYear(p.date, '2-digit')}</span>
                </button>
              </li>
            ))}
          </ul>
          {photos.length >= 2 && !compare && <p className="text-center text-body-sm text-on-surface-light">{t.compareHint}</p>}
        </>
      )}
    </Card>
  );
}
