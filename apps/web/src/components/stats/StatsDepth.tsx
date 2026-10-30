// Piezas 3D de Estadísticas: barras prisma isométricas, anillo de nivel con resplandor y los
// reversos de las tarjetas que giran (XP, Life Score, zonas y totales). El color sale de la
// escala del acento del tema (--lq-jade-*), así que sigue a Aurora, a Halloween y a cada tema.
// Los gráficos del reverso se animan al quedar a la vista (`active`), no al montar.
import { useId, useMemo, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck2, Flame, Gauge, Rocket, Sparkles, Trophy, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { INTL_LOCALE, useLocale, useText, type Copy, type Locale } from '@/lib/i18n';
import { FlipCard3D, FlipHint, FlipToggle } from './FlipCard3D';
import { bestXpDay, levelPercent, rankZones, weekdayRhythm, zoneInsight, zoneRoute, type DayXp, type ZoneLike } from './statsMath';

const es = {
  xpDetail: 'Detalle de XP',
  levelN: (n: number): string => `Nivel ${n}`,
  ofXp: (a: string, b: string): string => `${a} de ${b} XP`,
  toLevel: (v: string, n: number): string => `Faltan ${v} XP para el nivel ${n}`,
  bestDay: 'Mejor día',
  noXpYet: 'Sin XP aún',
  streak: 'Racha',
  days: (n: number): string => `${n} ${n === 1 ? 'día' : 'días'}`,
  bestStreak: (n: number): string => `Mejor: ${n} ${n === 1 ? 'día' : 'días'}`,
  nextLevel: 'Próximo nivel',
  inDays: (n: number): string => `en ${n} ${n === 1 ? 'día' : 'días'}`,
  atPace: (v: string): string => `a ${v} XP/día`,
  noPace: 'Sin ritmo reciente',
  consistency: 'Constancia',
  daysWithXp: 'días con XP',
  rhythm: 'Ritmo por día de la semana',
  rhythmLabel: (list: string): string => `XP media por día de la semana: ${list}`,
  strongest: (day: string, v: string): string => `Tu día más fuerte: ${day} · ${v} XP de media`,
  noRhythm: 'Aún no hay XP en este periodo.',
  lifeDetail: 'Cómo se compone',
  topZone: 'Más fuerte',
  lowZone: 'A reforzar',
  noZones: 'Configura tus zonas y registra actividad para ver el desglose.',
  zonesWithData: (a: number, b: number): string => `${a} de ${b} zonas con registros`,
  records: (n: number): string => (n === 1 ? 'registro' : 'registros'),
  inPeriod: (p: string): string => `en ${p}`,
  shareOf: (n: number): string => `${n} % de tu actividad`,
  rankOf: (r: number, n: number): string => `Puesto ${r} de ${n} en ritmo`,
  notRanked: 'Sin ritmo medible',
  open: (zone: string): string => `Abrir ${zone}`,
  openShort: 'Abrir',
};

const en: typeof es = {
  xpDetail: 'XP detail',
  levelN: (n) => `Level ${n}`,
  ofXp: (a, b) => `${a} of ${b} XP`,
  toLevel: (v, n) => `${v} XP to level ${n}`,
  bestDay: 'Best day',
  noXpYet: 'No XP yet',
  streak: 'Streak',
  days: (n) => `${n} ${n === 1 ? 'day' : 'days'}`,
  bestStreak: (n) => `Best: ${n} ${n === 1 ? 'day' : 'days'}`,
  nextLevel: 'Next level',
  inDays: (n) => `in ${n} ${n === 1 ? 'day' : 'days'}`,
  atPace: (v) => `at ${v} XP/day`,
  noPace: 'No recent pace',
  consistency: 'Consistency',
  daysWithXp: 'days with XP',
  rhythm: 'Pace by weekday',
  rhythmLabel: (list) => `Average XP by weekday: ${list}`,
  strongest: (day, v) => `Your strongest day: ${day} · ${v} XP on average`,
  noRhythm: 'No XP yet in this period.',
  lifeDetail: 'How it adds up',
  topZone: 'Strongest',
  lowZone: 'Needs care',
  noZones: 'Set up your zones and log activity to see the breakdown.',
  zonesWithData: (a, b) => `${a} of ${b} zones with records`,
  records: (n) => (n === 1 ? 'record' : 'records'),
  inPeriod: (p) => `in the ${p}`,
  shareOf: (n) => `${n}% of your activity`,
  rankOf: (r, n) => `#${r} of ${n} by pace`,
  notRanked: 'No measurable pace',
  open: (zone) => `Open ${zone}`,
  openShort: 'Open',
};

const COPY: Copy<typeof es> = { es, en };

const cleanId = (id: string) => id.replace(/:/g, '');

/** Formateadores Intl creados una vez por idioma (crearlos en cada render cuesta varios ms en móvil). */
const FORMATTERS = new Map<Locale, { fmt: (n: number) => string; day: (d: string) => string; weekday: (wd: number, style: 'short' | 'long') => string }>();
function formatters(locale: Locale) {
  let f = FORMATTERS.get(locale);
  if (!f) {
    const nf = INTL_LOCALE[locale];
    const num = new Intl.NumberFormat(nf, { maximumFractionDigits: 0 });
    const day = new Intl.DateTimeFormat(nf, { day: 'numeric', month: 'short' });
    const short = new Intl.DateTimeFormat(nf, { weekday: 'short' });
    const long = new Intl.DateTimeFormat(nf, { weekday: 'long' });
    f = {
      fmt: (n) => num.format(Math.round(n)),
      day: (d) => day.format(new Date(`${d.slice(0, 10)}T12:00:00`)),
      // 4 de enero de 2026 fue domingo: 4 + n es el día n de la semana (0 = domingo).
      weekday: (wd, style) => {
        const s = (style === 'short' ? short : long).format(new Date(2026, 0, 4 + wd, 12)).replace('.', '');
        return style === 'short' ? s.charAt(0).toUpperCase() + s.slice(1) : s;
      },
    };
    FORMATTERS.set(locale, f);
  }
  return f;
}

/* ───────── Barras prisma isométricas ───────── */

export interface PrismBar { key: string; label: string; value: number; highlight?: boolean }

/**
 * Columnas de vidrio en perspectiva isométrica (frente, costado y tapa en tres tonos del
 * acento, con luz cenital). Suben desde el suelo cuando `active`; la destacada lleva un haz.
 */
export function PrismBars({ bars, active, label, height = 168, format = String, className }: {
  bars: PrismBar[]; active: boolean; label: string; height?: number; format?: (n: number) => string; className?: string;
}) {
  const uid = cleanId(useId());
  const W = 320, H = height, base = H - 24, top = 34;
  const n = Math.max(1, bars.length);
  const slot = W / n;
  const w = Math.min(30, slot * 0.46);
  const depth = Math.min(16, slot * 0.3);
  const dx = depth * 0.866, dy = depth * 0.5;
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className={cn('lq-prism block w-full overflow-visible', className)} data-active={active || undefined}>
      <defs>
        <linearGradient id={`${uid}-beam`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" className="lq-prism-beam-a" />
          <stop offset="1" className="lq-prism-beam-b" />
        </linearGradient>
        <radialGradient id={`${uid}-pool`}>
          <stop offset="0" className="lq-prism-pool-a" />
          <stop offset="1" className="lq-prism-pool-b" />
        </radialGradient>
        <clipPath id={`${uid}-floor`}><rect x="-4" y="-40" width={W + 8} height={base + 40} /></clipPath>
      </defs>
      {/* Suelo isométrico. */}
      <path d={`M0 ${base}H${W - dx}l${dx} ${-dy}H${dx}z`} className="lq-prism-floor" />
      <g clipPath={`url(#${uid}-floor)`}>
        {bars.map((b, i) => {
          const h = Math.max(4, (b.value / max) * (base - top));
          const x = i * slot + (slot - w - dx) / 2;
          const y = base - h;
          return (
            <g key={b.key} className="lq-prism-bar" data-hi={b.highlight || undefined} style={{ '--i': i, '--h': h } as CSSProperties}>
              {b.highlight && (
                <>
                  <ellipse cx={x + (w + dx) / 2} cy={base - dy / 2} rx={w * 0.95} ry={depth * 0.55} fill={`url(#${uid}-pool)`} />
                  <rect x={x} y={Math.max(0, y - 44)} width={w} height={Math.min(44, y)} fill={`url(#${uid}-beam)`} />
                </>
              )}
              <path d={`M${x + w} ${y}l${dx} ${-dy}V${base - dy}l${-dx} ${dy}z`} className="lq-prism-side" />
              <path d={`M${x} ${y}h${w}V${base}H${x}z`} className="lq-prism-front" />
              <path d={`M${x} ${y}l${dx} ${-dy}h${w}l${-dx} ${dy}z`} className="lq-prism-top" />
              {b.highlight && b.value > 0 && (
                <text x={x + (w + dx) / 2} y={y - dy - 7} textAnchor="middle" className="lq-prism-value">{format(b.value)}</text>
              )}
            </g>
          );
        })}
      </g>
      {bars.map((b, i) => (
        <text key={b.key} x={i * slot + slot / 2 - dx / 2} y={H - 6} textAnchor="middle" className="lq-prism-label" data-hi={b.highlight || undefined}>{b.label}</text>
      ))}
    </svg>
  );
}

/* ───────── Anillo con resplandor ───────── */

export function GlowRing({ value, active, size = 112, stroke = 9, children }: { value: number; active: boolean; size?: number; stroke?: number; children?: ReactNode }) {
  const uid = cleanId(useId());
  const r = 50 - stroke / 2 - 3;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value)) / 100;
  const dash = { strokeDasharray: c, strokeDashoffset: active ? c * (1 - v) : c };
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden className="lq-glow-ring -rotate-90" width={size} height={size} data-active={active || undefined}>
        <defs>
          <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" className="lq-ring-a" />
            <stop offset="1" className="lq-ring-b" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth={stroke} className="lq-ring-track" />
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth={stroke + 7} stroke={`url(#${uid}-g)`} strokeLinecap="round" className="lq-ring-glow" style={dash} />
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth={stroke} stroke={`url(#${uid}-g)`} strokeLinecap="round" className="lq-ring-arc" style={dash} />
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>}
    </div>
  );
}

