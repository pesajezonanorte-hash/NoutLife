// Detalle de una materia: sus notas (con lo que hace falta para aprobar y para la meta) y sus temas con el
// nivel de dominio de cada uno. Todo se edita, archiva o elimina desde aquí.
import { useState, type FormEvent } from 'react';
import { Archive, CalendarDays, Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button, Input, ProgressBar, ResponsiveDialog, SegmentedControl, Select } from '@/components/ui/lq';
import { useToast } from '@/hooks/useToast';
import { INTL_LOCALE, useLocale, useText } from '@/lib/i18n';
import { courseStats, daysUntil, formatGrade, live, type Calibration } from '@/lib/academic';
import * as api from '@/services/academic.service';
import type { AcademicCourse, AcademicGrade, AcademicTopic, Mastery } from '@/services/academic.service';
import { ACADEMIC_COPY, type AcademicText } from './copy';
import { ConfirmDelete, GradeDialog } from './forms';

/** «hoy», «mañana», «en 5 días», «venció hace 2 días». */
export function whenLabel(t: AcademicText, days: number): string {
  if (days < 0) return t.when.overdue(-days);
  return days === 0 ? t.when.today : days === 1 ? t.when.tomorrow : t.when.inDays(days);
}

/** Dominio de un tema: tres pasos (visto, practicado, dominado). Tocar el paso actual lo deshace. */
function MasterySteps({ topic, onChange }: { topic: AcademicTopic; onChange: (m: Mastery) => void }) {
  const t = useText(ACADEMIC_COPY);
  return (
    <div role="radiogroup" aria-label={t.masteryOf(topic.title)} className="flex shrink-0 items-center gap-1">
      {([1, 2, 3] as Mastery[]).map((level) => {
        const on = topic.mastery >= level;
        return (
          <button
            key={level} type="button" role="radio" aria-checked={topic.mastery === level} aria-label={t.mastery[level]} title={t.mastery[level]}
            onClick={() => onChange(topic.mastery === level ? ((level - 1) as Mastery) : level)}
            className="group flex size-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-primary"
          >
            <span className={cn(
              'block size-5 rounded-full border-2 transition-[background-color,border-color,transform] duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] group-active:scale-90',
              on ? 'border-[rgb(var(--lq-jade-500))] bg-[rgb(var(--lq-jade-500))]' : 'border-border-strong bg-transparent group-hover:border-[rgb(var(--lq-jade-500))]',
              on && level === 3 && 'scale-110',
            )} />
          </button>
        );
      })}
    </div>
  );
}

