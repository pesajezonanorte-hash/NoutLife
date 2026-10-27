// Ciclo Menstrual: zona de salud femenina (solo para quien indica que es mujer).
// Una rueda con las cuatro fases (menstruación, fase folicular, ovulación y fase
// lútea). Una semilla de luz recorre la rueda hasta hoy; la luz de la zona toma el
// color de la fase en la que estás. Debajo: qué esperar hoy, cómo ajustar el
// Coliseo y los hábitos, el registro del día, el calendario, las tendencias y tus
// ciclos. Nada de esto llega al Sabio.
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, CalendarHeart, Droplet, Dumbbell, ListChecks, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { item } from '@/lib/motion';
import { longDate } from '@/lib/lifeMeta';
import { INTL_LOCALE } from '@/lib/locale';
import { useLocale, useText, type Copy } from '@/lib/i18n';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { canUseCycle } from '@/utils/gender';
import { apiError } from '@/services/network.service';
import {
  addCyclePeriod, clearCycleDay, getCycle, logCycleDay, saveCycleSettings, updateCyclePeriod,
  type CycleLogInput, type CycleOverview,
} from '@/services/cycle.service';
import { SketchUnderline, ZoneShell } from '@/components/ambience';
import { Lettering } from '@/components/layout/Lettering';
import { Button, Card, DatePicker, EmptyState, ErrorState, Field, PageLoader, ResponsiveDialog } from '@/components/ui/lq';
import { CycleRing } from '@/components/cycle/CycleRing';
import { CycleAnalyticsPanel } from '@/components/cycle/CycleAnalytics';
import { DayLogForm } from '@/components/cycle/DayLogForm';
import { CycleCalendar, type DayInfo } from '@/components/cycle/CycleCalendar';
import { PeriodHistory, Stepper } from '@/components/cycle/PeriodHistory';
import {
  PHASES, daysBetween, energyLabelFor, fertilityLabelFor, intensityLineFor, isBleeding, longDay, phaseFill, phaseInk,
  phaseMetaFor, sourceLabelFor, symptomLabelsFor,
} from '@/components/cycle/cycleMeta';
import { adviceCopy } from '@/components/cycle/adviceText';

