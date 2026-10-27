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
import { dismissSleepGapSuggestion, fetchServerSleepSuggestion, readSleepGapSuggestion, type SleepGapSuggestion } from '@/lib/sleepGapSuggestion';
import { useAuthStore } from '@/store/authStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useToastStore } from '@/hooks/useToast';
import { Button, Card, EmptyState, ErrorState, Field, IconChip, Input, LineChart, SegmentedControl, Select, type LinePoint, PageLoader } from '@/components/ui/lq';
import { useLoadingCopy } from '@/lib/loadingCopy';
import { softTone } from '@/components/ui/lq/tones';
import * as sleepService from '@/services/sleep.service';
import {
  napPresets, quality, qualityList, QualityFace, SLEEP_GOAL_H, bedMinutes, clock, fmtBedMinutes, hm, isNap, napAdvice, nightFromTimes, nightKey,
} from '@/components/sleep/sleepMeta';
import { DurationMeter, RestDial, SleepSky, SleepyMoon, type DialSegment } from '@/components/sleep/SleepVisuals';
import { Lettering } from '@/components/layout/Lettering';
import { INTL_LOCALE, useLocale, useText, type Copy, type Locale } from '@/lib/i18n';

const COPY: Copy<{
  section: string; headline: string; loading: string; loadFailed: string;
  quality: string; qualityNow: (name: string, n: number) => string; howSlept: string; howSleptLegend: string; howFeltLegend: string;
  factors: string; optional: string; cafLate: string; screens: string; exercised: string;
  nightEnded: string; sleptAt: string; wokeAt: string; wakeRange: string; goalRange: string; advisedHours: string;
  alreadyNight: string; updateNight: string; saveNight: string; nightUpdated: string; nightRegistered: string; nightInvalid: string; saveFailed: string;
  napUpdated: string; napRegistered: string; napInvalid: string; napSameTimes: string; napSaved: string; dayLabel: string; quickDuration: string;
  startedAt: string; endedAt: string; refHint: string; saveNap: string; wentWell: string;
  today: string; yesterday: string; logNight: string; logNap: string; typeOfRest: string; night: string; nap: string;
  napDate: string;
  asleepLast: string; asleepSince: (d: string) => string; lastRecord: (d: string) => string; restStarts: string;
  firstNight: string; goalMet: (g: string) => string; belowGoal: (h: string) => string;
  napTotal: (h: string, c: number) => string; napTotalOne: (h: string) => string;
  nightOf: (c: string) => string; napOf: (c: string) => string;
  noTrend: string; trendNeed: string; lastNights: (n: number) => string; avg: string; nightDay: string; withNap: string;
  trendLabel: (l: string) => string; trendImproving: string; trendDeclining: string; trendStable: string;
  vsLastWeek: (d: string, sign: string) => string; compareTwo: string; bestNights: (t: string) => string;
  napDayNote: string; noRecordsTrend: string; statsTrend: string;
  historyTitle: string; viewLess: string; viewAll: (n: number) => string; deleteEntry: (what: string, d: string) => string;
  naps: string; nightWord: string; napWord: string; deleted: string; deleteNapToast: string; deleteFailed: string;
  mean: string; noNights: string; lastN: (n: number) => string; napsWeek: string; noneWeek: string; napsCount: (n: number) => string;
  restToday: string; nightPlusNap: string; sheetLabel: string; gapTitle: string; gapBody: (d: string, from: string, to: string) => string;
  gapOnlyIfConfirm: string; gapNotSleep: string; gapRegister: string; gapQ: string; restRegistered: string; restFailed: string; restFailedBody: string;
  sleepLabel: string; sleepLoadingWords: string;
  shortLegend: string; night2: string; nap2: string; now: string;
  napPlus: (h: string, c: number) => string; napPlusOne: (h: string) => string;
  whichDay: string; sameBad: string; dayLetter: (d: string) => string;
  trendHeading: string; chartLabel: (ns: string, t: string) => string; napDaysLegend: string;
  gapCardAria: string; restSectionAria: string;
}> = {
  es: {
    section: 'Descanso', headline: 'Sueño', loading: 'Cargando tus noches…', loadFailed: 'No pudimos cargar tu sueño',
    quality: 'Calidad', qualityNow: (name, n) => `${name} (${n}/5)`, howSlept: 'Calidad', howSleptLegend: 'Calidad',
    howFeltLegend: '¿Cómo te sentiste?', factors: 'Factores', optional: '(opcional)',
    cafLate: 'Cafeína tarde', screens: 'Pantallas antes de dormir', exercised: 'Hice ejercicio',
    nightEnded: 'Noche que terminó', sleptAt: 'Me dormí', wokeAt: 'Desperté', wakeRange: 'Entre 1 min y 20 h',
    goalRange: 'Meta: 7 h por noche', advisedHours: 'Entre 1 min y 20 h',
    alreadyNight: 'Ya registraste esta noche: al guardar se actualizará.', updateNight: 'Actualizar noche', saveNight: 'Guardar noche',
    nightUpdated: 'Registro actualizado', nightRegistered: 'Noche registrada',
    nightInvalid: 'El descanso debe durar entre 1 min y 20 h.', saveFailed: 'No se pudo guardar. Inténtalo de nuevo.',
    napUpdated: 'Siesta actualizada', napRegistered: 'Siesta registrada', napInvalid: 'El descanso debe durar entre 1 min y 20 h.',
    napSameTimes: 'La hora de fin debe ser distinta del inicio.', napSaved: 'Siesta registrada',
    dayLabel: 'Día', quickDuration: 'Duración rápida', startedAt: 'Empecé', endedAt: 'Terminé',
    refHint: 'Referencia: un ciclo completo dura ~90 min', saveNap: 'Guardar siesta', wentWell: '¿Cómo te sentiste?',
    today: 'Hoy', yesterday: 'Ayer', logNight: 'Registrar noche', logNap: 'Registrar siesta', typeOfRest: 'Tipo de descanso',
    night: 'Noche', nap: 'Siesta', napDate: 'Día',
    asleepLast: 'Anoche dormiste', asleepSince: (d) => `Último registro · ${d}`, lastRecord: (d) => `Último registro · ${d}`, restStarts: 'Tu descanso empieza hoy',
    firstNight: 'Registra tu primera noche (o una siesta) para descubrir cómo cambia tu energía con el tiempo.',
    goalMet: (g) => `Meta ${g} h cumplida`, belowGoal: (h) => `${h} por debajo de la meta`,
    napTotal: (h, c) => `+ ${h} de siesta (${c})`, napTotalOne: (h) => `+ ${h} de siesta`,
    nightOf: (c) => `Noche de ${c}`, napOf: (c) => `Siesta de ${c}`,
    noTrend: 'Aún no hay tendencia', trendNeed: 'Registra al menos dos noches para ver cómo evoluciona tu descanso.',
    lastNights: (n) => `Últimas ${n} noches`, avg: 'Prom.', nightDay: 'Día con siesta (no cuenta en la media de noches)', withNap: 'Día con siesta',
    trendLabel: (l) => `Tendencia: ${l}`, trendImproving: 'mejorando', trendDeclining: 'bajando', trendStable: 'estable',
    vsLastWeek: (d, sign) => `${sign}${d} vs. la semana pasada.`, compareTwo: 'Registra dos semanas para comparar.', bestNights: (t) => `En tus mejores noches te acostaste hacia las ${t}.`,
    napDayNote: 'Día con siesta (no cuenta en la media de noches)', noRecordsTrend: 'Registra dos semanas para comparar.', statsTrend: 'estable',
    historyTitle: 'Historial', viewLess: 'Ver menos', viewAll: (n) => `Ver los ${n} registros`, deleteEntry: (w, d) => `Eliminar ${w} del ${d}`,
    naps: 'Siesta', nightWord: 'noche', napWord: 'siesta', deleted: 'Registro eliminado', deleteNapToast: 'Siesta eliminada',
    deleteFailed: 'No se pudo eliminar',
    mean: 'Media de noches', noNights: 'Sin noches aún', lastN: (n) => `Últimas ${n}`, napsWeek: 'Siestas · 7 días', noneWeek: 'Ninguna esta semana',
    napsCount: (n) => `${n} siesta${n === 1 ? '' : 's'}`, restToday: 'Descanso de hoy', nightPlusNap: 'Noche + siestas',
    sheetLabel: 'Sugerencia de descanso nocturno', gapTitle: '¿Dormiste durante esta pausa?',
    gapBody: (d, from, to) => `Noutlife detectó que volviste tras una pausa nocturna de ${d} (${from}–${to}). Solo se guardará si lo confirmas.`,
    gapOnlyIfConfirm: 'Solo se guardará si lo confirmas.', gapNotSleep: 'No fue sueño', gapRegister: 'Registrar descanso',
    gapQ: '¿Cómo descansaste?', restRegistered: 'Descanso registrado', restFailed: 'No se pudo registrar el descanso',
    restFailedBody: 'Comprueba que no haya un registro para esa noche.',
    sleepLabel: 'Sueño', sleepLoadingWords: '',
    shortLegend: 'Noche', night2: 'Noche', nap2: 'Siesta', now: 'Ahora',
    napPlus: (h, c) => `+ ${h} de siesta (${c})`, napPlusOne: (h) => `+ ${h} de siesta`,
    whichDay: 'Día', sameBad: '', dayLetter: (d) => d.charAt(0),
    trendHeading: 'Tendencia', chartLabel: (ns, t) => `Horas de sueño por noche: ${ns}. Tendencia ${t}.`, napDaysLegend: 'Día con siesta',
    gapCardAria: 'Sugerencia de descanso nocturno', restSectionAria: 'Tu descanso',
  },
  en: {
    section: 'Rest', headline: 'Sleep', loading: 'Loading your nights…', loadFailed: "We couldn't load your sleep",
    quality: 'Quality', qualityNow: (name, n) => `${name} (${n}/5)`, howSlept: 'Quality', howSleptLegend: 'Quality',
    howFeltLegend: 'How did you feel?', factors: 'Factors', optional: '(optional)',
    cafLate: 'Late caffeine', screens: 'Screens before bed', exercised: 'Exercised',
    nightEnded: 'Night that ended', sleptAt: 'Went to bed', wokeAt: 'Woke up', wakeRange: 'Between 1 min and 20 h',
    goalRange: 'Goal: 7 h a night', advisedHours: 'Between 1 min and 20 h',
    alreadyNight: 'You already logged this night: saving will update it.', updateNight: 'Update night', saveNight: 'Save night',
    nightUpdated: 'Entry updated', nightRegistered: 'Night logged',
    nightInvalid: 'Rest must last between 1 min and 20 h.', saveFailed: "We couldn't save. Try again.",
    napUpdated: 'Nap updated', napRegistered: 'Nap logged', napInvalid: 'Rest must last between 1 min and 20 h.',
    napSameTimes: 'The end time must differ from the start.', napSaved: 'Nap logged',
    dayLabel: 'Day', quickDuration: 'Quick length', startedAt: 'Started', endedAt: 'Ended',
    refHint: 'Reference: a full cycle lasts ~90 min', saveNap: 'Save nap', wentWell: 'How did you feel?',
    today: 'Today', yesterday: 'Yesterday', logNight: 'Log night', logNap: 'Log nap', typeOfRest: 'Type of rest', night: 'Night', nap: 'Nap', napDate: 'Day',
    asleepLast: 'Last night you slept', asleepSince: (d) => `Last entry · ${d}`, lastRecord: (d) => `Last entry · ${d}`, restStarts: 'Your rest starts today',
    firstNight: 'Log your first night (or a nap) to see how your energy changes over time.',
    goalMet: (g) => `Goal ${g} h met`, belowGoal: (h) => `${h} below goal`,
    napTotal: (h, c) => `+ ${h} of naps (${c})`, napTotalOne: (h) => `+ ${h} of naps`,
    nightOf: (c) => `Night from ${c}`, napOf: (c) => `Nap from ${c}`,
    noTrend: 'No trend yet', trendNeed: 'Log at least two nights to see how your rest changes.',
    lastNights: (n) => `Last ${n} nights`, avg: 'Avg.', nightDay: 'Day with a nap (not counted in the night average)', withNap: 'Day with a nap',
    trendLabel: (l) => `Trend: ${l}`, trendImproving: 'improving', trendDeclining: 'declining', trendStable: 'steady',
    vsLastWeek: (d, sign) => `${sign}${d} vs. last week.`, compareTwo: 'Log two weeks to compare.', bestNights: (t) => `On your best nights you went to bed around ${t}.`,
    napDayNote: 'Day with a nap (not counted in the night average)', noRecordsTrend: 'Log two weeks to compare.', statsTrend: 'steady',
    historyTitle: 'History', viewLess: 'Show less', viewAll: (n) => `See all ${n} entries`, deleteEntry: (w, d) => `Delete the ${w} from ${d}`,
    naps: 'Nap', nightWord: 'night', napWord: 'nap', deleted: 'Entry deleted', deleteNapToast: 'Nap deleted', deleteFailed: "We couldn't delete it",
    mean: 'Night average', noNights: 'No nights yet', lastN: (n) => `Last ${n}`, napsWeek: 'Naps · 7 days', noneWeek: 'None this week',
    napsCount: (n) => `${n} nap${n === 1 ? '' : 's'}`, restToday: 'Rest today', nightPlusNap: 'Night + naps',
    sheetLabel: 'Night rest suggestion', gapTitle: 'Did you sleep during this gap?',
    gapBody: (d, from, to) => `NoutLife noticed you came back after a ${d} overnight gap (${from}–${to}). It is only saved if you confirm.`,
    gapOnlyIfConfirm: 'It is only saved if you confirm.', gapNotSleep: "It wasn't sleep", gapRegister: 'Log rest',
    gapQ: 'How did you rest?', restRegistered: 'Rest logged', restFailed: "We couldn't log the rest",
    restFailedBody: 'Check that there is no entry for that night.',
    sleepLabel: 'Sleep', sleepLoadingWords: '',
    shortLegend: 'Night', night2: 'Night', nap2: 'Nap', now: 'Now',
    napPlus: (h, c) => `+ ${h} of naps (${c})`, napPlusOne: (h) => `+ ${h} of naps`,
    whichDay: 'Day', sameBad: '', dayLetter: (d) => d.charAt(0),
    trendHeading: 'Trend', chartLabel: (ns, t) => `Hours of sleep per night: ${ns}. Trend ${t}.`, napDaysLegend: 'Day with a nap',
    gapCardAria: 'Night rest suggestion', restSectionAria: 'Your rest',
  },
};

