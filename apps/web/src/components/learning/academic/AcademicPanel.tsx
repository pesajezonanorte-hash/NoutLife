// Académico (pestaña de Aprendizaje): el periodo de un vistazo. Arriba, el aro con el promedio del periodo
// (al girarlo, cada materia frente a la nota de aprobar); después «dónde mejorar», las materias, los
// compromisos con fecha y qué tan bien predice la persona sus notas. Las cuentas viven en lib/academic.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, BarChart3, CalendarClock, Check, CheckCircle2, CircleDashed, GraduationCap, ListChecks, Pencil, Plus, RotateCcw, Target, Trash2, TrendingDown,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { item, stagger } from '@/lib/motion';
import { AccordionItem, Badge, Button, Card, ChipGroup, EmptyState, ErrorState, IconChip, PageLoader, ProgressBar, ProgressRing, type BadgeVariant, type Tone } from '@/components/ui/lq';
import { FlipCard3D, FlipToggle } from '@/components/stats/FlipCard3D';
import { useToast } from '@/hooks/useToast';
import { INTL_LOCALE, useLocale, useText } from '@/lib/i18n';
import { coversFor } from '@/components/notebook/paper';
import {
  CALIBRATION_MIN, calibration, courseStats, formatGrade, improvementAreas, live, periodStats, periodsOf, upcoming,
  type CourseStatus, type Insight, type InsightKind,
} from '@/lib/academic';
import * as api from '@/services/academic.service';
import type { AcademicCourse, AcademicTask } from '@/services/academic.service';
import { ACADEMIC_COPY, type AcademicText } from './copy';
import { CourseSheet, whenLabel } from './CourseSheet';
import { CourseDialog, TaskDialog } from './forms';

const STATUS: Record<CourseStatus, { badge: BadgeVariant; icon: LucideIcon }> = {
  empty: { badge: 'neutral', icon: CircleDashed },
  passed: { badge: 'success', icon: CheckCircle2 },
  onTrack: { badge: 'primary', icon: Check },
  atRisk: { badge: 'warning', icon: AlertTriangle },
  lost: { badge: 'error', icon: AlertTriangle },
};
const INSIGHT: Record<InsightKind, { icon: LucideIcon; tone: Tone }> = {
  lost: { icon: AlertTriangle, tone: 'error' },
  needed: { icon: Target, tone: 'warning' },
  topics: { icon: ListChecks, tone: 'info' },
  weakKind: { icon: BarChart3, tone: 'forest' },
  trend: { icon: TrendingDown, tone: 'warning' },
};
const MAX_INSIGHTS = 4;

function insightText(t: AcademicText, i: Insight, fmt: (n: number) => string): string {
  switch (i.kind) {
    case 'lost': return t.insight.lost(i.course, fmt(i.value!));
    case 'needed': return t.insight.needed(i.course, fmt(i.value!));
    case 'topics': return t.insight.topics(i.course, i.count!, i.title!, whenLabel(t, i.days!));
    case 'weakKind': return t.insight.weakKind(i.course, t.kindsPlural[i.gradeKind!], fmt(i.value!), fmt(i.other!));
    case 'trend': return t.insight.trend(i.course, fmt(i.value!), fmt(i.other!));
  }
}

type Archived = { key: string; label: string; restore: () => Promise<unknown>; remove: () => Promise<unknown> };

