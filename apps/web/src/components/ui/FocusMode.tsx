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
import { useText, type Copy } from '@/lib/i18n';

const es = {
  title: 'Modo enfoque',
  close: 'Cerrar modo enfoque',
  saveFail: 'No se pudo guardar la sesión',
  tryAgain: 'Inténtalo de nuevo',
  tagline: 'Una sola cosa a la vez',
  taglineBody: 'Elige cuánto tiempo, silencia lo demás y gana XP al terminar.',
  duration: 'Duración',
  focusOn: '¿En qué te vas a enfocar?',
  focusHelp: 'Opcional. Aparece bajo el temporizador.',
  focusPh: 'Ej. Repasar el capítulo 3',
  timerAria: (t: string): string => `Tiempo restante ${t}`,
  minute: (n: number): string => `${n} ${n === 1 ? 'minuto' : 'minutos'}`,
  done: '¡Completado!',
  focusMinutes: (n: number): string => `${n} min de enfoque`,
  paused: 'En pausa',
  ready: 'Listo cuando quieras',
  focused: 'Enfocado',
  endQ: '¿Terminar la sesión?',
  saveHint: (n: number): string => `Llevas ${n} min; puedes guardarlos.`,
  noSaveHint: 'Aún no llevas un minuto, no se guardará nada.',
  stay: 'Seguir enfocado',
  saveMinutes: (n: number): string => `Guardar ${n} min`,
  leaveNoSave: 'Salir sin guardar',
  start: 'Comenzar',
  saveXp: 'Guardar sesión y ganar XP',
  closeNoSave: 'Cerrar sin guardar',
  pause: 'Pausar',
  resume: 'Continuar',
  resetAria: 'Reiniciar',
  reset: 'Reiniciar',
  finish: 'Terminar',
  soundAria: 'Sonido',
  ambient: 'Sonido ambiente',
  volume: 'Volumen',
  chime: 'Aviso sonoro al terminar',
  announceStart: (t: string): string => `Sesión iniciada: ${t}`,
  announcePaused: 'Sesión en pausa',
  announceResumed: 'Sesión reanudada',
  announceReset: 'Temporizador reiniciado',
  announceDone: '¡Sesión completada!',
  sounds: { none: 'Silencio', rain: 'Lluvia', waves: 'Olas', forest: 'Bosque', fire: 'Fogata' } as Record<AmbientSoundId, string>,
};

const en: typeof es = {
  title: 'Focus mode',
  close: 'Close focus mode',
  saveFail: 'Could not save the session',
  tryAgain: 'Try again',
  tagline: 'One thing at a time',
  taglineBody: 'Pick how long, silence everything else and earn XP when you finish.',
  duration: 'Duration',
  focusOn: 'What will you focus on?',
  focusHelp: 'Optional. Shown under the timer.',
  focusPh: 'E.g. Review chapter 3',
  timerAria: (t: string): string => `Time left ${t}`,
  minute: (n: number): string => `${n} ${n === 1 ? 'minute' : 'minutes'}`,
  done: 'Done!',
  focusMinutes: (n: number): string => `${n} min of focus`,
  paused: 'Paused',
  ready: 'Ready whenever you are',
  focused: 'Focused',
  endQ: 'End the session?',
  saveHint: (n: number): string => `You have ${n} min; you can save them.`,
  noSaveHint: 'Not even a minute yet, nothing will be saved.',
  stay: 'Keep focusing',
  saveMinutes: (n: number): string => `Save ${n} min`,
  leaveNoSave: 'Leave without saving',
  start: 'Start',
  saveXp: 'Save session and earn XP',
  closeNoSave: 'Close without saving',
  pause: 'Pause',
  resume: 'Continue',
  resetAria: 'Reset',
  reset: 'Reset',
  finish: 'Finish',
  soundAria: 'Sound',
  ambient: 'Background sound',
  volume: 'Volume',
  chime: 'Chime when finished',
  announceStart: (t: string): string => `Session started: ${t}`,
  announcePaused: 'Session paused',
  announceResumed: 'Session resumed',
  announceReset: 'Timer reset',
  announceDone: 'Session complete!',
  sounds: { none: 'Silence', rain: 'Rain', waves: 'Waves', forest: 'Forest', fire: 'Campfire' } as Record<AmbientSoundId, string>,
};

const COPY: Copy<typeof es> = { es, en };

const PRESETS = ['25', '45', '60', '90'] as const;
type Preset = (typeof PRESETS)[number];
type Phase = 'setup' | 'running' | 'paused' | 'done';

