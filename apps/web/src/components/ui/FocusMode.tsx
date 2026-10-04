// Modo enfoque — pantalla completa en móvil, diálogo centrado (520 px) en md+.
// Temporizador por marca de tiempo (no se desfasa si la pestaña se duerme),
// sonido ambiente opcional y aviso sonoro al terminar. Escape o cerrar durante
// una sesión piden confirmación en línea en vez de descartarla.
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Pause, Play, RotateCcw, Square, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dialog, scrim } from '@/lib/motion';
import { logFocusSession } from '@/services/focus.service';
import { useUIStore } from '@/store/uiStore';
import { useToastStore } from '@/hooks/useToast';
import { refreshUser } from '@/hooks/useAuth';
import { Button, Confetti, Field, IconChip, Input, SegmentedControl, Select, Switch, useDialogBehavior } from '@/components/ui/lq';
import { AMBIENT_SOUNDS, createAmbientSound, playChime, type AmbientAudioController, type AmbientSoundId } from '@/components/focus/ambientSound';

const PRESETS = ['25', '45', '60', '90'] as const;
type Preset = (typeof PRESETS)[number];
type Phase = 'setup' | 'running' | 'paused' | 'done';

interface Props {
  onClose: () => void;
  taskLabel?: string;
  questId?: string;
}

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const minutesText = (s: number) => {
  const m = Math.ceil(s / 60);
  return `${m} ${m === 1 ? 'minuto' : 'minutos'}`;
};