export function AcademicPanel() {
  const t = useText(ACADEMIC_COPY);
  const locale = useLocale();
  const toast = useToast();
  const [courses, setCourses] = useState<AcademicCourse[]>([]);
  const [tasks, setTasks] = useState<AcademicTask[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [picked, setPicked] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [courseDialog, setCourseDialog] = useState<{ course: AcademicCourse | null } | null>(null);
  const [taskDialog, setTaskDialog] = useState<{ task: AcademicTask | null } | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setState('loading');
    try {
      const data = await api.fetchAcademic();
      setCourses(data.courses); setTasks(data.tasks); setState('ready');
    } catch { if (!silent) setState('error'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const putCourse = (c: AcademicCourse) => setCourses((list) => (list.some((x) => x.id === c.id) ? list.map((x) => (x.id === c.id ? c : x)) : [...list, c]));
  const putTask = (task: AcademicTask) => setTasks((list) => (list.some((x) => x.id === task.id) ? list.map((x) => (x.id === task.id ? task : x)) : [...list, task]));

  const periods = useMemo(() => periodsOf(courses), [courses]);
  const period = picked && periods.includes(picked) ? picked : periods[0] ?? '';
  const inPeriod = useMemo(() => live(courses).filter((c) => c.period === period), [courses, period]);
  const stats = useMemo(() => periodStats(inPeriod), [inPeriod]);
  const insights = useMemo(() => improvementAreas(inPeriod).slice(0, MAX_INSIGHTS), [inPeriod]);
  const agenda = useMemo(() => upcoming(live(courses), tasks), [courses, tasks]);
  const cal = useMemo(() => calibration(courses), [courses]);
  const done = live(tasks).filter((task) => task.done);
  const opened = courses.find((c) => c.id === openId && !c.archivedAt) ?? null;
  const fmt = useCallback((n: number, max = stats.scaleMax) => formatGrade(n, max, INTL_LOCALE[locale]), [stats.scaleMax, locale]);
  const covers = coversFor(locale);

  /** Acción suelta (cumplir, restaurar, eliminar) con aviso si falla. */
  async function act(action: () => Promise<unknown>, ok?: string) {
    try { await action(); if (ok) toast.success(ok); }
    catch (err) { toast.error(api.apiMessage(err, t.actionFail)); }
  }
  const toggleTask = (task: AcademicTask) => act(async () => putTask(await api.updateTask(task.id, { done: !task.done })), task.done ? t.undone : t.markDone);

  // Todo lo archivado, en una sola lista: se restaura o se elimina desde aquí.
  const archived: Archived[] = [
    ...courses.filter((c) => c.archivedAt).map((c): Archived => ({
      key: c.id, label: `${c.name} · ${c.period}`,
      restore: async () => putCourse(await api.updateCourse(c.id, { archived: false })),
      remove: async () => { await api.deleteCourse(c.id); setCourses((list) => list.filter((x) => x.id !== c.id)); },
    })),
    ...live(courses).flatMap((c) => [
      ...c.grades.filter((g) => g.archivedAt).map((g): Archived => ({
        key: g.id, label: `${g.title} · ${c.name}`,
        restore: async () => putCourse(await api.updateGrade(g.id, { archived: false })),
        remove: async () => putCourse(await api.deleteGrade(g.id)),
      })),
      ...c.topics.filter((x) => x.archivedAt).map((x): Archived => ({
        key: x.id, label: `${x.title} · ${c.name}`,
        restore: async () => putCourse(await api.updateTopic(x.id, { archived: false })),
        remove: async () => putCourse(await api.deleteTopic(x.id)),
      })),
    ]),
    ...tasks.filter((task) => task.archivedAt).map((task): Archived => ({
      key: task.id, label: task.title,
      restore: async () => putTask(await api.updateTask(task.id, { archived: false })),
      remove: async () => { await api.deleteTask(task.id); setTasks((list) => list.filter((x) => x.id !== task.id)); },
    })),
  ];

  if (state === 'loading') return <PageLoader label={t.loading} />;
  if (state === 'error') return <ErrorState title={t.loadFail} description={t.loadFailDesc} onRetry={() => void load()} />;

  const dialogs = (
    <>
      <CourseSheet
        course={opened} cal={cal} locked={courseDialog !== null}
        onClose={() => setOpenId(null)} onChange={putCourse} onEdit={(course) => setCourseDialog({ course })}
        onDeleted={(id) => { setOpenId(null); setCourses((list) => list.filter((x) => x.id !== id)); }}
      />
      <CourseDialog
        open={courseDialog !== null} course={courseDialog?.course ?? null} period={period}
        onClose={() => setCourseDialog(null)}
        onSaved={(course) => { putCourse(course); setPicked(course.period); setCourseDialog(null); }}
      />
      <TaskDialog
        open={taskDialog !== null} task={taskDialog?.task ?? null} courses={live(courses)}
        onClose={() => setTaskDialog(null)}
        onSaved={(task) => { putTask(task); setTaskDialog(null); }}
        onDeleted={(id) => { setTasks((list) => list.filter((x) => x.id !== id)); setTaskDialog(null); }}
      />
    </>
  );

  const archivedList = archived.length > 0 && (
    <AccordionItem title={t.archived(archived.length)} open={showArchived} onToggle={() => setShowArchived((v) => !v)}>
      <ul className="flex flex-col">
        {archived.map((a) => (
          <li key={a.key} className="flex min-h-12 flex-wrap items-center gap-2 border-b border-border py-1 last:border-0">
            <span className="min-w-0 flex-1 truncate text-body-md">{a.label}</span>
            <Button variant="ghost" size="sm" onClick={() => void act(a.restore, t.restored)}><RotateCcw aria-hidden className="size-4" strokeWidth={1.75} />{t.restore}</Button>
            <Button variant="ghost" size="sm" className="text-error-text" onClick={() => void act(a.remove, t.deleted)}><Trash2 aria-hidden className="size-4" strokeWidth={1.75} />{t.delete}</Button>
          </li>
        ))}
      </ul>
    </AccordionItem>
  );

  if (live(courses).length === 0) {
    return (
      <>
        <Card variant="elevated" padding="lg">
          <EmptyState
            icon={GraduationCap} title={t.emptyTitle} description={t.emptyDesc} className="py-8"
            action={<Button onClick={() => setCourseDialog({ course: null })}><Plus aria-hidden className="size-4" strokeWidth={2} />{t.emptyCta}</Button>}
          />
        </Card>
        {archivedList}
        {dialogs}
      </>
    );
  }

  // El sesgo y el desvío vienen como parte de la escala: se muestran en puntos de la escala del periodo.
  const points = (part: number) => fmt(Math.abs(part) * (stats.scaleMax - stats.scaleMin));
  const calText = !cal ? null
    : cal.n < CALIBRATION_MIN ? t.calibrationFew(cal.n, CALIBRATION_MIN)
    : Math.abs(cal.bias) < 0.03 ? t.calibrationGood(points(cal.error))
    : cal.bias > 0 ? t.calibrationOver(points(cal.bias), points(cal.error))
    : t.calibrationUnder(points(cal.bias), points(cal.error));

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-6 md:gap-8">
      <motion.div variants={item} className="flex flex-wrap items-center justify-between gap-3">
        <div className="-mx-4 min-w-0 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
          <ChipGroup label={t.period} value={period} onChange={setPicked} className="flex-nowrap" options={periods.map((p) => ({ value: p, label: p }))} />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="md" onClick={() => setTaskDialog({ task: null })}><Plus aria-hidden className="size-4" strokeWidth={2} />{t.addTask}</Button>
          <Button size="md" onClick={() => setCourseDialog({ course: null })}><Plus aria-hidden className="size-4" strokeWidth={2} />{t.addCourse}</Button>
        </div>
      </motion.div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* El aro del periodo: al girarlo, cada materia frente a la nota de aprobar. */}
        <motion.div variants={item}>
          <FlipCard3D
            label={t.average} trigger="toggle" peek faceClassName="flex flex-col gap-5 p-6"
            front={(
              <>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-heading-sm">{t.average}</h2>
                  <FlipToggle />
                </div>
                <div className="flex flex-wrap items-center gap-6">
                  <ProgressRing value={(stats.ratio ?? 0) * 100} size={148} stroke={9} label={t.average} valueText={stats.average === null ? t.noGrades : `${fmt(stats.average)} ${t.of(fmt(stats.scaleMax))}`}>
                    <span className="lq-emboss font-mono text-display-sm tabular-nums">{stats.average === null ? '—' : fmt(stats.average)}</span>
                    <span className="text-body-sm text-on-surface-light">{t.of(fmt(stats.scaleMax))}</span>
                  </ProgressRing>
                  <dl className="grid flex-1 grid-cols-3 gap-2 sm:grid-cols-1">
                    {([[t.credits, String(stats.credits)], [t.gradedShare, `${Math.round(stats.gradedWeight)} %`], [t.atRisk, String(stats.atRisk)]] as const).map(([label, value]) => (
                      <div key={label} className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                        <dt className="text-body-sm text-on-surface-light">{label}</dt>
                        <dd className={cn('font-mono text-heading-sm tabular-nums', label === t.atRisk && stats.atRisk > 0 && 'text-warning-text')}>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <p className="text-body-sm text-on-surface-light">{t.passLine(fmt(stats.passGrade))}</p>
              </>
            )}
            back={(
              <>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-heading-sm">{t.byCourse}</h2>
                  <FlipToggle />
                </div>
                <ul className="flex flex-col gap-3">
                  {inPeriod.map((c) => {
                    const s = courseStats(c);
                    const span = c.scaleMax - c.scaleMin;
                    return (
                      <li key={c.id} className="flex flex-col gap-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 truncate text-body-md">{c.name}</span>
                          <span className="font-mono text-label-lg tabular-nums">{s.average === null ? '—' : fmt(s.average, c.scaleMax)}</span>
                        </div>
                        {/* Barra de la escala con la marca de la nota de aprobar. */}
                        <div className="relative h-2 rounded-full bg-surface-variant">
                          {s.average !== null && <span className={cn('absolute inset-y-0 left-0 rounded-full', s.average < c.passGrade ? 'bg-warning' : 'bg-primary')} style={{ width: `${((s.average - c.scaleMin) / span) * 100}%` }} />}
                          <span aria-hidden className="absolute -inset-y-1 w-0.5 rounded-full bg-on-background/60" style={{ left: `${((c.passGrade - c.scaleMin) / span) * 100}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-body-sm text-on-surface-light">{t.passLine(fmt(stats.passGrade))}</p>
              </>
            )}
          />
        </motion.div>

        <motion.div variants={item}>
          <Card as="section" padding="lg" aria-labelledby="ac-improve" className="flex h-full flex-col gap-4">
            <h2 id="ac-improve" className="text-heading-sm">{t.improve}</h2>
            {insights.length === 0 ? (
              <p className="text-body-md text-on-surface-light">{t.improveNone}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {insights.map((i) => {
                  const scale = inPeriod.find((c) => c.id === i.courseId)?.scaleMax ?? stats.scaleMax;
                  return (
                    <li key={`${i.courseId}-${i.kind}`} className="flex items-start gap-3">
                      <IconChip icon={INSIGHT[i.kind].icon} tone={INSIGHT[i.kind].tone} size="sm" />
                      <p className="min-w-0 flex-1 text-body-md text-on-surface">{insightText(t, i, (n) => fmt(n, scale))}</p>
                      <Button variant="ghost" size="sm" onClick={() => setOpenId(i.courseId)}>{t.open}</Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </motion.div>
      </div>

      <motion.section variants={item} aria-labelledby="ac-courses" className="flex flex-col gap-4">
        <h2 id="ac-courses" className="text-heading-lg">{t.courses}</h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {inPeriod.map((c) => {
            const s = courseStats(c);
            const meta = STATUS[s.status];
            const line = s.status === 'empty' ? t.noGradesYet
              : s.neededToPass === null ? (s.status === 'passed' ? t.closedPass : t.closedFail)
              : s.status === 'passed' ? t.secured
              : t.needPass(fmt(s.neededToPass, c.scaleMax));
            return (
              <Card as="li" key={c.id} interactive padding="lg" className="relative flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span aria-hidden className={cn('mt-1.5 size-3 shrink-0 rounded-full', covers[c.color]?.className)} />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-heading-sm [overflow-wrap:anywhere]">
                      <button type="button" aria-haspopup="dialog" onClick={() => setOpenId(c.id)} className="text-left after:absolute after:inset-0 after:rounded-2xl after:content-['']">{c.name}</button>
                    </h3>
                    {c.teacher && <p className="truncate text-body-sm text-on-surface-light">{c.teacher}</p>}
                  </div>
                  <span className="font-mono text-display-sm tabular-nums">{s.average === null ? '—' : fmt(s.average, c.scaleMax)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={meta.badge} icon={meta.icon}>{t.status[s.status]}</Badge>
                  <span className="text-body-sm text-on-surface">{line}</span>
                </div>
                <div className="mt-auto flex flex-col gap-1.5">
                  <ProgressBar value={s.gradedWeight} tone={s.status === 'atRisk' || s.status === 'lost' ? 'warning' : 'primary'} label={c.name} valueText={t.gradedOf(Math.round(s.gradedWeight))} />
                  <span className="text-body-sm text-on-surface-light">{t.gradedOf(Math.round(s.gradedWeight))}</span>
                </div>
              </Card>
            );
          })}
        </ul>
      </motion.section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <motion.div variants={item}>
          <Card as="section" padding="lg" aria-labelledby="ac-agenda" className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 id="ac-agenda" className="text-heading-sm">{t.agenda}</h2>
              <Button variant="ghost" size="sm" onClick={() => setTaskDialog({ task: null })}><Plus aria-hidden className="size-4" strokeWidth={2} />{t.addTask}</Button>
            </div>
            {agenda.length === 0 ? (
              <p className="text-body-md text-on-surface-light">{t.agendaEmpty}</p>
            ) : (
              <ul className="flex flex-col">
                {agenda.map((u, i) => {
                  const task = u.type === 'task' ? tasks.find((x) => x.id === u.id) : undefined;
                  const urgent = u.days <= 1;
                  return (
                    <li key={`${u.type}-${u.id}`} className={cn('flex min-h-14 items-center gap-3 py-1', i < agenda.length - 1 && 'border-b border-border')}>
                      {task ? (
                        <button
                          type="button" role="checkbox" aria-checked={false} aria-label={`${t.markDone}: ${u.title}`} onClick={() => void toggleTask(task)}
                          className="group flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-primary"
                        >
                          <span className="flex size-6 items-center justify-center rounded-full border-2 border-border-strong text-transparent transition-colors group-hover:border-primary group-hover:text-primary-text">
                            <Check aria-hidden className="size-4" strokeWidth={2.5} />
                          </span>
                        </button>
                      ) : (
                        <span className="flex size-11 shrink-0 items-center justify-center"><IconChip icon={CalendarClock} tone="info" size="sm" /></span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body-md">{u.title}</p>
                        <p className="truncate text-body-sm text-on-surface-light">{[u.type === 'exam' ? t.exam : task ? t.taskKinds[task.kind] : '', u.course].filter(Boolean).join(' · ')}</p>
                      </div>
                      <Badge variant={u.days < 0 ? 'error' : urgent ? 'warning' : 'neutral'}>{whenLabel(t, u.days)}</Badge>
                      {task
                        ? <Button variant="icon" aria-label={`${t.edit}: ${u.title}`} onClick={() => setTaskDialog({ task })}><Pencil aria-hidden className="size-5" strokeWidth={1.75} /></Button>
                        : <Button variant="ghost" size="sm" onClick={() => setOpenId(u.courseId)}>{t.open}</Button>}
                    </li>
                  );
                })}
              </ul>
            )}
            {done.length > 0 && (
              <>
                <Button variant="ghost" size="sm" className="self-start" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)}>{showDone ? t.hideDone : t.showDone(done.length)}</Button>
                {showDone && (
                  <ul className="flex flex-col">
                    {done.map((task) => (
                      <li key={task.id} className="flex min-h-12 items-center gap-3">
                        <button
                          type="button" role="checkbox" aria-checked aria-label={`${t.undone}: ${task.title}`} onClick={() => void toggleTask(task)}
                          className="flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-primary"
                        >
                          <span className="flex size-6 items-center justify-center rounded-full bg-primary-strong text-on-primary"><Check aria-hidden className="size-4" strokeWidth={2.5} /></span>
                        </button>
                        <span className="min-w-0 flex-1 truncate text-body-md text-on-surface-light line-through">{task.title}</span>
                        <Button variant="icon" aria-label={`${t.edit}: ${task.title}`} onClick={() => setTaskDialog({ task })}><Pencil aria-hidden className="size-5" strokeWidth={1.75} /></Button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card as="section" padding="lg" aria-labelledby="ac-cal" className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 id="ac-cal" className="text-heading-sm">{t.calibration}</h2>
              {cal && <Badge>{t.predictions(cal.n)}</Badge>}
            </div>
            <p className="text-body-md text-on-surface">{calText ?? t.calibrationFew(0, CALIBRATION_MIN)}</p>
            <p className="text-body-sm text-on-surface-light">{t.calibrationHow}</p>
          </Card>
        </motion.div>
      </div>

      {archivedList && <motion.div variants={item}>{archivedList}</motion.div>}
      {dialogs}
    </motion.div>
  );
}
