// Formularios del módulo académico: materia, evaluación y compromiso. Crear y editar comparten diálogo; al
// editar aparecen también archivar y eliminar.
import { useState, type FormEvent, type ReactNode } from 'react';
import { Archive, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, ChipGroup, DatePicker, Field, Input, ResponsiveDialog, Select, Textarea } from '@/components/ui/lq';
import { useToast } from '@/hooks/useToast';
import { INTL_LOCALE, useLocale, useText } from '@/lib/i18n';
import { coversFor } from '@/components/notebook/paper';
import { calibrated, courseStats, formatGrade, type Calibration } from '@/lib/academic';
import * as api from '@/services/academic.service';
import type { AcademicColor, AcademicCourse, AcademicGrade, AcademicTask, GradeKind, TaskKind } from '@/services/academic.service';
import { ACADEMIC_COPY } from './copy';

/** Número escrito con coma o punto. null: vacío; NaN: no es un número. */
const num = (text: string): number | null => {
  const clean = text.trim().replace(',', '.');
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : NaN;
};
const str = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));
const bad = (n: number | null) => n !== null && Number.isNaN(n);

/** Reinicia el formulario cada vez que el diálogo se abre con otro elemento. */
function useForm<T>(key: string | null, initial: () => T) {
  const [seen, setSeen] = useState<string | null>(null);
  const [form, setForm] = useState<T>(initial);
  const [tried, setTried] = useState(false);
  if (key !== seen) {
    setSeen(key);
    if (key) { setForm(initial()); setTried(false); }
  }
  const set = <K extends keyof T>(k: K, v: T[K]) => setForm((f) => ({ ...f, [k]: v }));
  return { form, set, tried, setTried };
}

/** Pie común: a la izquierda archivar y eliminar (solo al editar); a la derecha cancelar y guardar. */
function Footer({ editing, saving, onClose, onArchive, onDelete, submit }: {
  editing: boolean; saving: boolean; onClose: () => void; onArchive?: () => void; onDelete?: () => void; submit: string;
}) {
  const t = useText(ACADEMIC_COPY);
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-1">
        {editing && onArchive && <Button variant="ghost" size="md" onClick={onArchive}><Archive aria-hidden className="size-4" strokeWidth={1.75} />{t.archive}</Button>}
        {editing && onDelete && <Button variant="ghost" size="md" className="text-error-text" onClick={onDelete}><Trash2 aria-hidden className="size-4" strokeWidth={1.75} />{t.delete}</Button>}
      </div>
      <div className="flex gap-3">
        <Button variant="secondary" size="md" onClick={onClose}>{t.cancel}</Button>
        <Button type="submit" size="md" loading={saving}>{submit}</Button>
      </div>
    </div>
  );
}

/** Guarda con el mensaje de la API si lo hay (pesos que pasan de 100 %, nota fuera de escala…). */
function useSave() {
  const t = useText(ACADEMIC_COPY);
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const run = async (action: () => Promise<void>, ok?: string) => {
    setSaving(true);
    try { await action(); if (ok) toast.success(ok); }
    catch (err) { toast.error(api.apiMessage(err, t.actionFail)); }
    finally { setSaving(false); }
  };
  return { saving, run };
}

// ─── Materia ──────────────────────────────────────────────────────────────────

const SCALES = { five: [0, 5, 3], ten: [0, 10, 6], hundred: [0, 100, 60] } as const;
type ScaleId = keyof typeof SCALES | 'custom';
const scaleOf = (min: number, max: number): ScaleId =>
  ((Object.keys(SCALES) as (keyof typeof SCALES)[]).find((id) => SCALES[id][0] === min && SCALES[id][1] === max) ?? 'custom');

