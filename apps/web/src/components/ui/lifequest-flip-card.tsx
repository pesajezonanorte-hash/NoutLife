import { type CSSProperties, type ReactNode } from 'react';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PerspectiveFlipCard,
  getFlipDepthStyle,
  type PerspectiveFlipCardTrigger,
  useNested3dSupport,
  usePrefersReducedMotion,
} from './perspective-flip-card';

export interface FlipCardMetric {
  label: string;
  value: ReactNode;
}

export interface LifeQuestFlipCardProps {
  eyebrow: string;
  title: string;
  description?: string;
  /** Visual content for the clipped front hero: an icon, progress value, or game glyph. */
  visual: ReactNode;
  visualLabel?: string;
  badge?: string;
  frontFooter?: ReactNode;
  backTitle?: string;
  backDescription?: ReactNode;
  metrics?: FlipCardMetric[];
  backContent?: ReactNode;
  /** Extra reverse-side actions, such as a theme preview. */
  backActions?: ReactNode;
  actionLabel?: string;
  actionIcon?: LucideIcon;
  actionDisabled?: boolean;
  onAction?: () => void;
  accent?: string;
  className?: string;
  heroClassName?: string;
  trigger?: PerspectiveFlipCardTrigger;
  flipped?: boolean;
  onFlipChange?: (flipped: boolean) => void;
  id?: string;
}

/**
 * LifeQuest's shared presentation for one intentional, information-rich flip card.
 * It is intentionally used for featured summaries rather than repeated across long
 * lists, keeping the 3D compositor work bounded.
 */
export function LifeQuestFlipCard({
  eyebrow,
  title,
  description,
  visual,
  visualLabel,
  badge,
  frontFooter,
  backTitle,
  backDescription,
  metrics = [],
  backContent,
  backActions,
  actionLabel,
  actionIcon: ActionIcon = ArrowRight,
  actionDisabled = false,
  onAction,
  accent = 'var(--accent-gold)',
  className,
  heroClassName,
  trigger = 'auto',
  flipped,
  onFlipChange,
  id,
}: LifeQuestFlipCardProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const supports3d = useNested3dSupport();
  const customStyle = { '--flip-accent': accent } as CSSProperties;
  const depth = (value: number) => getFlipDepthStyle(value, prefersReducedMotion || !supports3d);
  const displayedMetrics = metrics.slice(0, 3);

  const front = (
    <div className="perspective-flip-card__depth-context flex h-full min-w-0 flex-col p-3">
      <div
        className={cn(
          'perspective-flip-card__depth-context relative h-56 w-full rounded-xl border border-border bg-muted',
          heroClassName,
        )}
        aria-label={visualLabel}
        role={visualLabel ? 'img' : undefined}
      >
        <div
          className={cn(
            'perspective-flip-card__depth-context absolute inset-0 flex items-center justify-center p-4 text-center text-foreground',
            !prefersReducedMotion && 'transition-transform duration-700 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] group-hover/p-card:scale-110',
          )}
          style={{
            background: 'radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--flip-accent) 24%, var(--bg-muted)), var(--bg-muted) 68%)',
          }}
        >
          <div className="perspective-flip-card__depth" style={depth(50)}>{visual}</div>
        </div>
        {badge && (
          <span
            className="perspective-flip-card__depth pointer-events-none absolute bottom-4 left-4 rounded-full border border-border bg-card px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] [color:var(--flip-accent)] shadow-lg"
            style={depth(80)}
          >
            {badge}
          </span>
        )}
      </div>

      <div className="perspective-flip-card__depth-context flex min-h-0 flex-1 flex-col justify-between px-3 pb-3 pt-5">
        <div className="perspective-flip-card__depth min-w-0" style={depth(60)}>
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] [color:var(--flip-accent)]">{eyebrow}</p>
          <h3 className="mt-1 line-clamp-2 text-xl font-bold leading-6 tracking-tight text-foreground transition-colors duration-300 group-hover/p-card:text-primary">{title}</h3>
          {description && <p className="mt-2 line-clamp-2 text-sm font-medium leading-5 text-muted-foreground">{description}</p>}
        </div>

        <div className="perspective-flip-card__depth mt-4 flex items-end justify-between gap-3 text-xs font-semibold tracking-wide text-muted-foreground" style={depth(44)}>
          <div className="min-w-0">
            {frontFooter}
            <p className="mt-2 flex items-center gap-1.5 text-[11px] transition-transform duration-300 group-hover/p-card:translate-x-1 group-hover/p-card:text-primary">
              <span className="hidden sm:inline">Pasa el cursor para ver más</span>
              <span className="sm:hidden">Toca para ver más</span>
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover/p-card:translate-x-1 group-hover/p-card:text-primary" aria-hidden="true" />
        </div>
      </div>
    </div>
  );

  const back = (
    <div className="perspective-flip-card__depth-context flex h-full min-h-0 min-w-0 flex-col p-6 pt-16 text-center">
      <div className="perspective-flip-card__depth min-w-0 pr-16" style={depth(80)}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] [color:var(--flip-accent)]">{eyebrow}</p>
        <h3 className="mt-1 line-clamp-2 text-xl font-bold leading-6 tracking-tight text-foreground">{backTitle ?? title}</h3>
      </div>

      <div className="perspective-flip-card__depth-context mt-4 min-h-0 flex-1 pr-1">
        {backDescription && <div className="perspective-flip-card__depth mx-auto max-w-[18rem] text-sm font-medium leading-5 text-muted-foreground" style={depth(48)}>{backDescription}</div>}

        {displayedMetrics.length > 0 && (
          <div className={cn('perspective-flip-card__depth-context mt-6 grid gap-2', displayedMetrics.length === 1 ? 'grid-cols-1' : displayedMetrics.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
            {displayedMetrics.map((metric, index) => (
              <div
                key={`${metric.label}-${index}`}
                className="perspective-flip-card__depth perspective-flip-card__depth-context min-w-0 rounded-2xl border border-border bg-muted p-3"
                style={depth(index === 1 ? 160 : 130)}
              >
                <p className="truncate text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{metric.label}</p>
                <div className="perspective-flip-card__depth mt-1 truncate text-sm font-bold text-foreground" style={depth(18)}>{metric.value}</div>
              </div>
            ))}
          </div>
        )}

        {backContent && <div className="perspective-flip-card__depth mt-5 text-sm leading-5 text-muted-foreground" style={depth(56)}>{backContent}</div>}
      </div>

      {(backActions || actionLabel) && (
        <div className="perspective-flip-card__depth-context mt-4 flex flex-wrap items-center justify-center gap-2 border-t border-border pt-4" onClick={(event) => event.stopPropagation()}>
          {backActions}
          {actionLabel && (
            <div className="perspective-flip-card__depth w-full px-1" style={depth(100)}>
              <button
                type="button"
                disabled={actionDisabled}
                onClick={(event) => {
                  event.stopPropagation();
                  onAction?.();
                }}
                className="inline-flex min-h-11 w-full max-w-full items-center justify-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-sm font-bold tracking-wide text-primary-foreground shadow-lg transition-transform hover:scale-[1.03] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="truncate">{actionLabel}</span>
                <ActionIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div style={customStyle} className="min-w-0 max-w-full">
      <PerspectiveFlipCard
        front={front}
        back={back}
        label={title}
        trigger={trigger}
        flipped={flipped}
        onFlipChange={onFlipChange}
        className={className}
        id={id}
      />
    </div>
  );
}
