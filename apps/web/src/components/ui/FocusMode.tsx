import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Play, Pause, RotateCcw, Zap } from 'lucide-react';
import { logFocusSession } from '../../services/focus.service';
import { useUIStore } from '../../store/uiStore';
import { useToastStore } from '../../hooks/useToast';
import { refreshUser } from '../../hooks/useAuth';
import { E } from '@/components/ui/glyphs';
import { Slider } from './slider';

const PRESETS = [
  { label: '25 min', minutes: 25, color: 'var(--accent-cyan)' },
  { label: '45 min', minutes: 45, color: 'var(--accent-gold)' },
  { label: '60 min', minutes: 60, color: 'var(--accent-pink)' },
  { label: '90 min', minutes: 90, color: 'var(--accent-green)' },
];

const AMBIENT_SOUNDS = [
  { id: 'none', label: 'Silencio' },
  { id: 'rain', label: 'Lluvia' },
  { id: 'waves', label: 'Olas' },
  { id: 'forest', label: 'Bosque' },
  { id: 'fire', label: 'Fogata' },
] as const;

type AmbientSoundId = (typeof AMBIENT_SOUNDS)[number]['id'];

interface AmbientAudioController {
  stop: () => void;
  setVolume: (value: number) => void;
}

interface Props {
  onClose: () => void;
  taskLabel?: string;
  questId?: string;
}

function createNoiseBuffer(ctx: AudioContext, seconds = 2) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  let last = 0;
  for (let i = 0; i < data.length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }

  return buffer;
}

function createAmbientSound(type: AmbientSoundId, ctx: AudioContext, volume: number): AmbientAudioController | null {
  if (type === 'none') return null;

  const master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);

  const cleanup: Array<() => void> = [];

  const setVolume = (value: number) => {
    master.gain.setTargetAtTime(value, ctx.currentTime, 0.15);
  };

  const addLoopingNoise = (filterType: BiquadFilterType, frequency: number, gainValue: number, q = 0.7) => {
    const source = ctx.createBufferSource();
    source.buffer = createNoiseBuffer(ctx);
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = q;

    const gain = ctx.createGain();
    gain.gain.value = gainValue;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();

    cleanup.push(() => {
      source.stop();
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    });
  };

  if (type === 'rain') {
    addLoopingNoise('bandpass', 1800, 0.3, 0.9);
    addLoopingNoise('highpass', 900, 0.08, 0.3);
  }

  if (type === 'waves') {
    addLoopingNoise('lowpass', 500, 0.28, 0.5);

    const swell = ctx.createOscillator();
    const swellGain = ctx.createGain();
    swell.type = 'sine';
    swell.frequency.value = 0.12;
    swellGain.gain.value = 0.06;
    swell.connect(swellGain);
    swellGain.connect(master.gain);
    swell.start();

    cleanup.push(() => {
      swell.stop();
      swell.disconnect();
      swellGain.disconnect();
    });
  }

  if (type === 'forest') {
    addLoopingNoise('bandpass', 1200, 0.12, 0.8);
    addLoopingNoise('highpass', 2500, 0.03, 0.2);

    const chirpTimer = window.setInterval(() => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200 + Math.random() * 900, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1800 + Math.random() * 1200, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);

      window.setTimeout(() => {
        osc.disconnect();
        gain.disconnect();
      }, 250);
    }, 3200);

    cleanup.push(() => window.clearInterval(chirpTimer));
  }

  if (type === 'fire') {
    addLoopingNoise('lowpass', 700, 0.22, 0.5);
    addLoopingNoise('bandpass', 80, 0.12, 1.1);

    const crackleTimer = window.setInterval(() => {
      const source = ctx.createBufferSource();
      source.buffer = createNoiseBuffer(ctx, 0.15);

      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1800 + Math.random() * 1200;

      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
      source.stop(ctx.currentTime + 0.1);

      window.setTimeout(() => {
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
      }, 160);
    }, 1400);

    cleanup.push(() => window.clearInterval(crackleTimer));
  }

  return {
    stop: () => {
      cleanup.forEach((fn) => fn());
      master.disconnect();
    },
    setVolume,
  };
}

