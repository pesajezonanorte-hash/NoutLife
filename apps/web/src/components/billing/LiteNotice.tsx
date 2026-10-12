import type { ReactNode } from 'react';
import { Gem } from 'lucide-react';
import { Button } from '@/components/ui/lq';
import { cn } from '@/lib/utils';
import { usePlanStore } from '@/store/planStore';
import type { ProFeature } from '@/lib/plan';

/** Aviso discreto de un límite de NoutLife Lite, con acceso al diálogo de Pro. */
export function LiteNotice({ feature, children, className }: { feature: ProFeature; children: ReactNode; className?: string }) {
  const openUpgrade = usePlanStore((s) => s.openUpgrade);
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-secondary/40 bg-secondary/[var(--lq-soft-alpha)] py-2 pl-4 pr-2', className)}>
      <Gem aria-hidden className="size-5 shrink-0 text-secondary-text" strokeWidth={1.75} />
      <p className="min-w-0 flex-[1_1_200px] text-body-sm text-on-background">{children}</p>
      <Button variant="ghost" size="sm" onClick={() => openUpgrade(feature)}>Ver Pro</Button>
    </div>
  );
}
