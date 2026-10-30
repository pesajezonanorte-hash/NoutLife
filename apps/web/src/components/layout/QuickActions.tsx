// Acciones rápidas del FAB (móvil) y de la Topbar (md+). Reemplaza al antiguo
// QuickActionsFAB con los componentes del rediseño; mismos servicios y mismas
// recompensas reales del backend (sin XP inventado).
import { useEffect, useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Angry, CheckCircle2, ChevronRight, Flag, Frown, Laugh, Lock, Meh, NotebookPen, Plus, Smile, Wallet, Zap, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, CheckButton, EmptyState, EnergyMeter, Field, Input, ResponsiveDialog, SegmentedControl, Textarea, type Tone, PageLoader } from '@/components/ui/lq';
import { energyLevel } from '@/components/ui/lq/energy';
import { useLoadingCopy } from '@/lib/loadingCopy';
import type { ProZone } from '@/lib/plan';
import { softTone } from '@/components/ui/lq/tones';
import { useLocale, type Copy } from '@/lib/i18n';
import { useAuthStore } from '@/store/authStore';
import { usePlanStore } from '@/store/planStore';
import { useShellStore, type QuickAction } from '@/store/shellStore';
import { useUIStore } from '@/store/uiStore';
import { useToastStore } from '@/hooks/useToast';
import { refreshUser } from '@/hooks/useAuth';
import api from '@/lib/api';
import { createQuest } from '@/services/quest.service';
import { createTransaction } from '@/services/finance.service';
import { fetchHabits, logHabit, type Habit } from '@/services/habit.service';
import { createJournalEntry } from '@/services/journal.service';

const es = {
  actions: {
    'new-habit': { label: 'Nuevo hábito', description: 'Crea una rutina para tu día' },
    habit: { label: 'Marcar hábito', description: 'Completa un hábito de hoy' },
    quest: { label: 'Nueva misión', description: 'Una tarea, proyecto o meta' },
    expense: { label: 'Gasto rápido', description: 'Registra un gasto en segundos' },
    note: { label: 'Nota rápida', description: 'Guárdala en tu diario' },
    checkin: { label: 'Check-in', description: 'Ánimo y energía de hoy' },
  } as Record<string, { label: string; description: string }>,
  title: 'Acciones rápidas',
  withPro: 'Con NoutLife Pro',
  saveError: 'No se pudo guardar. Inténtalo de nuevo.',
  questTypes: { SIDE: 'Tarea', MAIN: 'Proyecto', META: 'Meta' } as Record<string, string>,
  questTypeGroup: 'Tipo de misión',
  questName: 'Nombre de la misión',
  questNameError: 'Escribe un nombre',
  questNamePlaceholder: 'Ej. Terminar el informe',
  type: 'Tipo',
  questCreated: 'Misión creada',
  questRewardHint: 'Ganarás XP al completarla',
  createQuest: 'Crear misión',
  amount: 'Monto',
  amountError: 'Escribe un monto mayor que 0',
  description: 'Descripción',
  optional: 'Opcional',
  descriptionPlaceholder: 'Ej. Almuerzo',
  expenseSaved: 'Gasto registrado',
  saveExpense: 'Registrar gasto',
  habitsFailed: 'No pudimos cargar tus hábitos.',
  retry: 'Reintentar',
  habitsLoading: 'Cargando tus hábitos…',
  allDone: '¡Todo listo por hoy!',
  allDoneBody: 'Completaste todos tus hábitos del día.',
  habitCompleted: (title: string) => `${title} completado`,
  habitMarkFailed: 'No se pudo marcar el hábito',
  streak: (days: number) => `racha ${days} d`,
  noteQuestion: '¿Qué quieres recordar?',
  noteName: 'Tu nota',
  noteError: 'Escribe algo para guardar',
  noteSaved: 'Nota guardada en tu diario',
  saveNote: 'Guardar nota',
  moods: ['Muy mal', 'Mal', 'Normal', 'Bien', 'Muy bien'],
  moodQuestion: '¿Cómo te sientes?',
  moodGroup: 'Estado de ánimo',
  energy: 'Energía',
  energyLevels: ['Agotada', 'Baja', 'Estable', 'Alta', 'A tope'],
  energyValue: (v: number, level: string): string => `${v} de 10 · ${level}`,
  checkinSaved: 'Check-in registrado',
  bonus: 'bonus diario',
  checkinUpdated: 'Check-in actualizado',
  checkinBonusClaimed: 'El bonus de hoy ya estaba reclamado',
  saveCheckin: 'Registrar check-in',
  titles: { quest: 'Nueva misión', expense: 'Gasto rápido', habit: 'Marcar hábito', note: 'Nota rápida', checkin: 'Check-in' } as Record<string, string>,
};

