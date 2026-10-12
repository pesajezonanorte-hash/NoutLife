// Checklist reutilizable: progreso, pasos marcables, añadir/quitar pasos y
// acciones (compartir, duplicar, eliminar). La usan la zona de Listas y los
// bloques por categoría dentro de otras zonas (Compras en Comida, Finanzas…).
import { useState, type FormEvent } from 'react';
import { CheckCircle2, Circle, Copy, ListChecks, Plus, Share2, Trash2 } from 'lucide-react';
import { Badge, Button, Card, Input } from '@/components/ui/lq';
import { useToast } from '@/hooks/useToast';
import * as checklistService from '@/services/checklist.service';
import type { Checklist, ChecklistItem } from '@/services/checklist.service';

export function ChecklistCard({ checklist, onRefresh, onShare, compact = false }: { checklist: Checklist; onRefresh: () => void | Promise<void>; onShare?: () => void; compact?: boolean }) {
  const toast = useToast();
  const [newStep, setNewStep] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savingStep, setSavingStep] = useState(false);
  const done = checklist.items.filter((step) => step.isDone).length;
  const pct = checklist.items.length ? Math.round(done * 100 / checklist.items.length) : 0;

  async function toggle(step: ChecklistItem) {
    setBusyId(step.id);
    try { await checklistService.updateItem(step.id, { isDone: !step.isDone }); await onRefresh(); }
    catch { toast.error('No se pudo actualizar el paso'); }
    finally { setBusyId(null); }
  }
  async function addStep(event: FormEvent) {
    event.preventDefault();
    if (!newStep.trim()) return;
    setSavingStep(true);
    try { await checklistService.addItem(checklist.id, newStep.trim()); setNewStep(''); await onRefresh(); }
    catch { toast.error('No se pudo añadir el paso'); }
    finally { setSavingStep(false); }
  }
  async function removeStep(step: ChecklistItem) {
    try { await checklistService.deleteItem(step.id); await onRefresh(); }
    catch { toast.error('No se pudo eliminar el paso'); }
  }
  async function duplicate() {
    try { await checklistService.duplicateChecklist(checklist.id); await onRefresh(); toast.success('Lista duplicada'); }
    catch { toast.error('No se pudo duplicar la lista'); }
  }
  async function remove() {
    if (!window.confirm(`¿Eliminar “${checklist.title}” y sus pasos?`)) return;
    try { await checklistService.deleteChecklist(checklist.id); await onRefresh(); toast.success('Lista eliminada'); }
    catch { toast.error('No se pudo eliminar la lista'); }
  }

  return (
    <Card as="article" padding={compact ? 'md' : 'lg'} className={compact ? 'flex min-w-0 flex-col gap-3' : 'flex min-w-0 flex-col gap-5'}>
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/[var(--lq-soft-alpha)] text-primary-text"><ListChecks aria-hidden className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 break-words text-heading-sm">{checklist.title}</h2>
            {checklist.isTemplate && <Badge variant="warning">Plantilla</Badge>}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-body-sm text-on-surface-light"><span className="rounded-full bg-surface-variant px-2 py-0.5 capitalize">{checklist.category}</span><span>· {done}/{checklist.items.length} pasos</span></p>
          {checklist.description && <p className="mt-2 text-body-md text-on-surface-light">{checklist.description}</p>}
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-surface-variant" role="progressbar" aria-label={`Progreso de ${checklist.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>

      <ul className="flex flex-col gap-1" aria-label={`Pasos de ${checklist.title}`}>
        {checklist.items.map((step) => (
          <li key={step.id} className="group flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-surface-variant/60">
            <button type="button" aria-pressed={step.isDone} aria-label={`${step.isDone ? 'Desmarcar' : 'Completar'} ${step.title}`} disabled={busyId === step.id} onClick={() => void toggle(step)} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left">
              {step.isDone ? <CheckCircle2 aria-hidden className="size-5 shrink-0 text-success-text" /> : <Circle aria-hidden className="size-5 shrink-0 text-on-surface-light" />}
              <span className={step.isDone ? 'text-body-md text-on-surface-light line-through' : 'text-body-md text-on-background'}>{step.title}</span>
            </button>
            <Button variant="icon" size="sm" aria-label={`Eliminar paso ${step.title}`} onClick={() => void removeStep(step)} className="size-9 text-on-surface-light opacity-70 hover:text-error-text"><Trash2 aria-hidden className="size-4" /></Button>
          </li>
        ))}
        {checklist.items.length === 0 && <li className="py-2 text-body-sm text-on-surface-light">Añade el primer paso para empezar.</li>}
      </ul>

      <form onSubmit={addStep} className="flex gap-2">
        <Input aria-label={`Nuevo paso para ${checklist.title}`} value={newStep} onChange={(event) => setNewStep(event.target.value)} maxLength={160} placeholder="Añadir un paso…" />
        <Button type="submit" variant="secondary" aria-label="Añadir paso" disabled={!newStep.trim()} loading={savingStep} className="shrink-0"><Plus aria-hidden className="size-4" />Añadir</Button>
      </form>

      {!compact && <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        {onShare && <Button variant="ghost" size="sm" onClick={onShare}><Share2 aria-hidden className="size-4" />Compartir</Button>}
        <Button variant="ghost" size="sm" onClick={() => void duplicate()}><Copy aria-hidden className="size-4" />Duplicar</Button>
        <Button variant="ghost" size="sm" onClick={() => void remove()} className="text-error-text"><Trash2 aria-hidden className="size-4" />Eliminar</Button>
      </div>}
    </Card>
  );
}
