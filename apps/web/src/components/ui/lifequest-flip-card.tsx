import { type CSSProperties, type ReactNode } from 'react';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PerspectiveFlipCard,
  getFlipDepthStyle,
  type PerspectiveFlipCardTrigger,
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
  const customStyle = { '--flip-accent': accent } as CSSProperties;
  const depth = (value: number) => getFlipDepthStyle(value, prefersReducedMotion);
  const displayedMetrics = metrics.slice(0, 3);

  const front = (
    <div className="flex h-full min-w-0 flex-col p-4 sm:p-5">
      <div
        className={cn(
          'relative min-h-[8.5rem] overflow-hidden rounded-2xl border border-border bg-muted',
          heroClassName,
        )}
        aria-label={visualLabel}
        role={visualLabel ? 'img' : undefined}
      >
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center p-4 text-center text-foreground',
            !prefersReducedMotion && 'transition-transform duration-700 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]',
          )}
          style={{
            background: 'radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--flip-accent) 22%, var(--bg-muted)), var(--bg-muted) 68%)',
          }}
        >
          <div style={depth(36)}>{visual}</div>
        </div>
        {badge && (
          <span
            className="pointer-events-none absolute left-3 top-3 rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] [color:var(--flip-accent)] shadow-lg"
            style={depth(52)}
          >
            {badge}
          </span>
        )}
      </div>

      <div className="min-w-0 pt-4" style={depth(28)}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] [color:var(--flip-accent)]">{eyebrow}</p>
        <h3 className="mt-1 line-clamp-2 text-lg font-semibold leading-6 text-foreground sm:text-xl">{title}</h3>
        {description && <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-muted-foreground">{description}</p>}
      </div>

      {frontFooter && (
        <div className="mt-auto min-w-0 pt-3" style={depth(42)}>
          {frontFooter}
        </div>
      )}
    </div>
  );

  const back = (
    <div className="flex h-full min-h-0 min-w-0 flex-col p-4 pt-16 sm:p-5 sm:pt-16">
      <div className="min-w-0 pr-20" style={depth(36)}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] [color:var(--flip-accent)]">{eyebrow}</p>
        <h3 className="mt-1 line-clamp-2 text-lg font-semibold leading-6 text-foreground sm:text-xl">{backTitle ?? title}</h3>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        {backDescription && <div className="text-sm leading-5 text-muted-foreground" style={depth(26)}>{backDescription}</div>}

        {displayedMetrics.length > 0 && (
          <div className={cn('mt-4 grid gap-2', displayedMetrics.length === 1 ? 'grid-cols-1' : displayedMetrics.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
            {displayedMetrics.map((metric, index) => (
              <div
                key={`${metric.label}-${index}`}
                className="min-w-0 rounded-xl border border-border bg-muted p-2.5"
                style={depth(24 + index * 8)}
              >
                <p className="truncate text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{metric.label}</p>
                <div className="mt-1 truncate text-sm font-semibold text-foreground">{metric.value}</div>
              </div>
            ))}
          </div>
        )}

        {backContent && <div className="mt-4 text-sm leading-5 text-muted-foreground" style={depth(32)}>{backContent}</div>}
      </div>

      {(backActions || actionLabel) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3" onClick={(event) => event.stopPropagation()}>
          {backActions}
          {actionLabel && (
            <div style={depth(48)}>
              <button
                type="button"
                disabled={actionDisabled}
                onClick={(event) => {
                  event.stopPropagation();
                  onAction?.();
                }}
                className="inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.015] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
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
        className={cn('mx-auto', className)}
        id={id}
      />
    </div>
  );
}