export function FocusMode({ onClose, taskLabel, questId }: Props) {
  const titleId = useId();
  const soundOnId = useId();
  const confirmId = useId();
  const [preset, setPreset] = useState<Preset>('25');
  const [phase, setPhase] = useState<Phase>('setup');
  const [remaining, setRemaining] = useState(25 * 60);
  const [task, setTask] = useState(taskLabel ?? '');
  const [ambient, setAmbient] = useState<AmbientSoundId>('none');
  const [volume, setVolume] = useState(35);
  const [chime, setChime] = useState(true);
  const [confirmExit, setConfirmExit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [announce, setAnnounce] = useState('');
  const endAt = useRef(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const ambientRef = useRef<AmbientAudioController | null>(null);
  const stayRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLButtonElement>(null);
  const addFloatingXP = useUIStore((s) => s.addFloatingXP);
  const toast = useToastStore();

  const total = Number(preset) * 60;
  const elapsed = total - remaining;
  const progress = phase === 'done' ? 1 : elapsed / total;
  const inSession = phase === 'running' || phase === 'paused';

  /** Cerrar: durante una sesión pide confirmación; si no, cierra. */
  const requestClose = () => {
    if (confirmExit) { setConfirmExit(false); return; }
    if (inSession) {
      if (phase === 'running') pause();
      setConfirmExit(true);
      return;
    }
    onClose();
  };
  const panelRef = useDialogBehavior(true, requestClose);

  useEffect(() => { if (confirmExit) stayRef.current?.focus(); }, [confirmExit]);
  // Al cambiar de fase el botón pulsado desaparece: el foco pasa al control principal.
  useEffect(() => {
    if (confirmExit) return;
    if (!panelRef.current?.contains(document.activeElement) || document.activeElement === panelRef.current) mainRef.current?.focus();
  }, [phase, confirmExit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tic cada 250 ms contra la hora de fin.
  useEffect(() => {
    if (phase !== 'running') return;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) finish();
    }, 250);
    return () => window.clearInterval(id);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    ambientRef.current?.stop();
    ctxRef.current?.close().catch(() => null);
  }, []);

  useEffect(() => { ambientRef.current?.setVolume(volume / 100); }, [volume]);

  async function audioCtx() {
    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!ctxRef.current || ctxRef.current.state === 'closed') ctxRef.current = new Ctx();
    if (ctxRef.current.state === 'suspended') await ctxRef.current.resume().catch(() => null);
    return ctxRef.current;
  }

  async function changeAmbient(next: AmbientSoundId) {
    setAmbient(next);
    ambientRef.current?.stop();
    ambientRef.current = null;
    if (next === 'none') return;
    const ctx = await audioCtx();
    if (ctx) ambientRef.current = createAmbientSound(next, ctx, volume / 100);
  }

  function changePreset(p: Preset) {
    setPreset(p);
    setRemaining(Number(p) * 60);
  }

  function start() {
    endAt.current = Date.now() + remaining * 1000;
    setPhase('running');
    setAnnounce(`Sesión iniciada: ${minutesText(remaining)}`);
    if (chime) void audioCtx(); // desbloquea el audio con el gesto del usuario
  }

  function pause() {
    setRemaining(Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000)));
    setPhase('paused');
    setAnnounce('Sesión en pausa');
  }

  function resume() {
    setConfirmExit(false);
    start();
    setAnnounce('Sesión reanudada');
  }

  function reset() {
    setPhase('setup');
    setRemaining(total);
    setConfirmExit(false);
    setAnnounce('Temporizador reiniciado');
  }

  function finish() {
    setRemaining(0);
    setPhase('done');
    setAnnounce('¡Sesión completada!');
    navigator.vibrate?.([300, 100, 300]);
    if (chime && ctxRef.current) playChime(ctxRef.current);
  }

  async function save() {
    const minutes = Math.max(1, Math.floor(elapsed / 60));
    setSaving(true);
    try {
      const r = await logFocusSession(minutes, questId, task.trim() || undefined);
      addFloatingXP(r.xpEarned, window.innerWidth / 2, window.innerHeight / 2);
      toast.success(r.message);
      void refreshUser();
      onClose();
    } catch {
      toast.error('No se pudo guardar la sesión', 'Inténtalo de nuevo');
      setSaving(false);
    }
  }

  const ringTone = phase === 'done' ? 'stroke-success' : 'stroke-primary';
  const savedMinutes = Math.floor(elapsed / 60);

  return createPortal(
    <motion.div
      variants={scrim} initial="initial" animate="animate" exit="exit"
      className="fixed inset-0 z-[80] flex bg-[var(--scrim)] md:items-center md:justify-center md:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && requestClose()}
    >
      <motion.div
        ref={panelRef}
        role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        variants={dialog}
        className="flex h-full w-full flex-col overflow-y-auto bg-background text-on-background outline-none md:h-auto md:max-h-[calc(100dvh-3rem)] md:max-w-[520px] md:rounded-3xl md:shadow-lg"
      >
        <header className="flex items-center gap-3 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] md:px-8 md:pt-6">
          <IconChip icon={Zap} tone="primary" size="sm" />
          <h2 id={titleId} className="min-w-0 flex-1 text-heading-sm">Modo enfoque</h2>
          <Button variant="icon" aria-label="Cerrar modo enfoque" onClick={requestClose} className="-mr-2">
            <X aria-hidden className="size-6" strokeWidth={1.75} />
          </Button>
        </header>

        <div className="flex flex-1 flex-col gap-6 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-8 md:pb-8">
          {phase === 'setup' && (
            <>
              <div className="flex flex-col gap-1">
                <p className="text-heading-lg md:text-display-sm">Una sola cosa a la vez</p>
                <p className="text-body-md text-on-surface-light">Elige cuánto tiempo, silencia lo demás y gana XP al terminar.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-label-lg text-on-surface" aria-hidden>Duración</span>
                <SegmentedControl
                  role="radiogroup" label="Duración"
                  value={preset} onChange={changePreset}
                  options={PRESETS.map((p) => ({ value: p, label: `${p} min` }))}
                />
              </div>
              <Field label="¿En qué te vas a enfocar?" help="Opcional. Aparece bajo el temporizador.">
                <Input value={task} onChange={(e) => setTask(e.target.value)} placeholder="Ej. Repasar el capítulo 3" maxLength={80} />
              </Field>
            </>
          )}

          {/* Temporizador */}
          <div className="flex justify-center py-2">
            <div className="relative size-60 md:size-72">
              <svg viewBox="0 0 100 100" aria-hidden className="size-full -rotate-90">
                <circle cx="50" cy="50" r="45" fill="none" strokeWidth="6" className="stroke-surface-variant" />
                <circle
                  cx="50" cy="50" r="45" fill="none" strokeWidth="6" strokeLinecap="round"
                  pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - progress}
                  strokeOpacity={progress > 0 ? 1 : 0}
                  className={cn(ringTone, 'transition-[stroke-dashoffset,stroke] duration-300 ease-linear')}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-8 text-center">
                {phase === 'done' ? (
                  <>
                    <CheckCircle2 aria-hidden className="size-12 text-success-text" strokeWidth={1.75} />
                    <span className="text-heading-md">¡Completado!</span>
                    <span className="text-body-sm text-on-surface-light">{preset} min de enfoque</span>
                  </>
                ) : (
                  <>
                    <span role="timer" aria-label={`Tiempo restante ${minutesText(remaining)}`} className="text-display-md font-mono tabular-nums md:text-display-lg">
                      {mmss(remaining)}
                    </span>
                    <span className={cn('max-w-full truncate text-body-sm', phase === 'paused' ? 'text-warning-text' : 'text-on-surface-light')}>
                      {phase === 'paused' ? 'En pausa' : task.trim() || (phase === 'setup' ? 'Listo cuando quieras' : 'Enfocado')}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <p aria-live="polite" className="sr-only">{announce}</p>
          {phase === 'done' && <Confetti />}

          {/* Controles */}
          {confirmExit ? (
            <div role="group" aria-labelledby={confirmId} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
              <p id={confirmId} className="text-body-md">
                <b>¿Terminar la sesión?</b>{' '}
                {savedMinutes >= 1 ? `Llevas ${savedMinutes} min; puedes guardarlos.` : 'Aún no llevas un minuto, no se guardará nada.'}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <Button ref={stayRef} onClick={resume} className="sm:flex-1">Seguir enfocado</Button>
                {savedMinutes >= 1 && <Button variant="secondary" loading={saving} onClick={save} className="sm:flex-1">Guardar {savedMinutes} min</Button>}
                <Button variant="danger" onClick={onClose} className="sm:flex-1">Salir sin guardar</Button>
              </div>
            </div>
          ) : phase === 'setup' ? (
            <Button ref={mainRef} size="lg" block onClick={start}><Play aria-hidden className="size-5" strokeWidth={1.75} />Comenzar</Button>
          ) : phase === 'done' ? (
            <div className="flex flex-col gap-2">
              <Button ref={mainRef} size="lg" block loading={saving} onClick={save}><Zap aria-hidden className="size-5" strokeWidth={1.75} />Guardar sesión y ganar XP</Button>
              <Button variant="ghost" block onClick={onClose}>Cerrar sin guardar</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button ref={mainRef} size="lg" onClick={phase === 'running' ? pause : resume} className="flex-1">
                  {phase === 'running'
                    ? <><Pause aria-hidden className="size-5" strokeWidth={1.75} />Pausar</>
                    : <><Play aria-hidden className="size-5" strokeWidth={1.75} />Continuar</>}
                </Button>
                <Button variant="secondary" size="lg" onClick={reset} aria-label="Reiniciar" className="px-4 sm:px-6">
                  <RotateCcw aria-hidden className="size-5" strokeWidth={1.75} /><span aria-hidden className="hidden sm:inline">Reiniciar</span>
                </Button>
              </div>
              <Button variant="ghost" block onClick={requestClose}><Square aria-hidden className="size-4" strokeWidth={1.75} />Terminar</Button>
            </div>
          )}

          {/* Sonido */}
          {phase !== 'done' && (
            <section aria-label="Sonido" className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
              <Field label="Sonido ambiente">
                <Select value={ambient} onChange={(e) => void changeAmbient(e.target.value as AmbientSoundId)}>
                  {AMBIENT_SOUNDS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
              </Field>
              {ambient !== 'none' && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-label-lg text-on-surface">
                    <label htmlFor={`${soundOnId}-vol`}>Volumen</label>
                    <span className="font-mono tabular-nums text-on-surface-light">{volume}%</span>
                  </div>
                  <input
                    id={`${soundOnId}-vol`} type="range" min={0} max={100} step={5}
                    value={volume} onChange={(e) => setVolume(Number(e.target.value))}
                    aria-valuetext={`${volume}%`}
                    className="h-11 w-full cursor-pointer accent-primary"
                  />
                </div>
              )}
              <div className="flex items-center justify-between gap-4">
                <label htmlFor={soundOnId} className="text-body-md">Aviso sonoro al terminar</label>
                <Switch id={soundOnId} checked={chime} onChange={(e) => setChime(e.target.checked)} />
              </div>
            </section>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
