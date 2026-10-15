// El ciclo en otras zonas: el consejo de entrenamiento del día en el Coliseo y
// el de hábitos en la libreta de Hábitos. Solo aparece para quien tiene la zona
// Ciclo y ya anotó un periodo. Si lo que anotó hoy pide calma (energía baja,
// cólicos, flujo abundante), Hábitos ofrece marcar descanso en los hábitos de
// ejercicio: no suman XP pero tampoco rompen su racha. Nada se cambia sin un toque.
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, Moon, X } from 'lucide-react';
import { springs } from '@/lib/motion';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { canUseCycle } from '@/utils/gender';
import { dayKey } from '@/lib/lifeMeta';
import { Button } from '@/components/ui/lq';
import { getCycleAdvice, type CycleAdvice } from '@/services/cycle.service';
import type { Habit } from '@/services/habit.service';
import { PHASE_META, SOURCE_LABEL, SYMPTOM_LABELS, energyLabel, intensityLine, phaseFill, phaseInk } from './cycleMeta';

const HIDE_KEY = 'lq-cycle-hint-hidden';
const readHidden = (zone: string) => { try { return localStorage.getItem(`${HIDE_KEY}:${zone}`) === dayKey(new Date()); } catch { return false; } };
const writeHidden = (zone: string) => { try { localStorage.setItem(`${HIDE_KEY}:${zone}`, dayKey(new Date())); } catch { /* sin almacenamiento */ } };

/** Consejo del ciclo de hoy (null si la persona no tiene la zona o aún no hay periodo). */
function useCycleAdvice(): CycleAdvice | null {
  const enabled = canUseCycle(useAuthStore((s) => s.user?.gender));
  const [advice, setAdvice] = useState<CycleAdvice | null>(null);
  useEffect(() => {
    if (!enabled) { setAdvice(null); return; }
    let alive = true;
    getCycleAdvice().then((r) => alive && setAdvice(r.advice)).catch(() => alive && setAdvice(null));
    return () => { alive = false; };
  }, [enabled]);
  return advice;
}

function HintShell({ advice, zone, title, children }: { advice: CycleAdvice; zone: string; title: string; children: ReactNode }) {
  const [hidden, setHidden] = useState(() => readHidden(zone));
  if (hidden) return null;
  const meta = PHASE_META[advice.phase];
  const Icon = meta.icon;
  return (
    <motion.section
      aria-label={title}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: springs.natural }}
      className="relative flex gap-3 rounded-2xl border p-4 md:gap-4 md:p-5"
      style={{ borderColor: phaseFill(advice.phase, 0.35), background: phaseFill(advice.phase, 0.07) }}
    >
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface shadow-sm" style={{ color: phaseInk(advice.phase) }}>
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 pr-8">
        <p className="text-label-lg" style={{ color: phaseInk(advice.phase) }}>
          {meta.name} · día {advice.cycleDay} · energía {energyLabel(advice.energy).toLowerCase()}
        </p>
        {children}
        <p className="text-body-sm text-on-surface-light">
          Energía {advice.energy}/5, {SOURCE_LABEL[advice.energySource]}.{' '}
          <Link to="/ciclo" className="inline-flex items-center gap-0.5 font-semibold text-primary-text underline-offset-4 hover:underline">Ver mi ciclo<ArrowUpRight aria-hidden className="size-3.5" /></Link>
        </p>
      </div>
      <button
        type="button" aria-label="Ocultar por hoy" title="Ocultar por hoy"
        onClick={() => { writeHidden(zone); setHidden(true); }}
        className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-full text-on-surface-light hover:bg-on-background/5 hover:text-on-background"
      >
        <X aria-hidden className="size-4" />
      </button>
    </motion.section>
  );
}

/** Coliseo: intensidad y carga sugeridas para la sesión de hoy. */
export function CycleColiseoHint({ className }: { className?: string }) {
  const advice = useCycleAdvice();
  if (!advice) return null;
  return (
    <div className={className}>
      <HintShell advice={advice} zone="coliseo" title="Tu entrenamiento según tu ciclo">
        <h2 className="text-heading-sm">{advice.training.title}</h2>
        <p className="text-body-md text-on-surface">{advice.training.body}</p>
        <p className="text-body-sm text-on-surface">
          <span className="font-semibold">Carga sugerida ({intensityLine(advice.intensity)}):</span> {advice.training.load}.
          {advice.symptoms.length > 0 && <> {advice.symptomsSource === 'today' ? 'Hoy anotaste' : 'Estos días sueles tener'} {advice.symptoms.map((s) => SYMPTOM_LABELS[s].toLowerCase()).join(', ')}.</>}
        </p>
        <ul aria-label="Ideas para hoy" className="mt-1 flex flex-wrap gap-1.5">
          {advice.training.ideas.map((idea) => <li key={idea} className="rounded-full bg-surface px-3 py-1.5 text-body-sm text-on-surface shadow-sm">{idea}</li>)}
        </ul>
      </HintShell>
    </div>
  );
}

const isDone = (h: Habit) => Boolean(h.todayCompleted) || h.todayStatus === 'completed';

/** Hábitos: cómo llevar los hábitos hoy y, si hace falta, descanso en los de ejercicio. */
export function CycleHabitsHint({ habits, onRest }: { habits: Habit[]; onRest: (h: Habit) => Promise<void> }) {
  const advice = useCycleAdvice();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  if (!advice) return null;
  const fitness = advice.pauseFitness ? habits.filter((h) => h.category === 'FITNESS' && !isDone(h) && h.todayStatus !== 'skipped') : [];
  async function rest(h: Habit) {
    setBusy(h.id);
    try { await onRest(h); toast.success(`Descanso en «${h.title}»`, 'Su racha sigue intacta.'); }
    catch { toast.error('No se pudo marcar el descanso'); }
    finally { setBusy(null); }
  }
  return (
    <HintShell advice={advice} zone="habits" title="Tus hábitos según tu ciclo">
      <h2 className="text-heading-sm">{advice.habits.title}</h2>
      <p className="text-body-md text-on-surface">{advice.habits.body}</p>
      {fitness.length > 0 && (
        <ul aria-label="Hábitos de ejercicio de hoy" className="mt-1 flex flex-col gap-2">
          {fitness.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 shadow-sm">
              <span className="min-w-0 truncate text-body-md font-semibold">{h.title}</span>
              <Button size="sm" variant="secondary" loading={busy === h.id} onClick={() => void rest(h)}><Moon aria-hidden className="size-4" />Descanso hoy</Button>
            </li>
          ))}
        </ul>
      )}
    </HintShell>
  );
}
