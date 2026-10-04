// Acciones rápidas del FAB (móvil) y de la Topbar (md+). Reemplaza al antiguo
// QuickActionsFAB con los componentes del rediseño; mismos servicios y mismas
// recompensas reales del backend (sin XP inventado).
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Angry, CheckCircle2, ChevronRight, Flag, Frown, Laugh, Meh, NotebookPen, Plus, Smile, Wallet, Zap, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, CheckButton, EmptyState, Field, Input, ResponsiveDialog, SegmentedControl, Textarea, type Tone, PageLoader } from '@/components/ui/lq';
import { LOADING_COPY } from '@/lib/loadingCopy';
import { softTone } from '@/components/ui/lq/tones';
import { useShellStore, type QuickAction } from '@/store/shellStore';
import { useUIStore } from '@/store/uiStore';
import { useToastStore } from '@/hooks/useToast';
import { refreshUser } from '@/hooks/useAuth';
import api from '@/lib/api';
import { createQuest } from '@/services/quest.service';
import { createTransaction } from '@/services/finance.service';
import { fetchHabits, logHabit, type Habit } from '@/services/habit.service';
import { createJournalEntry } from '@/services/journal.service';

interface ActionDef { id: QuickAction | 'new-habit'; label: string; description: string; icon: LucideIcon; tone: Tone }

const ACTIONS: ActionDef[] = [
  { id: 'new-habit', label: 'Nuevo hábito', description: 'Crea una rutina para tu día', icon: Plus, tone: 'primary' },
  { id: 'habit', label: 'Marcar hábito', description: 'Completa un hábito de hoy', icon: CheckCircle2, tone: 'success' },
  { id: 'quest', label: 'Nueva misión', description: 'Una tarea, proyecto o meta', icon: Flag, tone: 'forest' },
  { id: 'expense', label: 'Gasto rápido', description: 'Registra un gasto en segundos', icon: Wallet, tone: 'warning' },
  { id: 'note', label: 'Nota rápida', description: 'Guárdala en tu diario', icon: NotebookPen, tone: 'info' },
  { id: 'checkin', label: 'Check-in', description: 'Ánimo y energía de hoy', icon: Zap, tone: 'error' },
];

function useSubmit(fn: () => Promise<void>) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setSaving(true);
    setError(null);
    try { await fn(); } catch { setError('No se pudo guardar. Inténtalo de nuevo.'); } finally { setSaving(false); }
  };
  return { saving, error, submit };
}

function FormError({ error }: { error: string | null }) {
  return error ? <p role="alert" className="text-body-sm text-error-text">{error}</p> : null;
}

// ── Formularios ──────────────────────────────────────────────────────────────

const QUEST_TYPES = [
  { value: 'SIDE', label: 'Tarea' }, { value: 'MAIN', label: 'Proyecto' }, { value: 'META', label: 'Meta' },
] as const;

function QuestForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'SIDE' | 'MAIN' | 'META'>('SIDE');
  const [touched, setTouched] = useState(false);
  const { saving, error, submit } = useSubmit(async () => {
    await createQuest({ title: title.trim(), type, difficulty: 'EASY', category: 'PERSONAL', xpReward: type === 'META' ? 75 : 50, goldReward: 10 });
    useToastStore.getState().success('Misión creada', 'Ganarás XP al completarla');
    onDone();
  });
  const invalid = touched && !title.trim();
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { setTouched(true); if (title.trim()) void submit(e); else e.preventDefault(); }}>
      <Field label="Nombre de la misión" error={invalid ? 'Escribe un nombre' : undefined}>
        <Input data-autofocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Terminar el informe" />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span aria-hidden className="text-label-lg text-on-surface">Tipo</span>
        <SegmentedControl role="radiogroup" label="Tipo de misión" value={type} onChange={setType} options={[...QUEST_TYPES]} />
      </div>
      <FormError error={error} />
      <Button type="submit" block loading={saving}>Crear misión</Button>
    </form>
  );
}

function ExpenseForm({ onDone }: { onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [touched, setTouched] = useState(false);
  const value = Number(amount);
  const valid = amount !== '' && Number.isFinite(value) && value > 0;
  const { saving, error, submit } = useSubmit(async () => {
    await createTransaction({ type: 'EXPENSE', amount: value, category: 'OTHER', description: desc.trim() || undefined });
    useToastStore.getState().success('Gasto registrado');
    onDone();
  });
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { setTouched(true); if (valid) void submit(e); else e.preventDefault(); }}>
      <Field label="Monto" error={touched && !valid ? 'Escribe un monto mayor que 0' : undefined}>
        <Input data-autofocus type="number" inputMode="decimal" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
      </Field>
      <Field label="Descripción" help="Opcional">
        <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ej. Almuerzo" />
      </Field>
      <FormError error={error} />
      <Button type="submit" block loading={saving}>Registrar gasto</Button>
    </form>
  );
}

