import * as React from 'react';
import * as RechartsPrimitive from 'recharts';
import { cn } from '@/lib/utils';

const THEMES = { light: '', dark: '.dark' } as const;

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
>;

type ChartContextProps = { config: ChartConfig };
const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) throw new Error('useChart must be used inside a <ChartContainer />');
  return context;
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    config: ChartConfig;
    children: React.ReactNode;
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId();
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, '')}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        ref={ref}
        data-chart={chartId}
        className={cn(
          'flex min-w-0 aspect-video min-h-[180px] w-full justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-[var(--text-muted)] [&_.recharts-cartesian-grid_line[stroke="#ccc"]]:stroke-[var(--border)] [&_.recharts-curve.recharts-tooltip-cursor]:stroke-[var(--border-strong)] [&_.recharts-default-tooltip]:outline-none',
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children as React.ReactElement}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = 'ChartContainer';

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(([, value]) => value.theme || value.color);
  if (!colorConfig.length) return null;

  const css = Object.entries(THEMES)
    .map(([theme, prefix]) => {
      const declarations = colorConfig
        .map(([key, itemConfig]) => {
          const color = itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ?? itemConfig.color;
          return color ? `  --color-${key}: ${color};` : '';
        })
        .filter(Boolean)
        .join('\n');
      return `${prefix} [data-chart=${id}] {\n${declarations}\n}`;
    })
    .join('\n');

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

const ChartTooltip = RechartsPrimitive.Tooltip;
const ChartLegend = RechartsPrimitive.Legend;

interface ChartTooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  active?: boolean;
  payload?: Array<{ name?: string | number; value?: string | number; color?: string; dataKey?: string | number }>;
  label?: string | number;
  labelFormatter?: (label: string | number) => React.ReactNode;
  formatter?: (value: string | number, name: string | number) => React.ReactNode;
}

function ChartTooltipContent({
  active,
  payload,
  className,
  label,
  labelFormatter,
  formatter,
}: ChartTooltipContentProps) {
  const { config } = useChart();

  if (!active || !payload?.length) return null;
  const formattedLabel = labelFormatter ? labelFormatter(label ?? '') : label;

  return (
    <div className={cn('grid min-w-[9rem] gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2 text-xs shadow-pixel', className)}>
      {formattedLabel ? <p className="font-medium text-[var(--text-secondary)]">{formattedLabel}</p> : null}
      {payload.map((item, index) => {
        const key = String(item.dataKey ?? item.name ?? index);
        const itemConfig = config[key];
        const itemLabel = itemConfig?.label ?? item.name ?? key;
        const value = item.value ?? 0;
        return (
          <div key={key} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color ?? `var(--color-${key})` }} />
              {itemLabel}
            </span>
            <span className="font-semibold tabular-nums text-[var(--text-primary)]">
              {formatter ? formatter(value, key) : value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartStyle,
  useChart,
};
