// Sueño — Sleep.dc.html (móvil) / SleepDesktop.dc.html (desktop).
// Cielo vivo con la última noche (count-up) y un reloj de 24 h donde la noche y
// las siestas se dibujan; registro de noche o siesta (la gente no solo duerme de
// noche), línea de 7 noches e historial con entradas y salidas fluidas.
// Las siestas suman al descanso del día pero no cuentan como noche.
import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, PresenceContext } from 'framer-motion';
import type { SleepLog, SleepStats } from '@noutlife/shared';
import { Clock, CloudSun, Coffee, Dumbbell, MonitorSmartphone, Moon, Minus, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { item, pop3, springSoft, stagger, useCountUp } from '@/lib/motion';
import { dayKey } from '@/lib/lifeMeta';
import { dismissSleepGapSuggestion, readSleepGapSuggestion, type SleepGapSuggestion } from '@/lib/sleepGapSuggestion';
import { useAuthStore } from '@/store/authStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useToastStore } from '@/hooks/useToast';
import { Button, Card, EmptyState, ErrorState, Field, IconChip, Input, LineChart, SegmentedControl, Select, type LinePoint, PageLoader } from '@/components/ui/lq';
import { LOADING_COPY } from '@/lib/loadingCopy';
import { softTone } from '@/components/ui/lq/tones';
import * as sleepService from '@/services/sleep.service';
import {
  NAP_PRESETS, QUALITY, QualityFace, SLEEP_GOAL_H, bedMinutes, clock, fmtBedMinutes, hm, isNap, napAdvice, nightFromTimes, nightKey, quality,
} from '@/components/sleep/sleepMeta';
import { DurationMeter, RestDial, SleepSky, SleepyMoon, type DialSegment } from '@/components/sleep/SleepVisuals';
import { Lettering } from '@/components/layout/Lettering';

const DAY = 86400000;
const weekday = (d: Date, style: 'short' | 'long' = 'short') => {
  const s = d.toLocaleDateString('es-ES', { weekday: style }).replace('.', '');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const shortDate = (d: Date) => d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
const num1 = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 1 });
const toHHMM = (m: number) => { const v = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`; };
const fromHHMM = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

type Mode = 'night' | 'nap';

function QualityBadge({ q }: { q: number }) {
  const meta = quality(q);
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-label-lg', softTone[meta.tone])}>
      <QualityFace q={q} className="size-4" />{meta.name} · {meta.n}/5
    </span>
  );
}

/** Radiogroup de caras 1–5 con flechas (roving tabindex); la píldora se desliza entre caras. */
function QualityPicker({ value, onChange, legend = 'Calidad' }: { value: number; onChange: (q: number) => void; legend?: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const pillId = useId();
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
      <legend className="mb-2 text-label-lg text-on-surface">{legend}: <span className="text-on-background">{quality(value).name} ({value}/5)</span></legend>
      {/* La píldora usa layoutId: se aísla del AnimatePresence del formulario (como SegmentedControl). */}
      <PresenceContext.Provider value={null}>
        <div role="radiogroup" aria-label={legend} className="grid grid-cols-5 gap-2">
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
                whileTap={{ scale: 0.9 }}
                className={cn(
                  'relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors duration-200 md:min-h-16 md:rounded-[14px]',
                  on ? 'border-transparent text-primary-text' : 'border-border bg-background text-on-surface hover:bg-surface-variant',
                )}
              >
                {on && (
                  <motion.span layoutId={pillId} aria-hidden transition={springSoft} className="absolute inset-0 rounded-xl border-2 border-primary bg-primary/[var(--lq-soft-alpha)] md:rounded-[14px]" />
                )}
                <motion.span className="relative" animate={{ scale: on ? 1.15 : 1, rotate: on ? [0, -8, 6, 0] : 0 }} transition={{ scale: springSoft, rotate: { duration: 0.5 } }}>
                  <QualityFace q={f.n} />
                </motion.span>
                <span className="relative text-label-md">{f.n}</span>
              </motion.button>
            );
          })}
        </div>
      </PresenceContext.Provider>
    </fieldset>
  );
}

const FACTORS = [
  { key: 'caffeineLate', label: 'Cafeína tarde', icon: Coffee },
  { key: 'screensBeforeBed', label: 'Pantallas antes de dormir', icon: MonitorSmartphone },
  { key: 'exercisedToday', label: 'Hice ejercicio', icon: Dumbbell },
] as const;
type FactorKey = (typeof FACTORS)[number]['key'];

function DaySelect({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (v: number) => void }) {
  return (
    <Field label={label}>
      <Select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {Array.from({ length: 7 }, (_, i) => {
          const d = new Date(Date.now() - i * DAY);
          return <option key={i} value={i}>{i === 0 ? `Hoy · ${shortDate(d)}` : i === 1 ? `Ayer · ${shortDate(d)}` : shortDate(d)}</option>;
        })}
      </Select>
    </Field>
  );
}

function NightForm({ logs, onSaved, idPrefix }: { logs: SleepLog[]; onSaved: () => void; idPrefix: string }) {
  const last = logs.find((l) => !isNap(l));
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
  // Una noche por mañana; las siestas no cuentan.
  const existing = night ? logs.find((l) => !isNap(l) && nightKey(l) === dayKey(night.wakeTime)) : undefined;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!night || !valid) { setError('La noche debe durar entre 30 min y 12 h.'); return; }
    setSaving(true);
    setError(null);
    try {
      const body = { bedtime: night.bedtime.toISOString(), wakeTime: night.wakeTime.toISOString(), quality: q };
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
      <DaySelect id={`${idPrefix}-day`} label="Noche que terminó" value={wakeDay} onChange={setWakeDay} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Me dormí"><Input id={`${idPrefix}-in`} type="time" value={bed} onChange={(e) => setBed(e.target.value)} required /></Field>
        <Field label="Desperté" error={night && !valid ? 'Entre 30 min y 12 h' : undefined}><Input id={`${idPrefix}-out`} type="time" value={wake} onChange={(e) => setWake(e.target.value)} required /></Field>
      </div>
      <DurationMeter hours={night && valid ? night.hours : null} target={SLEEP_GOAL_H} targetLabel={`Meta: ${SLEEP_GOAL_H} h por noche`} />
      <QualityPicker value={q} onChange={setQ} legend="Calidad" />
      {!existing && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label-lg text-on-surface">Factores <span className="font-normal text-on-surface-light">(opcional)</span></legend>
          <div className="flex flex-wrap gap-2">
            {FACTORS.map(({ key, label, icon: Icon }) => (
              <motion.button
                key={key}
                type="button"
                aria-pressed={factors[key]}
                whileTap={{ scale: 0.94 }}
                onClick={() => setFactors((f) => ({ ...f, [key]: !f[key] }))}
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-label-lg transition-colors',
                  factors[key] ? 'border-primary bg-primary/[var(--lq-soft-alpha)] text-primary-text' : 'border-border text-on-surface hover:bg-surface-variant',
                )}
              >
                <Icon aria-hidden className="size-4" strokeWidth={1.75} />{label}
              </motion.button>
            ))}
          </div>
        </fieldset>
      )}
      {existing && <p className="text-body-sm text-on-surface-light">Ya registraste esta noche: al guardar se actualizará.</p>}
      {error && <p role="alert" className="text-body-sm text-error-text">{error}</p>}
      <Button type="submit" block loading={saving}>{existing ? 'Actualizar noche' : 'Guardar noche'}</Button>
    </form>
  );
}

function NapForm({ onSaved, idPrefix }: { onSaved: () => void; idPrefix: string }) {
  const [day, setDay] = useState(0);
  const [start, setStart] = useState(() => {
    // Hoy, después de mediodía: termina «ahora» (redondeado a 5 min); si no, 15:00.
    const now = new Date();
    const m = now.getHours() * 60 + now.getMinutes();
    return m >= 13 * 60 ? toHHMM(Math.floor(m / 5) * 5 - 20) : '14:40';
  });
  const [end, setEnd] = useState(() => toHHMM(fromHHMM(start) + 20));
  const [q, setQ] = useState(4);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minutes = start && end ? fromHHMM(end) - fromHHMM(start) : 0;
  const hours = minutes / 60;
  const valid = minutes >= 5 && minutes <= 240;
  const preset = NAP_PRESETS.find((p) => p.min === minutes)?.min;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) { setError(minutes <= 0 ? 'La hora de fin debe ser posterior al inicio.' : 'La siesta debe durar entre 5 min y 4 h.'); return; }
    const base = new Date(Date.now() - day * DAY);
    const s = new Date(base); s.setHours(0, fromHHMM(start), 0, 0);
    const w = new Date(base); w.setHours(0, fromHHMM(end), 0, 0);
    setSaving(true);
    setError(null);
    try {
      await sleepService.createSleep({ bedtime: s.toISOString(), wakeTime: w.toISOString(), quality: q, date: dayKey(w), isNap: true });
      useToastStore.getState().success('Siesta registrada', `${hm(hours)} · ${quality(q).name.toLowerCase()}`);
      onSaved();
    } catch {
      setError('No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={(e) => void submit(e)} noValidate>
      <DaySelect id={`${idPrefix}-day`} label="Día" value={day} onChange={setDay} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label-lg text-on-surface">Duración rápida</legend>
        <div className="grid grid-cols-3 gap-2">
          {NAP_PRESETS.map((p) => {
            const on = preset === p.min;
            return (
              <motion.button
                key={p.min}
                type="button"
                aria-pressed={on}
                whileTap={{ scale: 0.94 }}
                onClick={() => setEnd(toHHMM(fromHHMM(start) + p.min))}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center rounded-xl border px-2 transition-colors',
                  on ? 'border-warning bg-warning/[var(--lq-soft-alpha)] text-warning-text' : 'border-border text-on-surface hover:bg-surface-variant',
                )}
              >
                <span className="text-label-lg font-mono tabular-nums">{p.label}</span>
                <span className="text-body-sm opacity-80">{p.hint}</span>
              </motion.button>
            );
          })}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Empecé"><Input id={`${idPrefix}-in`} type="time" value={start} onChange={(e) => setStart(e.target.value)} required /></Field>
        <Field label="Terminé" error={start && end && !valid ? 'Entre 5 min y 4 h' : undefined}><Input id={`${idPrefix}-out`} type="time" value={end} onChange={(e) => setEnd(e.target.value)} required /></Field>
      </div>
      <DurationMeter
        hours={valid ? hours : null}
        target={1.5}
        tone="warning"
        targetLabel="Referencia: un ciclo completo dura ~90 min"
        advice={valid ? napAdvice(hours) : null}
      />
      <QualityPicker value={q} onChange={setQ} legend="¿Cómo te sentiste?" />
      {error && <p role="alert" className="text-body-sm text-error-text">{error}</p>}
      <Button type="submit" block loading={saving}>Guardar siesta</Button>
    </form>
  );
}

function LogCard({ logs, onSaved }: { logs: SleepLog[]; onSaved: () => void }) {
  const [mode, setMode] = useState<Mode>('night');
  const [formKey, setFormKey] = useState(0);
  const dir = mode === 'nap' ? 1 : -1;
  const saved = () => { setFormKey((k) => k + 1); onSaved(); };
  return (
    <Card as="section" padding="none" aria-labelledby="sleep-log" className="flex flex-col gap-4 overflow-hidden p-4 md:gap-5 md:p-6 lg:p-8">
      <div className="flex items-center gap-3">
        <span className={cn('relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl transition-colors duration-300', mode === 'night' ? softTone.info : softTone.warning)}>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={mode}
              initial={{ opacity: 0, rotate: -90 * dir, scale: 0.4, y: 12 }}
              animate={{ opacity: 1, rotate: 0, scale: 1, y: 0, transition: springSoft }}
              exit={{ opacity: 0, rotate: 90 * dir, scale: 0.4, y: -12, transition: { duration: 0.2 } }}
              className="flex"
            >
              {mode === 'night' ? <Moon aria-hidden className="size-5" strokeWidth={1.75} /> : <CloudSun aria-hidden className="size-5" strokeWidth={1.75} />}
            </motion.span>
          </AnimatePresence>
        </span>
        <h2 id="sleep-log" className="text-heading-sm">{mode === 'night' ? 'Registrar noche' : 'Registrar siesta'}</h2>
      </div>
      <SegmentedControl
        role="radiogroup"
        label="Tipo de descanso"
        value={mode}
        onChange={setMode}
        options={[{ value: 'night', label: 'Noche' }, { value: 'nap', label: 'Siesta' }]}
      />
      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div
          key={`${mode}-${formKey}`}
          custom={dir}
          initial={{ opacity: 0, x: 28 * dir }}
          animate={{ opacity: 1, x: 0, transition: { type: 'spring', stiffness: 260, damping: 28 } }}
          exit={{ opacity: 0, x: -28 * dir, transition: { duration: 0.16 } }}
        >
          {mode === 'night'
            ? <NightForm logs={logs} idPrefix="sl" onSaved={saved} />
            : <NapForm idPrefix="nap" onSaved={saved} />}
        </motion.div>
      </AnimatePresence>
    </Card>
  );
}

/** Cifra grande que cuenta hasta el valor (horas y minutos). */
function BigDuration({ hours }: { hours: number }) {
  const minutes = useCountUp(Math.round(hours * 60), 1.2);
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-2 md:gap-2.5" aria-hidden>
        <span className="text-display-lg font-mono tabular-nums md:text-[88px] md:font-bold md:leading-none md:tracking-[-2px]">{h}</span><span className="text-heading-md text-on-surface">h</span>
        <span className="text-display-lg font-mono tabular-nums md:text-[88px] md:font-bold md:leading-none md:tracking-[-2px]">{String(m).padStart(2, '0')}</span><span className="text-heading-md text-on-surface">min</span>
      </div>
      <span className="sr-only">{hm(hours)}</span>
    </>
  );
}

function SleepHero({ night, dayLogs }: { night: SleepLog | undefined; dayLogs: SleepLog[] }) {
  const naps = dayLogs.filter(isNap);
  const napHours = naps.reduce((a, l) => a + l.duration, 0);
  const total = dayLogs.reduce((a, l) => a + l.duration, 0);
  const wake = night ? new Date(night.wakeTime) : null;
  const recent = wake ? Date.now() - wake.getTime() < 1.5 * DAY : false;
  const met = night ? night.duration >= SLEEP_GOAL_H : false;
  const gap = night ? Math.round((SLEEP_GOAL_H - night.duration) * 60) : 0;
  const segments: DialSegment[] = dayLogs.map((l) => ({
    start: l.bedtime, end: l.wakeTime, kind: isNap(l) ? 'nap' : 'night',
    label: `${isNap(l) ? 'Siesta' : 'Noche'} de ${clock(l.bedtime)} a ${clock(l.wakeTime)}`,
  }));
  return (
    <Card as="section" variant="elevated" padding="none" aria-label={night ? (recent ? 'Última noche' : 'Último registro') : 'Tu descanso'} className="relative isolate overflow-hidden">
      <SleepSky className="-z-10" />
      <div className="flex flex-col gap-6 p-6 pb-10 md:flex-row md:items-center md:gap-12 md:p-10 md:pb-14">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-center gap-3">
            <SleepyMoon />
            <span className="text-body-sm text-on-surface-light md:text-body-md">
              {night ? (recent ? 'Anoche dormiste' : `Último registro · ${shortDate(wake!)}`) : 'Tu descanso empieza hoy'}
            </span>
          </div>
          {night ? (
            <>
              <BigDuration hours={night.duration} />
              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                <QualityBadge q={night.quality} />
                <span className="flex items-center gap-1.5 text-body-sm text-on-surface-light"><Clock aria-hidden className="size-4" strokeWidth={1.75} />{clock(night.bedtime)} → {clock(night.wakeTime)}</span>
                <span className={cn('rounded-full px-3 py-1.5 text-label-lg', met ? 'bg-surface-variant text-on-surface' : softTone.warning)}>
                  {met ? `Meta ${SLEEP_GOAL_H} h cumplida` : `${hm(gap / 60)} por debajo de la meta`}
                </span>
              </div>
            </>
          ) : (
            <p className="max-w-md text-body-md text-on-surface">Registra tu primera noche (o una siesta) para descubrir cómo cambia tu energía con el tiempo.</p>
          )}
          <AnimatePresence>
            {naps.length > 0 && (
              <motion.p
                initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1, transition: { ...springSoft, delay: 0.6 } }} exit={{ opacity: 0 }}
                className={cn('inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-label-lg', softTone.warning)}
              >
                <CloudSun aria-hidden className="size-4" strokeWidth={1.75} />
                + {hm(napHours)} de siesta{naps.length > 1 ? ` (${naps.length})` : ''}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <div className="flex flex-col items-center gap-3">
          <RestDial segments={segments} totalHours={total} caption={naps.length ? 'noche + siestas' : 'descanso total'} />
          <div aria-hidden className="flex items-center gap-4 text-body-sm text-on-surface-light">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-info" />Noche</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-warning" />Siesta</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary" />Ahora</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function MiniStat({ label, hours, sub, tone }: { label: string; hours: number; sub: string; tone: 'info' | 'warning' | 'primary' }) {
  const minutes = useCountUp(Math.round(hours * 60), 1.1);
  return (
    <motion.div variants={pop3} className="min-w-0">
      <Card padding="none" className="lq-lift flex h-full flex-col gap-1 p-4 md:p-5">
        <span className="flex items-center gap-2 text-body-sm text-on-surface-light">
          <span aria-hidden className={cn('size-2 rounded-full', tone === 'info' ? 'bg-info' : tone === 'warning' ? 'bg-warning' : 'bg-primary')} />
          {label}
        </span>
        <span className="text-heading-md font-bold font-mono tabular-nums" aria-hidden>{hours ? hm(minutes / 60, true) : '—'}</span>
        <span className="sr-only">{hours ? hm(hours) : 'Sin datos'}</span>
        <span className="truncate text-body-sm text-on-surface-light">{sub}</span>
      </Card>
    </motion.div>
  );
}

function SleepGapCard({ suggestion, onDismiss, onSaved }: { suggestion: SleepGapSuggestion; onDismiss: () => void; onSaved: () => void }) {
  const [q, setQ] = useState(3);
  const [saving, setSaving] = useState(false);
  const start = new Date(suggestion.bedtime);
  const end = new Date(suggestion.wakeTime);
  const time = (date: Date) => date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  async function confirm() {
    setSaving(true);
    try {
      await sleepService.createSleep({
        bedtime: start.toISOString(),
        wakeTime: end.toISOString(),
        date: dayKey(end),
        quality: q,
      });
      useToastStore.getState().success('Descanso registrado', `${hm(suggestion.durationHours)} · ${quality(q).name.toLowerCase()}`);
      onSaved();
      onDismiss();
    } catch {
      useToastStore.getState().error('No se pudo registrar el descanso', 'Comprueba que no haya un registro para esa noche.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card as="section" padding="lg" aria-label="Sugerencia de descanso nocturno" className="flex flex-col gap-4 border-info/35 bg-info/[var(--lq-soft-alpha)]">
      <div className="flex items-start gap-3">
        <IconChip icon={Moon} tone="info" size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="text-heading-sm">¿Dormiste durante esta pausa?</h2>
          <p className="mt-1 text-body-sm text-on-surface-light">
            Noutlife detectó que volviste tras una pausa nocturna de <b className="font-mono text-on-surface">{hm(suggestion.durationHours)}</b> ({time(start)}–{time(end)}). Solo se guardará si lo confirmas.
          </p>
        </div>
      </div>
      <QualityPicker value={q} onChange={setQ} legend="¿Cómo descansaste?" />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onDismiss}>No fue sueño</Button>
        <Button type="button" loading={saving} onClick={() => void confirm()}>Registrar descanso</Button>
      </div>
    </Card>
  );
}

export default function SleepPage() {
  const [logs, setLogs] = useState<SleepLog[]>([]);
  const [stats, setStats] = useState<SleepStats | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [showAll, setShowAll] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const userId = useAuthStore((s) => s.user?.id);
  const [gapSuggestion, setGapSuggestion] = useState<SleepGapSuggestion | null>(null);

  useEffect(() => {
    if (!userId) { setGapSuggestion(null); return; }
    const sync = () => setGapSuggestion(readSleepGapSuggestion(userId));
    sync();
    const later = window.setTimeout(sync, 0);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.clearTimeout(later);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [userId]);

  const dismissGapSuggestion = useCallback(() => {
    if (userId) dismissSleepGapSuggestion(userId);
    setGapSuggestion(null);
  }, [userId]);

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
  useEffect(() => {
    if (!gapSuggestion) return;
    const wakeDay = dayKey(new Date(gapSuggestion.wakeTime));
    if (logs.some((log) => !isNap(log) && nightKey(log) === wakeDay)) dismissGapSuggestion();
  }, [dismissGapSuggestion, gapSuggestion, logs]);

  async function remove(l: SleepLog) {
    setLogs((list) => list.filter((x) => x.id !== l.id));
    try {
      await sleepService.deleteSleep(l.id);
      useToastStore.getState().success(isNap(l) ? 'Siesta eliminada' : 'Registro eliminado');
      void load(true);
    } catch {
      useToastStore.getState().error('No se pudo eliminar');
      void load(true);
    }
  }

  // Una entrada por mañana con las noches; las siestas del mismo día van aparte.
  const { nights, napsByDay } = useMemo(() => {
    const map = new Map<string, { key: string; wake: Date; hours: number; logs: SleepLog[] }>();
    const naps = new Map<string, number>();
    for (const l of logs) {
      const k = nightKey(l);
      if (isNap(l)) { naps.set(k, (naps.get(k) ?? 0) + l.duration); continue; }
      const n = map.get(k) ?? { key: k, wake: new Date(l.wakeTime), hours: 0, logs: [] };
      n.hours += l.duration;
      n.logs.push(l);
      map.set(k, n);
    }
    return { nights: [...map.values()].sort((a, b) => b.key.localeCompare(a.key)), napsByDay: naps };
  }, [logs]);

  const lastNight = logs.find((l) => !isNap(l));
  const heroDay = lastNight ? nightKey(lastNight) : dayKey(new Date());
  const heroLogs = logs.filter((l) => nightKey(l) === heroDay).sort((a, b) => a.bedtime.localeCompare(b.bedtime));

  const recent = nights.slice(0, 7).reverse();
  const points: LinePoint[] = recent.map((n) => {
    const nap = napsByDay.get(n.key);
    return {
      label: isDesktop ? weekday(n.wake) : num1(n.hours),
      value: n.hours,
      tip: `${weekday(n.wake)} · ${hm(n.hours, true)}${nap ? ` + ${hm(nap)} de siesta` : ''}`,
    };
  });
  const avg = recent.length ? recent.reduce((a, n) => a + n.hours, 0) / recent.length : 0;
  const lo = Math.min(5.5, ...recent.map((n) => n.hours - 0.5));
  const hi = Math.max(8, ...recent.map((n) => n.hours + 0.5));

  // Tendencia: esta semana vs. la anterior (por día de despertar, solo noches).
  const now = Date.now();
  const inRange = (a: number, b: number) => nights.filter((n) => now - n.wake.getTime() >= a * DAY && now - n.wake.getTime() < b * DAY);
  const mean = (ns: typeof nights) => (ns.length ? ns.reduce((a, n) => a + n.hours, 0) / ns.length : null);
  const thisWeek = mean(inRange(0, 7));
  const lastWeek = mean(inRange(7, 14));
  const delta = thisWeek !== null && lastWeek !== null ? Math.round((thisWeek - lastWeek) * 60) : null;
  const trend = delta !== null ? (delta > 15 ? 'improving' : delta < -15 ? 'declining' : 'stable') : stats?.trend ?? 'stable';
  const trendMeta = {
    improving: { label: 'mejorando', icon: TrendingUp, tone: 'success' as const },
    declining: { label: 'bajando', icon: TrendingDown, tone: 'warning' as const },
    stable: { label: 'estable', icon: Minus, tone: 'info' as const },
  }[trend];
  const good = nights.slice(0, 14).flatMap((n) => n.logs).filter((l) => l.quality >= 4);
  const goodBed = good.length >= 2 ? fmtBedMinutes(good.reduce((a, l) => a + bedMinutes(l.bedtime), 0) / good.length) : null;

  const weekNaps = logs.filter((l) => isNap(l) && now - new Date(l.wakeTime).getTime() < 7 * DAY);
  const weekNapHours = weekNaps.reduce((a, l) => a + l.duration, 0);
  const todayKey = dayKey(new Date());
  const todayHours = logs.filter((l) => nightKey(l) === todayKey).reduce((a, l) => a + l.duration, 0);

  const header = (
    <motion.section variants={item} className="flex flex-col gap-1 md:gap-2">
      <span className="hidden text-label-lg text-primary-text md:block">Descanso</span>
      <h1 className="text-display-sm md:text-display-md lg:text-display-lg"><Lettering text="Sueño" /></h1>
    </motion.section>
  );

  const chart = (
    <Card as="section" padding="none" aria-labelledby="sleep-week" className="flex flex-col gap-4 p-4 md:gap-6 md:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="sleep-week" className="text-heading-sm md:text-heading-lg">Últimas {recent.length > 1 ? recent.length : 7} noches</h2>
        {recent.length > 1 && <span className="text-body-sm text-on-surface-light md:text-body-md">Prom. <b className="font-semibold text-on-background font-mono tabular-nums">{hm(avg, true)}</b></span>}
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
            label={`Horas de sueño por noche: ${recent.map((n) => num1(n.hours)).join('; ')}. Tendencia ${trendMeta.label}.`}
          />
          <div aria-hidden className="-mt-1 grid text-center" style={{ gridTemplateColumns: `repeat(${recent.length}, minmax(0, 1fr))` }}>
            {recent.map((n, i) => (
              <span key={n.key} className="flex flex-col items-center gap-1">
                {!isDesktop && <span className="text-label-md text-on-surface-light">{weekday(n.wake).charAt(0)}</span>}
                {/* Siestas de ese día: punto ámbar que aparece con muelle */}
                <motion.span
                  className={cn('size-1.5 rounded-full', napsByDay.has(n.key) ? 'bg-warning' : 'bg-transparent')}
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...springSoft, delay: 0.8 + i * 0.06 }}
                />
              </span>
            ))}
          </div>
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
          {napsByDay.size > 0 && <p className="-mt-2 flex items-center gap-2 text-body-sm text-on-surface-light"><span aria-hidden className="size-1.5 rounded-full bg-warning" />Día con siesta (no cuenta en la media de noches)</p>}
        </>
      ) : (
        <EmptyState icon={Moon} tone="muted" title="Aún no hay tendencia" description="Registra al menos dos noches para ver cómo evoluciona tu descanso." className="py-8" />
      )}
    </Card>
  );

  const visible = showAll ? logs : logs.slice(0, 8);
  const history = logs.length > 0 && (
    <Card as="section" padding="none" aria-labelledby="sleep-history" className="flex flex-col gap-2 p-4 md:p-6">
      <h2 id="sleep-history" className="text-heading-sm">Historial</h2>
      <ul className="flex flex-col">
        <AnimatePresence initial={false}>
          {visible.map((l, i) => {
            const nap = isNap(l);
            const date = shortDate(new Date(l.wakeTime));
            return (
              <motion.li
                key={l.id}
                layout
                initial={{ opacity: 0, y: -12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { ...springSoft, delay: Math.min(i, 8) * 0.04 } }}
                exit={{ opacity: 0, x: -40, transition: { duration: 0.22 } }}
                transition={{ layout: springSoft }}
                className={cn('flex min-h-16 items-center gap-3 md:gap-4', i < visible.length - 1 && 'border-b border-border')}
              >
                <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', nap ? softTone.warning : softTone[quality(l.quality).tone])} title={nap ? 'Siesta' : quality(l.quality).name}>
                  {nap ? <CloudSun aria-hidden className="size-5" strokeWidth={1.75} /> : <QualityFace q={l.quality} className="size-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2 truncate text-body-md font-semibold">
                    {date}
                    {nap && <span className="hidden rounded-full sm:inline bg-warning/[var(--lq-soft-alpha)] px-2 py-0.5 text-label-md text-warning-text">Siesta</span>}
                  </div>
                  <div className="truncate text-body-sm text-on-surface-light font-mono tabular-nums">{nap && <span className="text-warning-text sm:hidden">Siesta · </span>}{clock(l.bedtime)} → {clock(l.wakeTime)}<span className="sr-only sm:not-sr-only"> · {quality(l.quality).name}</span></div>
                </div>
                <span className={cn('text-body-md font-semibold font-mono tabular-nums', !nap && l.duration < SLEEP_GOAL_H - 1 && 'text-warning-text')}>{nap ? hm(l.duration) : hm(l.duration, true)}</span>
                <Button variant="icon" aria-label={`Eliminar ${nap ? 'la siesta' : 'la noche'} del ${date}`} onClick={() => void remove(l)} className="-mr-2 hover:text-error-text">
                  <Trash2 aria-hidden className="size-5" strokeWidth={1.75} />
                </Button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {logs.length > 8 && (
        <Button variant="ghost" size="sm" className="self-center" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Ver menos' : `Ver los ${logs.length} registros`}
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
          {gapSuggestion && (
            <motion.div variants={item}>
              <SleepGapCard suggestion={gapSuggestion} onDismiss={dismissGapSuggestion} onSaved={() => void load(true)} />
            </motion.div>
          )}
          <motion.div variants={item}><SleepHero night={lastNight} dayLogs={heroLogs} /></motion.div>
          <motion.div variants={stagger} className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
            <MiniStat label="Media de noches" hours={avg} sub={recent.length ? `Últimas ${recent.length}` : 'Sin noches aún'} tone="info" />
            <MiniStat label="Siestas · 7 días" hours={weekNapHours} sub={weekNaps.length ? `${weekNaps.length} siesta${weekNaps.length === 1 ? '' : 's'}` : 'Ninguna esta semana'} tone="warning" />
            <div className="col-span-2 md:col-span-1">
              <MiniStat label="Descanso de hoy" hours={todayHours} sub="Noche + siestas" tone="primary" />
            </div>
          </motion.div>
          <motion.div variants={item} className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
            {chart}
            <LogCard logs={logs} onSaved={() => void load(true)} />
          </motion.div>
          {history && <motion.div variants={item}>{history}</motion.div>}
        </>
      )}
    </motion.div>
  );
}
