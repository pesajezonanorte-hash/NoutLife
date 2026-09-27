import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { PixelPanel } from '../ui/PixelPanel';
import { PixelButton } from '../ui/PixelButton';
import { ModalFrame } from '../ui/ModalFrame';
import * as gym2 from '../../services/gym2.service';
import { E } from '@/components/ui/glyphs';

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

  const pct = remaining !== null ? (remaining / duration) * 100 : 100;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (pct / 100) * circumference;
  const color = remaining !== null && remaining <= 10
    ? 'var(--accent-red)'
    : remaining !== null && remaining <= 30
      ? 'var(--accent-gold)'
      : 'var(--accent-green)';
  const displaySeconds = remaining ?? duration;

  return (
    <ModalFrame
      title="Descanso entre series"
      description="Recupera el ritmo antes de tu siguiente serie."
      icon={<Timer className="h-4 w-4" aria-hidden="true" />}
      onClose={onClose}
      size="sm"
      contentClassName="space-y-5 text-center"
      footer={(
        running ? (
          <PixelButton variant="danger" onClick={stop} className="w-full">Detener temporizador</PixelButton>
        ) : (
          <PixelButton variant="primary" onClick={() => start()} className="w-full">Iniciar {duration}s</PixelButton>
        )
      )}
    >
      <div className="flex justify-center">
        <div className="relative inline-flex h-36 w-36 items-center justify-center rounded-full bg-[var(--bg-panel-light)] shadow-sm">
          <svg width="128" height="128" className="-rotate-90" aria-hidden="true">
            <circle cx="64" cy="64" r={radius} fill="none" stroke="var(--border)" strokeWidth="8" />
            <motion.circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - strokeDash}
              strokeLinecap="round"
              transition={{ duration: 0.45 }}
            />
          </svg>
          <div className="absolute text-center">
            <p className="text-3xl font-semibold tabular-nums" style={{ color }}>{displaySeconds}</p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">segundos</p>
          </div>
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-left text-xs font-medium text-[var(--text-secondary)]">Duración</legend>
        <div className="grid grid-cols-4 gap-1.5">
          {TIMER_PRESETS.map((seconds) => {
            const selected = duration === seconds;
            return (
              <button
                key={seconds}
                type="button"
                onClick={() => chooseDuration(seconds)}
                aria-pressed={selected}
                className={`min-h-10 rounded-xl border text-xs font-medium tabular-nums transition-colors ${
                  selected
                    ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/10 text-[var(--accent-gold)]'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                }`}
              >
                {seconds}s
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="number"
            min="1"
            inputMode="numeric"
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && applyCustomDuration()}
            placeholder="Otro tiempo en segundos"
            className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-gold)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent-gold)_16%,transparent)]"
          />
          <button
            type="button"
            onClick={applyCustomDuration}
            disabled={!custom || Number(custom) <= 0}
            className="rounded-xl border border-[var(--border)] px-3 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-gold)] hover:text-[var(--accent-gold)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Aplicar
          </button>
        </div>
      </fieldset>

      {remaining === 0 && (
        <motion.p
          className="rounded-xl border border-[var(--accent-green)]/40 bg-[var(--accent-green)]/10 px-3 py-2 text-sm font-medium text-[var(--accent-green)]"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          ¡Listo! Siguiente serie <E e="💪" />
        </motion.p>
      )}
    </ModalFrame>
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
      setRecords(prev => [...prev, rec].sort((a, b) => a.date.localeCompare(b.date)));
      setWeight('');
      setNotes('');
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    await gym2.deleteBodyWeight(id);
    setRecords(prev => prev.filter(r => r.id !== id));
  }

  const chartData = records.map(r => ({
    date: new Date(r.date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' }),
    peso: r.weight,
  }));

  const latest = records[records.length - 1];
  const first = records[0];
  const change = latest && first && records.length > 1 ? latest.weight - first.weight : null;

  return (
    <PixelPanel className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="pixel-text text-sm text-[var(--accent-gold)]"><E e="⚖" /> PESO CORPORAL</h3>
        {latest && (
          <div className="text-right">
            <p className="text-xl font-bold text-[var(--text-primary)]">{latest.weight} kg</p>
            {change !== null && (
              <p className={`text-xs ${change < 0 ? 'text-green-400' : change > 0 ? 'text-red-400' : 'text-[var(--text-secondary)]'}`}>
                {change > 0 ? '+' : ''}{change.toFixed(1)} kg total
              </p>
            )}
          </div>
        )}
      </div>

      {records.length > 1 && (
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={chartData}>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} width={35} />
            <Tooltip contentStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', fontSize: 12 }} />
            <Line type="monotone" dataKey="peso" stroke="var(--accent-gold)" strokeWidth={2} dot={{ r: 3, fill: 'var(--accent-gold)' }} />
          </LineChart>
        </ResponsiveContainer>
      )}

      <div className="flex gap-2 mt-3">
        <input
          type="number"
          value={weight}
          onChange={e => setWeight(e.target.value)}
          placeholder="Peso (kg)"
          step="0.1"
          className="flex-1 bg-[var(--bg-deep)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-gold)]"
        />
        <input
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Nota (opcional)"
          className="flex-1 bg-[var(--bg-deep)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-gold)]"
        />
        <button onClick={handleSave} disabled={!weight || saving} className="pixel-button px-3 py-2 text-sm disabled:opacity-50">
          {saving ? '...' : '+ Registrar'}
        </button>
      </div>

      {records.length > 0 && (
        <div className="mt-3 max-h-40 overflow-y-auto space-y-1">
          {[...records].reverse().slice(0, 8).map(r => (
            <div key={r.id} className="flex items-center justify-between text-xs py-1 border-b border-[var(--border)]">
              <span className="text-[var(--text-secondary)]">{new Date(r.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>
              <span className="font-bold text-[var(--text-primary)]">{r.weight} kg</span>
              {r.notes && <span className="text-[var(--text-muted)] truncate max-w-[100px]">{r.notes}</span>}
              <button onClick={() => handleDelete(r.id)} className="text-red-400 hover:text-red-300 ml-1"><E e="✕" /></button>
            </div>
          ))}
        </div>
      )}
    </PixelPanel>
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
    const oneRM = r === 1 ? w : Math.round(w * (1 + r / 30));
    setResult(oneRM);
  }

  const percentages = result ? [100, 95, 90, 85, 80, 75, 70].map(pct => ({
    pct,
    weight: Math.round(result * pct / 100 * 2) / 2,
    reps: pct === 100 ? 1 : pct >= 90 ? 3 : pct >= 85 ? 4 : pct >= 80 ? 6 : pct >= 75 ? 8 : pct >= 70 ? 10 : 12,
  })) : [];

  return (
    <PixelPanel className="p-4">
      <h3 className="pixel-text text-sm text-[var(--accent-gold)] mb-4"><E e="💪" /> CALCULADORA 1RM</h3>
      <div className="flex gap-2 mb-3">
        <input value={weight} onChange={e => setWeight(e.target.value)} placeholder="Peso (kg)" type="number" step="0.5"
          className="flex-1 bg-[var(--bg-deep)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-gold)]" />
        <input value={reps} onChange={e => setReps(e.target.value)} placeholder="Reps" type="number" min="1"
          className="w-20 bg-[var(--bg-deep)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-gold)]" />
        <button onClick={calc} className="pixel-button px-3 py-2 text-sm">Calcular</button>
      </div>
      {result !== null && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-center mb-3">
            <span className="pixel-text text-3xl text-[var(--accent-gold)]">{result}</span>
            <span className="text-sm text-[var(--text-secondary)] ml-1">kg (1RM estimado)</span>
          </p>
          <div className="grid grid-cols-4 gap-1 text-xs">
            {percentages.map(({ pct, weight: w, reps: r }) => (
              <div key={pct} className="bg-[var(--bg-deep)] border border-[var(--border)] rounded p-2 text-center">
                <p className="text-[var(--text-secondary)]">{pct}%</p>
                <p className="font-bold text-[var(--text-primary)]">{w}kg</p>
                <p className="text-[var(--text-muted)]">×{r}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </PixelPanel>
  );
}

// ─── Weekly Volume ─────────────────────────────────────────────────────────────

export function WeeklyVolumeWidget() {
  const [data, setData] = useState<gym2.WeeklyVolume>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    gym2.fetchWeeklyVolume().then(setData).finally(() => setLoading(false));
  }, []);

  const chartData = Object.entries(data)
    .sort((a, b) => b[1].sets - a[1].sets)
    .map(([muscle, { sets, volume }]) => ({ muscle: muscle.slice(0, 8), sets, volume: Math.round(volume) }));

  if (loading) return <PixelPanel className="p-4 animate-pulse"><div className="h-32 bg-[var(--bg-deep)] rounded" /></PixelPanel>;
  if (chartData.length === 0) return null;

  return (
    <PixelPanel className="p-4">
      <h3 className="pixel-text text-sm text-[var(--accent-gold)] mb-4"><E e="📊" /> VOLUMEN SEMANAL POR MÚSCULO</h3>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={chartData} barSize={24}>
          <XAxis dataKey="muscle" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} width={25} />
          <Tooltip
            contentStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', fontSize: 12 }}
            formatter={(v, n) => [n === 'sets' ? `${v} sets` : `${v} kg·reps`, n === 'sets' ? 'Sets' : 'Volumen']}
          />
          <Bar dataKey="sets" fill="var(--accent-blue)" radius={[4, 4, 0, 0]} name="sets" />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-2">
        {chartData.map(({ muscle, sets }) => (
          <span key={muscle} className="text-xs bg-[var(--bg-deep)] border border-[var(--border)] px-2 py-0.5 rounded">
            <span className="text-[var(--text-secondary)]">{muscle}:</span>
            <span className="font-bold text-[var(--text-primary)] ml-1">{sets} sets</span>
          </span>
        ))}
      </div>
    </PixelPanel>
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
      alert('La foto debe pesar menos de 500KB. Comprime la imagen primero.');
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        await gym2.saveProgressPhoto(base64, new Date().toISOString().slice(0, 10));
        const fresh = await gym2.fetchProgressPhotos();
        setPhotos(fresh);
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert(err.message);
      setUploading(false);
    }
  }

  function toggleCompare(id: string) {
    if (!compare) { setCompare([id, '']); return; }
    const [first, second] = compare;
    if (!first) { setCompare([id, second]); return; }
    if (!second && id !== first) { setCompare([first, id]); return; }
    setCompare(null);
  }

  return (
    <PixelPanel className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="pixel-text text-sm text-[var(--accent-gold)]"><E e="📸" /> PROGRESO VISUAL</h3>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="pixel-button px-3 py-1 text-xs disabled:opacity-50"
        >
          {uploading ? '...' : '+ Foto'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
      </div>

      {photos.length === 0 ? (
        <p className="text-center text-[var(--text-muted)] text-sm py-6">Sin fotos aún. Sube tu primera foto de progreso.</p>
      ) : (
        <>
          {compare && compare[0] && compare[1] && (
            <div className="mb-4 grid grid-cols-2 gap-2">
              {[compare[0], compare[1]].map((id, i) => {
                const p = photos.find(ph => ph.id === id);
                return p ? (
                  <div key={id} className="relative">
                    <p className="text-xs text-[var(--text-secondary)] mb-1">{i === 0 ? 'Antes' : 'Después'} · {new Date(p.date).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })}</p>
                    <img src={`data:image/jpeg;base64,${p.photoData}`} className="w-full aspect-square object-cover rounded border border-[var(--border)]" alt="" />
                  </div>
                ) : null;
              })}
              <button onClick={() => setCompare(null)} className="col-span-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Cerrar comparación</button>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {photos.map(p => (
              <div key={p.id} className={`relative cursor-pointer rounded overflow-hidden border-2 transition-colors ${compare && (compare[0] === p.id || compare[1] === p.id) ? 'border-[var(--accent-gold)]' : 'border-[var(--border)] hover:border-[var(--accent-blue)]'}`}
                onClick={() => toggleCompare(p.id)}>
                <img src={`data:image/jpeg;base64,${p.photoData}`} className="w-full aspect-square object-cover" alt="" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] text-white text-center py-0.5">
                  {new Date(p.date).toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
          {photos.length >= 2 && !compare && (
            <p className="text-xs text-[var(--text-secondary)] text-center mt-2">Toca 2 fotos para comparar</p>
          )}
        </>
      )}
    </PixelPanel>
  );
}