const en: typeof es = {
  actions: {
    'new-habit': { label: 'New habit', description: 'Create a routine for your day' },
    habit: { label: 'Mark a habit', description: 'Complete one of today’s habits' },
    quest: { label: 'New goal', description: 'A task, project or goal' },
    expense: { label: 'Quick expense', description: 'Log an expense in seconds' },
    note: { label: 'Quick note', description: 'Save it in your journal' },
    checkin: { label: 'Check-in', description: 'Mood and energy today' },
  },
  title: 'Quick actions',
  withPro: 'With NoutLife Pro',
  saveError: 'We couldn’t save it. Try again.',
  questTypes: { SIDE: 'Task', MAIN: 'Project', META: 'Goal' },
  questTypeGroup: 'Goal type',
  questName: 'Goal name',
  questNameError: 'Write a name',
  questNamePlaceholder: 'E.g. Finish the report',
  type: 'Type',
  questCreated: 'Goal created',
  questRewardHint: 'You will earn XP when you complete it',
  createQuest: 'Create goal',
  amount: 'Amount',
  amountError: 'Write an amount greater than 0',
  description: 'Description',
  optional: 'Optional',
  descriptionPlaceholder: 'E.g. Lunch',
  expenseSaved: 'Expense logged',
  saveExpense: 'Log expense',
  habitsFailed: "We couldn't load your habits.",
  retry: 'Try again',
  habitsLoading: 'Loading your habits…',
  allDone: 'All set for today!',
  allDoneBody: 'You completed all your habits for the day.',
  habitCompleted: (title) => `${title} completed`,
  habitMarkFailed: "We couldn't mark the habit",
  streak: (days) => `${days}-day streak`,
  noteQuestion: 'What do you want to remember?',
  noteName: 'Your note',
  noteError: 'Write something to save',
  noteSaved: 'Note saved in your journal',
  saveNote: 'Save note',
  moods: ['Very bad', 'Bad', 'Okay', 'Good', 'Very good'],
  moodQuestion: 'How are you feeling?',
  moodGroup: 'Mood',
  energy: 'Energy',
  energyLevels: ['Drained', 'Low', 'Steady', 'High', 'Charged'],
  energyValue: (v, level) => `${v} of 10 · ${level}`,
  checkinSaved: 'Check-in logged',
  bonus: 'daily bonus',
  checkinUpdated: 'Check-in updated',
  checkinBonusClaimed: 'Today’s bonus was already claimed',
  saveCheckin: 'Log check-in',
  titles: { quest: 'New goal', expense: 'Quick expense', habit: 'Mark a habit', note: 'Quick note', checkin: 'Check-in' },
};

const COPY: Copy<typeof es> = { es, en };

interface ActionDef { id: QuickAction | 'new-habit'; icon: LucideIcon; tone: Tone }

const ACTIONS: ActionDef[] = [
  { id: 'new-habit', icon: Plus, tone: 'primary' },
  { id: 'habit', icon: CheckCircle2, tone: 'success' },
  { id: 'quest', icon: Flag, tone: 'forest' },
  { id: 'expense', icon: Wallet, tone: 'warning' },
  { id: 'note', icon: NotebookPen, tone: 'info' },
  { id: 'checkin', icon: Zap, tone: 'error' },
];