const es = {
  // Primer arranque
  setupTitle: 'Empecemos por tu último periodo',
  setupBody: 'Con eso ya podemos ubicarte en tu ciclo. Cada periodo que anotes afina las predicciones.',
  setupDate: '¿Qué día empezó tu último periodo?',
  pickDay: 'Elige el día',
  cycleLen: 'Tu ciclo suele durar',
  periodLen: 'Tu periodo suele durar',
  unitDays: 'días',
  setupPrivacy: 'Tus datos del ciclo son privados: no se comparten con nadie ni los lee el Sabio.',
  begin: 'Empezar',
  begun: 'Tu ciclo está en marcha',
  saveErr: 'No se pudo guardar',
  // Sin acceso
  unavailableTitle: 'Esta zona no está en tu cuenta',
  unavailableBody: 'Si eres mujer y quieres seguir tu ciclo, indícalo en Ajustes → Perfil.',
  goSettings: 'Ir a Ajustes',
  // Carga y cabecera
  errorTitle: 'No pudimos abrir tu ciclo',
  loading: 'Preparando tu ciclo…',
  title: 'Ciclo Menstrual',
  intro: 'Las cuatro fases de tu ciclo: sabes dónde estás, qué esperar y cómo ajustar tu día.',
  periodEnded: 'Terminó mi periodo',
  periodStarted: 'Me llegó el periodo',
  // Próximo periodo
  lateLine: (n: number): string => `Tu periodo va ${n} ${n === 1 ? 'día' : 'días'} tarde según tu promedio. Los ciclos varían; si te preocupa, consulta con un profesional de salud.`,
  onPeriodLine: (d: number): string => `Estás en tu periodo: día ${d}.`,
  nextWindowLine: (a: string, b: string, c: string): string => `Próximo periodo entre el ${a} y el ${b}, hacia el ${c}.`,
  nextLine: (c: string, n: number): string => `Próximo periodo hacia el ${c} (en ${n} ${n === 1 ? 'día' : 'días'}).`,
  // Hoy
  todayAria: 'Hoy en tu ciclo',
  cycleDayCaption: 'día de tu ciclo',
  phaseLabel: 'Fase del ciclo',
  phaseOf: (d: number, l: number): string => `Día ${d} de ${l} de esta fase.`,
  energyExpected: 'Energía prevista',
  symptomsToday: 'Síntomas de hoy',
  symptomsMaybe: 'Puede que notes',
  nothingNote: 'Nada que destacar por ahora.',
  fertileLine: (label: string, a: string, b: string): string => `${label}: del ${a} al ${b}. Es una estimación a partir de tus ciclos: no sirve como método anticonceptivo.`,
  // Para hoy
  forToday: 'Para hoy',
  coliseoTag: 'Coliseo',
  suggestedLoad: 'Carga sugerida:',
  goColiseo: 'Ir al Coliseo',
  habitsTag: 'Hábitos',
  restNote: 'Si hoy anotas energía baja o cólicos, Hábitos te dejará marcar descanso en los de ejercicio sin romper su racha.',
  goHabits: 'Ir a Hábitos',
  // Registro, calendario, fases, tendencias e historial
  logTitle: '¿Cómo estás hoy?',
  logBody: 'Lo que anotes ajusta los consejos de hoy y enseña a la app tus patrones.',
  calTitle: 'Calendario',
  calBody: 'Toca un día para ver o anotar cómo fue. El borde punteado es tu próximo periodo previsto.',
  phasesTitle: 'Tus cuatro fases',
  here: ' (estás aquí)',
  daysRange: (a: number, b: number): string => `días ${a}–${b}`,
  trendsTitle: 'Tendencias',
  trendsBody: 'Cómo han sido tus ciclos y periodos, y qué síntomas aparecen en cada fase.',
  historyTitle: 'Tus ciclos',
  disclaimer: 'Las predicciones son estimaciones a partir de tus registros y de promedios: no sustituyen el consejo médico ni sirven como anticonceptivo. Tus datos del ciclo son privados y no los lee el Sabio.',
  // Diálogo de un día
  noPhase: 'Sin fase calculada para este día.',
  predicted: ' (prevista)',
  expectedPeriod: 'Es uno de los días previstos de tu próximo periodo.',
  notYet: 'Aún no llega: podrás anotarlo ese día.',
  // Avisos
  dayOk: 'Día guardado',
  startedNote: 'Anotamos el inicio de tu periodo.',
  extendedNote: 'Tu periodo se alargó hasta ese día.',
  dayErr: 'No se pudo guardar el día',
  cleared: 'Registro borrado',
  clearErr: 'No se pudo borrar',
  periodNoted: 'Periodo anotado',
  periodNotedSub: 'Hoy es el día 1 de tu ciclo.',
  periodNoteErr: 'No se pudo anotar el periodo',
  periodClosed: 'Periodo cerrado',
  periodClosedSub: 'Gracias: así tus promedios son más exactos.',
  periodCloseErr: 'No se pudo cerrar el periodo',
};