export function CourseDialog({ open, course, period, onClose, onSaved }: {
  open: boolean; course: AcademicCourse | null; period: string; onClose: () => void; onSaved: (course: AcademicCourse) => void;
}) {
  const t = useText(ACADEMIC_COPY);
  const locale = useLocale();
  const { saving, run } = useSave();
  const { form, set, tried, setTried } = useForm(open ? course?.id ?? 'new' : null, () => ({
    name: course?.name ?? '', period: course?.period ?? period, teacher: course?.teacher ?? '', credits: str(course?.credits ?? 1),
    color: (course?.color ?? 'jade') as AcademicColor, scale: scaleOf(course?.scaleMin ?? 0, course?.scaleMax ?? 5),
    scaleMin: str(course?.scaleMin ?? 0), scaleMax: str(course?.scaleMax ?? 5), passGrade: str(course?.passGrade ?? 3), targetGrade: str(course?.targetGrade),
  }));
  const covers = coversFor(locale);
  const credits = num(form.credits);
  const numbers = [credits, num(form.scaleMin), num(form.scaleMax), num(form.passGrade), num(form.targetGrade)];
  const valid = form.name.trim() !== '' && form.period.trim() !== '' && credits !== null && !numbers.some(bad);

  function pickScale(scale: ScaleId) {
    set('scale', scale);
    if (scale === 'custom') return;
    const [min, max, pass] = SCALES[scale];
    set('scaleMin', String(min)); set('scaleMax', String(max)); set('passGrade', String(pass)); set('targetGrade', '');
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!valid) return;
    const body = {
      name: form.name.trim(), period: form.period.trim(), teacher: form.teacher.trim() || null, credits: credits!, color: form.color,
      scaleMin: num(form.scaleMin) ?? 0, scaleMax: num(form.scaleMax) ?? 5, passGrade: num(form.passGrade) ?? 3, targetGrade: num(form.targetGrade),
    };
    void run(async () => onSaved(course ? await api.updateCourse(course.id, body) : await api.createCourse(body)), t.courseSaved);
  }

  return (
    <ResponsiveDialog open={open} onClose={onClose} title={course ? t.editCourse : t.newCourse} className="md:max-w-[560px]">
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <Field label={t.name} error={tried && !form.name.trim() ? t.required : undefined}>
          <Input data-autofocus value={form.name} maxLength={80} onChange={(e) => set('name', e.target.value)} placeholder={t.namePh} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.period} help={t.periodHelp} error={tried && !form.period.trim() ? t.required : undefined}>
            <Input value={form.period} maxLength={30} onChange={(e) => set('period', e.target.value)} placeholder={t.periodPh} />
          </Field>
          <Field label={t.credits} help={t.creditsHelp} error={tried && (credits === null || bad(credits)) ? t.numberErr : undefined}>
            <Input inputMode="decimal" value={form.credits} onChange={(e) => set('credits', e.target.value)} className="font-mono tabular-nums" />
          </Field>
        </div>
        <Field label={t.teacher} help={t.optional}>
          <Input value={form.teacher} maxLength={80} onChange={(e) => set('teacher', e.target.value)} />
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label-lg text-on-surface">{t.color}</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(covers) as AcademicColor[]).map((c) => (
              <label key={c} className="relative cursor-pointer">
                <input type="radio" name="ac-color" value={c} checked={form.color === c} onChange={() => set('color', c)} className="peer sr-only" />
                <span className={cn('block size-11 rounded-full ring-offset-2 ring-offset-surface peer-checked:ring-2 peer-checked:ring-on-background peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-primary', covers[c].className)} />
                <span className="sr-only">{t.colors[c]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-col gap-2">
          <span className="text-label-lg text-on-surface">{t.scale}</span>
          <ChipGroup label={t.scale} value={form.scale} onChange={pickScale} options={(['five', 'ten', 'hundred', 'custom'] as ScaleId[]).map((value) => ({ value, label: t.scales[value] }))} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {form.scale === 'custom' && (
            <>
              <Field label={t.scaleMin} error={tried && bad(num(form.scaleMin)) ? t.numberErr : undefined}>
                <Input inputMode="decimal" value={form.scaleMin} onChange={(e) => set('scaleMin', e.target.value)} className="font-mono tabular-nums" />
              </Field>
              <Field label={t.scaleMax} error={tried && bad(num(form.scaleMax)) ? t.numberErr : undefined}>
                <Input inputMode="decimal" value={form.scaleMax} onChange={(e) => set('scaleMax', e.target.value)} className="font-mono tabular-nums" />
              </Field>
            </>
          )}
          <Field label={t.passGrade} error={tried && bad(num(form.passGrade)) ? t.numberErr : undefined}>
            <Input inputMode="decimal" value={form.passGrade} onChange={(e) => set('passGrade', e.target.value)} className="font-mono tabular-nums" />
          </Field>
          <Field label={t.target} help={t.targetHelp} error={tried && bad(num(form.targetGrade)) ? t.numberErr : undefined}>
            <Input inputMode="decimal" value={form.targetGrade} onChange={(e) => set('targetGrade', e.target.value)} placeholder={t.optional} className="font-mono tabular-nums" />
          </Field>
        </div>
        <Footer editing={false} saving={saving} onClose={onClose} submit={course ? t.save : t.create} />
      </form>
    </ResponsiveDialog>
  );
}