/** Acciones que escriben en una zona Pro: en NoutLife Lite llevan candado y abren el diálogo de Pro. */
const ACTION_ZONES: Partial<Record<ActionDef['id'], ProZone>> = { expense: 'finances', note: 'journal' };

function useSubmit(fn: () => Promise<void>) {
  const t = COPY[useLocale()];
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setSaving(true);
    setError(null);
    try { await fn(); } catch { setError(t.saveError); } finally { setSaving(false); }
  };
  return { saving, error, submit };
}

function FormError({ error }: { error: string | null }) {
  return error ? <p role="alert" className="text-body-sm text-error-text">{error}</p> : null;
}

// ── Formularios ──────────────────────────────────────────────────────────────

function QuestForm({ onDone }: { onDone: () => void }) {
  const t = COPY[useLocale()];
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'SIDE' | 'MAIN' | 'META'>('SIDE');
  const [touched, setTouched] = useState(false);
  const { saving, error, submit } = useSubmit(async () => {
    await createQuest({ title: title.trim(), type, difficulty: 'EASY', category: 'PERSONAL', xpReward: type === 'META' ? 75 : 50, goldReward: 10 });
    useToastStore.getState().success(t.questCreated, t.questRewardHint);
    onDone();
  });
  const invalid = touched && !title.trim();
  const types = (['SIDE', 'MAIN', 'META'] as const).map((value) => ({ value, label: t.questTypes[value] }));
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { setTouched(true); if (title.trim()) void submit(e); else e.preventDefault(); }}>
      <Field label={t.questName} error={invalid ? t.questNameError : undefined}>
        <Input data-autofocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.questNamePlaceholder} />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span aria-hidden className="text-label-lg text-on-surface">{t.type}</span>
        <SegmentedControl role="radiogroup" label={t.questTypeGroup} value={type} onChange={setType} options={types} />
      </div>
      <FormError error={error} />
      <Button type="submit" block loading={saving}>{t.createQuest}</Button>
    </form>
  );
}

function ExpenseForm({ onDone }: { onDone: () => void }) {
  const t = COPY[useLocale()];
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [touched, setTouched] = useState(false);
  const value = Number(amount);
  const valid = amount !== '' && Number.isFinite(value) && value > 0;
  const { saving, error, submit } = useSubmit(async () => {
    await createTransaction({ type: 'EXPENSE', amount: value, category: 'OTHER', description: desc.trim() || undefined });
    useToastStore.getState().success(t.expenseSaved);
    onDone();
  });
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { setTouched(true); if (valid) void submit(e); else e.preventDefault(); }}>
      <Field label={t.amount} error={touched && !valid ? t.amountError : undefined}>
        <Input data-autofocus type="number" inputMode="decimal" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
      </Field>
      <Field label={t.description} help={t.optional}>
        <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t.descriptionPlaceholder} />
      </Field>
      <FormError error={error} />
      <Button type="submit" block loading={saving}>{t.saveExpense}</Button>
    </form>
  );
}

