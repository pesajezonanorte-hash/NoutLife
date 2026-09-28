import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CalendarClock, Coffee, Dumbbell, Moon, MonitorSmartphone } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { PixelPanel } from '../../components/ui/PixelPanel';
import { PixelButton } from '../../components/ui/PixelButton';
import { ModalFrame } from '../../components/ui/ModalFrame';
import type { SleepLog, SleepStats } from '@lifequest/shared';
import * as sleepService from '../../services/sleep.service';
import { SageContextButton } from '../../components/sage/SageContextButton';
import { E } from '@/components/ui/glyphs';

const QUALITY_LABELS = ['', ' Terrible', ' Malo', ' Regular', ' Bueno', ' Excelente'];
const QUALITY_COLORS = ['', 'var(--accent-red)', 'var(--text-muted)', 'var(--text-secondary)', 'var(--accent-green)', 'var(--accent-green)'];

function SleepModal({ onClose, onSave }: { onClose: () => void; onSave: (log: SleepLog) => void }) {
  const today = new Date().toISOString().split('T')[0];
  const [bedtime, setBedtime] = useState(`${today}T23:00`);
  const [wakeTime, setWakeTime] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return `${tomorrow.toISOString().split('T')[0]}T07:00`;
  });
  const [quality, setQuality] = useState(4);
  const [notes, setNotes] = useState('');
  const [caffeineLate, setCaffeineLate] = useState(false);
  const [screensBeforeBed, setScreensBeforeBed] = useState(false);
  const [exercisedToday, setExercisedToday] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const duration = (() => {
    try {
      let hours = (new Date(wakeTime).getTime() - new Date(bedtime).getTime()) / 3600000;
      if (hours < 0) hours += 24;
      return hours.toFixed(1);
    } catch {
      return '?';
    }
  })();

  async function save() {
    setSaving(true);
    try {
      const log = await sleepService.createSleep({
        bedtime,
        wakeTime,
        quality,
        notes: notes || undefined,
        date: today,
        caffeineLate,
        screensBeforeBed,
        exercisedToday,
      });
      onSave(log);
      toast.success('¡Sueño registrado!', `${duration}h de descanso`);
    } catch {
      toast.error('Error al registrar sueño');
    } finally {
      setSaving(false);
    }
  }

  const factors = [
    { key: 'caffeine', label: 'Tomé cafeína tarde', detail: 'Después de las 4 p. m.', active: caffeineLate, setActive: setCaffeineLate, Icon: Coffee },
    { key: 'screens', label: 'Usé pantallas antes de dormir', detail: 'TV, móvil o computador', active: screensBeforeBed, setActive: setScreensBeforeBed, Icon: MonitorSmartphone },
    { key: 'exercise', label: 'Hice ejercicio hoy', detail: 'Entrenamiento o actividad física', active: exercisedToday, setActive: setExercisedToday, Icon: Dumbbell },
  ];

  const inputClass = 'min-h-11 min-w-0 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2.5 text-base text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-gold)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent-gold)_16%,transparent)]';

  return (
    <ModalFrame
      title="Registrar descanso"
      description="Guarda cómo dormiste para detectar patrones y cuidar tu energía."
      icon={<Moon className="h-4 w-4" aria-hidden="true" />}
      onClose={onClose}
      size="lg"
      contentClassName="space-y-5"
      footer={(
        <div className="grid grid-cols-2 gap-2.5">
          <PixelButton variant="ghost" onClick={onClose} className="w-full">Cancelar</PixelButton>
          <PixelButton variant="primary" onClick={save} disabled={saving} className="w-full">
            {saving ? 'Guardando…' : 'Registrar sueño'}
          </PixelButton>
        </div>
      )}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="min-w-0">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
            <CalendarClock className="h-3.5 w-3.5 text-[var(--accent-gold)]" aria-hidden="true" /> Me acosté
          </span>
          <input
            type="datetime-local"
            value={bedtime}
            onChange={(event) => setBedtime(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="min-w-0">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
            <CalendarClock className="h-3.5 w-3.5 text-[var(--accent-gold)]" aria-hidden="true" /> Me levanté
          </span>
          <input
            type="datetime-local"
            value={wakeTime}
            onChange={(event) => setWakeTime(event.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel-light)] p-4 text-center shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">Duración calculada</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-[var(--accent-gold)]">{duration}<span className="ml-0.5 text-base">h</span></p>
      </section>

      <fieldset>
        <legend className="mb-2 text-xs font-medium text-[var(--text-secondary)]">¿Cómo descansaste?</legend>
        <div className="flex items-center gap-2" role="radiogroup" aria-label="Calidad del sueño">
          {[1, 2, 3, 4, 5].map((rating) => {
            const selected = quality === rating;
            return (
              <motion.button
                key={rating}
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => setQuality(rating)}
                aria-label={`${rating} de 5`}
                aria-pressed={selected}
                className={`flex h-11 flex-1 items-center justify-center rounded-xl border text-lg transition-colors ${
                  selected
                    ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/10 text-[var(--accent-gold)]'
                    : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                }`}
              >
                <E e="⭐" />
              </motion.button>
            );
          })}
        </div>
        <p className="mt-2 text-center text-sm font-medium" style={{ color: QUALITY_COLORS[quality] }}><E e={QUALITY_LABELS[quality]} /></p>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Factores de la noche</legend>
        <div className="space-y-2">
          {factors.map(({ key, label, detail, active, setActive, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActive(!active)}
              aria-pressed={active}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                active
                  ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/10'
                  : 'border-[var(--border)] bg-[var(--bg-panel-light)] hover:border-[var(--border-strong)]'
              }`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-[var(--accent-gold)]/15 text-[var(--accent-gold)]' : 'bg-[var(--bg-muted)] text-[var(--text-secondary)]'}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-[var(--text-primary)]">{label}</span>
                <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{detail}</span>
              </span>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${active ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)] text-[var(--bg-deep)]' : 'border-[var(--border-strong)] text-transparent'}`}>
                <E e="✓" />
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Notas <span className="font-normal text-[var(--text-muted)]">(opcional)</span></span>
        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Algo que quieras recordar sobre tu noche"
          className={inputClass}
        />
      </label>
    </ModalFrame>
  );
}

export default function SleepPage() {
  const toast = useToast();
  const [logs, setLogs] = useState<SleepLog[]>([]);
  const [stats, setStats] = useState<SleepStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, s] = await Promise.all([sleepService.fetchSleep(), sleepService.fetchSleepStats()]);
      setLogs(l);
      setStats(s);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSaved(log: SleepLog) {
    setLogs(prev => [log, ...prev]);
    setShowModal(false);
    load();
  }

  async function handleDelete(id: string) {
    setLogs(prev => prev.filter(l => l.id !== id));
    try { await sleepService.deleteSleep(id); load(); }
    catch { toast.error('Error al eliminar'); load(); }
  }

  const chartData = logs.slice(0, 14).reverse().map(l => ({
    date: new Date(l.date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' }),
    horas: Number(l.duration.toFixed(1)),
    quality: l.quality,
  }));

  const lastLog = logs[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-pixel text-accent-gold" style={{ fontSize: '14px' }}><E e="🌙" /> TORRE DEL SUEÑO</h1>
          <p className="font-vt text-text-secondary text-base">Tu descanso es tu HP, héroe</p>
        </div>
        <div className="flex items-center gap-2">
          <SageContextButton message="¿Cómo está mi sueño últimamente? ¿Qué patrones detectas?" label="Pídele consejo al Sabio" />
          <PixelButton variant="primary" onClick={() => setShowModal(true)}>+ REGISTRAR SUEÑO</PixelButton>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'PROMEDIO SEMANAL', value: `${stats.weeklyAvg.toFixed(1)}h`, icon: '🌙' },
            { label: 'PROMEDIO TOTAL', value: `${stats.avgDuration.toFixed(1)}h`, icon: '📊' },
            { label: 'CALIDAD MEDIA', value: `${stats.avgQuality.toFixed(1)}/5`, icon: '⭐' },
            { label: 'TENDENCIA', value: stats.trend === 'improving' ? '↑ Mejorando' : stats.trend === 'declining' ? '↓ Bajando' : '→ Estable', icon: '📈' },
          ].map(s => (
            <PixelPanel key={s.label} className="p-3 text-center">
              <p className="text-2xl"><E e={s.icon} /></p>
              <p className="font-pixel text-accent-gold mt-1" style={{ fontSize: '11px' }}>{s.value}</p>
              <p className="font-pixel text-text-secondary" style={{ fontSize: '6px' }}>{s.label}</p>
            </PixelPanel>
          ))}
        </div>
      )}

      {/* Last night */}
      {lastLog && (
        <PixelPanel className="p-4">
          <p className="font-pixel text-text-secondary mb-2" style={{ fontSize: '8px' }}>ANOCHE</p>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="font-vt text-text-primary text-xl">
                {new Date(lastLog.bedtime).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} →{' '}
                {new Date(lastLog.wakeTime).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="font-pixel text-accent-gold mt-1" style={{ fontSize: '12px' }}>{lastLog.duration.toFixed(1)}h</p>
            </div>
            <div className="text-right">
              <p className="font-vt text-text-primary text-2xl">{Array.from({ length: lastLog.quality }).map((_, i) => <E key={i} e="⭐" s={16} className="inline-block" />)}</p>
              <p className="font-vt text-text-secondary text-base"><E e={QUALITY_LABELS[lastLog.quality]} /></p>
              {(lastLog as any).sleepScore != null && (
                <div className="mt-1 inline-block px-2 py-0.5 border-2 font-pixel" style={{
                  fontSize: '9px',
                  borderColor: (lastLog as any).sleepScore >= 80 ? 'var(--accent-green)' : (lastLog as any).sleepScore >= 60 ? 'var(--accent-gold)' : 'var(--accent-red)',
                  color: (lastLog as any).sleepScore >= 80 ? 'var(--accent-green)' : (lastLog as any).sleepScore >= 60 ? 'var(--accent-gold)' : 'var(--accent-red)',
                }}>
                  SCORE: {(lastLog as any).sleepScore}/100
                </div>
              )}
            </div>
          </div>
          {lastLog.duration < 7 && (
            <p className="font-vt text-accent-red text-base mt-2"><E e="⚠" /> Tu HP está bajo, héroe. Descansa más esta noche.</p>
          )}
        </PixelPanel>
      )}

      {/* Chart */}
      {chartData.length > 1 && (
        <PixelPanel className="p-4">
          <p className="font-pixel text-text-secondary mb-3" style={{ fontSize: '8px' }}>ÚLTIMAS 2 SEMANAS</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontFamily: 'Montserrat', fontSize: 12, fill: '#8a8a92' }} />
              <YAxis domain={[0, 10]} tick={{ fontFamily: 'Montserrat', fontSize: 12, fill: '#8a8a92' }} />
              <Tooltip contentStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border-strong)', fontFamily: 'Montserrat', fontSize: '16px', color: 'var(--text-primary)' }} formatter={(v: number) => `${v}h`} />
              <Bar dataKey="horas">
                {chartData.map((d, i) => (
                  <Cell key={i} fill={QUALITY_COLORS[d.quality] ?? 'var(--text-muted)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </PixelPanel>
      )}

      {/* Log list */}
      {!loading && logs.length > 0 && (
        <div className="space-y-2">
          <p className="font-pixel text-text-secondary" style={{ fontSize: '8px' }}>HISTORIAL</p>
          <AnimatePresence>
            {logs.map((l, i) => (
              <motion.div key={l.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }}>
                <PixelPanel className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-vt text-text-primary text-lg">{new Date(l.date).toLocaleDateString('es-CO', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                    <p className="font-pixel text-text-secondary" style={{ fontSize: '7px' }}>
                      {new Date(l.bedtime).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} → {new Date(l.wakeTime).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-pixel text-accent-gold" style={{ fontSize: '11px' }}>{l.duration.toFixed(1)}h</p>
                    <p className="font-vt text-base" style={{ color: QUALITY_COLORS[l.quality] }}>{Array.from({ length: l.quality }).map((_, i) => <E key={i} e="⭐" s={14} className="inline-block" />)}</p>
                    <button onClick={() => handleDelete(l.id)} className="flex h-11 w-11 items-center justify-center font-pixel text-accent-red hover:opacity-70" style={{ fontSize: '8px' }}><E e="✕" /></button>
                  </div>
                </PixelPanel>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showModal && <SleepModal onClose={() => setShowModal(false)} onSave={handleSaved} />}
      </AnimatePresence>
    </div>
  );
}