const DAY = 86400000;
// Límites amplios de descanso (mismos que la API): de una microsiesta a un turno largo.
const REST_MIN_H = 1 / 60;
const REST_MAX_H = 20;
const toHHMM = (m: number) => { const v = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`; };
const fromHHMM = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

type Mode = 'night' | 'nap';

function QualityBadge({ q }: { q: number }) {
  const locale = useLocale();
  const meta = quality(q, locale);
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-label-lg', softTone[meta.tone])}>
      <QualityFace q={q} className="size-4" />{meta.name} · {meta.n}/5
    </span>
  );
}

/** Radiogroup de caras 1–5 con flechas (roving tabindex); la píldora se desliza entre caras. */
function QualityPicker({ value, onChange, legend }: { value: number; onChange: (q: number) => void; legend: string }) {
  const locale = useLocale();
  const t = useText(COPY);
  const list = qualityList(locale);
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
      <legend className="mb-2 text-label-lg text-on-surface">{legend}: <span className="text-on-background">{t.qualityNow(quality(value, locale).name, value)}</span></legend>
      {/* La píldora usa layoutId: se aísla del AnimatePresence del formulario (como SegmentedControl). */}
      <PresenceContext.Provider value={null}>
        <div role="radiogroup" aria-label={legend} className="grid grid-cols-5 gap-2">
          {list.map((f, i) => {
            const on = value === f.n;
            return (
              <motion.button
                key={f.n}
                ref={(el) => (refs.current[i] = el)}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={`${f.n} / 5, ${f.name}`}
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
  { key: 'caffeineLate', icon: Coffee },
  { key: 'screensBeforeBed', icon: MonitorSmartphone },
  { key: 'exercisedToday', icon: Dumbbell },
] as const;
type FactorKey = (typeof FACTORS)[number]['key'];

function DaySelect({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (v: number) => void }) {
  const t = useText(COPY);
  const locale = useLocale();
  const shortDate = (d: Date) => d.toLocaleDateString(INTL_LOCALE[locale], { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
  return (
    <Field label={label}>
      <Select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {Array.from({ length: 7 }, (_, i) => {
          const d = new Date(Date.now() - i * DAY);
          return <option key={i} value={i}>{i === 0 ? `${t.today} · ${shortDate(d)}` : i === 1 ? `${t.yesterday} · ${shortDate(d)}` : shortDate(d)}</option>;
        })}
      </Select>
    </Field>
  );
}

function NightForm({ logs, onSaved, idPrefix }: { logs: SleepLog[]; onSaved: () => void; idPrefix: string }) {
  const t = useText(COPY);
  const locale = useLocale();
  const last = logs.find((l) => !isNap(l));
  const [wakeDay, setWakeDay] = useState(0);
  const [bed, setBed] = useState(() => (last ? clock(last.bedtime, locale) : '23:00'));
  const [wake, setWake] = useState(() => (last ? clock(last.wakeTime, locale) : '07:00'));
  const [q, setQ] = useState(4);
  const [factors, setFactors] = useState<Record<FactorKey, boolean>>({ caffeineLate: false, screensBeforeBed: false, exercisedToday: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = useMemo(() => new Date(Date.now() - wakeDay * DAY), [wakeDay]);
  const night = bed && wake ? nightFromTimes(bed, wake, base) : null;
  const valid = night && night.hours >= REST_MIN_H && night.hours <= REST_MAX_H;
  // Una noche por mañana; las siestas no cuentan.
  const existing = night ? logs.find((l) => !isNap(l) && nightKey(l) === dayKey(night.wakeTime)) : undefined;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!night || !valid) { setError(t.nightInvalid); return; }
    setSaving(true);
    setError(null);
    try {
      const body = { bedtime: night.bedtime.toISOString(), wakeTime: night.wakeTime.toISOString(), quality: q };
      if (existing) await sleepService.updateSleep(existing.id, body);
      else await sleepService.createSleep({ ...body, date: dayKey(night.wakeTime), ...factors });
      useToastStore.getState().success(existing ? t.nightUpdated : t.nightRegistered, `${hm(night.hours)} · ${quality(q, locale).name.toLowerCase()}`);
      onSaved();
    } catch {
      setError(t.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={(e) => void submit(e)} noValidate>
      <DaySelect id={`${idPrefix}-day`} label={t.nightEnded} value={wakeDay} onChange={setWakeDay} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.sleptAt}><Input id={`${idPrefix}-in`} type="time" value={bed} onChange={(e) => setBed(e.target.value)} required /></Field>
        <Field label={t.wokeAt} error={night && !valid ? t.wakeRange : undefined}><Input id={`${idPrefix}-out`} type="time" value={wake} onChange={(e) => setWake(e.target.value)} required /></Field>
      </div>
      <DurationMeter hours={night && valid ? night.hours : null} target={SLEEP_GOAL_H} targetLabel={t.goalRange} />
      <QualityPicker value={q} onChange={setQ} legend={t.howSleptLegend} />
      {!existing && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label-lg text-on-surface">{t.factors} <span className="font-normal text-on-surface-light">{t.optional}</span></legend>
          <div className="flex flex-wrap gap-2">
            {FACTORS.map(({ key, icon: Icon }) => (
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
                <Icon aria-hidden className="size-4" strokeWidth={1.75} />{key === 'caffeineLate' ? t.cafLate : key === 'screensBeforeBed' ? t.screens : t.exercised}
              </motion.button>
            ))}
          </div>
        </fieldset>
      )}
      {existing && <p className="text-body-sm text-on-surface-light">{t.alreadyNight}</p>}
      {error && <p role="alert" className="text-body-sm text-error-text">{error}</p>}
      <Button type="submit" block loading={saving}>{existing ? t.updateNight : t.saveNight}</Button>
    </form>
  );
}

function NapForm({ onSaved, idPrefix }: { onSaved: () => void; idPrefix: string }) {
  const t = useText(COPY);
  const locale = useLocale();
  const presets = napPresets(locale);
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

  // Una siesta puede cruzar la medianoche (turnos, descansos largos): fin < inicio = día siguiente.
  const minutes = start && end ? (fromHHMM(end) - fromHHMM(start) + 1440) % 1440 : 0;
  const hours = minutes / 60;
  const valid = hours >= REST_MIN_H && hours <= REST_MAX_H;
  const preset = presets.find((p) => p.min === minutes)?.min;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) { setError(minutes <= 0 ? t.napSameTimes : t.napInvalid); return; }
    const base = new Date(Date.now() - day * DAY);
    const s = new Date(base); s.setHours(0, fromHHMM(start), 0, 0);
    const w = new Date(s.getTime() + minutes * 60_000);
    setSaving(true);
    setError(null);
    try {
      await sleepService.createSleep({ bedtime: s.toISOString(), wakeTime: w.toISOString(), quality: q, date: dayKey(w), isNap: true });
      useToastStore.getState().success(t.napRegistered, `${hm(hours)} · ${quality(q, locale).name.toLowerCase()}`);
      onSaved();
    } catch {
      setError(t.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  const advice = valid ? napAdvice(hours, locale) : null;
  return (
    <form className="flex flex-col gap-5" onSubmit={(e) => void submit(e)} noValidate>
      <DaySelect id={`${idPrefix}-day`} label={t.napDate} value={day} onChange={setDay} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label-lg text-on-surface">{t.quickDuration}</legend>
        <div className="grid grid-cols-3 gap-2">
          {presets.map((p) => {
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
        <Field label={t.startedAt}><Input id={`${idPrefix}-in`} type="time" value={start} onChange={(e) => setStart(e.target.value)} required /></Field>
        <Field label={t.endedAt} error={start && end && !valid ? t.wakeRange : undefined}><Input id={`${idPrefix}-out`} type="time" value={end} onChange={(e) => setEnd(e.target.value)} required /></Field>
      </div>
      <DurationMeter hours={valid ? hours : null} target={1.5} tone="warning" targetLabel={t.refHint} advice={advice} />
      <QualityPicker value={q} onChange={setQ} legend={t.wentWell} />
      {error && <p role="alert" className="text-body-sm text-error-text">{error}</p>}
      <Button type="submit" block loading={saving}>{t.saveNap}</Button>
    </form>
  );
}

function LogCard({ logs, onSaved }: { logs: SleepLog[]; onSaved: () => void }) {
  const t = useText(COPY);
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
        <h2 id="sleep-log" className="text-heading-sm">{mode === 'night' ? t.logNight : t.logNap}</h2>
      </div>
      <SegmentedControl
        role="radiogroup"
        label={t.typeOfRest}
        value={mode}
        onChange={setMode}
        options={[{ value: 'night', label: t.night }, { value: 'nap', label: t.nap }]}
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
  const t = useText(COPY);
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
  const t = useText(COPY);
  const locale = useLocale();
  const shortDate = (d: Date) => d.toLocaleDateString(INTL_LOCALE[locale], { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
  const naps = dayLogs.filter(isNap);
  const napHours = naps.reduce((a, l) => a + l.duration, 0);
  const total = dayLogs.reduce((a, l) => a + l.duration, 0);
  const wake = night ? new Date(night.wakeTime) : null;
  const recent = wake ? Date.now() - wake.getTime() < 1.5 * DAY : false;
  const met = night ? night.duration >= SLEEP_GOAL_H : false;
  const gap = night ? Math.round((SLEEP_GOAL_H - night.duration) * 60) : 0;
  const segments: DialSegment[] = dayLogs.map((l) => ({
    start: l.bedtime, end: l.wakeTime, kind: isNap(l) ? 'nap' : 'night',
    label: `${isNap(l) ? t.naps : t.night} ${clock(l.bedtime, locale)} → ${clock(l.wakeTime, locale)}`,
  }));
  return (
    <Card as="section" variant="elevated" padding="none" aria-label={night ? (recent ? t.asleepLast : t.lastRecord(shortDate(wake!))) : t.restSectionAria} className="relative isolate overflow-hidden">
      <SleepSky className="-z-10" />
      <div className="flex flex-col gap-6 p-6 pb-10 md:flex-row md:items-center md:gap-12 md:p-10 md:pb-14">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-center gap-3">
            <SleepyMoon />
            <span className="text-body-sm text-on-surface-light md:text-body-md">
              {night ? (recent ? t.asleepLast : t.asleepSince(shortDate(wake!))) : t.restStarts}
            </span>
          </div>
          {night ? (
            <>
              <BigDuration hours={night.duration} />
              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                <QualityBadge q={night.quality} />
                <span className="flex items-center gap-1.5 text-body-sm text-on-surface-light"><Clock aria-hidden className="size-4" strokeWidth={1.75} />{clock(night.bedtime, locale)} → {clock(night.wakeTime, locale)}</span>
                <span className={cn('rounded-full px-3 py-1.5 text-label-lg', met ? 'bg-surface-variant text-on-surface' : softTone.warning)}>
                  {met ? t.goalMet(String(SLEEP_GOAL_H)) : t.belowGoal(hm(gap / 60))}
                </span>
              </div>
            </>
          ) : (
            <p className="max-w-md text-body-md text-on-surface">{t.firstNight}</p>
          )}
          <AnimatePresence>
            {naps.length > 0 && (
              <motion.p
                initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1, transition: { ...springSoft, delay: 0.6 } }} exit={{ opacity: 0 }}
                className={cn('inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-label-lg', softTone.warning)}
              >
                <CloudSun aria-hidden className="size-4" strokeWidth={1.75} />
                {naps.length > 1 ? t.napTotal(hm(napHours), naps.length) : t.napTotalOne(hm(napHours))}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <div className="flex flex-col items-center gap-3">
          <RestDial segments={segments} totalHours={total} caption={naps.length ? t.nightPlusNap : t.restToday} />
          <div aria-hidden className="flex items-center gap-4 text-body-sm text-on-surface-light">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-info" />{t.shortLegend}</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-warning" />{t.nap2}</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary" />{t.now}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function MiniStat({ label, hours, sub, tone }: { label: string; hours: number; sub: string; tone: 'info' | 'warning' | 'primary' }) {
  const t = useText(COPY);
  const minutes = useCountUp(Math.round(hours * 60), 1.1);
  return (
    <motion.div variants={pop3} className="min-w-0">
      <Card padding="none" className="lq-lift flex h-full flex-col gap-1 p-4 md:p-5">
        <span className="flex items-center gap-2 text-body-sm text-on-surface-light">
          <span aria-hidden className={cn('size-2 rounded-full', tone === 'info' ? 'bg-info' : tone === 'warning' ? 'bg-warning' : 'bg-primary')} />
          {label}
        </span>
        <span className="text-heading-md font-bold font-mono tabular-nums" aria-hidden>{hours ? hm(minutes / 60, true) : '—'}</span>
        <span className="sr-only">{hours ? hm(hours) : t.noNights}</span>
        <span className="truncate text-body-sm text-on-surface-light">{sub}</span>
      </Card>
    </motion.div>
  );
}

function SleepGapCard({ suggestion, onDismiss, onSaved }: { suggestion: SleepGapSuggestion; onDismiss: () => void; onSaved: () => void }) {
  const t = useText(COPY);
  const locale = useLocale();
  const [q, setQ] = useState(3);
  const [saving, setSaving] = useState(false);
  const start = new Date(suggestion.bedtime);
  const end = new Date(suggestion.wakeTime);
  const time = (date: Date) => date.toLocaleTimeString(INTL_LOCALE[locale], { hour: '2-digit', minute: '2-digit' });

  async function confirm() {
    setSaving(true);
    try {
      await sleepService.createSleep({
        bedtime: start.toISOString(),
        wakeTime: end.toISOString(),
        date: dayKey(end),
        quality: q,
      });
      useToastStore.getState().success(t.restRegistered, `${hm(suggestion.durationHours)} · ${quality(q, locale).name.toLowerCase()}`);
      onSaved();
      onDismiss();
    } catch {
      useToastStore.getState().error(t.restFailed, t.restFailedBody);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card as="section" padding="lg" aria-label={t.gapCardAria} className="flex flex-col gap-4 border-info/35 bg-info/[var(--lq-soft-alpha)]">
      <div className="flex items-start gap-3">
        <IconChip icon={Moon} tone="info" size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="text-heading-sm">{t.gapTitle}</h2>
          <p className="mt-1 text-body-sm text-on-surface-light">
            {t.gapBody(hm(suggestion.durationHours), time(start), time(end))}
          </p>
        </div>
      </div>
      <QualityPicker value={q} onChange={setQ} legend={t.gapQ} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onDismiss}>{t.gapNotSleep}</Button>
        <Button type="button" loading={saving} onClick={() => void confirm()}>{t.gapRegister}</Button>
      </div>
    </Card>
  );
}

export default function SleepPage() {
  const t = useText(COPY);
  const locale: Locale = useLocale();
  const loadingCopy = useLoadingCopy();
  const weekday = (d: Date, style: 'short' | 'long' = 'short') => {
    const s = d.toLocaleDateString(INTL_LOCALE[locale], { weekday: style }).replace('.', '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const shortDate = (d: Date) => d.toLocaleDateString(INTL_LOCALE[locale], { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
  const num1 = (n: number) => n.toLocaleString(INTL_LOCALE[locale], { maximumFractionDigits: 1 });

  const [logs, setLogs] = useState<SleepLog[]>([]);
  const [stats, setStats] = useState<SleepStats | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [showAll, setShowAll] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const userId = useAuthStore((s) => s.user?.id);
  const [gapSuggestion, setGapSuggestion] = useState<SleepGapSuggestion | null>(null);

  useEffect(() => {
    if (!userId) { setGapSuggestion(null); return; }
    let alive = true;
    // Primero la del servidor (detectada con lastActiveAt); si no hay, la de este dispositivo.
    const sync = () => {
      const local = readSleepGapSuggestion(userId);
      setGapSuggestion(local);
      void fetchServerSleepSuggestion().then((remote) => { if (alive && remote) setGapSuggestion(remote); });
    };
    sync();
    const later = window.setTimeout(sync, 0);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      alive = false;
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
      useToastStore.getState().success(isNap(l) ? t.deleteNapToast : t.deleted);
      void load(true);
    } catch {
      useToastStore.getState().error(t.deleteFailed);
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
      tip: `${weekday(n.wake)} · ${hm(n.hours, true)}${nap ? ` + ${hm(nap)} ${t.nap2.toLowerCase()}` : ''}`,
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
    improving: { label: t.trendImproving, icon: TrendingUp, tone: 'success' as const },
    declining: { label: t.trendDeclining, icon: TrendingDown, tone: 'warning' as const },
    stable: { label: t.trendStable, icon: Minus, tone: 'info' as const },
  }[trend];
  const good = nights.slice(0, 14).flatMap((n) => n.logs).filter((l) => l.quality >= 4);
  const goodBed = good.length >= 2 ? fmtBedMinutes(good.reduce((a, l) => a + bedMinutes(l.bedtime), 0) / good.length) : null;

  const weekNaps = logs.filter((l) => isNap(l) && now - new Date(l.wakeTime).getTime() < 7 * DAY);
  const weekNapHours = weekNaps.reduce((a, l) => a + l.duration, 0);
  const todayKey = dayKey(new Date());
  const todayHours = logs.filter((l) => nightKey(l) === todayKey).reduce((a, l) => a + l.duration, 0);

  const header = (
    <motion.section variants={item} className="flex flex-col gap-1 md:gap-2">
      <span className="hidden text-label-lg text-primary-text md:block">{t.section}</span>
      <h1 className="text-display-sm md:text-display-md lg:text-display-lg"><Lettering text={t.headline} /></h1>
    </motion.section>
  );

  const chart = (
    <Card as="section" padding="none" aria-labelledby="sleep-week" className="flex flex-col gap-4 p-4 md:gap-6 md:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="sleep-week" className="text-heading-sm md:text-heading-lg">{t.lastNights(recent.length > 1 ? recent.length : 7)}</h2>
        {recent.length > 1 && <span className="text-body-sm text-on-surface-light md:text-body-md">{t.avg} <b className="font-semibold text-on-background font-mono tabular-nums">{hm(avg, true)}</b></span>}
      </div>
      {recent.length > 1 ? (
        <>
          <LineChart
            key={`${isDesktop}-${recent.map((n) => n.key).join()}`}
            data={points}
            min={lo} max={hi}
            goal={{ value: SLEEP_GOAL_H, label: `${t.goalRange}` }}
            height={isDesktop ? 240 : 140}
            dots={isDesktop}
            label={t.chartLabel(recent.map((n) => num1(n.hours)).join('; '), trendMeta.label)}
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
              <div className={cn('text-label-lg md:text-body-lg md:font-semibold', softTone[trendMeta.tone].split(' ')[1])}>{t.trendLabel(trendMeta.label)}</div>
              <div className="text-body-sm text-on-surface md:text-body-md">
                {delta !== null ? t.vsLastWeek(hm(Math.abs(delta) / 60), delta >= 0 ? '+' : '−') : t.compareTwo}
                {goodBed && <span className="hidden md:inline"> {t.bestNights(goodBed)}</span>}
              </div>
            </div>
          </div>
          {napsByDay.size > 0 && <p className="-mt-2 flex items-center gap-2 text-body-sm text-on-surface-light"><span aria-hidden className="size-1.5 rounded-full bg-warning" />{t.nightDay}</p>}
        </>
      ) : (
        <EmptyState icon={Moon} tone="muted" title={t.noTrend} description={t.trendNeed} className="py-8" />
      )}
    </Card>
  );

  const visible = showAll ? logs : logs.slice(0, 8);
  const history = logs.length > 0 && (
    <Card as="section" padding="none" aria-labelledby="sleep-history" className="flex flex-col gap-2 p-4 md:p-6">
      <h2 id="sleep-history" className="text-heading-sm">{t.historyTitle}</h2>
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
                <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', nap ? softTone.warning : softTone[quality(l.quality, locale).tone])} title={nap ? t.nap2 : quality(l.quality, locale).name}>
                  {nap ? <CloudSun aria-hidden className="size-5" strokeWidth={1.75} /> : <QualityFace q={l.quality} className="size-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2 truncate text-body-md font-semibold">
                    {date}
                    {nap && <span className="hidden rounded-full sm:inline bg-warning/[var(--lq-soft-alpha)] px-2 py-0.5 text-label-md text-warning-text">{t.nap2}</span>}
                  </div>
                  <div className="truncate text-body-sm text-on-surface-light font-mono tabular-nums">{nap && <span className="text-warning-text sm:hidden">{t.nap2} · </span>}{clock(l.bedtime, locale)} → {clock(l.wakeTime, locale)}<span className="sr-only sm:not-sr-only"> · {quality(l.quality, locale).name}</span></div>
                </div>
                <span className={cn('text-body-md font-semibold font-mono tabular-nums', !nap && l.duration < SLEEP_GOAL_H - 1 && 'text-warning-text')}>{nap ? hm(l.duration) : hm(l.duration, true)}</span>
                <Button variant="icon" aria-label={t.deleteEntry(nap ? t.napWord : t.nightWord, date)} onClick={() => void remove(l)} className="-mr-2 hover:text-error-text">
                  <Trash2 aria-hidden className="size-5" strokeWidth={1.75} />
                </Button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {logs.length > 8 && (
        <Button variant="ghost" size="sm" className="self-center" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
          {showAll ? t.viewLess : t.viewAll(logs.length)}
        </Button>
      )}
    </Card>
  );

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-6 md:gap-8">
      {header}
      {state === 'loading' ? (
        <PageLoader label={t.loading} words={loadingCopy.statsSleep} />
      ) : state === 'error' ? (
        <ErrorState title={t.loadFailed} onRetry={() => void load()} />
      ) : (
        <>
          {gapSuggestion && (
            <motion.div variants={item}>
              <SleepGapCard suggestion={gapSuggestion} onDismiss={dismissGapSuggestion} onSaved={() => void load(true)} />
            </motion.div>
          )}
          <motion.div variants={item}><SleepHero night={lastNight} dayLogs={heroLogs} /></motion.div>
          <motion.div variants={stagger} className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
            <MiniStat label={t.mean} hours={avg} sub={recent.length ? t.lastN(recent.length) : t.noNights} tone="info" />
            <MiniStat label={t.napsWeek} hours={weekNapHours} sub={weekNaps.length ? t.napsCount(weekNaps.length) : t.noneWeek} tone="warning" />
            <div className="col-span-2 md:col-span-1">
              <MiniStat label={t.restToday} hours={todayHours} sub={t.nightPlusNap} tone="primary" />
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
