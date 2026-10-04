// Extras de Gimnasio (rediseño): descanso entre series, peso corporal, 1RM,
// volumen semanal por músculo y fotos de progreso. Misma lógica y servicios
// (gym2.service); solo cambia la piel a componentes/tokens lq.
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Camera, Dumbbell, Scale, Timer as TimerIcon, Trash2, Plus, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, BarChart, Button, Card, EmptyState, Field, IconChip, Input, LineChart, Modal, ProgressRing, chipClasses, type BarDatum, type LinePoint, PageLoader } from '@/components/ui/lq';
import { LOADING_COPY } from '@/lib/loadingCopy';
import { useToastStore } from '@/hooks/useToast';
import * as gym2 from '../../services/gym2.service';

// ─── Rest Timer ────────────────────────────────────────────────────────────────

const TIMER_PRESETS = [60, 90, 120, 180];

export function RestTimer({ onClose }: { onClose: () => void }) {
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
    <Modal open onClose={onClose} title="Descanso entre series">
      <p className="-mt-2 text-body-sm text-on-surface-light">Recupera el ritmo antes de tu siguiente serie.</p>
      <div className="flex justify-center">
        <ProgressRing value={pct} tone={tone} size={144} stroke={10} label="Tiempo de descanso restante" valueText={`${shown} segundos`}>
          <span className="flex flex-col items-center">
            <span className="font-mono text-display-sm font-bold tabular-nums">{shown}</span>
            <span className="text-label-md text-on-surface-light">segundos</span>
          </span>
        </ProgressRing>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label-lg text-on-surface">Duración</legend>
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
            type="number" min="1" inputMode="numeric" aria-label="Otro tiempo en segundos"
            value={custom} onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyCustomDuration()}
            placeholder="Otro tiempo (s)" className="min-w-0 flex-1"
          />
          <Button variant="secondary" size="md" onClick={applyCustomDuration} disabled={!custom || Number(custom) <= 0}>Aplicar</Button>
        </div>
      </fieldset>

      <p role="status" className="min-h-6 text-center text-label-lg text-success-text">
        {remaining === 0 ? '¡Listo! Siguiente serie' : ''}
      </p>

      {running ? (
        <Button variant="danger" block onClick={stop}>Detener temporizador</Button>
      ) : (
        <Button block onClick={() => start()}><TimerIcon aria-hidden className="size-4" />Iniciar {duration}s</Button>
      )}
    </Modal>
  );
}

// ─── Body Weight Tracker ───────────────────────────────────────────────────────

