// Crear / editar misión (sustituye al QuestWizard; mismo payload).
import { useEffect, useState, type FormEvent } from 'react';
import type { Quest } from '@noutlife/shared';
import { Plus, X } from 'lucide-react';
import { Button, Field, Input, ResponsiveDialog, SegmentedControl, Select, Textarea, DatePicker } from '@/components/ui/lq';
import { CATEGORIES, categoryMeta } from '@/lib/lifeMeta';
import { useLocale, useText, type Copy } from '@/lib/i18n';
import { difficultiesFor, questTypesFor } from './questMeta';

const es = {
  nameError: 'Escribe un nombre para la misión',
  type: 'Tipo',
  typeLabel: 'Tipo de misión',
  name: 'Nombre',
  namePh: 'Ej. Terminar un curso en línea',
  description: 'Descripción',
  optional: 'Opcional',
  category: 'Categoría',
  deadline: 'Fecha límite',
  difficulty: 'Dificultad',
  difficultyHelp: 'A más dificultad, más XP al completarla.',
  steps: 'Pasos',
  newStep: 'Nuevo paso',
  addStep: 'Añadir paso',
  removeStep: (s: string): string => `Quitar paso ${s}`,
  stepPh: 'Añade un paso y pulsa Enter',
  stepsHelp: 'El progreso de la misión se calcula con sus pasos.',
  cancel: 'Cancelar',
  save: 'Guardar cambios',
  create: 'Crear misión',
  editTitle: 'Editar misión',
  newTitle: 'Nueva misión',
};

const en: typeof es = {
  nameError: 'Write a name for the quest',
  type: 'Type',
  typeLabel: 'Quest type',
  name: 'Name',
  namePh: 'E.g. Finish an online course',
  description: 'Description',
  optional: 'Optional',
  category: 'Category',
  deadline: 'Deadline',
  difficulty: 'Difficulty',
  difficultyHelp: 'The harder it is, the more XP you earn when you complete it.',
  steps: 'Steps',
  newStep: 'New step',
  addStep: 'Add step',
  removeStep: (s: string): string => `Remove step ${s}`,
  stepPh: 'Add a step and press Enter',
  stepsHelp: 'The quest progress is calculated from its steps.',
  cancel: 'Cancel',
  save: 'Save changes',
  create: 'Create quest',
  editTitle: 'Edit quest',
  newTitle: 'New quest',
};

const COPY: Copy<typeof es> = { es, en };

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
  const t = useText(COPY);
  const locale = useLocale();
  const [v, setV] = useState<QuestFormValues>(() => initial(quest));
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState('');

  useEffect(() => { if (open) { setV(initial(quest)); setTouched(false); setStep(''); } }, [open, quest]);

  const set = <K extends keyof QuestFormValues>(k: K, val: QuestFormValues[K]) => setV((x) => ({ ...x, [k]: val }));
  const titleError = touched && !v.title.trim() ? t.nameError : undefined;

  function addStep() {
    const value = step.trim();
    if (!value) return;
    set('subObjectives', [...v.subObjectives, value]);
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

  const typeOptions = questTypesFor(locale).map((x) => ({ value: x.value, label: x.label }));
  const typeValue = (questTypesFor(locale).some((x) => x.value === v.type) ? v.type : 'SIDE') as 'SIDE' | 'MAIN' | 'META';

  return (
    <ResponsiveDialog open={open} onClose={onClose} title={quest ? t.editTitle : t.newTitle} className="md:max-w-[560px]">
      <form className="flex flex-col gap-6" onSubmit={(e) => void submit(e)} noValidate>
        <div className="flex flex-col gap-2">
          <span aria-hidden className="text-label-lg text-on-surface">{t.type}</span>
          <SegmentedControl role="radiogroup" label={t.typeLabel} value={typeValue} onChange={(x) => set('type', x)} options={typeOptions} />
          <span className="text-body-sm text-on-surface-light">{questTypesFor(locale).find((x) => x.value === typeValue)?.description}</span>
        </div>

        <Field label={t.name} error={titleError}>
          <Input data-autofocus value={v.title} maxLength={120} onChange={(e) => set('title', e.target.value)} placeholder={t.namePh} />
        </Field>

        <Field label={t.description} help={t.optional}>
          <Textarea rows={2} className="min-h-20" value={v.description} onChange={(e) => set('description', e.target.value)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.category}>
            <Select value={v.category} onChange={(e) => set('category', e.target.value as Quest['category'])}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{categoryMeta(c, locale).label}</option>)}
            </Select>
          </Field>
          <Field label={t.deadline} help={t.optional}>
            <DatePicker clearable value={v.deadline} onChange={(d) => set('deadline', d)} />
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          <span aria-hidden className="text-label-lg text-on-surface">{t.difficulty}</span>
          <SegmentedControl
            role="radiogroup"
            label={t.difficulty}
            value={v.difficulty}
            onChange={(d) => set('difficulty', d)}
            options={difficultiesFor(locale).map((d) => ({ value: d.value, label: d.label }))}
          />
          <span className="text-body-sm text-on-surface-light">{t.difficultyHelp}</span>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label-lg text-on-surface">{t.steps}</legend>
          {v.subObjectives.length > 0 && (
            <ol className="flex flex-col gap-1">
              {v.subObjectives.map((s, i) => (
                <li key={`${s}-${i}`} className="flex items-center gap-2 rounded-xl border border-border bg-surface pl-3">
                  <span className="text-label-md text-on-surface-light font-mono tabular-nums">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate text-body-md">{s}</span>
                  <Button variant="icon" aria-label={t.removeStep(s)} onClick={() => set('subObjectives', v.subObjectives.filter((_, j) => j !== i))}>
                    <X aria-hidden className="size-5" strokeWidth={1.75} />
                  </Button>
                </li>
              ))}
            </ol>
          )}
          <div className="flex gap-2">
            <Input
              aria-label={t.newStep}
              value={step}
              onChange={(e) => setStep(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStep(); } }}
              placeholder={t.stepPh}
            />
            <Button variant="secondary" aria-label={t.addStep} onClick={addStep} className="shrink-0 px-4">
              <Plus aria-hidden className="size-5" strokeWidth={2} />
            </Button>
          </div>
          <span className="text-body-sm text-on-surface-light">{t.stepsHelp}</span>
        </fieldset>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>{t.cancel}</Button>
          <Button type="submit" loading={saving}>{quest ? t.save : t.create}</Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
