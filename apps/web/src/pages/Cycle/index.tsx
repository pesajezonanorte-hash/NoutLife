// Ciclo — zona de salud femenina (solo para quien indica que es mujer).
// Zona ambientada: el jardín de las cuatro estaciones interiores. El ciclo es una
// rueda: el periodo es el invierno, la fase folicular la primavera, la ovulación
// el verano y la fase lútea el otoño. Una semilla de luz recorre la rueda hasta
// hoy; la luz de la zona toma el color de la estación en la que estás.
// Debajo: qué esperar hoy, cómo ajustar el Coliseo y los hábitos, el registro del
// día, el calendario con lo previsto y tus ciclos. Nada de esto llega al Sabio.
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, CalendarHeart, Droplet, Dumbbell, ListChecks, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { item } from '@/lib/motion';
import { longDate } from '@/lib/lifeMeta';
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
import { SeasonWheel } from '@/components/cycle/SeasonWheel';
import { DayLogForm } from '@/components/cycle/DayLogForm';
import { CycleCalendar, type DayInfo } from '@/components/cycle/CycleCalendar';
import { PeriodHistory, Stepper } from '@/components/cycle/PeriodHistory';
import {
  PHASES, PHASE_META, SOURCE_LABEL, SYMPTOM_LABELS, daysBetween, energyLabel, intensityLine, isBleeding, longDay, phaseFill, phaseInk,
} from '@/components/cycle/cycleMeta';

/** Primer arranque: su último periodo y sus largos de siempre. */
function Setup({ today, onDone }: { today: string; onDone: (data: CycleOverview) => void }) {
  const toast = useToast();
  const [start, setStart] = useState('');
  const [cycleLength, setCycleLength] = useState(28);
  const [periodLength, setPeriodLength] = useState(5);
  const [saving, setSaving] = useState(false);
  async function begin() {
    if (!start) return;
    setSaving(true);
    try { onDone(await saveCycleSettings({ lastPeriodStart: start, cycleLength, periodLength })); toast.success('Tu ciclo está en marcha'); }
    catch (e) { toast.error(apiError(e, 'No se pudo guardar')); }
    finally { setSaving(false); }
  }
  return (
    <motion.div variants={item}>
      <Card padding="lg" className="mx-auto flex max-w-xl flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h2 className="text-heading-lg">Empecemos por tu último periodo</h2>
          <p className="text-body-md text-on-surface-light">Con eso ya podemos ubicarte en tu ciclo. Cada periodo que anotes afina las predicciones.</p>
        </div>
        <Field label="¿Qué día empezó tu último periodo?">
          <DatePicker value={start} onChange={setStart} max={today} placeholder="Elige el día" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Stepper label="Tu ciclo suele durar" value={cycleLength} min={18} max={60} onChange={setCycleLength} unit="días" />
          <Stepper label="Tu periodo suele durar" value={periodLength} min={2} max={10} onChange={setPeriodLength} unit="días" />
        </div>
        <p className="flex items-start gap-2 text-body-sm text-on-surface-light">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          Tus datos del ciclo son privados: no se comparten con nadie ni los lee el Sabio.
        </p>
        <Button size="lg" disabled={!start} loading={saving} onClick={() => void begin()}>Empezar</Button>
      </Card>
    </motion.div>
  );
}

/** Quien no indicó que es mujer no tiene esta zona (la API también la cierra). */
function Unavailable() {
  return (
    <EmptyState
      icon={Lock} tone="muted" className="py-20"
      title="Esta zona no está en tu cuenta"
      description="Si eres mujer y quieres seguir tu ciclo, indícalo en Ajustes → Perfil."
      action={<Link to="/settings" className="inline-flex min-h-11 items-center gap-1 rounded-md font-semibold text-primary-text underline-offset-4 hover:underline">Ir a Ajustes<ArrowUpRight aria-hidden className="size-4" /></Link>}
    />
  );
}