export function BodyWeightTracker() {
  const [records, setRecords] = useState<gym2.BodyWeight[]>([]);
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    gym2.fetchBodyWeights().then(setRecords).finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!weight) return;
    setSaving(true);
    try {
      const rec = await gym2.logBodyWeight(parseFloat(weight), new Date().toISOString().slice(0, 10), notes || undefined);
      setRecords((prev) => [...prev, rec].sort((a, b) => a.date.localeCompare(b.date)));
      setWeight('');
      setNotes('');
    } catch {
      useToastStore.getState().error('No se pudo registrar el peso');
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    try {
      await gym2.deleteBodyWeight(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
    } catch {
      useToastStore.getState().error('No se pudo eliminar el registro');
    }
  }

  const points: LinePoint[] = records.map((r) => {
    const label = new Date(r.date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }).replace('.', '');
    return { label, value: r.weight, tip: `${label} · ${r.weight} kg` };
  });
  const latest = records[records.length - 1];
  const first = records[0];
  const change = latest && first && records.length > 1 ? latest.weight - first.weight : null;
  const lo = Math.floor(Math.min(...records.map((r) => r.weight)) - 1);
  const hi = Math.ceil(Math.max(...records.map((r) => r.weight)) + 1);

  return (
    <Card as="section" aria-labelledby="gym-weight" padding="lg" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconChip icon={Scale} tone="info" size="sm" />
          <h3 id="gym-weight" className="text-heading-sm">Peso corporal</h3>
        </div>
        {latest && (
          <div className="text-right">
            <p className="font-mono text-heading-sm font-bold tabular-nums">{latest.weight} kg</p>
            {change !== null && (
              <p className={cn('text-label-md tabular-nums', change < 0 ? 'text-success-text' : change > 0 ? 'text-warning-text' : 'text-on-surface-light')}>
                {change > 0 ? '+' : ''}{change.toFixed(1)} kg total
              </p>
            )}
          </div>
        )}
      </div>

      {loading ? <PageLoader label="Leyendo tu peso…" words={LOADING_COPY.gym} size="sm" /> : records.length > 1 && (
        <LineChart data={points} min={lo} max={hi} label={`Peso corporal: de ${first.weight} a ${latest.weight} kg`} tone="info" height={140} dots />
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
        <Field label="Peso (kg)"><Input type="number" inputMode="decimal" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="72.5" /></Field>
        <Field label="Nota (opcional)"><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="En ayunas" /></Field>
        <Button onClick={() => void handleSave()} disabled={!weight} loading={saving}><Plus aria-hidden className="size-4" />Registrar</Button>
      </div>

      {records.length > 0 && (
        <ul className="flex max-h-48 flex-col overflow-y-auto">
          {[...records].reverse().slice(0, 8).map((r) => (
            <li key={r.id} className="flex min-h-11 items-center gap-3 border-b border-border last:border-0">
              <span className="w-20 text-body-sm text-on-surface-light">{new Date(r.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')}</span>
              <span className="font-mono text-label-lg tabular-nums">{r.weight} kg</span>
              {r.notes && <span className="min-w-0 flex-1 truncate text-body-sm text-on-surface-light">{r.notes}</span>}
              <Button variant="icon" size="sm" aria-label={`Eliminar registro del ${new Date(r.date).toLocaleDateString('es-ES')}`} onClick={() => void handleDelete(r.id)} className="ml-auto">
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

export function OneRMCalculator() {
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [result, setResult] = useState<number | null>(null);

  function calc() {
    const w = parseFloat(weight);
    const r = parseInt(reps);
    if (!w || !r || r < 1) return;
    setResult(r === 1 ? w : Math.round(w * (1 + r / 30)));
  }

  const percentages = result ? [100, 95, 90, 85, 80, 75, 70].map((pct) => ({
    pct,
    weight: Math.round(result * pct / 100 * 2) / 2,
    reps: pct === 100 ? 1 : pct >= 90 ? 3 : pct >= 85 ? 4 : pct >= 80 ? 6 : pct >= 75 ? 8 : 10,
  })) : [];

  return (
    <Card as="section" aria-labelledby="gym-1rm" padding="lg" className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <IconChip icon={Dumbbell} tone="warning" size="sm" />
        <h3 id="gym-1rm" className="text-heading-sm">Calculadora 1RM</h3>
      </div>
      <form className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); calc(); }}>
        <Field label="Peso (kg)"><Input type="number" inputMode="decimal" step="0.5" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="80" /></Field>
        <Field label="Repeticiones"><Input type="number" inputMode="numeric" min="1" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="5" /></Field>
        <Button type="submit" variant="secondary" disabled={!weight || !reps}>Calcular</Button>
      </form>
      {result !== null && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4" aria-live="polite">
          <p className="text-center">
            <span className="font-mono text-display-sm font-bold tabular-nums text-primary-text">{result}</span>
            <span className="ml-2 text-body-sm text-on-surface-light">kg · 1RM estimado</span>
          </p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {percentages.map(({ pct, weight: w, reps: r }) => (
              <li key={pct} className="rounded-xl bg-surface-variant p-3 text-center">
                <p className="text-label-md text-on-surface-light">{pct}%</p>
                <p className="font-mono text-label-lg tabular-nums">{w} kg</p>
                <p className="font-mono text-label-md tabular-nums text-on-surface-light">×{r}</p>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </Card>
  );
}

// ─── Weekly Volume ─────────────────────────────────────────────────────────────

export function WeeklyVolumeWidget() {
  const [data, setData] = useState<gym2.WeeklyVolume>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    gym2.fetchWeeklyVolume().then(setData).finally(() => setLoading(false));
  }, []);

  const rows = Object.entries(data)
    .sort((a, b) => b[1].sets - a[1].sets)
    .map(([muscle, { sets, volume }]) => ({ muscle, sets, volume: Math.round(volume) }));
  const bars: BarDatum[] = rows.map((r, i) => ({
    label: r.muscle.slice(0, 5), value: r.sets, tip: `${r.muscle} · ${r.sets} series · ${r.volume.toLocaleString('es-ES')} kg·reps`, highlight: i === 0,
  }));

  if (loading) return <PageLoader label="Sumando tus récords…" words={LOADING_COPY.gym} size="sm" />;
  if (rows.length === 0) return null;

  return (
    <Card as="section" aria-labelledby="gym-muscle" padding="lg" className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <IconChip icon={BarChart3} tone="primary" size="sm" />
        <h3 id="gym-muscle" className="text-heading-sm">Volumen semanal por músculo</h3>
      </div>
      <BarChart data={bars} label={`Series por músculo: ${rows.map((r) => `${r.muscle} ${r.sets}`).join(', ')}`} height={160} showValues />
      <ul className="flex flex-wrap gap-2">
        {rows.map(({ muscle, sets }) => (
          <li key={muscle}><Badge variant="neutral">{muscle}: <span className="font-mono tabular-nums">{sets}</span> series</Badge></li>
        ))}
      </ul>
    </Card>
  );
}

// ─── Progress Photos ───────────────────────────────────────────────────────────

export function ProgressPhotos() {
  const [photos, setPhotos] = useState<gym2.ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [compare, setCompare] = useState<[string, string] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    gym2.fetchProgressPhotos().then(setPhotos).finally(() => setLoading(false));
  }, []);

  async function handleUpload(file: File) {
    if (file.size > 500 * 1024) {
      useToastStore.getState().warning('La foto pesa más de 500 KB', 'Comprime la imagen e inténtalo de nuevo.');
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = (e.target?.result as string).split(',')[1];
          await gym2.saveProgressPhoto(base64, new Date().toISOString().slice(0, 10));
          setPhotos(await gym2.fetchProgressPhotos());
        } catch {
          useToastStore.getState().error('No se pudo subir la foto');
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      useToastStore.getState().error('No se pudo leer la foto');
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

  const monthYear = (d: string, y: 'numeric' | '2-digit' = 'numeric') => new Date(d).toLocaleDateString('es-ES', { month: 'short', year: y }).replace('.', '');
  const selected = (id: string) => !!compare && (compare[0] === id || compare[1] === id);

  return (
    <Card as="section" aria-labelledby="gym-photos" padding="lg" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconChip icon={Camera} tone="success" size="sm" />
          <h3 id="gym-photos" className="text-heading-sm">Progreso visual</h3>
        </div>
        <Button variant="secondary" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}><Plus aria-hidden className="size-4" />Foto</Button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-label="Subir foto de progreso" onChange={(e) => e.target.files?.[0] && void handleUpload(e.target.files[0])} />
      </div>

      {loading ? <PageLoader label="Buscando tus fotos…" words={LOADING_COPY.gym} size="sm" /> : photos.length === 0 ? (
        <EmptyState icon={Camera} tone="success" title="Aún no hay fotos" description="Sube tu primera foto para ver tu cambio con el tiempo." className="py-4" />
      ) : (
        <>
          {compare && compare[0] && compare[1] && (
            <div className="grid grid-cols-2 gap-3">
              {[compare[0], compare[1]].map((id, i) => {
                const p = photos.find((ph) => ph.id === id);
                return p ? (
                  <figure key={id} className="flex flex-col gap-1">
                    <figcaption className="text-label-md text-on-surface-light">{i === 0 ? 'Antes' : 'Después'} · {monthYear(p.date)}</figcaption>
                    <img src={`data:image/jpeg;base64,${p.photoData}`} className="aspect-square w-full rounded-xl border border-border object-cover" alt={`Foto ${i === 0 ? 'anterior' : 'posterior'} de ${monthYear(p.date)}`} />
                  </figure>
                ) : null;
              })}
              <Button variant="ghost" size="sm" className="col-span-2" onClick={() => setCompare(null)}>Cerrar comparación</Button>
            </div>
          )}
          <ul className="grid grid-cols-3 gap-3">
            {photos.map((p) => (
              <li key={p.id}>
                <button
                  type="button" aria-pressed={selected(p.id)} aria-label={`Foto de ${monthYear(p.date)}${selected(p.id) ? ', seleccionada' : ''}`}
                  onClick={() => toggleCompare(p.id)}
                  className={cn('relative block w-full overflow-hidden rounded-xl border-2 transition-colors', selected(p.id) ? 'border-primary' : 'border-border hover:border-primary/40')}
                >
                  <img src={`data:image/jpeg;base64,${p.photoData}`} className="aspect-square w-full object-cover" alt="" />
                  <span className="absolute inset-x-0 bottom-0 bg-on-background/70 py-0.5 text-center text-label-md text-background">{monthYear(p.date, '2-digit')}</span>
                </button>
              </li>
            ))}
          </ul>
          {photos.length >= 2 && !compare && <p className="text-center text-body-sm text-on-surface-light">Toca 2 fotos para comparar</p>}
        </>
      )}
    </Card>
  );
}