interface Props {
  onClose: () => void;
  taskLabel?: string;
  questId?: string;
}

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export function FocusMode({ onClose, taskLabel, questId }: Props) {
  const t = useText(COPY);
  const minutesText = (s: number) => t.minute(Math.ceil(s / 60));
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
    setAnnounce(t.announceStart(minutesText(remaining)));
    if (chime) void audioCtx(); // desbloquea el audio con el gesto del usuario
  }

  function pause() {
    setRemaining(Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000)));
    setPhase('paused');
    setAnnounce(t.announcePaused);
  }

  function resume() {
    setConfirmExit(false);
    start();
    setAnnounce(t.announceResumed);
  }

  function reset() {
    setPhase('setup');
    setRemaining(total);
    setConfirmExit(false);
    setAnnounce(t.announceReset);
  }

  function finish() {
    setRemaining(0);
    setPhase('done');
    setAnnounce(t.announceDone);
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
      toast.error(t.saveFail, t.tryAgain);
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
          <h2 id={titleId} className="min-w-0 flex-1 text-heading-sm">{t.title}</h2>
          <Button variant="icon" aria-label={t.close} onClick={requestClose} className="-mr-2">
            <X aria-hidden className="size-6" strokeWidth={1.75} />
          </Button>
        </header>

        <div className="flex flex-1 flex-col gap-6 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-8 md:pb-8">
          {phase === 'setup' && (
            <>
              <div className="flex flex-col gap-1">
                <p className="text-heading-lg md:text-display-sm">{t.tagline}</p>
                <p className="text-body-md text-on-surface-light">{t.taglineBody}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-label-lg text-on-surface" aria-hidden>{t.duration}</span>
                <SegmentedControl
                  role="radiogroup" label={t.duration}
                  value={preset} onChange={changePreset}
                  options={PRESETS.map((p) => ({ value: p, label: `${p} min` }))}
                />
              </div>
              <Field label={t.focusOn} help={t.focusHelp}>
                <Input value={task} onChange={(e) => setTask(e.target.value)} placeholder={t.focusPh} maxLength={80} />
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
                    <span className="text-heading-md">{t.done}</span>
                    <span className="text-body-sm text-on-surface-light">{t.focusMinutes(Number(preset))}</span>
                  </>
                ) : (
                  <>
                    <span role="timer" aria-label={t.timerAria(minutesText(remaining))} className="text-display-md font-mono tabular-nums md:text-display-lg">
                      {mmss(remaining)}
                    </span>
                    <span className={cn('max-w-full truncate text-body-sm', phase === 'paused' ? 'text-warning-text' : 'text-on-surface-light')}>
                      {phase === 'paused' ? t.paused : task.trim() || (phase === 'setup' ? t.ready : t.focused)}
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
                <b>{t.endQ}</b>{' '}
                {savedMinutes >= 1 ? t.saveHint(savedMinutes) : t.noSaveHint}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <Button ref={stayRef} onClick={resume} className="sm:flex-1">{t.stay}</Button>
                {savedMinutes >= 1 && <Button variant="secondary" loading={saving} onClick={save} className="sm:flex-1">{t.saveMinutes(savedMinutes)}</Button>}
                <Button variant="danger" onClick={onClose} className="sm:flex-1">{t.leaveNoSave}</Button>
              </div>
            </div>
          ) : phase === 'setup' ? (
            <Button ref={mainRef} size="lg" block onClick={start}><Play aria-hidden className="size-5" strokeWidth={1.75} />{t.start}</Button>
          ) : phase === 'done' ? (
            <div className="flex flex-col gap-2">
              <Button ref={mainRef} size="lg" block loading={saving} onClick={save}><Zap aria-hidden className="size-5" strokeWidth={1.75} />{t.saveXp}</Button>
              <Button variant="ghost" block onClick={onClose}>{t.closeNoSave}</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button ref={mainRef} size="lg" onClick={phase === 'running' ? pause : resume} className="flex-1">
                  {phase === 'running'
                    ? <><Pause aria-hidden className="size-5" strokeWidth={1.75} />{t.pause}</>
                    : <><Play aria-hidden className="size-5" strokeWidth={1.75} />{t.resume}</>}
                </Button>
                <Button variant="secondary" size="lg" onClick={reset} aria-label={t.resetAria} className="px-4 sm:px-6">
                  <RotateCcw aria-hidden className="size-5" strokeWidth={1.75} /><span aria-hidden className="hidden sm:inline">{t.reset}</span>
                </Button>
              </div>
              <Button variant="ghost" block onClick={requestClose}><Square aria-hidden className="size-4" strokeWidth={1.75} />{t.finish}</Button>
            </div>
          )}

          {/* Sonido */}
          {phase !== 'done' && (
            <section aria-label={t.soundAria} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
              <Field label={t.ambient}>
                <Select value={ambient} onChange={(e) => void changeAmbient(e.target.value as AmbientSoundId)}>
                  {AMBIENT_SOUNDS.map((s) => <option key={s.id} value={s.id}>{t.sounds[s.id]}</option>)}
                </Select>
              </Field>
              {ambient !== 'none' && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-label-lg text-on-surface">
                    <label htmlFor={`${soundOnId}-vol`}>{t.volume}</label>
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
                <label htmlFor={soundOnId} className="text-body-md">{t.chime}</label>
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