/* ───────── Piezas comunes de los reversos ───────── */

function BackHeader({ icon: Icon, title, sub }: { icon: LucideIcon; title: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="lq-well flex size-9 shrink-0 items-center justify-center rounded-xl text-primary-text"><Icon aria-hidden className="size-[18px]" strokeWidth={1.75} /></span>
        <div className="min-w-0">
          <h3 className="truncate text-label-lg md:text-body-md md:font-semibold">{title}</h3>
          {sub && <p className="truncate text-caption text-on-surface-light">{sub}</p>}
        </div>
      </div>
      <FlipToggle />
    </div>
  );
}

function Well({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="lq-well flex min-w-0 flex-col gap-0.5 px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-caption text-on-surface-light"><Icon aria-hidden className="size-3.5 shrink-0 text-primary-text" strokeWidth={2} />{label}</span>
      <span className="truncate font-mono text-label-lg tabular-nums md:text-body-md md:font-semibold">{value}</span>
      {sub && <span className="truncate text-caption text-on-surface-light">{sub}</span>}
    </div>
  );
}

/** Barra de medidor con resplandor: escala desde la izquierda al quedar a la vista. */
export function GlowMeter({ value, active, index = 0, className }: { value: number; active: boolean; index?: number; className?: string }) {
  return (
    <span aria-hidden className={cn('lq-meter', className)} data-active={active || undefined}>
      <span style={{ '--v': active ? Math.max(0, Math.min(1, value / 100)) : 0, '--i': index } as CSSProperties} />
    </span>
  );
}