export default function CyclePage() {
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
      toast.success('Día guardado', r.period === 'started' ? 'Anotamos el inicio de tu periodo.' : r.period === 'extended' ? 'Tu periodo se alargó hasta ese día.' : undefined);
      setDay(null);
    } catch (e) { toast.error(apiError(e, 'No se pudo guardar el día')); }
    finally { setSaving(false); }
  }
  async function clearDay(date: string) {
    try { await clearCycleDay(date); await load(); setDay(null); toast.info('Registro borrado'); }
    catch (e) { toast.error(apiError(e, 'No se pudo borrar')); }
  }
  async function periodStarted() {
    if (!data) return;
    try { await addCyclePeriod({ startDate: data.today }); await load(); toast.success('Periodo anotado', 'Hoy es el día 1 de tu ciclo.'); }
    catch (e) { toast.error(apiError(e, 'No se pudo anotar el periodo')); }
  }
  async function periodEnded() {
    const current = data?.periods.find((p) => p.startDate === data.snapshot?.periodStart);
    if (!data || !current) return;
    try { await updateCyclePeriod(current.id, { endDate: data.today }); await load(); toast.success('Periodo cerrado', 'Gracias: así tus promedios son más exactos.'); }
    catch (e) { toast.error(apiError(e, 'No se pudo cerrar el periodo')); }
  }

  const snap = data?.snapshot ?? null;
  const advice = data?.advice ?? null;
  const tone = snap ? `var(--cy-${snap.phase})` : 'var(--cy-follicular)';

  const header = (
    <motion.section variants={item} className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1 md:gap-2">
        <span className="hidden text-label-lg text-primary-text md:block">{longDate()}</span>
        <h1 className="relative self-start text-display-sm md:text-display-md">
          <Lettering text="Ciclo" />
          <span style={{ color: snap ? phaseFill(snap.phase) : 'rgb(var(--cy-follicular))' }}><SketchUnderline className="absolute -bottom-1.5 left-0 w-full md:-bottom-2.5" delay={0.75} /></span>
        </h1>
        <p className="max-w-[560px] text-body-md text-on-surface-light md:text-body-lg">Tu ciclo como cuatro estaciones: sabes dónde estás, qué esperar y cómo ajustar tu día.</p>
      </div>
      {snap && (
        snap.onPeriod && snap.periodOpen
          ? <Button variant="secondary" onClick={() => void periodEnded()}>Terminó mi periodo</Button>
          : !snap.onPeriod && <Button onClick={() => void periodStarted()}><Droplet aria-hidden className="size-4" />Me llegó el periodo</Button>
      )}
    </motion.section>
  );

  let body;
  if (!allowed) body = <Unavailable />;
  else if (state === 'loading' || !data) body = state === 'error' ? <ErrorState title="No pudimos abrir tu ciclo" onRetry={() => void load()} /> : <PageLoader label="Preparando tu ciclo…" />;
  else if (state === 'error') body = <ErrorState title="No pudimos abrir tu ciclo" onRetry={() => void load()} />;
  else if (!snap) body = <Setup today={data.today} onDone={(d) => { setData(d); setState('ready'); }} />;
  else {
    const meta = PHASE_META[snap.phase];
    const cycleStartOffset = (key: string) => daysBetween(snap.periodStart, key) + 1;
    const thisCycle = data.logs.filter((l) => l.date >= snap.periodStart);
    const bleedDays = thisCycle.filter((l) => isBleeding(l.flow)).map((l) => cycleStartOffset(l.date));
    const loggedDays = thisCycle.map((l) => cycleStartOffset(l.date));
    const nextLine = snap.lateDays > 0
      ? `Tu periodo va ${snap.lateDays} ${snap.lateDays === 1 ? 'día' : 'días'} tarde según tu promedio. Los ciclos varían; si te preocupa, consulta con un profesional de salud.`
      : snap.onPeriod
        ? `Estás en tu periodo: día ${snap.cycleDay}.`
        : `Próximo periodo hacia el ${longDay(snap.nextPeriod)} (en ${snap.daysUntilNextPeriod} ${snap.daysUntilNextPeriod === 1 ? 'día' : 'días'}).`;

    body = (
      <>
        {/* La rueda y lo que significa hoy */}
        <motion.section variants={item} aria-label="Hoy en tu ciclo" className="grid items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12">
          <SeasonWheel shape={snap.shape} cycleDay={snap.cycleDay} phase={snap.phase} bleedDays={bleedDays} loggedDays={loggedDays}>
            <span className="text-label-lg" style={{ color: phaseInk(snap.phase) }}>{meta.season}</span>
            <span className="font-mono text-display-md leading-none tabular-nums md:text-display-lg">{snap.cycleDay}</span>
            <span className="text-body-sm text-on-surface-light">día de tu ciclo</span>
          </SeasonWheel>
          <div className="flex min-w-0 flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-2 text-label-lg" style={{ color: phaseInk(snap.phase) }}>
                <meta.icon aria-hidden className="size-4" strokeWidth={1.75} />{meta.season} interior
              </span>
              <h2 className="text-display-sm">{meta.name}</h2>
              <p className="text-body-md text-on-surface">
                Día {snap.phaseDay} de {snap.phaseLength} de esta fase. {meta.summary}
              </p>
            </div>
            <p className={cn('rounded-xl px-4 py-3 text-body-md', snap.lateDays > 0 ? 'bg-warning/[var(--lq-soft-alpha)] text-on-surface' : 'bg-surface-variant text-on-surface')}>{nextLine}</p>
            {advice && (
              <dl className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <dt className="text-label-lg text-on-surface">Energía prevista</dt>
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
                    <span className="text-body-md"><b>{energyLabel(advice.energy)}</b> <span className="text-on-surface-light">· {SOURCE_LABEL[advice.energySource]}</span></span>
                  </dd>
                </div>
                <div className="flex flex-col gap-1.5">
                  <dt className="text-label-lg text-on-surface">{advice.symptomsSource === 'today' ? 'Síntomas de hoy' : 'Puede que notes'}</dt>
                  <dd className="text-body-md text-on-surface">
                    {advice.symptoms.length ? advice.symptoms.map((s) => SYMPTOM_LABELS[s]).join(', ') : <span className="text-on-surface-light">Nada que destacar por ahora.</span>}
                  </dd>
                </div>
              </dl>
            )}
            <p className="text-body-sm text-on-surface-light">
              Ventana fértil estimada: del {longDay(snap.fertileStart)} al {longDay(snap.fertileEnd)}. Es una estimación: no sirve como método anticonceptivo.
            </p>
          </div>
        </motion.section>

        {/* El ciclo en el resto de la app */}
        {advice && (
          <motion.section variants={item} aria-labelledby="cy-today" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="cy-today" className="text-heading-lg">Para hoy</h2>
              <p className="text-body-md text-on-surface-light">{advice.note}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Card padding="lg" className="flex flex-col gap-3">
                <span className="flex items-center gap-2 text-label-lg text-on-surface"><Dumbbell aria-hidden className="size-4" strokeWidth={1.75} />Coliseo · {intensityLine(advice.intensity)}</span>
                <h3 className="text-heading-sm">{advice.training.title}</h3>
                <p className="text-body-md text-on-surface">{advice.training.body}</p>
                <p className="text-body-sm text-on-surface"><span className="font-semibold">Carga sugerida:</span> {advice.training.load}.</p>
                <ul className="flex flex-wrap gap-1.5">{advice.training.ideas.map((i) => <li key={i} className="rounded-full bg-surface-variant px-3 py-1.5 text-body-sm">{i}</li>)}</ul>
                <Link to="/coliseo" className="mt-auto inline-flex min-h-11 items-center gap-1 self-start font-semibold text-primary-text underline-offset-4 hover:underline">Ir al Coliseo<ArrowUpRight aria-hidden className="size-4" /></Link>
              </Card>
              <Card padding="lg" className="flex flex-col gap-3">
                <span className="flex items-center gap-2 text-label-lg text-on-surface"><ListChecks aria-hidden className="size-4" strokeWidth={1.75} />Hábitos</span>
                <h3 className="text-heading-sm">{advice.habits.title}</h3>
                <p className="text-body-md text-on-surface">{advice.habits.body}</p>
                {!advice.pauseFitness && <p className="text-body-sm text-on-surface-light">Si hoy anotas energía baja o cólicos, Hábitos te dejará marcar descanso en los de ejercicio sin romper su racha.</p>}
                <Link to="/habits" className="mt-auto inline-flex min-h-11 items-center gap-1 self-start font-semibold text-primary-text underline-offset-4 hover:underline">Ir a Hábitos<ArrowUpRight aria-hidden className="size-4" /></Link>
              </Card>
            </div>
          </motion.section>
        )}

        {/* Registro de hoy y calendario */}
        <motion.div variants={item} className="grid items-start gap-6 lg:grid-cols-2">
          <Card as="section" aria-labelledby="cy-log" padding="lg" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="cy-log" className="text-heading-lg">¿Cómo estás hoy?</h2>
              <p className="text-body-sm text-on-surface-light">Lo que anotes ajusta los consejos de hoy y enseña a la app tus patrones.</p>
            </div>
            <DayLogForm key={`today-${data.todayLog ? JSON.stringify(data.todayLog) : 'empty'}`} initial={data.todayLog} saving={saving} onSave={(input) => saveDay(data.today, input)} onClear={() => clearDay(data.today)} />
          </Card>
          <Card as="section" aria-labelledby="cy-cal" padding="lg" className="flex flex-col gap-4">
            <div className="flex items-start gap-2">
              <CalendarHeart aria-hidden className="mt-1 size-5 text-on-surface-light" strokeWidth={1.75} />
              <div>
                <h2 id="cy-cal" className="text-heading-lg">Calendario</h2>
                <p className="text-body-sm text-on-surface-light">Toca un día para ver o anotar cómo fue. El borde punteado es tu próximo periodo previsto.</p>
              </div>
            </div>
            <CycleCalendar data={data} selected={day?.key ?? null} onSelect={setDay} />
          </Card>
        </motion.div>

        {/* Las cuatro estaciones de este ciclo */}
        <motion.section variants={item} aria-labelledby="cy-seasons" className="flex flex-col gap-4">
          <h2 id="cy-seasons" className="text-heading-lg">Tus cuatro estaciones</h2>
          <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {PHASES.map((p) => {
              const r = snap.shape.ranges[p];
              const m = PHASE_META[p];
              const now = p === snap.phase;
              if (r.end < r.start) return null;
              return (
                <li
                  key={p} aria-current={now ? 'step' : undefined}
                  className={cn('flex flex-col gap-2 rounded-2xl border p-4', now ? 'border-transparent' : 'border-border bg-surface')}
                  style={now ? { background: phaseFill(p, 0.1), boxShadow: `inset 0 0 0 1.5px ${phaseFill(p, 0.55)}` } : undefined}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-label-lg" style={{ color: phaseInk(p) }}><m.icon aria-hidden className="size-4" strokeWidth={1.75} />{m.season}</span>
                    <span className="font-mono text-label-md tabular-nums text-on-surface-light">días {r.start}–{p === 'luteal' ? Math.max(r.end, snap.cycleDay) : r.end}</span>
                  </span>
                  <h3 className="text-heading-sm">{m.name}{now && <span className="sr-only"> (estás aquí)</span>}</h3>
                  <p className="text-body-sm text-on-surface">{m.summary}</p>
                </li>
              );
            })}
          </ol>
        </motion.section>

        <motion.section variants={item} aria-labelledby="cy-history" className="flex flex-col gap-4">
          <h2 id="cy-history" className="text-heading-lg">Tus ciclos</h2>
          <PeriodHistory data={data} onChanged={load} />
        </motion.section>

        <motion.p variants={item} className="flex max-w-[70ch] items-start gap-2 text-body-sm text-on-surface-light">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          Las predicciones son estimaciones a partir de tus registros y de promedios: no sustituyen el consejo médico ni sirven como anticonceptivo. Tus datos del ciclo son privados y no los lee el Sabio.
        </motion.p>

        <ResponsiveDialog open={Boolean(day)} onClose={() => setDay(null)} title={day ? new Date(`${day.key}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}>
          {day && (
            <div className="flex flex-col gap-4">
              <p className="text-body-md text-on-surface">
                {day.phase ? <><span style={{ color: phaseInk(day.phase) }} className="font-semibold">{PHASE_META[day.phase].name}</span>{day.predicted ? ' (prevista)' : ''}.</> : 'Sin fase calculada para este día.'}
                {day.expectedPeriod && ' Es uno de los días previstos de tu próximo periodo.'}
              </p>
              {day.key <= data.today
                ? <DayLogForm key={day.key} initial={day.log} saving={saving} onSave={(input) => saveDay(day.key, input)} onClear={() => clearDay(day.key)} />
                : <p className="text-body-sm text-on-surface-light">Aún no llega: podrás anotarlo ese día.</p>}
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
