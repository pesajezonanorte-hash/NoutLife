// Crear / editar misión (sustituye al QuestWizard; mismo payload).
import { useEffect, useState, type FormEvent } from 'react';
import type { Quest } from '@lifequest/shared';
import { Plus, X } from 'lucide-react';
import { Button, Field, Input, ResponsiveDialog, SegmentedControl, Select, Textarea } from '@/components/ui/lq';
import { CATEGORIES, CATEGORY_META } from '@/lib/lifeMeta';
import { DIFFICULTIES, QUEST_TYPES } from './questMeta';

export interface QuestFormValues {
  type: Quest['type'];
  title: string;
  description: string;
  category: Quest['category'];
  difficulty: Quest['difficulty'];
  deadline: string;
  subObjectives: string[];
}

function initial(q?: Quest | null): QuestFormValues {
  return {
    type: q?.type ?? 'SIDE',
    title: q?.title ?? '',
    description: q?.description ?? '',
    category: q?.category ?? 'PERSONAL',
    difficulty: q?.difficulty ?? 'NORMAL',
    deadline: q?.deadline ? q.deadline.slice(0, 10) : '',
    subObjectives: q?.subObjectives?.map((s) => s.title) ?? [],
  };
}

export interface QuestFormDialogProps {
  open: boolean;
  quest?: Quest | null;
  onClose: () => void;
  onSubmit: (values: QuestFormValues) => Promise<void> | void;
}

export function QuestFormDialog({ open, quest, onClose, onSubmit }: QuestFormDialogProps) {
  const [v, setV] = useState<QuestFormValues>(() => initial(quest));
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState('');

  useEffect(() => { if (open) { setV(initial(quest)); setTouched(false); setStep(''); } }, [open, quest]);

  const set = <K extends keyof QuestFormValues>(k: K, val: QuestFormValues[K]) => setV((x) => ({ ...x, [k]: val }));
  const titleError = touched && !v.title.trim() ? 'Escribe un nombre para la misión' : undefined;

  function addStep() {
    const t = step.trim();
    if (!t) return;
    set('subObjectives', [...v.subObjectives, t]);
    setStep('');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!v.title.trim()) return;
    setSaving(true);
    try {
      await onSubmit({ ...v, title: v.title.trim(), subObjectives: step.trim() ? [...v.subObjectives, step.trim()] : v.subObjectives });
    } finally {
      setSaving(false);
    }
  }

  const typeOptions = QUEST_TYPES.map((t) => ({ value: t.value, label: t.label }));
  const typeValue = (QUEST_TYPES.some((t) => t.value === v.type) ? v.type : 'SIDE') as 'SIDE' | 'MAIN' | 'META';

  return (
    <ResponsiveDialog open={open} onClose={onClose} title={quest ? 'Editar misión' : 'Nueva misión'} className="md:max-w-[560px]">
      <form className="flex flex-col gap-6" onSubmit={(e) => void submit(e)} noValidate>
        <div className="flex flex-col gap-2">
          <span aria-hidden className="text-label-lg text-on-surface">Tipo</span>
          <SegmentedControl role="radiogroup" label="Tipo de misión" value={typeValue} onChange={(t) => set('type', t)} options={typeOptions} />
          <span className="text-body-sm text-on-surface-light">{QUEST_TYPES.find((t) => t.value === typeValue)?.description}</span>
        </div>

        <Field label="Nombre" error={titleError}>
          <Input data-autofocus value={v.title} maxLength={120} onChange={(e) => set('title', e.target.value)} placeholder="Ej. Terminar un curso en línea" />
        </Field>

        <Field label="Descripción" help="Opcional">
          <Textarea rows={2} className="min-h-20" value={v.description} onChange={(e) => set('description', e.target.value)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoría">
            <Select value={v.category} onChange={(e) => set('category', e.target.value as Quest['category'])}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
            </Select>
          </Field>
          <Field label="Fecha límite" help="Opcional">
            <Input type="date" value={v.deadline} onChange={(e) => set('deadline', e.target.value)} />
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          <span aria-hidden className="text-label-lg text-on-surface">Dificultad</span>
          <SegmentedControl
            role="radiogroup"
            label="Dificultad"
            value={v.difficulty}
            onChange={(d) => set('difficulty', d)}
            options={DIFFICULTIES.map((d) => ({ value: d.value, label: d.label }))}
          />
          <span className="text-body-sm text-on-surface-light">A más dificultad, más XP al completarla.</span>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label-lg text-on-surface">Pasos</legend>
          {v.subObjectives.length > 0 && (
            <ol className="flex flex-col gap-1">
              {v.subObjectives.map((s, i) => (
                <li key={`${s}-${i}`} className="flex items-center gap-2 rounded-xl border border-border bg-surface pl-3">
                  <span className="text-label-md text-on-surface-light tabular-nums">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate text-body-md">{s}</span>
                  <Button variant="icon" aria-label={`Quitar paso ${s}`} onClick={() => set('subObjectives', v.subObjectives.filter((_, j) => j !== i))}>
                    <X aria-hidden className="size-5" strokeWidth={1.75} />
                  </Button>
                </li>
              ))}
            </ol>
          )}
          <div className="flex gap-2">
            <Input
              aria-label="Nuevo paso"
              value={step}
              onChange={(e) => setStep(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStep(); } }}
              placeholder="Añade un paso y pulsa Enter"
            />
            <Button variant="secondary" aria-label="Añadir paso" onClick={addStep} className="shrink-0 px-4">
              <Plus aria-hidden className="size-5" strokeWidth={2} />
            </Button>
          </div>
          <span className="text-body-sm text-on-surface-light">El progreso de la misión se calcula con sus pasos.</span>
        </fieldset>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>{quest ? 'Guardar cambios' : 'Crear misión'}</Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