function HabitPicker({ onDone }: { onDone: () => void }) {
  const t = COPY[useLocale()];
  const loading = useLoadingCopy();
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const addFloatingXP = useUIStore((s) => s.addFloatingXP);

  const load = () => {
    setFailed(false);
    fetchHabits().then((h) => setHabits(h.filter((x) => !x.todayCompleted))).catch(() => setFailed(true));
  };
  useEffect(load, []);

  async function complete(h: Habit) {
    setSaving(h.id);
    try {
      const r = await logHabit(h.id, 'completed');
      const xp = r.rewards?.xpEarned ?? 0;
      addFloatingXP(xp, window.innerWidth / 2, 200);
      useToastStore.getState().success(t.habitCompleted(h.title), xp > 0 ? `+${xp} XP` : undefined);
      void refreshUser();
      const rest = (habits ?? []).filter((x) => x.id !== h.id);
      setHabits(rest);
      if (rest.length === 0) onDone();
    } catch {
      useToastStore.getState().error(t.habitMarkFailed);
    } finally {
      setSaving(null);
    }
  }

  if (failed) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 py-4 text-center">
        <p className="text-body-md text-on-surface">{t.habitsFailed}</p>
        <Button variant="secondary" size="sm" onClick={load}>{t.retry}</Button>
      </div>
    );
  }
  if (!habits) {
    return <PageLoader label={t.habitsLoading} words={loading.habits} size="sm" />;
  }
  if (habits.length === 0) {
    return <EmptyState icon={CheckCircle2} tone="success" title={t.allDone} description={t.allDoneBody} />;
  }
  return (
    <ul className="flex max-h-[50dvh] flex-col gap-2 overflow-y-auto">
      {habits.map((h) => (
        <li key={h.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-label-lg text-on-background">{h.title}</span>
            <span className="block text-body-sm text-primary-text font-mono tabular-nums">+{h.xpReward} XP{h.currentStreak > 0 ? ` · ${t.streak(h.currentStreak)}` : ''}</span>
          </span>
          <CheckButton name={h.title} checked={saving === h.id} disabled={saving === h.id} onToggle={() => void complete(h)} />
        </li>
      ))}
    </ul>
  );
}

function NoteForm({ onDone }: { onDone: () => void }) {
  const t = COPY[useLocale()];
  const [content, setContent] = useState('');
  const [touched, setTouched] = useState(false);
  const { saving, error, submit } = useSubmit(async () => {
    await createJournalEntry({ content: content.trim(), title: content.trim().slice(0, 40) });
    useToastStore.getState().success(t.noteSaved);
    onDone();
  });
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { setTouched(true); if (content.trim()) void submit(e); else e.preventDefault(); }}>
      <Field label={t.noteName} error={touched && !content.trim() ? t.noteError : undefined}>
        <Textarea data-autofocus rows={4} value={content} onChange={(e) => setContent(e.target.value)} placeholder={t.noteQuestion} />
      </Field>
      <FormError error={error} />
      <Button type="submit" block loading={saving}>{t.saveNote}</Button>
    </form>
  );
}

const MOOD_ICONS: LucideIcon[] = [Angry, Frown, Meh, Smile, Laugh];

function CheckinForm({ onDone }: { onDone: () => void }) {
  const t = COPY[useLocale()];
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(5);
  const energyLabel = useId();
  const level = t.energyLevels[energyLevel(energy)];
  const addFloatingXP = useUIStore((s) => s.addFloatingXP);
  const { saving, error, submit } = useSubmit(async () => {
    const res = await api.post('/checkin', { mood, energy });
    const xp = (res.data as { rewards?: { xpEarned?: number } | null })?.rewards?.xpEarned ?? 0;
    if (xp > 0) {
      addFloatingXP(xp, window.innerWidth / 2, 200);
      useToastStore.getState().success(t.checkinSaved, `+${xp} XP · ${t.bonus}`);
    } else {
      useToastStore.getState().success(t.checkinUpdated, t.checkinBonusClaimed);
    }
    void refreshUser();
    onDone();
  });
  return (
    <form className="flex flex-col gap-6" onSubmit={(e) => void submit(e)}>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-label-lg text-on-surface">{t.moodQuestion}</legend>
        <div role="radiogroup" aria-label={t.moodGroup} className="grid grid-cols-5 gap-2">
          {MOOD_ICONS.map((Icon, i) => {
            const selected = mood === i + 1;
            return (
              <button
                key={t.moods[i]}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={t.moods[i]}
                data-autofocus={selected || undefined}
                onClick={() => setMood(i + 1)}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border transition-[background-color,border-color,transform] duration-200',
                  selected ? 'scale-105 border-primary bg-primary/[var(--lq-soft-alpha)] text-primary-text [.reduce-motion_&]:scale-100' : 'border-border text-on-surface-light hover:bg-surface-variant',
                )}
              >
                <Icon aria-hidden className="size-7" strokeWidth={1.75} />
              </button>
            );
          })}
        </div>
        <span className="text-center text-body-sm text-on-surface" aria-live="polite">{t.moods[mood - 1]}</span>
      </fieldset>
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <span id={energyLabel} className="text-label-lg text-on-surface">{t.energy}</span>
          {/* El slider anuncia el valor (aria-valuetext); esta lectura es solo visual. */}
          <span aria-hidden className="flex items-center gap-1.5 text-label-lg">
            {/* El rayo se «carga» con la energía elegida. */}
            <Zap className="size-4 text-primary-text" strokeWidth={2} fill="currentColor" fillOpacity={0.12 + (energy / 10) * 0.78} />
            <span className="font-mono tabular-nums text-primary-text">{energy}/10</span>
            <span className="text-on-surface-light">· {level}</span>
          </span>
        </div>
        <EnergyMeter value={energy} onChange={setEnergy} labelledBy={energyLabel} valueText={t.energyValue(energy, level)} />
      </div>
      <FormError error={error} />
      <Button type="submit" block loading={saving}>{t.saveCheckin}</Button>
    </form>
  );
}