const en: typeof es = {
  setupTitle: 'Let’s start with your last period',
  setupBody: 'With that we can place you in your cycle. Every period you log sharpens the predictions.',
  setupDate: 'What day did your last period start?',
  pickDay: 'Pick the day',
  cycleLen: 'Your cycle usually lasts',
  periodLen: 'Your period usually lasts',
  unitDays: 'days',
  setupPrivacy: 'Your cycle data is private: it is not shared with anyone and the Sage does not read it.',
  begin: 'Start',
  begun: 'Your cycle is on its way',
  saveErr: 'Could not save',
  unavailableTitle: 'This zone is not in your account',
  unavailableBody: 'If you are a woman and want to track your cycle, set it in Settings → Profile.',
  goSettings: 'Go to Settings',
  errorTitle: 'We could not open your cycle',
  loading: 'Preparing your cycle…',
  title: 'Menstrual Cycle',
  intro: 'The four phases of your cycle: know where you are, what to expect and how to adjust your day.',
  periodEnded: 'My period ended',
  periodStarted: 'My period started',
  lateLine: (n: number): string => `Your period is ${n} ${n === 1 ? 'day' : 'days'} late based on your average. Cycles vary; if you are worried, talk to a health professional.`,
  onPeriodLine: (d: number): string => `You are on your period: day ${d}.`,
  nextWindowLine: (a: string, b: string, c: string): string => `Next period between ${a} and ${b}, around ${c}.`,
  nextLine: (c: string, n: number): string => `Next period around ${c} (in ${n} ${n === 1 ? 'day' : 'days'}).`,
  todayAria: 'Today in your cycle',
  cycleDayCaption: 'day of your cycle',
  phaseLabel: 'Cycle phase',
  phaseOf: (d: number, l: number): string => `Day ${d} of ${l} of this phase.`,
  energyExpected: 'Expected energy',
  symptomsToday: 'Symptoms today',
  symptomsMaybe: 'You may notice',
  nothingNote: 'Nothing to highlight for now.',
  fertileLine: (label: string, a: string, b: string): string => `${label}: from ${a} to ${b}. This is an estimate based on your cycles: it is not a contraceptive method.`,
  forToday: 'For today',
  coliseoTag: 'Coliseo',
  suggestedLoad: 'Suggested load:',
  goColiseo: 'Go to Coliseo',
  habitsTag: 'Habits',
  restNote: 'If you log low energy or cramps today, Habits will let you mark a rest day on your exercise habits without breaking their streak.',
  goHabits: 'Go to Habits',
  logTitle: 'How are you today?',
  logBody: 'What you log adjusts today’s advice and teaches the app your patterns.',
  calTitle: 'Calendar',
  calBody: 'Tap a day to see or log how it went. The dotted edge is your next expected period.',
  phasesTitle: 'Your four phases',
  here: ' (you are here)',
  daysRange: (a: number, b: number): string => `days ${a}–${b}`,
  trendsTitle: 'Trends',
  trendsBody: 'How your cycles and periods have gone, and which symptoms show up in each phase.',
  historyTitle: 'Your cycles',
  disclaimer: 'Predictions are estimates based on your logs and averages: they do not replace medical advice and are not a contraceptive. Your cycle data is private and the Sage does not read it.',
  noPhase: 'No phase calculated for this day.',
  predicted: ' (predicted)',
  expectedPeriod: 'This is one of the expected days of your next period.',
  notYet: 'Not here yet: you can log it on that day.',
  dayOk: 'Day saved',
  startedNote: 'We noted the start of your period.',
  extendedNote: 'Your period was extended to that day.',
  dayErr: 'Could not save the day',
  cleared: 'Entry deleted',
  clearErr: 'Could not delete',
  periodNoted: 'Period logged',
  periodNotedSub: 'Today is day 1 of your cycle.',
  periodNoteErr: 'Could not log the period',
  periodClosed: 'Period closed',
  periodClosedSub: 'Thanks: this makes your averages more accurate.',
  periodCloseErr: 'Could not close the period',
};

const COPY: Copy<typeof es> = { es, en };

/** Primer arranque: su último periodo y sus largos de siempre. */
function Setup({ today, onDone }: { today: string; onDone: (data: CycleOverview) => void }) {
  const t = useText(COPY);
  const toast = useToast();
  const [start, setStart] = useState('');
  const [cycleLength, setCycleLength] = useState(28);
  const [periodLength, setPeriodLength] = useState(5);
  const [saving, setSaving] = useState(false);
  async function begin() {
    if (!start) return;
    setSaving(true);
    try { onDone(await saveCycleSettings({ lastPeriodStart: start, cycleLength, periodLength })); toast.success(t.begun); }
    catch (e) { toast.error(apiError(e, t.saveErr)); }
    finally { setSaving(false); }
  }
  return (
    <motion.div variants={item}>
      <Card padding="lg" className="mx-auto flex max-w-xl flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h2 className="text-heading-lg">{t.setupTitle}</h2>
          <p className="text-body-md text-on-surface-light">{t.setupBody}</p>
        </div>
        <Field label={t.setupDate}>
          <DatePicker value={start} onChange={setStart} max={today} placeholder={t.pickDay} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Stepper label={t.cycleLen} value={cycleLength} min={18} max={60} onChange={setCycleLength} unit={t.unitDays} />
          <Stepper label={t.periodLen} value={periodLength} min={2} max={10} onChange={setPeriodLength} unit={t.unitDays} />
        </div>
        <p className="flex items-start gap-2 text-body-sm text-on-surface-light">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          {t.setupPrivacy}
        </p>
        <Button size="lg" disabled={!start} loading={saving} onClick={() => void begin()}>{t.begin}</Button>
      </Card>
    </motion.div>
  );
}