export function CourseSheet({ course, cal, locked, onClose, onChange, onEdit, onDeleted }: {
  course: AcademicCourse | null;
  cal: Calibration | null;
  /** Hay otro diálogo encima (editar la materia): Escape lo cierra a él, no a este. */
  locked?: boolean;
  onClose: () => void;
  onChange: (course: AcademicCourse) => void;
  onEdit: (course: AcademicCourse) => void;
  onDeleted: (id: string) => void;
}) {
  const t = useText(ACADEMIC_COPY);
  const locale = useLocale();
  const toast = useToast();
  const [tab, setTab] = useState<'grades' | 'topics'>('grades');
  const [gradeDialog, setGradeDialog] = useState<{ grade: AcademicGrade | null } | null>(null);
  const [topicTitle, setTopicTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  if (!course) return null;

  const fmt = (n: number) => formatGrade(n, course.scaleMax, INTL_LOCALE[locale]);
  const s = courseStats(course);
  const grades = live(course.grades);
  const topics = live(course.topics);
  const mastered = topics.filter((x) => x.mastery === 3).length;
  const pendingPct = Math.round(s.pendingWeight);
  const assigned = Math.round(s.assignedWeight * 10) / 10;

  /** Una escritura sobre la materia: la respuesta la sustituye entera. */
  async function apply(action: () => Promise<AcademicCourse>, ok?: string) {
    try { onChange(await action()); if (ok) toast.success(ok); }
    catch (err) { toast.error(api.apiMessage(err, t.actionFail)); }
  }

  async function addTopic(e: FormEvent) {
    e.preventDefault();
    const title = topicTitle.trim();
    if (!title) return;
    setTopicTitle('');
    await apply(() => api.createTopic(course!.id, { title }));
  }

  async function remove() {
    setBusy(true);
    try { await api.deleteCourse(course!.id); toast.success(t.deleted); setConfirm(false); onDeleted(course!.id); }
    catch (err) { toast.error(api.apiMessage(err, t.actionFail)); }
    finally { setBusy(false); }
  }

  const need = (value: number | null) => (value === null ? t.nothingLeft : value <= course.scaleMin ? fmt(course.scaleMin) : fmt(value));
  /** Una nota que pasa de la máxima ya no se puede sacar: se dice en vez de dejar el número solo. */
  const hint = (value: number | null, base: string) => (value !== null && value > course.scaleMax ? t.outOfReach(fmt(course.scaleMax)) : base);
  const summary: Array<[string, string, string?]> = [
    [t.yourAverage, s.average === null ? '—' : fmt(s.average), t.gradedOf(Math.round(s.gradedWeight))],
    [t.toPass, need(s.neededToPass), s.neededToPass === null ? undefined : hint(s.neededToPass, t.inRemaining(pendingPct))],
    ...(course.targetGrade !== null ? [[t.toTarget, need(s.neededForTarget), hint(s.neededForTarget, `${t.target}: ${fmt(course.targetGrade)}`)] as [string, string, string]] : []),
  ];

  // Los diálogos escuchan Escape en el documento: con uno encima, este no debe cerrarse también.
  const covered = locked || gradeDialog !== null || confirm;

  return (
    <>
      <ResponsiveDialog open onClose={covered ? () => undefined : onClose} title={course.name} className="md:max-w-[680px]">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{course.period}</Badge>
            {course.teacher && <span className="text-body-sm text-on-surface-light">{course.teacher}</span>}
            <Badge variant={s.status === 'lost' || s.status === 'atRisk' ? 'warning' : s.status === 'empty' ? 'neutral' : 'success'}>{t.status[s.status]}</Badge>
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {summary.map(([label, value, note]) => (
              <div key={label} className="lq-well flex flex-col gap-0.5 p-3">
                <dt className="text-body-sm text-on-surface-light">{label}</dt>
                <dd className={cn('font-mono text-heading-md tabular-nums', s.status === 'lost' && label === t.toPass && 'text-error-text')}>{value}</dd>
                {note && <dd className="text-body-sm text-on-surface-light">{note}</dd>}
              </div>
            ))}
          </dl>

          <SegmentedControl
            label={t.courseView} value={tab} onChange={setTab}
            options={[{ value: 'grades', label: `${t.tabGrades} · ${grades.length}` }, { value: 'topics', label: `${t.tabTopics} · ${topics.length}` }]}
          />

          {tab === 'grades' ? (
            <section className="flex flex-col gap-3">
              {grades.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border-strong p-4 text-body-md text-on-surface-light">{t.gradesEmpty}</p>
              ) : (
                <ul className="flex flex-col">
                  {grades.map((g, i) => {
                    const days = g.date ? daysUntil(g.date) : null;
                    return (
                      <li key={g.id} className={cn('relative grid min-h-16 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-2', i < grades.length - 1 && 'border-b border-border')}>
                        <div className="min-w-0">
                          <button type="button" aria-haspopup="dialog" onClick={() => setGradeDialog({ grade: g })} className="block max-w-full truncate text-left text-body-md font-semibold after:absolute after:inset-0 after:content-['']">{g.title}</button>
                          <p className="truncate text-body-sm text-on-surface-light">
                            {t.kinds[g.kind]}
                            {g.score === null && days !== null && <> · <CalendarDays aria-hidden className="mb-0.5 inline size-3.5" /> {whenLabel(t, days)}</>}
                            {g.predicted !== null && <> · {g.score === null ? t.predictedIs(fmt(g.predicted)) : t.predictedWas(fmt(g.predicted))}</>}
                          </p>
                        </div>
                        <span className="font-mono text-body-sm tabular-nums text-on-surface-light">{t.weightPct(g.weight)}</span>
                        {g.score === null
                          ? <Badge variant="info">{t.pending}</Badge>
                          : <span className={cn('min-w-12 text-right font-mono text-heading-sm tabular-nums', g.score < course.passGrade ? 'text-error-text' : 'text-on-background')}>{fmt(g.score)}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-body-sm text-on-surface-light">
                  {t.weightsSum(assigned)}{assigned < 100 && grades.length > 0 ? `. ${t.weightsMissing(Math.round((100 - assigned) * 10) / 10)}` : ''}
                </p>
                <Button size="md" onClick={() => setGradeDialog({ grade: null })}><Plus aria-hidden className="size-4" strokeWidth={2} />{t.addGrade}</Button>
              </div>
            </section>
          ) : (
            <section className="flex flex-col gap-3">
              {topics.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <ProgressBar value={(mastered / topics.length) * 100} tone="success" label={t.tabTopics} valueText={t.masteryProgress(mastered, topics.length)} />
                  <span className="text-body-sm text-on-surface-light">{t.masteryProgress(mastered, topics.length)}</span>
                </div>
              )}
              {topics.length === 0 && <p className="rounded-2xl border border-dashed border-border-strong p-4 text-body-md text-on-surface-light">{t.topicsEmpty}</p>}
              <ul className="flex flex-col">
                {topics.map((topic, i) => (
                  <li key={topic.id} className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5', i < topics.length - 1 && 'border-b border-border')}>
                    <div className="min-w-0 flex-[1_1_12rem]">
                      <p className={cn('text-body-md [overflow-wrap:anywhere]', topic.mastery === 3 && 'text-on-surface-light')}>{topic.title}</p>
                      <p className="text-body-sm text-on-surface-light">{t.mastery[topic.mastery]}</p>
                    </div>
                    <MasterySteps topic={topic} onChange={(mastery) => void apply(() => api.updateTopic(topic.id, { mastery }))} />
                    {grades.some((g) => g.score === null) && (
                      <Select
                        aria-label={`${t.topicFor}: ${topic.title}`} value={topic.gradeId ?? ''} className="min-h-11 w-40 py-1 text-body-sm"
                        onChange={(e) => void apply(() => api.updateTopic(topic.id, { gradeId: e.target.value || null }))}
                      >
                        <option value="">{t.anyGrade}</option>
                        {grades.filter((g) => g.score === null || g.id === topic.gradeId).map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                      </Select>
                    )}
                    <div role="group" aria-label={t.topicActions(topic.title)} className="flex">
                      <Button variant="icon" aria-label={`${t.archive}: ${topic.title}`} onClick={() => void apply(() => api.updateTopic(topic.id, { archived: true }), t.archivedOk)}><Archive aria-hidden className="size-5" strokeWidth={1.75} /></Button>
                      <Button variant="icon" aria-label={`${t.delete}: ${topic.title}`} className="hover:text-error-text" onClick={() => void apply(() => api.deleteTopic(topic.id), t.deleted)}><Trash2 aria-hidden className="size-5" strokeWidth={1.75} /></Button>
                    </div>
                  </li>
                ))}
              </ul>
              <form onSubmit={(e) => void addTopic(e)} className="flex gap-2">
                <Input aria-label={t.addTopic} value={topicTitle} maxLength={120} onChange={(e) => setTopicTitle(e.target.value)} placeholder={t.topicPh} />
                <Button type="submit" size="md" disabled={!topicTitle.trim()} aria-label={t.addTopic}><Plus aria-hidden className="size-5" strokeWidth={2} /></Button>
              </form>
            </section>
          )}

          <div className="flex flex-wrap gap-1 border-t border-border pt-3">
            <Button variant="ghost" size="md" onClick={() => onEdit(course)}><Pencil aria-hidden className="size-4" strokeWidth={1.75} />{t.editCourse}</Button>
            <Button variant="ghost" size="md" onClick={() => void apply(() => api.updateCourse(course.id, { archived: true }), t.archivedOk).then(onClose)}><Archive aria-hidden className="size-4" strokeWidth={1.75} />{t.archive}</Button>
            <Button variant="ghost" size="md" className="text-error-text" onClick={() => setConfirm(true)}><Trash2 aria-hidden className="size-4" strokeWidth={1.75} />{t.delete}</Button>
          </div>
        </div>
      </ResponsiveDialog>

      <GradeDialog open={gradeDialog !== null} course={course} grade={gradeDialog?.grade ?? null} cal={cal} onClose={() => setGradeDialog(null)} onSaved={onChange} />
      <ConfirmDelete open={confirm} title={t.confirmDelete(course.name)} body={t.confirmDeleteBody} busy={busy} onCancel={() => setConfirm(false)} onConfirm={() => void remove()} />
    </>
  );
}