// ─── Evaluación ───────────────────────────────────────────────────────────────

const GRADE_KINDS: GradeKind[] = ['MIDTERM', 'EXAM', 'QUIZ', 'HOMEWORK', 'PROJECT', 'OTHER'];

export function GradeDialog({ open, course, grade, cal, onClose, onSaved }: {
  open: boolean; course: AcademicCourse; grade: AcademicGrade | null; cal: Calibration | null; onClose: () => void; onSaved: (course: AcademicCourse) => void;
}) {
  const t = useText(ACADEMIC_COPY);
  const locale = useLocale();
  const { saving, run } = useSave();
  const { form, set, tried, setTried } = useForm(open ? grade?.id ?? 'new' : null, () => ({
    title: grade?.title ?? '', kind: (grade?.kind ?? 'MIDTERM') as GradeKind, weight: str(grade?.weight), date: grade?.date?.slice(0, 10) ?? '',
    score: str(grade?.score), predicted: str(grade?.predicted),
  }));
  const weight = num(form.weight);
  const score = num(form.score);
  const predicted = num(form.predicted);
  const valid = form.title.trim() !== '' && weight !== null && !bad(weight) && weight > 0 && !bad(score) && !bad(predicted);
  // Lo que queda sin asignar si se guarda esta evaluación con el peso que ya tenía.
  const left = Math.max(0, Math.round((100 - courseStats(course).assignedWeight + (grade && !grade.archivedAt ? grade.weight : 0)) * 10) / 10);
  // La predicción se anota antes de saber la nota: con la nota puesta ya no se puede cambiar.
  const canPredict = score === null;
  const expect = canPredict && predicted !== null && !bad(predicted) ? calibrated(predicted, course, cal) : null;
  const fmt = (n: number) => formatGrade(n, course.scaleMax, INTL_LOCALE[locale]);

  function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!valid) return;
    const body = { title: form.title.trim(), kind: form.kind, weight: weight!, date: form.date || null, score, ...(canPredict && { predicted }) };
    void run(async () => { onSaved(grade ? await api.updateGrade(grade.id, body) : await api.createGrade(course.id, body)); onClose(); }, t.gradeSaved);
  }
  const act = (action: () => Promise<AcademicCourse>, ok: string) => void run(async () => { onSaved(await action()); onClose(); }, ok);

  return (
    <ResponsiveDialog open={open} onClose={onClose} title={grade ? t.editGrade : t.newGrade} className="md:max-w-[520px]">
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <Field label={t.title} error={tried && !form.title.trim() ? t.required : undefined}>
          <Input data-autofocus value={form.title} maxLength={80} onChange={(e) => set('title', e.target.value)} placeholder={t.gradePh} />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-label-lg text-on-surface">{t.kind}</span>
          <ChipGroup label={t.kind} value={form.kind} onChange={(kind) => set('kind', kind)} options={GRADE_KINDS.map((value) => ({ value, label: t.kinds[value] }))} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t.weight} help={t.weightHelp(left)} error={tried && (weight === null || bad(weight) || weight <= 0) ? t.numberErr : undefined}>
            <Input inputMode="decimal" value={form.weight} onChange={(e) => set('weight', e.target.value)} placeholder="30" className="font-mono tabular-nums" />
          </Field>
          <Field label={t.date} help={t.optional}>
            <DatePicker value={form.date} onChange={(date) => set('date', date)} clearable />
          </Field>
        </div>
        <Field label={`${t.score} (${fmt(course.scaleMin)}–${fmt(course.scaleMax)})`} help={t.scoreHelp} error={tried && bad(score) ? t.numberErr : undefined}>
          <Input inputMode="decimal" value={form.score} onChange={(e) => set('score', e.target.value)} className="font-mono tabular-nums" />
        </Field>
        {canPredict ? (
          <Field label={t.predicted} help={expect !== null ? t.expect(fmt(expect)) : t.predictedHelp} error={tried && bad(predicted) ? t.numberErr : undefined}>
            <Input inputMode="decimal" value={form.predicted} onChange={(e) => set('predicted', e.target.value)} className="font-mono tabular-nums" />
          </Field>
        ) : grade?.predicted !== null && grade?.predicted !== undefined ? (
          <p className="text-body-sm text-on-surface-light">{t.predictedWas(fmt(grade.predicted))}</p>
        ) : null}
        <Footer
          editing={Boolean(grade)} saving={saving} onClose={onClose} submit={grade ? t.save : t.create}
          onArchive={grade ? () => act(() => api.updateGrade(grade.id, { archived: true }), t.archivedOk) : undefined}
          onDelete={grade ? () => act(() => api.deleteGrade(grade.id), t.deleted) : undefined}
        />
      </form>
    </ResponsiveDialog>
  );
}