/* ───────── Reverso de «Progreso de XP» ───────── */

export interface XpBackProps {
  active: boolean;
  period: string;
  level: number;
  xpInLevel: number;
  xpToNext: number;
  points: DayXp[];
  activeDays: number;
  daysInPeriod: number;
  streak: number;
  bestStreak: number;
  daysToNextLevel: number | null;
  avgDailyXp: number;
}

export function XpBack({ active, period, level, xpInLevel, xpToNext, points, activeDays, daysInPeriod, streak, bestStreak, daysToNextLevel, avgDailyXp }: XpBackProps) {
  const t = useText(COPY);
  const locale = useLocale();
  const { fmt } = formatters(locale);
  const pct = levelPercent(xpInLevel, xpToNext);
  // Girar la tarjeta solo cambia `active`: las fechas y la serie no se recalculan (Intl es caro).
  const view = useMemo(() => {
    const f = formatters(locale);
    const rhythm = weekdayRhythm(points, locale === 'en' ? 0 : 1);
    const top = rhythm && rhythm.some((r) => r.avg > 0) ? rhythm.reduce((a, b) => (b.avg > a.avg ? b : a)) : null;
    const best = bestXpDay(points);
    const bars: PrismBar[] = (rhythm ?? []).map((r) => ({ key: String(r.weekday), label: f.weekday(r.weekday, 'short'), value: Math.round(r.avg), highlight: top?.weekday === r.weekday }));
    return {
      rhythm, top, best, bars,
      bestDate: best ? f.day(best.date) : null,
      topName: top ? f.weekday(top.weekday, 'long') : '',
      barsLabel: bars.map((b) => `${b.label} ${b.value}`).join(', '),
    };
  }, [points, locale]);
  const { rhythm, top, best, bars } = view;

  return (
    <div className="flex h-full flex-col gap-5">
      <BackHeader icon={Sparkles} title={t.xpDetail} sub={period} />
      <div className="flex items-center gap-4">
        <GlowRing value={pct} active={active} size={108}>
          <span className="lq-emboss font-mono text-heading-md font-bold leading-none tabular-nums">{pct}%</span>
        </GlowRing>
        <div className="min-w-0">
          <div className="lq-emboss text-heading-lg">{t.levelN(level)}</div>
          <div className="font-mono text-body-sm tabular-nums text-on-surface">{t.ofXp(fmt(xpInLevel), fmt(xpToNext))}</div>
          <div className="text-body-sm text-on-surface-light">{t.toLevel(fmt(Math.max(0, xpToNext - xpInLevel)), level + 1)}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Well icon={Trophy} label={t.bestDay} value={best ? `+${fmt(best.xp)} XP` : '—'} sub={view.bestDate ?? t.noXpYet} />
        <Well icon={Flame} label={t.streak} value={t.days(streak)} sub={t.bestStreak(Math.max(bestStreak, streak))} />
        <Well icon={Rocket} label={t.nextLevel} value={daysToNextLevel != null ? t.inDays(daysToNextLevel) : '—'} sub={avgDailyXp > 0 ? t.atPace(fmt(avgDailyXp)) : t.noPace} />
        <Well icon={CalendarCheck2} label={t.consistency} value={`${activeDays}/${daysInPeriod}`} sub={t.daysWithXp} />
      </div>
      {rhythm && (
        <div className="mt-auto flex flex-col gap-2">
          <span className="text-label-md text-on-surface">{t.rhythm}</span>
          {top ? (
            <>
              <PrismBars bars={bars} active={active} format={fmt} label={t.rhythmLabel(view.barsLabel)} />
              <p className="text-caption text-on-surface-light">{t.strongest(view.topName, fmt(top.avg))}</p>
            </>
          ) : <p className="py-6 text-center text-body-sm text-on-surface-light">{t.noRhythm}</p>}
        </div>
      )}
    </div>
  );
}