/** Hoja de acciones + diálogo del formulario activo. Montado una vez en el AppShell. */
export function QuickActions() {
  const t = COPY[useLocale()];
  const navigate = useNavigate();
  const open = useShellStore((s) => s.quickOpen);
  const setOpen = useShellStore((s) => s.setQuickOpen);
  const action = useShellStore((s) => s.quickAction);
  const openAction = useShellStore((s) => s.openQuickAction);
  const lite = useAuthStore((s) => s.user?.subscription?.plan === 'lite');
  const openUpgrade = usePlanStore((s) => s.openUpgrade);
  const done = () => openAction(null);
  const lockOf = (id: ActionDef['id']) => (lite ? ACTION_ZONES[id] : undefined);

  // Una acción de zona Pro abierta desde otro sitio también pasa por el candado.
  useEffect(() => {
    const zone = action && lite ? ACTION_ZONES[action] : undefined;
    if (!zone) return;
    openAction(null);
    openUpgrade(zone);
  }, [action, lite, openAction, openUpgrade]);

  const choose = (id: ActionDef['id']) => {
    const zone = lockOf(id);
    if (zone) {
      setOpen(false);
      openUpgrade(zone);
    } else if (id === 'new-habit') {
      setOpen(false);
      navigate('/habits?new=1');
    } else {
      openAction(id);
    }
  };

  return (
    <>
      <ResponsiveDialog open={open} onClose={() => setOpen(false)} title={t.title}>
        <ul className="flex flex-col gap-2">
          {ACTIONS.map(({ id, icon: Icon, tone }) => {
            const label = t.actions[id]?.label ?? id;
            const description = t.actions[id]?.description ?? '';
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => choose(id)}
                  className="lq-lift flex min-h-16 w-full items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-left"
                >
                  <span className={cn('lq-ichip flex size-10 shrink-0 items-center justify-center rounded-xl', softTone[tone])}>
                    <Icon aria-hidden className="size-5" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-label-lg text-on-background">{label}</span>
                    <span className="block truncate text-body-sm text-on-surface-light">{lockOf(id) ? t.withPro : description}</span>
                  </span>
                  {lockOf(id)
                    ? <Lock aria-hidden className="size-4 shrink-0 text-secondary-text" strokeWidth={2} />
                    : <ChevronRight aria-hidden className="size-5 shrink-0 text-on-surface-light" strokeWidth={1.75} />}
                </button>
              </li>
            );
          })}
        </ul>
      </ResponsiveDialog>

      <ResponsiveDialog open={action !== null} onClose={done} title={action ? t.titles[action] : ''}>
        {action === 'quest' && <QuestForm onDone={done} />}
        {action === 'expense' && <ExpenseForm onDone={done} />}
        {action === 'habit' && <HabitPicker onDone={done} />}
        {action === 'note' && <NoteForm onDone={done} />}
        {action === 'checkin' && <CheckinForm onDone={done} />}
      </ResponsiveDialog>
    </>
  );
}