// ─── Compromiso ───────────────────────────────────────────────────────────────

const TASK_KINDS: TaskKind[] = ['DELIVERY', 'READING', 'GROUP', 'PAPERWORK', 'OTHER'];
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function TaskDialog({ open, task, courses, courseId, onClose, onSaved, onDeleted }: {
  open: boolean; task: AcademicTask | null; courses: AcademicCourse[]; courseId?: string | null;
  onClose: () => void; onSaved: (task: AcademicTask) => void; onDeleted: (id: string) => void;
}) {
  const t = useText(ACADEMIC_COPY);
  const { saving, run } = useSave();
  const { form, set, tried, setTried } = useForm(open ? task?.id ?? 'new' : null, () => ({
    title: task?.title ?? '', kind: (task?.kind ?? 'DELIVERY') as TaskKind, dueAt: task?.dueAt.slice(0, 10) ?? todayKey(),
    courseId: task?.courseId ?? courseId ?? '', notes: task?.notes ?? '',
  }));
  const valid = form.title.trim() !== '' && form.dueAt !== '';

  function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!valid) return;
    const body = { title: form.title.trim(), kind: form.kind, dueAt: form.dueAt, courseId: form.courseId || null, notes: form.notes.trim() || null };
    void run(async () => onSaved(task ? await api.updateTask(task.id, body) : await api.createTask(body)), t.taskSaved);
  }

  return (
    <ResponsiveDialog open={open} onClose={onClose} title={task ? t.editTask : t.newTask} className="md:max-w-[520px]">
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <Field label={t.title} error={tried && !form.title.trim() ? t.required : undefined}>
          <Input data-autofocus value={form.title} maxLength={120} onChange={(e) => set('title', e.target.value)} placeholder={t.taskPh} />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-label-lg text-on-surface">{t.kind}</span>
          <ChipGroup label={t.kind} value={form.kind} onChange={(kind) => set('kind', kind)} options={TASK_KINDS.map((value) => ({ value, label: t.taskKinds[value] }))} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.due} help={t.remindNote} error={tried && !form.dueAt ? t.required : undefined}>
            <DatePicker value={form.dueAt} onChange={(dueAt) => set('dueAt', dueAt)} />
          </Field>
          <Field label={t.course}>
            <Select value={form.courseId} onChange={(e) => set('courseId', e.target.value)}>
              <option value="">{t.noCourse}</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label={t.notes} help={t.optional}>
          <Textarea rows={2} maxLength={500} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        <Footer
          editing={Boolean(task)} saving={saving} onClose={onClose} submit={task ? t.save : t.create}
          onArchive={task ? () => void run(async () => onSaved(await api.updateTask(task.id, { archived: true })), t.archivedOk) : undefined}
          onDelete={task ? () => void run(async () => { await api.deleteTask(task.id); onDeleted(task.id); }, t.deleted) : undefined}
        />
      </form>
    </ResponsiveDialog>
  );
}

/** Confirmación de borrado (materia): diálogo pequeño con el daño dicho con claridad. */
export function ConfirmDelete({ open, title, body, busy, onCancel, onConfirm, children }: {
  open: boolean; title: string; body: string; busy: boolean; onCancel: () => void; onConfirm: () => void; children?: ReactNode;
}) {
  const t = useText(ACADEMIC_COPY);
  return (
    <ResponsiveDialog open={open} onClose={onCancel} title={title} className="md:max-w-[440px]">
      <div className="flex flex-col gap-5">
        <p className="text-body-md text-on-surface">{body}</p>
        {children}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="md" onClick={onCancel}>{t.cancel}</Button>
          <Button variant="danger" size="md" loading={busy} onClick={onConfirm}><Trash2 aria-hidden className="size-4" strokeWidth={1.75} />{t.delete}</Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
