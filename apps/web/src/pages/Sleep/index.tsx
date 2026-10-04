// Sueño — Sleep.dc.html (móvil) / SleepDesktop.dc.html (desktop).
// Última noche (count-up + ventana de sueño), línea de 7 noches que se dibuja,
// registro con calidad 1–5 (caras SVG) e historial.
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import type { SleepLog, SleepStats } from '@lifequest/shared';
import { Clock, Coffee, Dumbbell, MonitorSmartphone, Moon, Sun, Trash2, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { item, stagger, useCountUp } from '@/lib/motion';
import { dayKey } from '@/lib/lifeMeta';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useToastStore } from '@/hooks/useToast';
import { Button, Card, EmptyState, ErrorState, Field, IconChip, Input, LineChart, Select, type LinePoint, PageLoader } from '@/components/ui/lq';
import { LOADING_COPY } from '@/lib/loadingCopy';
import { softTone } from '@/components/ui/lq/tones';
import * as sleepService from '@/services/sleep.service';
import {
  QUALITY, QualityFace, SLEEP_GOAL_H, bedMinutes, clock, fmtBedMinutes, hm, nightFromTimes, nightKey, quality,
} from '@/components/sleep/sleepMeta';

const DAY = 86400000;
const weekday = (d: Date, style: 'short' | 'long' = 'short') => {
  const s = d.toLocaleDateString('es-ES', { weekday: style }).replace('.', '');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const shortDate = (d: Date) => d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
const num1 = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 1 });

function QualityBadge({ q, prefix = '' }: { q: number; prefix?: string }) {
  const meta = quality(q);
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-label-lg', softTone[meta.tone])}>
      <QualityFace q={q} className="size-4" />{prefix}{meta.name} · {meta.n}/5
    </span>
  );
}

