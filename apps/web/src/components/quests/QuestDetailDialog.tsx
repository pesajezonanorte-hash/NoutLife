// Detalle de misión (sin prototipo propio: hoja/modal del sistema). Sustituye
// al antiguo QuestModal: pasos marcables, completar, editar, fallar, archivar.
import { useEffect, useRef, useState } from 'react';
import type { Quest } from '@lifequest/shared';
import { Archive, CalendarClock, Check, CheckCircle2, Pencil, Sparkles, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { categoryMeta } from '@/lib/lifeMeta';
import { Badge, Button, ProgressBar, ResponsiveDialog } from '@/components/ui/lq';
import { useToastStore } from '@/hooks/useToast';
import * as questService from '@/services/quest.service';
import { deadlineInfo, difficultyMeta, questProgress, typeMeta } from './questMeta';

export interface QuestDetailDialogProps {
  quest: Quest | null;
  onClose: () => void;
  onChange: (quest: Quest) => void;
  onComplete: (quest: Quest) => void;
  onEdit: (quest: Quest) => void;
  onFail: (quest: Quest) => void;
  onArchive: (quest: Quest) => void;
}

export function QuestDetailDialog({ quest: current, onClose, onChange, onComplete, onEdit, onFail, onArchive }: QuestDetailDialogProps) {
  // Conserva la última misión para que la animación de salida no quede vacía.
  const last = useRef(current);
  if (current) last.current = current;
  const quest = current ?? last.current;
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'fail' | 'archive' | null>(null);
  useEffect(() => setConfirm(null), [quest?.id]);

  if (!quest) return null;

  const cat = categoryMeta(quest.category);
  const type = typeMeta(quest.type);
  const diff = difficultyMeta(quest.difficulty);
  const p = questProgress(quest);
  const deadline = deadlineInfo(quest.deadline);
  const active = quest.status === 'ACTIVE';

  async function toggle(subId: string, completed: boolean) {
    if (!quest) return;
    setBusy(subId);
    // Optimista: se marca ya y se revierte si falla.
    onChange({ ...quest, subObjectives: quest.subObjectives.map((s) => (s.id === subId ? { ...s, completed } : s)) });
    try {
      onChange(await questService.toggleSubObjective(quest.id, subId, completed));
    } catch {
      onChange(quest);
      useToastStore.getState().error('No se pudo actualizar el paso');
    } finally {
      setBusy(null);
    }
  }

  return (
    <ResponsiveDialog open={Boolean(current)} onClose={onClose} title={quest.title} className="md:max-w-[560px]">
      <div className="flex flex-wrap gap-2">
        <Badge variant={cat.tone}>{cat.label}</Badge>
        <Badge variant="neutral" icon={type.icon}>{type.label}</Badge>
        <Badge variant={diff.variant}>{diff.label}</Badge>
        {active && deadline && <Badge variant={deadline.variant} icon={CalendarClock}>{deadline.text}</Badge>}
        {quest.status === 'COMPLETED' && <Badge variant="success" icon={CheckCircle2}>Completada</Badge>}
        {quest.status === 'FAILED' && <Badge variant="error" icon={XCircle}>Fallida</Badge>}
      </div>

      {quest.description && <p className="text-body-md text-on-surface">{quest.description}</p>}

      <div className="flex items-center justify-between rounded-2xl bg-primary/[var(--lq-soft-alpha)] p-4">
        <span className="flex items-center gap-2 text-label-lg text-primary-text"><Sparkles aria-hidden className="size-5" strokeWidth={1.75} />Recompensa</span>
        <span className="text-heading-sm text-primary-text tabular-nums">+{quest.xpReward} XP{quest.goldReward ? ` · ${quest.goldReward} oro` : ''}</span>
      </div>

      {quest.subObjectives.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="qd-steps">
          <div className="flex items-center justify-between">
            <h3 id="qd-steps" className="text-heading-sm">Pasos</h3>
            <span className="text-body-sm text-on-surface-light tabular-nums">{p.text}</span>
          </div>
          <ProgressBar value={p.pct} tone={p.pct >= 100 ? 'success' : 'primary'} label="Progreso de la misión" valueText={p.text} />
          <ul className="flex flex-col gap-1">
            {quest.subObjectives.map((s) => (
              <li key={s.id}>
                <label className={cn('flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-surface-variant', !active && 'cursor-default')}>
                  <input
                    type="checkbox"
                    checked={s.completed}
                    disabled={!active || busy === s.id}
                    onChange={(e) => void toggle(s.id, e.target.checked)}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary',
                      s.completed ? 'border-success bg-success text-on-primary' : 'border-border-strong',
                    )}
                  >
                    {s.completed && <Check className="size-4" strokeWidth={3} />}
                  </span>
                  <span className={cn('text-body-md', s.completed ? 'text-on-surface-light line-through' : 'text-on-background')}>{s.title}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {confirm ? (
        <div role="alertdialog" aria-labelledby="qd-confirm" className="flex flex-col gap-3 rounded-2xl border border-error/30 bg-error/[var(--lq-soft-alpha)] p-4">
          <p id="qd-confirm" className="text-label-lg text-error-text">
            {confirm === 'fail' ? '¿Marcar la misión como fallida?' : '¿Archivar la misión?'}
          </p>
          <p className="text-body-sm text-on-surface">
            {confirm === 'fail' ? 'No ganarás su recompensa. Podrás verla en el historial.' : 'Desaparecerá de tus listas.'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirm(null)}>Cancelar</Button>
            <Button variant="danger" size="sm" onClick={() => (confirm === 'fail' ? onFail(quest) : onArchive(quest))}>
              {confirm === 'fail' ? 'Marcar fallida' : 'Archivar'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {active && (
            <Button block onClick={() => onComplete(quest)}>
              <CheckCircle2 aria-hidden className="size-5" strokeWidth={1.75} />Completar misión
            </Button>
          )}
          <div className={cn('grid gap-2', active ? 'grid-cols-3' : 'grid-cols-1')}>
            {active && <Button variant="secondary" size="md" onClick={() => onEdit(quest)}><Pencil aria-hidden className="size-4" strokeWidth={1.75} />Editar</Button>}
            {active && <Button variant="ghost" size="md" onClick={() => setConfirm('fail')}><XCircle aria-hidden className="size-4" strokeWidth={1.75} />Fallar</Button>}
            <Button variant="ghost" size="md" onClick={() => setConfirm('archive')} className="text-error-text"><Archive aria-hidden className="size-4" strokeWidth={1.75} />Archivar</Button>
          </div>
        </div>
      )}
    </ResponsiveDialog>
  );
}
