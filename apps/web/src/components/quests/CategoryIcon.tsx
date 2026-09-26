import {
  BookOpen,
  CircleDot,
  Dumbbell,
  Heart,
  HeartPulse,
  Palette,
  UserRound,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  HEALTH: HeartPulse,
  FITNESS: Dumbbell,
  FINANCE: WalletCards,
  LEARNING: BookOpen,
  LOVE: Heart,
  SOCIAL: UsersRound,
  PERSONAL: UserRound,
  CREATIVE: Palette,
};

export const CATEGORY_LABELS: Record<string, string> = {
  HEALTH: 'Salud',
  FITNESS: 'Fitness',
  FINANCE: 'Finanzas',
  LEARNING: 'Aprendizaje',
  LOVE: 'Amor',
  SOCIAL: 'Social',
  PERSONAL: 'Personal',
  CREATIVE: 'Creativo',
};

const CATEGORY_COLORS: Record<string, string> = {
  HEALTH: 'var(--accent-green)',
  FITNESS: 'var(--accent-red)',
  FINANCE: 'var(--accent-gold)',
  LEARNING: 'var(--accent-cyan)',
  LOVE: 'var(--accent-pink)',
  SOCIAL: 'var(--accent-blue)',
  PERSONAL: 'var(--text-primary)',
  CREATIVE: 'var(--accent-purple)',
};

interface Props {
  category: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** A compact semantic category marker shared by quest lists and dialogs. */
export function CategoryIcon({ category, showLabel = false, size = 'md', className = '' }: Props) {
  const Icon = CATEGORY_ICONS[category] ?? CircleDot;
  const label = CATEGORY_LABELS[category] ?? category;
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 20 : 16;
  const boxClass = size === 'sm'
    ? 'h-6 w-6 rounded-lg'
    : size === 'lg'
      ? 'h-10 w-10 rounded-xl'
      : 'h-8 w-8 rounded-lg';

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`inline-flex shrink-0 items-center justify-center border border-[var(--border)] bg-[var(--bg-panel-light)] ${boxClass}`}
        style={{ color: CATEGORY_COLORS[category] ?? 'var(--text-secondary)' }}
        aria-hidden="true"
      >
        <Icon size={iconSize} strokeWidth={1.8} />
      </span>
      {showLabel && <span className="text-sm text-[var(--text-secondary)]">{label}</span>}
    </span>
  );
}

export { CATEGORY_COLORS };