/** Radiogroup de caras 1–5 con flechas (roving tabindex). */
function QualityPicker({ value, onChange }: { value: number; onChange: (q: number) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (i + d + 5) % 5;
    onChange(next + 1);
    refs.current[next]?.focus();
  };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-label-lg text-on-surface">Calidad: <span className="text-on-background">{quality(value).name} ({value}/5)</span></legend>
      <div role="radiogroup" aria-label="Calidad del sueño" className="grid grid-cols-5 gap-2">
        {QUALITY.map((f, i) => {
          const on = value === f.n;
          return (
            <motion.button
              key={f.n}
              ref={(el) => (refs.current[i] = el)}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${f.n} de 5, ${f.name}`}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(f.n)}
              onKeyDown={(e) => onKey(e, i)}
              animate={{ scale: on ? 1.06 : 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18 }}
              className={cn(
                'flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl transition-colors duration-200 md:min-h-16 md:rounded-[14px]',
                on ? 'border-2 border-primary bg-primary/[var(--lq-soft-alpha)] text-primary-text' : 'border border-border bg-background text-on-surface hover:bg-surface-variant',
              )}
            >
              <QualityFace q={f.n} />
              <span className="text-label-md">{f.n}</span>
            </motion.button>
          );
        })}
      </div>
    </fieldset>
  );
}

const FACTORS = [
  { key: 'caffeineLate', label: 'Cafeína tarde', icon: Coffee },
  { key: 'screensBeforeBed', label: 'Pantallas antes de dormir', icon: MonitorSmartphone },
  { key: 'exercisedToday', label: 'Hice ejercicio', icon: Dumbbell },
] as const;
type FactorKey = (typeof FACTORS)[number]['key'];

function LogForm({ logs, onSaved, idPrefix }: { logs: SleepLog[]; onSaved: () => void; idPrefix: string }) {
  const last = logs[0];
  const [wakeDay, setWakeDay] = useState(0);
  const [bed, setBed] = useState(() => (last ? clock(last.bedtime) : '23:00'));
  const [wake, setWake] = useState(() => (last ? clock(last.wakeTime) : '07:00'));
  const [q, setQ] = useState(4);
  const [factors, setFactors] = useState<Record<FactorKey, boolean>>({ caffeineLate: false, screensBeforeBed: false, exercisedToday: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = useMemo(() => new Date(Date.now() - wakeDay * DAY), [wakeDay]);
  const night = bed && wake ? nightFromTimes(bed, wake, base) : null;
  const valid = night && night.hours >= 0.5 && night.hours <= 12;
  const existing = night ? logs.find((l) => nightKey(l) === dayKey(night.wakeTime)) : undefined;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!night || !valid) { setError('La noche debe durar entre 30 min y 12 h.'); return; }
    setSaving(true);
    setError(null);
    try {
      const body = { bedtime: night.bedtime.toISOString(), wakeTime: night.wakeTime.toISOString(), quality: q };
      // Una noche por mañana: si ya existe, se actualiza en lugar de duplicarla.
      if (existing) await sleepService.updateSleep(existing.id, body);
      else await sleepService.createSleep({ ...body, date: dayKey(night.wakeTime), ...factors });
      useToastStore.getState().success(existing ? 'Registro actualizado' : 'Noche registrada', `${hm(night.hours)} · ${quality(q).name.toLowerCase()}`);
      onSaved();
    } catch {
      setError('No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={(e) => void submit(e)} noValidate>
      <Field label="Noche que terminó">
        <Select id={`${idPrefix}-day`} value={wakeDay} onChange={(e) => setWakeDay(Number(e.target.value))}>
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date(Date.now() - i * DAY);
            return <option key={i} value={i}>{i === 0 ? `Hoy · ${shortDate(d)}` : i === 1 ? `Ayer · ${shortDate(d)}` : shortDate(d)}</option>;
          })}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
        <Field label="Me dormí"><Input id={`${idPrefix}-in`} type="time" value={bed} onChange={(e) => setBed(e.target.value)} required /></Field>
        <Field label="Desperté" error={night && !valid ? 'Entre 30 min y 12 h' : undefined}><Input id={`${idPrefix}-out`} type="time" value={wake} onChange={(e) => setWake(e.target.value)} required /></Field>
      </div>
      {night && valid && <p className="-mt-2 flex items-center gap-2 text-body-sm text-on-surface-light"><Clock aria-hidden className="size-4" strokeWidth={1.75} />Duración: <b className="font-semibold text-on-background tabular-nums">{hm(night.hours)}</b></p>}
      <QualityPicker value={q} onChange={setQ} />
      {!existing && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label-lg text-on-surface">Factores <span className="font-normal text-on-surface-light">(opcional)</span></legend>
          <div className="flex flex-wrap gap-2">
            {FACTORS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                aria-pressed={factors[key]}
                onClick={() => setFactors((f) => ({ ...f, [key]: !f[key] }))}
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-label-lg transition-colors',
                  factors[key] ? 'border-primary bg-primary/[var(--lq-soft-alpha)] text-primary-text' : 'border-border text-on-surface hover:bg-surface-variant',
                )}
              >
                <Icon aria-hidden className="size-4" strokeWidth={1.75} />{label}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {existing && <p className="text-body-sm text-on-surface-light">Ya registraste esta noche: al guardar se actualizará.</p>}
      {error && <p role="alert" className="text-body-sm text-error-text">{error}</p>}
      <Button type="submit" block loading={saving}>{existing ? 'Actualizar registro' : 'Guardar registro'}</Button>
    </form>
  );
}

/** Ventana de sueño sobre una escala 20:00 → 10:00 (desktop). */
function SleepWindow({ log }: { log: SleepLog }) {
  const SPAN = 14 * 60;
  const start = Math.max(0, Math.min(SPAN, bedMinutes(log.bedtime) - 20 * 60));
  const width = Math.max(2, Math.min(SPAN - start, log.duration * 60));
  const ticks = [['20:00', 0], ['00:00', 4 / 14], ['04:00', 8 / 14], ['10:00', 1]] as const;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-label-lg"><Moon aria-hidden className="size-4 text-secondary-text" strokeWidth={1.75} />{clock(log.bedtime)}</span>
        <span className="flex items-center gap-2 text-label-lg">{clock(log.wakeTime)}<Sun aria-hidden className="size-4 text-warning-text" strokeWidth={1.75} /></span>
      </div>
      <div role="img" aria-label={`Ventana de sueño de ${clock(log.bedtime)} a ${clock(log.wakeTime)} en una escala de 20:00 a 10:00`} className="relative h-12 overflow-hidden rounded-[14px] bg-surface-variant">
        <motion.span
          className="absolute inset-y-0 rounded-[14px] bg-secondary"
          style={{ left: `${(start / SPAN) * 100}%`, width: `${(width / SPAN) * 100}%`, originX: 0 }}
          initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1], delay: 0.3 }}
        />
      </div>
      <div aria-hidden className="relative h-5 text-body-sm text-on-surface-light">
        {ticks.map(([t, p], i) => (
          <span key={t} className={cn('absolute top-0', i === 0 ? 'left-0' : i === ticks.length - 1 ? 'right-0' : '-translate-x-1/2')} style={i === 0 || i === ticks.length - 1 ? undefined : { left: `${p * 100}%` }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

function LastNight({ log }: { log: SleepLog }) {
  const minutes = useCountUp(Math.round(log.duration * 60), 1.2);
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  const wake = new Date(log.wakeTime);
  const recent = Date.now() - wake.getTime() < 1.5 * DAY;
  const met = log.duration >= SLEEP_GOAL_H;
  const gap = Math.round((SLEEP_GOAL_H - log.duration) * 60);
  return (
    <Card as="section" variant="elevated" padding="none" aria-label={recent ? 'Última noche' : 'Último registro'} className="flex flex-col gap-3 p-6 md:flex-row md:flex-wrap md:items-center md:gap-12 md:p-10">
      <div className="flex min-w-0 flex-col gap-3 md:flex-[1_1_320px]">
        <span className="text-body-sm text-on-surface-light md:text-body-md">{recent ? <><span className="md:hidden">Anoche</span><span className="hidden md:inline">Anoche dormiste</span></> : `Último registro · ${shortDate(wake)}`}</span>
        <div className="flex flex-wrap items-baseline gap-2 md:gap-2.5" aria-hidden>
          <span className="text-display-lg tabular-nums md:text-[88px] md:font-bold md:leading-none md:tracking-[-2px]">{h}</span><span className="text-heading-md text-on-surface">h</span>
          <span className="text-display-lg tabular-nums md:text-[88px] md:font-bold md:leading-none md:tracking-[-2px]">{String(m).padStart(2, '0')}</span><span className="text-heading-md text-on-surface">min</span>
        </div>
        <span className="sr-only">{hm(log.duration)}</span>
        <div className="flex flex-wrap items-center gap-3">
          <QualityBadge q={log.quality} prefix="" />
          <span className="flex items-center gap-1.5 text-body-sm text-on-surface-light md:hidden"><Clock aria-hidden className="size-4" strokeWidth={1.75} />{clock(log.bedtime)} → {clock(log.wakeTime)}</span>
          <span className={cn('hidden rounded-full px-3 py-1.5 text-label-lg md:inline-flex', met ? 'bg-surface-variant text-on-surface' : softTone.warning)}>
            {met ? `Meta ${SLEEP_GOAL_H} h cumplida` : `${hm(gap / 60)} por debajo de la meta`}
          </span>
        </div>
      </div>
      <div className="hidden min-w-0 md:block md:flex-[1_1_380px]"><SleepWindow log={log} /></div>
    </Card>
  );
}

export default function SleepPage() {
  const [logs, setLogs] = useState<SleepLog[]>([]);
  const [stats, setStats] = useState<SleepStats | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [formKey, setFormKey] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const load = useCallback(async (silent = false) => {
    if (!silent) setState('loading');
    try {
      const [l, s] = await Promise.all([sleepService.fetchSleep(), sleepService.fetchSleepStats().catch(() => null)]);
      setLogs([...l].sort((a, b) => b.wakeTime.localeCompare(a.wakeTime)));
      setStats(s);
      setState('ready');
    } catch {
      if (!silent) setState('error');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function remove(l: SleepLog) {
    setLogs((list) => list.filter((x) => x.id !== l.id));
    try {
      await sleepService.deleteSleep(l.id);
      useToastStore.getState().success('Registro eliminado');
      void load(true);
    } catch {
      useToastStore.getState().error('No se pudo eliminar');
      void load(true);
    }
  }

  // Una entrada por mañana (si hay varias, se suman: siestas incluidas).
  const nights = useMemo(() => {
    const map = new Map<string, { key: string; wake: Date; hours: number; logs: SleepLog[] }>();
    for (const l of logs) {
      const k = nightKey(l);
      const n = map.get(k) ?? { key: k, wake: new Date(l.wakeTime), hours: 0, logs: [] };
      n.hours += l.duration;
      n.logs.push(l);
      map.set(k, n);
    }
    return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
  }, [logs]);

  const recent = nights.slice(0, 7).reverse();
  const points: LinePoint[] = recent.map((n) => ({
    label: isDesktop ? weekday(n.wake) : num1(n.hours),
    value: n.hours,
    tip: `${weekday(n.wake)} · ${hm(n.hours, true)}`,
  }));
  const avg = recent.length ? recent.reduce((a, n) => a + n.hours, 0) / recent.length : 0;
  const lo = Math.min(5.5, ...recent.map((n) => n.hours - 0.5));
  const hi = Math.max(8, ...recent.map((n) => n.hours + 0.5));

  // Tendencia: esta semana vs. la anterior (por día de despertar).
  const now = Date.now();
  const inRange = (a: number, b: number) => nights.filter((n) => now - n.wake.getTime() >= a * DAY && now - n.wake.getTime() < b * DAY);
  const mean = (ns: typeof nights) => (ns.length ? ns.reduce((a, n) => a + n.hours, 0) / ns.length : null);
  const thisWeek = mean(inRange(0, 7));
  const lastWeek = mean(inRange(7, 14));
  const delta = thisWeek !== null && lastWeek !== null ? Math.round((thisWeek - lastWeek) * 60) : null;
  // Mismo umbral que la API (±15 min); sin dos semanas de datos se usa /sleep/stats.
  const trend = delta !== null ? (delta > 15 ? 'improving' : delta < -15 ? 'declining' : 'stable') : stats?.trend ?? 'stable';
  const trendMeta = {
    improving: { label: 'mejorando', icon: TrendingUp, tone: 'success' as const },
    declining: { label: 'bajando', icon: TrendingDown, tone: 'warning' as const },
    stable: { label: 'estable', icon: Minus, tone: 'info' as const },
  }[trend];
  const good = nights.slice(0, 14).flatMap((n) => n.logs).filter((l) => l.quality >= 4);
  const goodBed = good.length >= 2 ? fmtBedMinutes(good.reduce((a, l) => a + bedMinutes(l.bedtime), 0) / good.length) : null;

  const header = (
    <motion.section variants={item} className="flex flex-col gap-1 md:gap-2">
      <span className="hidden text-label-lg text-primary-text md:block">Descanso</span>
      <h1 className="text-display-sm md:text-display-md lg:text-display-lg">Sueño</h1>
    </motion.section>
  );

  const chart = (
    <Card as="section" padding="none" aria-labelledby="sleep-week" className="flex flex-col gap-4 p-4 md:gap-6 md:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="sleep-week" className="text-heading-sm md:text-heading-lg">Últimas {recent.length > 1 ? recent.length : 7} noches</h2>
        {recent.length > 1 && <span className="text-body-sm text-on-surface-light md:text-body-md">Prom. <b className="font-semibold text-on-background tabular-nums">{hm(avg, true)}</b></span>}
      </div>
      {recent.length > 1 ? (
        <>
          <LineChart
            key={`${isDesktop}-${recent.map((n) => n.key).join()}`}
            data={points}
            min={lo} max={hi}
            goal={{ value: SLEEP_GOAL_H, label: `Meta ${SLEEP_GOAL_H} h` }}
            height={isDesktop ? 240 : 140}
            dots={isDesktop}
            label={`Horas de sueño: ${recent.map((n) => num1(n.hours)).join('; ')}. Tendencia ${trendMeta.label}.`}
          />
          {!isDesktop && (
            <div aria-hidden className="-mt-1 grid text-center" style={{ gridTemplateColumns: `repeat(${recent.length}, minmax(0, 1fr))` }}>
              {recent.map((n) => <span key={n.key} className="text-label-md text-on-surface-light">{weekday(n.wake).charAt(0)}</span>)}
            </div>
          )}
          <div className={cn('flex items-center gap-3 rounded-xl px-4 py-3 md:gap-4 md:rounded-2xl md:px-5 md:py-4', softTone[trendMeta.tone].split(' ')[0])}>
            <IconChip icon={trendMeta.icon} tone={trendMeta.tone} size="sm" className="hidden bg-background md:inline-flex" />
            <trendMeta.icon aria-hidden className={cn('size-5 shrink-0 md:hidden', softTone[trendMeta.tone].split(' ')[1])} strokeWidth={1.75} />
            <div className="min-w-0">
              <div className={cn('text-label-lg md:text-body-lg md:font-semibold', softTone[trendMeta.tone].split(' ')[1])}>Tendencia: {trendMeta.label}</div>
              <div className="text-body-sm text-on-surface md:text-body-md">
                {delta !== null ? `${delta >= 0 ? '+' : '−'}${hm(Math.abs(delta) / 60)} vs. la semana pasada.` : 'Registra dos semanas para comparar.'}
                {goodBed && <span className="hidden md:inline"> En tus mejores noches te acostaste hacia las {goodBed}.</span>}
              </div>
            </div>
          </div>
        </>
      ) : (
        <EmptyState icon={Moon} tone="muted" title="Aún no hay tendencia" description="Registra al menos dos noches para ver cómo evoluciona tu descanso." className="py-8" />
      )}
    </Card>
  );

  const form = (
    <Card as="section" padding="none" aria-labelledby="sleep-log" className="flex flex-col gap-4 p-4 md:gap-5 md:p-6 lg:p-8">
      <h2 id="sleep-log" className="text-heading-sm">Registrar noche</h2>
      <LogForm key={formKey} logs={logs} idPrefix="sl" onSaved={() => { setFormKey((k) => k + 1); void load(true); }} />
    </Card>
  );

  const visible = showAll ? logs : logs.slice(0, 7);
  const history = logs.length > 0 && (
    <Card as="section" padding="none" aria-labelledby="sleep-history" className="flex flex-col gap-2 p-4 md:p-6">
      <h2 id="sleep-history" className="text-heading-sm">Historial</h2>
      <motion.ul variants={stagger} initial="initial" animate="animate" className="flex flex-col">
        {visible.map((l, i) => (
          <motion.li key={l.id} variants={item} className={cn('flex min-h-16 items-center gap-3 md:gap-4', i < visible.length - 1 && 'border-b border-border')}>
            <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', softTone[quality(l.quality).tone])} title={quality(l.quality).name}>
              <QualityFace q={l.quality} className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-body-md font-semibold">{shortDate(new Date(l.wakeTime))}</div>
              <div className="truncate text-body-sm text-on-surface-light tabular-nums">{clock(l.bedtime)} → {clock(l.wakeTime)}<span className="sr-only sm:not-sr-only"> · {quality(l.quality).name}</span></div>
            </div>
            <span className={cn('text-body-md font-semibold tabular-nums', l.duration < SLEEP_GOAL_H - 1 && 'text-warning-text')}>{hm(l.duration, true)}</span>
            <Button variant="icon" aria-label={`Eliminar la noche del ${shortDate(new Date(l.wakeTime))}`} onClick={() => void remove(l)} className="-mr-2 hover:text-error-text">
              <Trash2 aria-hidden className="size-5" strokeWidth={1.75} />
            </Button>
          </motion.li>
        ))}
      </motion.ul>
      {logs.length > 7 && (
        <Button variant="ghost" size="sm" className="self-center" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Ver menos' : `Ver las ${logs.length} noches`}
        </Button>
      )}
    </Card>
  );

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-6 md:gap-8">
      {header}
      {state === 'loading' ? (
        <PageLoader label="Cargando tus noches…" words={LOADING_COPY.statsSleep} />
      ) : state === 'error' ? (
        <ErrorState title="No pudimos cargar tu sueño" onRetry={() => void load()} />
      ) : (
        <>
          {logs[0] ? (
            <motion.div variants={item}><LastNight log={logs[0]} /></motion.div>
          ) : (
            <motion.div variants={item}>
              <Card variant="elevated" padding="lg">
                <EmptyState icon={Moon} title="Tu descanso empieza esta noche" description="Registra tu primera noche para descubrir cómo cambia tu energía con el tiempo." className="py-6" />
              </Card>
            </motion.div>
          )}
          <motion.div variants={item} className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
            {chart}
            {form}
          </motion.div>
          {history && <motion.div variants={item}>{history}</motion.div>}
        </>
      )}
    </motion.div>
  );
}
