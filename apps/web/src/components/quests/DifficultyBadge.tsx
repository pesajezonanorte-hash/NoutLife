const DIFFICULTY_CONFIG: Record<string, { label: string; color: string }> = {
  EASY:   { label: 'Fácil', color: 'var(--text-muted)' },
  NORMAL: { label: 'Normal', color: 'var(--text-secondary)' },
  HARD:   { label: 'Difícil', color: 'var(--text-primary)' },
  EPIC:   { label: 'Épica', color: 'var(--accent-gold)' },
};

interface Props {
  difficulty: string;
  showLabel?: boolean;
}

export function DifficultyBadge({ difficulty, showLabel = true }: Props) {
  const cfg = DIFFICULTY_CONFIG[difficulty] ?? { label: difficulty, color: 'var(--text-secondary)' };

  return (
    <span
      className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none"
      style={{
        color: cfg.color,
        borderColor: `color-mix(in oklab, ${cfg.color} 42%, var(--border))`,
        backgroundColor: `color-mix(in oklab, ${cfg.color} 8%, transparent)`,
      }}
    >
      {showLabel ? cfg.label : difficulty.charAt(0)}
    </span>
  );
}

export { DIFFICULTY_CONFIG };
