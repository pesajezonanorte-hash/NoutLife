// El ciclo en otras zonas: el consejo de entrenamiento del día en el Coliseo y
// el de hábitos en la libreta de Hábitos. Solo aparece para quien tiene la zona
// Ciclo y ya anotó un periodo. Si lo que anotó hoy pide calma (energía baja,
// cólicos, flujo abundante), Hábitos ofrece marcar descanso en los hábitos de
// ejercicio: no suman XP pero tampoco rompen su racha. Nada se cambia sin un toque.
// Los consejos de texto llegan de la API; los rótulos de esta vista salen en el idioma activo.
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
import { phaseMetaFor, sourceLabelFor, symptomLabelsFor, energyLabelFor, intensityLineFor, phaseFill, phaseInk } from './cycleMeta';
import { adviceCopy } from './adviceText';
import { useLocale, useText, type Copy } from '@/lib/i18n';

const COPY: Copy<{
  day: string; energy: string; energyOf: (n: number) => string; seeCycle: string; hide: string;
  coliseoTitle: string; habitsTitle: string; carga: (i: string) => string;
  todayNoted: string; usualDays: string; ideas: string; restTodayBtn: string; restList: string; restDone: (t: string) => string;
  restKeeps: string; restFailed: string;
}> = {
  es: {
    day: 'día', energy: 'energía', energyOf: (n) => `Energía ${n}/5`, seeCycle: 'Ver mi ciclo', hide: 'Ocultar por hoy',
    coliseoTitle: 'Tu entrenamiento según tu ciclo', habitsTitle: 'Tus hábitos según tu ciclo',
    carga: (i) => `Carga sugerida (${i}):`,
    todayNoted: 'Hoy anotaste', usualDays: 'Estos días sueles tener', ideas: 'Ideas para hoy',
    restTodayBtn: 'Descanso hoy', restList: 'Hábitos de ejercicio de hoy', restDone: (t) => `Descanso en «${t}»`,
    restKeeps: 'Su racha sigue intacta.', restFailed: 'No se pudo marcar el descanso',
  },
  en: {
    day: 'day', energy: 'energy', energyOf: (n) => `Energy ${n}/5`, seeCycle: 'See my cycle', hide: 'Hide for today',
    coliseoTitle: 'Your training based on your cycle', habitsTitle: 'Your habits based on your cycle',
    carga: (i) => `Suggested load (${i}):`,
    todayNoted: 'Today you logged', usualDays: 'These days you usually have', ideas: 'Ideas for today',
    restTodayBtn: 'Rest today', restList: "Today's exercise habits", restDone: (t) => `Rest day for “${t}”`,
    restKeeps: 'Its streak stays intact.', restFailed: "We couldn't mark the rest day",
  },
};

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
  const t = useText(COPY);
  const locale = useLocale();
  const [hidden, setHidden] = useState(() => readHidden(zone));
  if (hidden) return null;
  const meta = phaseMetaFor(locale)[advice.phase];
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
          {meta.name} · {t.day} {advice.cycleDay} · {t.energy} {energyLabelFor(advice.energy, locale).toLowerCase()}
        </p>
        {children}
        <p className="text-body-sm text-on-surface-light">
          {t.energyOf(advice.energy)}, {sourceLabelFor(advice.energySource, locale)}.{' '}
          <Link to="/ciclo-menstrual" className="inline-flex items-center gap-0.5 font-semibold text-primary-text underline-offset-4 hover:underline">{t.seeCycle}<ArrowUpRight aria-hidden className="size-3.5" /></Link>
        </p>
      </div>
      <button
        type="button" aria-label={t.hide} title={t.hide}
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
  const t = useText(COPY);
  const locale = useLocale();
  const advice = useCycleAdvice();
  if (!advice) return null;
  const symptoms = symptomLabelsFor(locale);
  const copy = adviceCopy(advice, locale);
  return (
    <div className={className}>
      <HintShell advice={advice} zone="coliseo" title={t.coliseoTitle}>
        <h2 className="text-heading-sm">{copy.training.title}</h2>
        <p className="text-body-md text-on-surface">{copy.training.body}</p>
        <p className="text-body-sm text-on-surface">
          <span className="font-semibold">{t.carga(intensityLineFor(advice.intensity, locale))}</span> {copy.training.load}.
          {advice.symptoms.length > 0 && <> {advice.symptomsSource === 'today' ? t.todayNoted : t.usualDays} {advice.symptoms.map((s) => symptoms[s].toLowerCase()).join(', ')}.</>}
        </p>
        <ul aria-label={t.ideas} className="mt-1 flex flex-wrap gap-1.5">
          {copy.training.ideas.map((idea) => <li key={idea} className="rounded-full bg-surface px-3 py-1.5 text-body-sm text-on-surface shadow-sm">{idea}</li>)}
        </ul>
      </HintShell>
    </div>
  );
}

const isDone = (h: Habit) => Boolean(h.todayCompleted) || h.todayStatus === 'completed';

/** Hábitos: cómo llevar los hábitos hoy y, si hace falta, descanso en los de ejercicio. */
export function CycleHabitsHint({ habits, onRest }: { habits: Habit[]; onRest: (h: Habit) => Promise<void> }) {
  const t = useText(COPY);
  const locale = useLocale();
  const advice = useCycleAdvice();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  if (!advice) return null;
  const copy = adviceCopy(advice, locale);
  const fitness = advice.pauseFitness ? habits.filter((h) => h.category === 'FITNESS' && !isDone(h) && h.todayStatus !== 'skipped') : [];
  async function rest(h: Habit) {
    setBusy(h.id);
    try { await onRest(h); toast.success(t.restDone(h.title), t.restKeeps); }
    catch { toast.error(t.restFailed); }
    finally { setBusy(null); }
  }
  return (
    <HintShell advice={advice} zone="habits" title={t.habitsTitle}>
      <h2 className="text-heading-sm">{copy.habits.title}</h2>
      <p className="text-body-md text-on-surface">{copy.habits.body}</p>
      {fitness.length > 0 && (
        <ul aria-label={t.restList} className="mt-1 flex flex-col gap-2">
          {fitness.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 shadow-sm">
              <span className="min-w-0 truncate text-body-md font-semibold">{h.title}</span>
              <Button size="sm" variant="secondary" loading={busy === h.id} onClick={() => void rest(h)}><Moon aria-hidden className="size-4" />{t.restTodayBtn}</Button>
            </li>
          ))}
        </ul>
      )}
    </HintShell>
  );
}