/* ───────── Reverso de «Life Score» ───────── */

export function LifeBack({ active, score, trend, zones }: { active: boolean; score: number; trend: string; zones: ZoneLike[] }) {
  const t = useText(COPY);
  const ranked = rankZones(zones).slice(0, 5);
  const withData = zones.filter((z) => z.hasData).length;
  return (
    <div className="flex h-full flex-col gap-4 text-left">
      <BackHeader icon={Gauge} title={t.lifeDetail} sub={trend} />
      <div className="flex items-baseline gap-2">
        <span className="lq-emboss font-mono text-[2.5rem] font-bold leading-none tabular-nums">{score}</span>
        <span className="text-body-sm text-on-surface-light">/ 100</span>
      </div>
      {ranked.length === 0 ? <p className="text-body-sm text-on-surface-light">{t.noZones}</p> : (
        <ul className="flex flex-col gap-3">
          {ranked.map((z, i) => (
            <li key={z.id} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-body-sm text-on-background">{z.name}</span>
                  {ranked.length >= 3 && i === 0 && <span className="shrink-0 rounded-full bg-primary/[var(--lq-soft-alpha)] px-2 py-0.5 text-[0.6875rem] font-semibold text-primary-text">{t.topZone}</span>}
                  {ranked.length >= 3 && i === ranked.length - 1 && <span className="shrink-0 rounded-full bg-warning/[var(--lq-soft-alpha)] px-2 py-0.5 text-[0.6875rem] font-semibold text-warning-text">{t.lowZone}</span>}
                </span>
                <span className="shrink-0 font-mono text-label-md tabular-nums">{Math.round(z.score)}%</span>
              </div>
              <GlowMeter value={z.score} active={active} index={i} />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-auto text-caption text-on-surface-light">{t.zonesWithData(withData, zones.length)}</p>
    </div>
  );
}

/* ───────── Zona que gira ───────── */

export interface ZoneFlipProps {
  zone: ZoneLike & { activityLabel: string };
  zones: ZoneLike[];
  period: string;
  /** Anverso (el diseño de siempre: ícono, nombre, estado, ritmo). */
  front: ReactNode;
}

export function ZoneFlip({ zone, zones, period, front }: ZoneFlipProps) {
  const t = useText(COPY);
  const insight = zoneInsight(zone, zones);
  const route = zoneRoute(zone.id);
  return (
    <FlipCard3D
      label={zone.name}
      className="h-full"
      faceClassName="flex h-full flex-col gap-3.5 p-4 md:p-6"
      front={front}
      back={(active) => (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-label-lg md:text-body-md md:font-semibold">{zone.name}</span>
            <FlipToggle />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="lq-emboss font-mono text-heading-lg font-bold leading-none tabular-nums">{zone.activityCount}</span>
            <span className="min-w-0 truncate text-body-sm text-on-surface-light">{t.records(zone.activityCount)} {t.inPeriod(period)}</span>
          </div>
          <GlowMeter value={insight.share} active={active} />
          <div className="mt-auto flex items-center justify-between gap-3">
            <span className="line-clamp-2 min-w-0 text-caption text-on-surface-light">{t.shareOf(insight.share)} · {insight.rank ? t.rankOf(insight.rank, insight.ranked) : t.notRanked}</span>
            {route && (
              <Link to={route} aria-label={t.open(zone.name)} className="inline-flex min-h-11 shrink-0 items-center gap-1 text-label-md text-primary-text hover:underline hover:underline-offset-4">
                {t.openShort}<ArrowRight aria-hidden className="size-4" strokeWidth={1.75} />
              </Link>
            )}
          </div>
        </>
      )}
    />
  );
}

/* ───────── Total que gira ───────── */

export function TotalFlip({ label, front, details }: { label: string; front: ReactNode; details: Array<{ label: string; value: ReactNode }> }) {
  return (
    <FlipCard3D
      label={label}
      className="h-full"
      faceClassName="flex h-full flex-col gap-3 p-4"
      front={<>{front}<FlipHint className="absolute right-4 top-4" /></>}
      back={
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-label-md text-on-surface">{label}</span>
            <FlipToggle />
          </div>
          <dl className="flex flex-col gap-2">
            {details.map((d) => (
              <div key={d.label} className="lq-well flex items-baseline justify-between gap-3 px-3 py-2">
                <dt className="min-w-0 truncate text-caption text-on-surface-light">{d.label}</dt>
                <dd className="shrink-0 font-mono text-label-lg tabular-nums">{d.value}</dd>
              </div>
            ))}
          </dl>
        </>
      }
    />
  );
}
