import { motion } from 'framer-motion';
import type { Quest } from '@lifequest/shared';
import { CalendarClock, CheckCircle2, Sparkles, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { item } from '@/lib/motion';
import { categoryMeta } from '@/lib/lifeMeta';
import { Badge, Button, IconChip, ProgressBar } from '@/components/ui/lq';
import { deadlineInfo, isReady, questProgress, typeMeta } from './questMeta';

export interface QuestCardProps {
  quest: Quest;
  onOpen: () => void;
  onComplete: () => void;
  className?: string;
}

/**
 * Tarjeta de misión (Quests.dc.html / QuestsDesktop): categoría + XP, título,
 * barra de progreso con texto y %. Toda la tarjeta abre el detalle; el botón
 * "Completar misión" aparece cuando la misión está activa.
 */
export function QuestCard({ quest, onOpen, onComplete, className }: QuestCardProps) {
  const cat = categoryMeta(quest.category);
  const type = typeMeta(quest.type);
  const p = questProgress(quest);
  const ready = isReady(quest);
  const done = quest.status === 'COMPLETED';
  const failed = quest.status === 'FAILED';
  const deadline = quest.status === 'ACTIVE' ? deadlineInfo(quest.deadline) : null;

  return (
    <motion.li variants={item} className={cn('lq-lift relative flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm md:p-6', failed && 'opacity-75', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-3">
          <IconChip icon={type.icon} tone={cat.tone} size="sm" className="hidden md:flex" />
          <Badge variant={cat.tone}>{cat.label}</Badge>
        </span>
        <span className="flex items-center gap-1 text-label-lg text-primary-text font-mono tabular-nums">
          <Sparkles aria-hidden className="size-4" strokeWidth={1.75} />+{quest.xpReward} XP
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-heading-sm">
          {/* El enlace cubre la tarjeta (patrón "stretched link"): un único destino tabulable. */}
          <button type="button" aria-haspopup="dialog" onClick={onOpen} className="text-left lq-stretch after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-[3px] focus-visible:after:outline-offset-2 focus-visible:after:outline-primary">
            {quest.title}
          </button>
        </h3>
        <span className="line-clamp-2 text-body-sm text-on-surface-light">{type.label}{quest.description ? ` · ${quest.description}` : ''}</span>
      </div>

      <div className="mt-auto flex flex-col gap-1.5">
        <ProgressBar
          value={p.pct}
          tone={done || ready ? 'success' : 'primary'}
          label={`Progreso de ${quest.title}`}
          valueText={p.text}
        />
        <div className="flex justify-between gap-2 text-body-sm font-mono tabular-nums">
          <span className="text-on-surface-light">{p.text}</span>
          <span className="text-on-surface">{p.pct}%</span>
        </div>
      </div>

      {deadline && <Badge variant={deadline.variant} icon={CalendarClock} className="self-start">{deadline.text}</Badge>}
      {done && (
        <Badge variant="success" icon={CheckCircle2} className="self-start">
          Completada{quest.completedAt ? ` · ${new Date(quest.completedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ''}
        </Badge>
      )}
      {failed && <Badge variant="error" icon={XCircle} className="self-start">Fallida</Badge>}
      {quest.status === 'ACTIVE' && (
        <Button
          variant={ready ? 'primary' : 'secondary'}
          size="md"
          block
          onClick={onComplete}
          className="relative z-[1]"
        >
          <CheckCircle2 aria-hidden className="size-5" strokeWidth={1.75} />
          Completar misión
        </Button>
      )}
    </motion.li>
  );
}