export function FocusMode({ onClose, taskLabel, questId }: Props) {
  const [preset, setPreset] = useState(PRESETS[0]);
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(PRESETS[0].minutes * 60);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const [task, setTask] = useState(taskLabel ?? '');
  const [ambientSound, setAmbientSound] = useState<AmbientSoundId>('none');
  const [ambientVolume, setAmbientVolume] = useState(35);
  const [saving, setSaving] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ambientControllerRef = useRef<AmbientAudioController | null>(null);
  const { addFloatingXP } = useUIStore();
  const toast = useToastStore();

  const totalSecs = preset.minutes * 60;
  const progress = ((totalSecs - remaining) / totalSecs) * 100;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !started) onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [started, onClose]);

  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current!);
      ambientControllerRef.current?.stop();
      ambientControllerRef.current = null;
      audioContextRef.current?.close().catch(() => null);
      audioContextRef.current = null;
    };
  }, []);

  useEffect(() => {
    ambientControllerRef.current?.setVolume(ambientVolume / 100);
  }, [ambientVolume]);

  async function syncAmbientSound(nextSound: AmbientSoundId) {
    ambientControllerRef.current?.stop();
    ambientControllerRef.current = null;

    if (nextSound === 'none') return;

    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioCtx();
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume().catch(() => null);
    }

    ambientControllerRef.current = createAmbientSound(nextSound, audioContextRef.current, ambientVolume / 100);
  }

  function handlePresetChange(p: typeof PRESETS[0]) {
    setPreset(p);
    setRemaining(p.minutes * 60);
    setStarted(false);
    setRunning(false);
    clearInterval(intervalRef.current!);
  }

  function handleAmbientChange(nextSound: AmbientSoundId) {
    setAmbientSound(nextSound);
    void syncAmbientSound(nextSound);
  }

  function handleStart() {
    setStarted(true);
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(intervalRef.current!);
          setRunning(false);
          setDone(true);
          if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }

  function handlePause() {
    setRunning(false);
    clearInterval(intervalRef.current!);
  }

  function handleResume() {
    setRunning(true);
    clearInterval(intervalRef.current!);
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(intervalRef.current!);
          setRunning(false);
          setDone(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }

  function handleReset() {
    clearInterval(intervalRef.current!);
    setRemaining(preset.minutes * 60);
    setRunning(false);
    setStarted(false);
    setDone(false);
  }

  async function handleComplete() {
    const elapsed = totalSecs - remaining;
    const durationMin = Math.max(1, Math.floor(elapsed / 60));
    setSaving(true);
    try {
      const result = await logFocusSession(durationMin, questId, task || undefined);
      addFloatingXP(result.xpEarned, window.innerWidth / 2, window.innerHeight / 2);
      toast.success(result.message);
      void refreshUser();
    } catch {
      toast.error('Error registrando sesión');
    } finally {
      setSaving(false);
      onClose();
    }
  }

  const circumference = 2 * Math.PI * 110;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => { if (e.target === e.currentTarget && !started) onClose(); }}
    >
      <motion.div
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--bg-deep)', border: `2px solid ${preset.color}44` }}
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
      >
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Zap size={18} style={{ color: preset.color }} />
            <span className="font-bold text-[var(--text-primary)]">Modo Enfoque</span>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 pb-8 space-y-6">
          {!started && (
            <div className="grid grid-cols-4 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.minutes}
                  onClick={() => handlePresetChange(p)}
                  className="py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: preset.minutes === p.minutes ? p.color + '33' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${preset.minutes === p.minutes ? p.color : 'transparent'}`,
                    color: preset.minutes === p.minutes ? p.color : 'var(--text-muted)',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {!started && (
            <input
              className="w-full rounded-xl bg-white/5 border border-[var(--border)] px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--accent-gold)] transition-colors"
              placeholder="¿En qué te vas a enfocar? (opcional)"
              value={task}
              onChange={(e) => setTask(e.target.value)}
            />
          )}

          <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Ambiente relajante</p>
                <p className="text-xs text-[var(--text-muted)]">Puedes dejarlo sonando durante tu sesión</p>
              </div>
              <span className="text-xs font-semibold" style={{ color: preset.color }}>
                {AMBIENT_SOUNDS.find((item) => item.id === ambientSound)?.label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {AMBIENT_SOUNDS.map((sound) => (
                <button
                  key={sound.id}
                  onClick={() => handleAmbientChange(sound.id)}
                  className="rounded-xl px-3 py-2 text-xs font-semibold transition-all"
                  style={{
                    background: ambientSound === sound.id ? `${preset.color}22` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${ambientSound === sound.id ? preset.color : 'rgba(255,255,255,0.08)'}`,
                    color: ambientSound === sound.id ? preset.color : 'var(--text-secondary)',
                  }}
                >
                  {sound.label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>Volumen</span>
                <span>{ambientVolume}%</span>
              </div>
              <Slider
                min={0}
                max={100}
                step={1}
                value={[ambientVolume]}
                onValueChange={([value]) => setAmbientVolume(value)}
                accent={preset.color}
                aria-label="Volumen del ambiente"
              />
            </div>
          </div>

          <div className="flex justify-center">
            <div className="relative" style={{ width: 240, height: 240 }}>
              <svg width={240} height={240}>
                <circle cx={120} cy={120} r={110} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={10} />
                <motion.circle
                  cx={120}
                  cy={120}
                  r={110}
                  fill="none"
                  stroke={preset.color}
                  strokeWidth={10}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - (progress / 100) * circumference}
                  transform="rotate(-90 120 120)"
                  transition={{ duration: 0.5 }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {done ? (
                  <div className="text-center">
                    <div className="text-5xl mb-2"><E e="🎉" /></div>
                    <p className="text-lg font-bold" style={{ color: preset.color }}>¡Completado!</p>
                  </div>
                ) : (
                  <>
                    <div className="tabular-nums text-5xl font-bold text-[var(--text-primary)]">
                      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                    </div>
                    {task && <p className="text-xs text-[var(--text-muted)] mt-2 max-w-[160px] text-center truncate">{task}</p>}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            {done ? (
              <motion.button
                onClick={handleComplete}
                disabled={saving}
                whileTap={{ scale: 0.96 }}
                className="flex-1 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
                style={{ background: preset.color, color: 'var(--bg-deep)' }}
              >
                {saving ? 'Guardando...' : <><Zap size={16} /> +XP – Guardar sesión</>}
              </motion.button>
            ) : !started ? (
              <motion.button
                onClick={handleStart}
                whileTap={{ scale: 0.96 }}
                className="flex-1 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
                style={{ background: preset.color, color: 'var(--bg-deep)' }}
              >
                <Play size={16} /> Comenzar
              </motion.button>
            ) : (
              <>
                <motion.button
                  onClick={running ? handlePause : handleResume}
                  whileTap={{ scale: 0.96 }}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
                  style={{ background: preset.color, color: 'var(--bg-deep)' }}
                >
                  {running ? <><Pause size={16} /> Pausar</> : <><Play size={16} /> Continuar</>}
                </motion.button>
                <motion.button
                  onClick={handleReset}
                  whileTap={{ scale: 0.96 }}
                  className="py-3 px-4 rounded-2xl border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <RotateCcw size={16} />
                </motion.button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