function HabitPicker({ onDone }: { onDone: () => void }) {
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
      useToastStore.getState().success(`${h.title} completado`, xp > 0 ? `+${xp} XP` : undefined);
      void refreshUser();
      const rest = (habits ?? []).filter((x) => x.id !== h.id);
      setHabits(rest);
      if (rest.length === 0) onDone();
    } catch {
      useToastStore.getState().error('No se pudo marcar el hábito');
    } finally {
      setSaving(null);
    }
  }

  if (failed) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 py-4 text-center">
        <p className="text-body-md text-on-surface">No pudimos cargar tus hábitos.</p>
        <Button variant="secondary" size="sm" onClick={load}>Reintentar</Button>
      </div>
    );
  }
  if (!habits) {
    return <PageLoader label="Cargando tus hábitos…" words={LOADING_COPY.habits} size="sm" />;
  }
  if (habits.length === 0) {
    return <EmptyState icon={CheckCircle2} tone="success" title="¡Todo listo por hoy!" description="Completaste todos tus hábitos del día." />;
  }
  return (
    <ul className="flex max-h-[50dvh] flex-col gap-2 overflow-y-auto">
      {habits.map((h) => (
        <li key={h.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-label-lg text-on-background">{h.title}</span>
            <span className="block text-body-sm text-primary-text font-mono tabular-nums">+{h.xpReward} XP{h.currentStreak > 0 ? ` · racha ${h.currentStreak} d` : ''}</span>
          </span>
          <CheckButton name={h.title} checked={saving === h.id} disabled={saving === h.id} onToggle={() => void complete(h)} />
        </li>
      ))}
    </ul>
  );
}

function NoteForm({ onDone }: { onDone: () => void }) {
  const [content, setContent] = useState('');
  const [touched, setTouched] = useState(false);
  const { saving, error, submit } = useSubmit(async () => {
    await createJournalEntry({ content: content.trim(), title: content.trim().slice(0, 40) });
    useToastStore.getState().success('Nota guardada en tu diario');
    onDone();
  });
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { setTouched(true); if (content.trim()) void submit(e); else e.preventDefault(); }}>
      <Field label="Tu nota" error={touched && !content.trim() ? 'Escribe algo para guardar' : undefined}>
        <Textarea data-autofocus rows={4} value={content} onChange={(e) => setContent(e.target.value)} placeholder="¿Qué quieres recordar?" />
      </Field>
      <FormError error={error} />
      <Button type="submit" block loading={saving}>Guardar nota</Button>
    </form>
  );
}

const MOODS: { icon: LucideIcon; label: string }[] = [
  { icon: Angry, label: 'Muy mal' }, { icon: Frown, label: 'Mal' }, { icon: Meh, label: 'Normal' },
  { icon: Smile, label: 'Bien' }, { icon: Laugh, label: 'Muy bien' },
];

function CheckinForm({ onDone }: { onDone: () => void }) {
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(5);
  const addFloatingXP = useUIStore((s) => s.addFloatingXP);
  const { saving, error, submit } = useSubmit(async () => {
    const res = await api.post('/checkin', { mood, energy });
    const xp = (res.data as { rewards?: { xpEarned?: number } | null })?.rewards?.xpEarned ?? 0;
    if (xp > 0) {
      addFloatingXP(xp, window.innerWidth / 2, 200);
      useToastStore.getState().success('Check-in registrado', `+${xp} XP · bonus diario`);
    } else {
      useToastStore.getState().success('Check-in actualizado', 'El bonus de hoy ya estaba reclamado');
    }
    void refreshUser();
    onDone();
  });
  return (
    <form className="flex flex-col gap-6" onSubmit={(e) => void submit(e)}>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-label-lg text-on-surface">¿Cómo te sientes?</legend>
        <div role="radiogroup" aria-label="Estado de ánimo" className="grid grid-cols-5 gap-2">
          {MOODS.map(({ icon: Icon, label }, i) => {
            const selected = mood === i + 1;
            return (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={label}
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
        <span className="text-center text-body-sm text-on-surface" aria-live="polite">{MOODS[mood - 1].label}</span>
      </fieldset>
      <div className="flex flex-col gap-2">
        <label htmlFor="qa-energy" className="flex justify-between text-label-lg text-on-surface">
          Energía <span className="font-mono tabular-nums text-primary-text">{energy}/10</span>
        </label>
        <input
          id="qa-energy"
          type="range"
          min={1}
          max={10}
          step={1}
          value={energy}
          onChange={(e) => setEnergy(Number(e.target.value))}
          className="h-11 w-full cursor-pointer accent-primary-strong"
        />
      </div>
      <FormError error={error} />
      <Button type="submit" block loading={saving}>Registrar check-in</Button>
    </form>
  );
}

const TITLES: Record<QuickAction, string> = {
  quest: 'Nueva misión', expense: 'Gasto rápido', habit: 'Marcar hábito', note: 'Nota rápida', checkin: 'Check-in',
};

/** Hoja de acciones + diálogo del formulario activo. Montado una vez en el AppShell. */
export function QuickActions() {
  const navigate = useNavigate();
  const open = useShellStore((s) => s.quickOpen);
  const setOpen = useShellStore((s) => s.setQuickOpen);
  const action = useShellStore((s) => s.quickAction);
  const openAction = useShellStore((s) => s.openQuickAction);
  const done = () => openAction(null);

  const choose = (id: ActionDef['id']) => {
    if (id === 'new-habit') {
      setOpen(false);
      navigate('/habits?new=1');
    } else {
      openAction(id);
    }
  };

  return (
    <>
      <ResponsiveDialog open={open} onClose={() => setOpen(false)} title="Acciones rápidas">
        <ul className="flex flex-col gap-2">
          {ACTIONS.map(({ id, label, description, icon: Icon, tone }) => (
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
                  <span className="block truncate text-body-sm text-on-surface-light">{description}</span>
                </span>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-on-surface-light" strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      </ResponsiveDialog>

      <ResponsiveDialog open={action !== null} onClose={done} title={action ? TITLES[action] : ''}>
        {action === 'quest' && <QuestForm onDone={done} />}
        {action === 'expense' && <ExpenseForm onDone={done} />}
        {action === 'habit' && <HabitPicker onDone={done} />}
        {action === 'note' && <NoteForm onDone={done} />}
        {action === 'checkin' && <CheckinForm onDone={done} />}
      </ResponsiveDialog>
    </>
  );
}
