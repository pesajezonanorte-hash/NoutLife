// Checklist reutilizable: progreso, pasos marcables, añadir/quitar pasos y
// acciones (compartir, duplicar, eliminar). La usan la zona de Listas y los
// bloques por categoría dentro de otras zonas (Compras en Comida, Finanzas…).
import { useState, type FormEvent } from 'react';
import { CheckCircle2, Circle, Copy, ListChecks, Plus, Share2, Trash2 } from 'lucide-react';
import { Badge, Button, Card, Input } from '@/components/ui/lq';
import { useToast } from '@/hooks/useToast';
import { useText, type Copy as CopyDict } from '@/lib/i18n';
import * as checklistService from '@/services/checklist.service';
import type { Checklist, ChecklistItem } from '@/services/checklist.service';

const es = {
  updateFail: 'No se pudo actualizar el paso',
  addFail: 'No se pudo añadir el paso',
  removeFail: 'No se pudo eliminar el paso',
  duplicated: 'Lista duplicada',
  duplicateFail: 'No se pudo duplicar la lista',
  confirmDelete: (title: string): string => `¿Eliminar “${title}” y sus pasos?`,
  deleted: 'Lista eliminada',
  deleteFail: 'No se pudo eliminar la lista',
  template: 'Plantilla',
  steps: 'pasos',
  progressOf: (title: string): string => `Progreso de ${title}`,
  stepsOf: (title: string): string => `Pasos de ${title}`,
  uncheck: 'Desmarcar',
  check: 'Completar',
  removeStep: (title: string): string => `Eliminar paso ${title}`,
  emptySteps: 'Añade el primer paso para empezar.',
  newStepFor: (title: string): string => `Nuevo paso para ${title}`,
  addPh: 'Añadir un paso…',
  addStep: 'Añadir paso',
  add: 'Añadir',
  share: 'Compartir',
  duplicate: 'Duplicar',
  remove: 'Eliminar',
};

const en: typeof es = {
  updateFail: 'Could not update the step',
  addFail: 'Could not add the step',
  removeFail: 'Could not delete the step',
  duplicated: 'List duplicated',
  duplicateFail: 'Could not duplicate the list',
  confirmDelete: (title: string): string => `Delete “${title}” and its steps?`,
  deleted: 'List deleted',
  deleteFail: 'Could not delete the list',
  template: 'Template',
  steps: 'steps',
  progressOf: (title: string): string => `Progress of ${title}`,
  stepsOf: (title: string): string => `Steps of ${title}`,
  uncheck: 'Uncheck',
  check: 'Complete',
  removeStep: (title: string): string => `Delete step ${title}`,
  emptySteps: 'Add the first step to get started.',
  newStepFor: (title: string): string => `New step for ${title}`,
  addPh: 'Add a step…',
  addStep: 'Add step',
  add: 'Add',
  share: 'Share',
  duplicate: 'Duplicate',
  remove: 'Delete',
};

const COPY: CopyDict<typeof es> = { es, en };

export function ChecklistCard({ checklist, onRefresh, onShare, compact = false }: { checklist: Checklist; onRefresh: () => void | Promise<void>; onShare?: () => void; compact?: boolean }) {
  const t = useText(COPY);
  const toast = useToast();
  const [newStep, setNewStep] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savingStep, setSavingStep] = useState(false);
  const done = checklist.items.filter((step) => step.isDone).length;
  const pct = checklist.items.length ? Math.round(done * 100 / checklist.items.length) : 0;

  async function toggle(step: ChecklistItem) {
    setBusyId(step.id);
    try { await checklistService.updateItem(step.id, { isDone: !step.isDone }); await onRefresh(); }
    catch { toast.error(t.updateFail); }
    finally { setBusyId(null); }
  }
  async function addStep(event: FormEvent) {
    event.preventDefault();
    if (!newStep.trim()) return;
    setSavingStep(true);
    try { await checklistService.addItem(checklist.id, newStep.trim()); setNewStep(''); await onRefresh(); }
    catch { toast.error(t.addFail); }
    finally { setSavingStep(false); }
  }
  async function removeStep(step: ChecklistItem) {
    try { await checklistService.deleteItem(step.id); await onRefresh(); }
    catch { toast.error(t.removeFail); }
  }
  async function duplicate() {
    try { await checklistService.duplicateChecklist(checklist.id); await onRefresh(); toast.success(t.duplicated); }
    catch { toast.error(t.duplicateFail); }
  }
  async function remove() {
    if (!window.confirm(t.confirmDelete(checklist.title))) return;
    try { await checklistService.deleteChecklist(checklist.id); await onRefresh(); toast.success(t.deleted); }
    catch { toast.error(t.deleteFail); }
  }

  return (
    <Card as="article" padding={compact ? 'md' : 'lg'} className={compact ? 'flex min-w-0 flex-col gap-3' : 'flex min-w-0 flex-col gap-5'}>
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/[var(--lq-soft-alpha)] text-primary-text"><ListChecks aria-hidden className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 break-words text-heading-sm">{checklist.title}</h2>
            {checklist.isTemplate && <Badge variant="warning">{t.template}</Badge>}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-body-sm text-on-surface-light"><span className="rounded-full bg-surface-variant px-2 py-0.5 capitalize">{checklist.category}</span><span>· {done}/{checklist.items.length} {t.steps}</span></p>
          {checklist.description && <p className="mt-2 text-body-md text-on-surface-light">{checklist.description}</p>}
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-surface-variant" role="progressbar" aria-label={t.progressOf(checklist.title)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>

      <ul className="flex flex-col gap-1" aria-label={t.stepsOf(checklist.title)}>
        {checklist.items.map((step) => (
          <li key={step.id} className="group flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-surface-variant/60">
            <button type="button" aria-pressed={step.isDone} aria-label={`${step.isDone ? t.uncheck : t.check} ${step.title}`} disabled={busyId === step.id} onClick={() => void toggle(step)} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left">
              {step.isDone ? <CheckCircle2 aria-hidden className="size-5 shrink-0 text-success-text" /> : <Circle aria-hidden className="size-5 shrink-0 text-on-surface-light" />}
              <span className={step.isDone ? 'text-body-md text-on-surface-light line-through' : 'text-body-md text-on-background'}>{step.title}</span>
            </button>
            <Button variant="icon" size="sm" aria-label={t.removeStep(step.title)} onClick={() => void removeStep(step)} className="size-9 text-on-surface-light opacity-70 hover:text-error-text"><Trash2 aria-hidden className="size-4" /></Button>
          </li>
        ))}
        {checklist.items.length === 0 && <li className="py-2 text-body-sm text-on-surface-light">{t.emptySteps}</li>}
      </ul>

      <form onSubmit={addStep} className="flex gap-2">
        <Input aria-label={t.newStepFor(checklist.title)} value={newStep} onChange={(event) => setNewStep(event.target.value)} maxLength={160} placeholder={t.addPh} />
        <Button type="submit" variant="secondary" aria-label={t.addStep} disabled={!newStep.trim()} loading={savingStep} className="shrink-0"><Plus aria-hidden className="size-4" />{t.add}</Button>
      </form>

      {!compact && <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        {onShare && <Button variant="ghost" size="sm" onClick={onShare}><Share2 aria-hidden className="size-4" />{t.share}</Button>}
        <Button variant="ghost" size="sm" onClick={() => void duplicate()}><Copy aria-hidden className="size-4" />{t.duplicate}</Button>
        <Button variant="ghost" size="sm" onClick={() => void remove()} className="text-error-text"><Trash2 aria-hidden className="size-4" />{t.remove}</Button>
      </div>}
    </Card>
  );
}
