import { type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface Props {
  icon: ReactNode;
  label: string;
  sublabel: string;
  to: string;
  color: string;
  badge?: string;
}

/** A calm navigation tile for the dashboard's life zones. */
export function ZoneCard({ icon, label, sublabel, to, color, badge }: Props) {
  const navigate = useNavigate();
  const style = { '--zone-accent': color } as CSSProperties;

  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      style={style}
      className="group relative flex min-h-[122px] w-full flex-col rounded-2xl border border-[color-mix(in_oklab,var(--zone-accent)_42%,var(--border))] bg-[var(--bg-panel-light)] p-3.5 text-left shadow-[0_10px_25px_rgba(0,0,0,0.06)] transition-colors hover:bg-[var(--bg-panel)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zone-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-deep)]"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--zone-accent)_11%,var(--bg-panel))] text-[var(--zone-accent)]" aria-hidden="true">
        {icon}
      </span>
      <span className="mt-3 text-sm font-semibold text-[var(--text-primary)]">{label}</span>
      <span className="mt-0.5 text-xs leading-5 text-[var(--text-secondary)]">{sublabel}</span>
      {badge && <span className="mt-auto pt-2 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--zone-accent)]">{badge}</span>}
    </button>
  );
}