/** Quien no indicó que es mujer no tiene esta zona (la API también la cierra). */
function Unavailable() {
  const t = useText(COPY);
  return (
    <EmptyState
      icon={Lock} tone="muted" className="py-20"
      title={t.unavailableTitle}
      description={t.unavailableBody}
      action={<Link to="/settings" className="inline-flex min-h-11 items-center gap-1 rounded-md font-semibold text-primary-text underline-offset-4 hover:underline">{t.goSettings}<ArrowUpRight aria-hidden className="size-4" /></Link>}
    />
  );
}

export default function CyclePage() {
  const t = useText(COPY);
  const locale = useLocale();
  const gender = useAuthStore((s) => s.user?.gender);
  const toast = useToast();
  const [data, setData] = useState<CycleOverview | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [saving, setSaving] = useState(false);
  const [day, setDay] = useState<DayInfo | null>(null);
  const allowed = canUseCycle(gender);

  const load = useCallback(async () => {
    try { setData(await getCycle()); setState('ready'); }
    catch { setState('error'); }
  }, []);
  useEffect(() => { if (allowed) void load(); }, [allowed, load]);

  async function saveDay(date: string, input: CycleLogInput) {
    setSaving(true);
    try {
      const r = await logCycleDay(date, input);
      await load();
      toast.success(t.dayOk, r.period === 'started' ? t.startedNote : r.period === 'extended' ? t.extendedNote : undefined);
      setDay(null);
    } catch (e) { toast.error(apiError(e, t.dayErr)); }
    finally { setSaving(false); }
  }
  async function clearDay(date: string) {
    try { await clearCycleDay(date); await load(); setDay(null); toast.info(t.cleared); }
    catch (e) { toast.error(apiError(e, t.clearErr)); }
  }
  async function periodStarted() {
    if (!data) return;
    try { await addCyclePeriod({ startDate: data.today }); await load(); toast.success(t.periodNoted, t.periodNotedSub); }
    catch (e) { toast.error(apiError(e, t.periodNoteErr)); }
  }
  async function periodEnded() {
    const current = data?.periods.find((p) => p.startDate === data.snapshot?.periodStart);
    if (!data || !current) return;
    try { await updateCyclePeriod(current.id, { endDate: data.today }); await load(); toast.success(t.periodClosed, t.periodClosedSub); }
    catch (e) { toast.error(apiError(e, t.periodCloseErr)); }
  }

  const snap = data?.snapshot ?? null;
  const advice = data?.advice ?? null;
  const copy = advice ? adviceCopy(advice, locale) : null;
  const tone = snap ? `var(--cy-${snap.phase})` : 'var(--cy-follicular)';
  const phases = phaseMetaFor(locale);
  const symptoms = symptomLabelsFor(locale);

  const header = (
    <motion.section variants={item} className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1 md:gap-2">
        <span className="hidden text-label-lg text-primary-text md:block">{longDate(new Date(), locale)}</span>
        <h1 className="relative self-start text-display-sm md:text-display-md">
          <Lettering text={t.title} />
          <span style={{ color: snap ? phaseFill(snap.phase) : 'rgb(var(--cy-follicular))' }}><SketchUnderline className="absolute -bottom-1.5 left-0 w-full md:-bottom-2.5" delay={0.75} /></span>
        </h1>
        <p className="max-w-[560px] text-body-md text-on-surface-light md:text-body-lg">{t.intro}</p>
      </div>
      {snap && (
        snap.onPeriod && snap.periodOpen
          ? <Button variant="secondary" onClick={() => void periodEnded()}>{t.periodEnded}</Button>
          : !snap.onPeriod && <Button onClick={() => void periodStarted()}><Droplet aria-hidden className="size-4" />{t.periodStarted}</Button>
      )}
    </motion.section>
  );

  let body;
  if (!allowed) body = <Unavailable />;
  else if (state === 'loading' || !data) body = state === 'error' ? <ErrorState title={t.errorTitle} onRetry={() => void load()} /> : <PageLoader label={t.loading} />;
  else if (state === 'error') body = <ErrorState title={t.errorTitle} onRetry={() => void load()} />;
  else if (!snap) body = <Setup today={data.today} onDone={(d) => { setData(d); setState('ready'); }} />;
  else {
    const meta = phases[snap.phase];
    const cycleStartOffset = (key: string) => daysBetween(snap.periodStart, key) + 1;
    const thisCycle = data.logs.filter((l) => l.date >= snap.periodStart);
    const bleedDays = thisCycle.filter((l) => isBleeding(l.flow)).map((l) => cycleStartOffset(l.date));
    const loggedDays = thisCycle.map((l) => cycleStartOffset(l.date));
    const nextLine = snap.lateDays > 0
      ? t.lateLine(snap.lateDays)
      : snap.onPeriod
        ? t.onPeriodLine(snap.cycleDay)
        : snap.nextPeriodEarliest && snap.nextPeriodLatest && snap.nextPeriodEarliest !== snap.nextPeriodLatest
          ? t.nextWindowLine(longDay(snap.nextPeriodEarliest, locale), longDay(snap.nextPeriodLatest, locale), longDay(snap.nextPeriod, locale))
          : t.nextLine(longDay(snap.nextPeriod, locale), snap.daysUntilNextPeriod);

    body = (
      <>
        {/* La rueda y lo que significa hoy */}
        <motion.section variants={item} aria-label={t.todayAria} className="grid items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12">
          <CycleRing shape={snap.shape} cycleDay={snap.cycleDay} phase={snap.phase} bleedDays={bleedDays} loggedDays={loggedDays}>
            <span className="text-label-lg" style={{ color: phaseInk(snap.phase) }}>{meta.name}</span>
            <span className="font-mono text-display-md leading-none tabular-nums md:text-display-lg">{snap.cycleDay}</span>
            <span className="text-body-sm text-on-surface-light">{t.cycleDayCaption}</span>
          </CycleRing>
          <div className="flex min-w-0 flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-2 text-label-lg" style={{ color: phaseInk(snap.phase) }}>
                <meta.icon aria-hidden className="size-4" strokeWidth={1.75} />{t.phaseLabel}
              </span>
              <h2 className="text-display-sm">{meta.name}</h2>
              <p className="text-body-md text-on-surface">
                {t.phaseOf(snap.phaseDay, snap.phaseLength)} {meta.summary}
              </p>
            </div>
            <p className={cn('rounded-xl px-4 py-3 text-body-md', snap.lateDays > 0 ? 'bg-warning/[var(--lq-soft-alpha)] text-on-surface' : 'bg-surface-variant text-on-surface')}>{nextLine}</p>
            {advice && (
              <dl className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <dt className="text-label-lg text-on-surface">{t.energyExpected}</dt>
                  <dd className="flex items-center gap-3">
                    <span aria-hidden className="flex items-end gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <motion.span
                          key={n} className="block w-2 origin-bottom rounded-[3px]"
                          style={{ height: 8 + n * 5, background: n <= advice.energy ? phaseFill(snap.phase) : 'rgb(var(--lq-on-background) / .1)' }}
                          initial={{ scaleY: 0 }} animate={{ scaleY: 1, transition: { type: 'spring', stiffness: 260, damping: 20, delay: 0.9 + n * 0.06 } }}
                        />
                      ))}
                    </span>
                    <span className="text-body-md"><b>{energyLabelFor(advice.energy, locale)}</b> <span className="text-on-surface-light">· {sourceLabelFor(advice.energySource, locale)}</span></span>
                  </dd>
                </div>
                <div className="flex flex-col gap-1.5">
                  <dt className="text-label-lg text-on-surface">{advice.symptomsSource === 'today' ? t.symptomsToday : t.symptomsMaybe}</dt>
                  <dd className="text-body-md text-on-surface">
                    {advice.symptoms.length ? advice.symptoms.map((s) => symptoms[s]).join(', ') : <span className="text-on-surface-light">{t.nothingNote}</span>}
                  </dd>
                </div>
              </dl>
            )}
            <p className="text-body-sm text-on-surface-light">
              {t.fertileLine(fertilityLabelFor(snap.fertility, locale), longDay(snap.fertileStart, locale), longDay(snap.fertileEnd, locale))}
            </p>
          </div>
        </motion.section>

        {/* El ciclo en el resto de la app */}
        {advice && copy && (
          <motion.section variants={item} aria-labelledby="cy-today" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="cy-today" className="text-heading-lg">{t.forToday}</h2>
              <p className="text-body-md text-on-surface-light">{copy.note}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Card padding="lg" className="flex flex-col gap-3">
                <span className="flex items-center gap-2 text-label-lg text-on-surface"><Dumbbell aria-hidden className="size-4" strokeWidth={1.75} />{t.coliseoTag} · {intensityLineFor(advice.intensity, locale)}</span>
                <h3 className="text-heading-sm">{copy.training.title}</h3>
                <p className="text-body-md text-on-surface">{copy.training.body}</p>
                <p className="text-body-sm text-on-surface"><span className="font-semibold">{t.suggestedLoad}</span> {copy.training.load}.</p>
                <ul className="flex flex-wrap gap-1.5">{copy.training.ideas.map((i) => <li key={i} className="rounded-full bg-surface-variant px-3 py-1.5 text-body-sm">{i}</li>)}</ul>
                <Link to="/coliseo" className="mt-auto inline-flex min-h-11 items-center gap-1 self-start font-semibold text-primary-text underline-offset-4 hover:underline">{t.goColiseo}<ArrowUpRight aria-hidden className="size-4" /></Link>
              </Card>
              <Card padding="lg" className="flex flex-col gap-3">
                <span className="flex items-center gap-2 text-label-lg text-on-surface"><ListChecks aria-hidden className="size-4" strokeWidth={1.75} />{t.habitsTag}</span>
                <h3 className="text-heading-sm">{copy.habits.title}</h3>
                <p className="text-body-md text-on-surface">{copy.habits.body}</p>
                {!advice.pauseFitness && <p className="text-body-sm text-on-surface-light">{t.restNote}</p>}
                <Link to="/habits" className="mt-auto inline-flex min-h-11 items-center gap-1 self-start font-semibold text-primary-text underline-offset-4 hover:underline">{t.goHabits}<ArrowUpRight aria-hidden className="size-4" /></Link>
              </Card>
            </div>
          </motion.section>
        )}

        {/* Registro de hoy y calendario */}
        <motion.div variants={item} className="grid items-start gap-6 lg:grid-cols-2">
          <Card as="section" aria-labelledby="cy-log" padding="lg" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="cy-log" className="text-heading-lg">{t.logTitle}</h2>
              <p className="text-body-sm text-on-surface-light">{t.logBody}</p>
            </div>
            <DayLogForm key={`today-${data.todayLog ? JSON.stringify(data.todayLog) : 'empty'}`} initial={data.todayLog} saving={saving} onSave={(input) => saveDay(data.today, input)} onClear={() => clearDay(data.today)} />
          </Card>
          <Card as="section" aria-labelledby="cy-cal" padding="lg" className="flex flex-col gap-4">
            <div className="flex items-start gap-2">
              <CalendarHeart aria-hidden className="mt-1 size-5 text-on-surface-light" strokeWidth={1.75} />
              <div>
                <h2 id="cy-cal" className="text-heading-lg">{t.calTitle}</h2>
                <p className="text-body-sm text-on-surface-light">{t.calBody}</p>
              </div>
            </div>
            <CycleCalendar data={data} selected={day?.key ?? null} onSelect={setDay} />
          </Card>
        </motion.div>

        {/* Las cuatro fases de este ciclo */}
        <motion.section variants={item} aria-labelledby="cy-phases" className="flex flex-col gap-4">
          <h2 id="cy-phases" className="text-heading-lg">{t.phasesTitle}</h2>
          <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {PHASES.map((p) => {
              const r = snap.shape.ranges[p];
              const m = phases[p];
              const now = p === snap.phase;
              if (r.end < r.start) return null;
              return (
                <li
                  key={p} aria-current={now ? 'step' : undefined}
                  className={cn('flex flex-col gap-2 rounded-2xl border p-4', now ? 'border-transparent' : 'border-border bg-surface')}
                  style={now ? { background: phaseFill(p, 0.1), boxShadow: `inset 0 0 0 1.5px ${phaseFill(p, 0.55)}` } : undefined}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-label-lg" style={{ color: phaseInk(p) }}><m.icon aria-hidden className="size-4" strokeWidth={1.75} /></span>
                    <span className="font-mono text-label-md tabular-nums text-on-surface-light">{t.daysRange(r.start, p === 'luteal' ? Math.max(r.end, snap.cycleDay) : r.end)}</span>
                  </span>
                  <h3 className="text-heading-sm">{m.name}{now && <span className="sr-only">{t.here}</span>}</h3>
                  <p className="text-body-sm text-on-surface">{m.summary}</p>
                </li>
              );
            })}
          </ol>
        </motion.section>

        <motion.section variants={item} aria-labelledby="cy-trends" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="cy-trends" className="text-heading-lg">{t.trendsTitle}</h2>
            <p className="text-body-sm text-on-surface-light">{t.trendsBody}</p>
          </div>
          <Card padding="lg"><CycleAnalyticsPanel data={data} /></Card>
        </motion.section>

        <motion.section variants={item} aria-labelledby="cy-history" className="flex flex-col gap-4">
          <h2 id="cy-history" className="text-heading-lg">{t.historyTitle}</h2>
          <PeriodHistory data={data} onChanged={load} />
        </motion.section>

        <motion.p variants={item} className="flex max-w-[70ch] items-start gap-2 text-body-sm text-on-surface-light">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          {t.disclaimer}
        </motion.p>

        <ResponsiveDialog open={Boolean(day)} onClose={() => setDay(null)} title={day ? new Date(`${day.key}T12:00:00`).toLocaleDateString(INTL_LOCALE[locale], { weekday: 'long', day: 'numeric', month: 'long' }) : ''}>
          {day && (
            <div className="flex flex-col gap-4">
              <p className="text-body-md text-on-surface">
                {day.phase ? <><span style={{ color: phaseInk(day.phase) }} className="font-semibold">{phases[day.phase].name}</span>{day.predicted ? t.predicted : ''}.</> : t.noPhase}
                {day.expectedPeriod && ` ${t.expectedPeriod}`}
              </p>
              {day.key <= data.today
                ? <DayLogForm key={day.key} initial={day.log} saving={saving} onSave={(input) => saveDay(day.key, input)} onClear={() => clearDay(day.key)} />
                : <p className="text-body-sm text-on-surface-light">{t.notYet}</p>}
            </div>
          )}
        </ResponsiveDialog>
      </>
    );
  }

  return (
    <ZoneShell
      zone="cycle"
      contentClassName="gap-8 md:gap-12"
      ambience={(
        // La luz de la estación en la que estás, muy diluida, detrás de la zona
        <span className="lq-cy-light lq-amb-breathe absolute -right-[10%] -top-[10%] block h-[38rem] w-[min(48rem,110%)] rounded-full [--d:15s] [--hi:1] [--lo:.6]" style={{ '--tone': tone } as CSSProperties} />
      )}
    >
      {allowed && header}
      {body}
    </ZoneShell>
  );
}
