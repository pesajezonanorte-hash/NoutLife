// Académico: cada persona tiene sus materias; cada materia, sus evaluaciones y temas. Las entregas son de la
// persona y pueden ir sin materia. Todo se comprueba contra el dueño: lo ajeno responde como si no existiera.
// Los promedios, «qué necesito» y «dónde mejorar» se calculan en la app (apps/web/src/lib/academic.ts) con
// estos datos, para que cada cambio se vea al instante.
import { prisma } from '../lib/prisma';
import { ApiError, calendarDay, gone } from '../lib/http';
import {
  MAX_COURSES, MAX_GRADES_PER_COURSE, MAX_OPEN_TASKS, MAX_TOPICS_PER_COURSE,
  type CourseInput, type CoursePatch, type GradeInput, type GradePatch, type TaskInput, type TaskPatch, type TopicInput, type TopicPatch,
} from '../schemas/academic.schemas';

const DAY_MS = 86_400_000;
/** Las entregas hechas siguen a la vista dos meses; después solo cuentan en el historial. */
const DONE_VISIBLE_DAYS = 60;

const withParts = {
  grades: { orderBy: [{ date: 'asc' as const }, { createdAt: 'asc' as const }] },
  topics: { orderBy: [{ order: 'asc' as const }, { createdAt: 'asc' as const }] },
};

const archivedAt = (archived: boolean | undefined) => (archived === undefined ? {} : { archivedAt: archived ? new Date() : null });
const dayOrNull = (value: string | null | undefined) => (value === undefined ? undefined : value === null ? null : calendarDay(value));

export async function getAcademic(userId: string) {
  const [courses, tasks] = await Promise.all([
    prisma.academicCourse.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, include: withParts }),
    prisma.academicTask.findMany({
      where: { userId, OR: [{ done: false }, { doneAt: { gte: new Date(Date.now() - DONE_VISIBLE_DAYS * DAY_MS) } }] },
      orderBy: { dueAt: 'asc' },
      take: 500,
    }),
  ]);
  return { courses, tasks };
}

const courseOf = (userId: string, id: string) => prisma.academicCourse.findFirst({ where: { id, userId }, include: withParts });

interface Scale { scaleMin: number; scaleMax: number; passGrade: number; targetGrade: number | null }

function assertScale(s: Scale) {
  if (!(s.scaleMin < s.scaleMax)) throw new ApiError('La nota máxima debe ser mayor que la mínima.');
  if (s.passGrade < s.scaleMin || s.passGrade > s.scaleMax) throw new ApiError('La nota para aprobar debe estar dentro de la escala.');
  if (s.targetGrade !== null && (s.targetGrade < s.scaleMin || s.targetGrade > s.scaleMax)) throw new ApiError('Tu meta debe estar dentro de la escala.');
}

function assertInScale(value: number | null | undefined, s: Pick<Scale, 'scaleMin' | 'scaleMax'>, what: string) {
  if (value === null || value === undefined) return;
  if (value < s.scaleMin || value > s.scaleMax) throw new ApiError(`${what} debe estar entre ${s.scaleMin} y ${s.scaleMax}.`);
}

export async function createCourse(userId: string, input: CourseInput) {
  if ((await prisma.academicCourse.count({ where: { userId } })) >= MAX_COURSES) {
    throw new ApiError(`Puedes tener hasta ${MAX_COURSES} materias. Elimina alguna que ya no uses.`, 409);
  }
  const scale = { scaleMin: input.scaleMin ?? 0, scaleMax: input.scaleMax ?? 5, passGrade: input.passGrade ?? 3, targetGrade: input.targetGrade ?? null };
  assertScale(scale);
  const course = await prisma.academicCourse.create({ data: { userId, ...input, ...scale }, include: withParts });
  return { course };
}

export async function updateCourse(userId: string, id: string, { archived, ...input }: CoursePatch) {
  const current = await courseOf(userId, id);
  if (!current) throw gone('Esa materia');
  const scale = {
    scaleMin: input.scaleMin ?? current.scaleMin,
    scaleMax: input.scaleMax ?? current.scaleMax,
    passGrade: input.passGrade ?? current.passGrade,
    targetGrade: input.targetGrade === undefined ? current.targetGrade : input.targetGrade,
  };
  assertScale(scale);
  // Una escala nueva no puede dejar fuera notas que ya están puestas.
  for (const g of current.grades) assertInScale(g.score, scale, `La escala deja fuera la nota de «${g.title}»: la nota`);
  const course = await prisma.academicCourse.update({ where: { id }, data: { ...input, ...archivedAt(archived) }, include: withParts });
  return { course };
}

export async function deleteCourse(userId: string, id: string) {
  const { count } = await prisma.academicCourse.deleteMany({ where: { id, userId } });
  if (!count) throw gone('Esa materia');
  return { ok: true };
}

/** Los pesos de una materia no pueden sumar más de 100 %. */
function assertWeights(grades: { id: string; weight: number; archivedAt: Date | null }[], changed: { id?: string; weight: number; archived: boolean }) {
  const others = grades.filter((g) => g.id !== changed.id && !g.archivedAt).reduce((sum, g) => sum + g.weight, 0);
  const total = others + (changed.archived ? 0 : changed.weight);
  if (total > 100.001) throw new ApiError(`Los pesos de la materia sumarían ${Math.round(total * 10) / 10} %. No pueden pasar de 100 %.`);
}

export async function createGrade(userId: string, courseId: string, input: GradeInput) {
  const course = await courseOf(userId, courseId);
  if (!course) throw gone('Esa materia');
  if (course.grades.length >= MAX_GRADES_PER_COURSE) throw new ApiError(`Una materia admite hasta ${MAX_GRADES_PER_COURSE} evaluaciones.`, 409);
  assertInScale(input.score, course, 'La nota');
  assertInScale(input.predicted, course, 'Tu predicción');
  assertWeights(course.grades, { weight: input.weight, archived: false });
  await prisma.academicGrade.create({ data: { courseId, ...input, date: dayOrNull(input.date) ?? null } });
  return { course: await courseOf(userId, courseId) };
}

export async function updateGrade(userId: string, id: string, { archived, ...input }: GradePatch) {
  const grade = await prisma.academicGrade.findFirst({ where: { id, course: { userId } }, include: { course: { include: withParts } } });
  if (!grade) throw gone('Esa evaluación');
  assertInScale(input.score, grade.course, 'La nota');
  assertInScale(input.predicted, grade.course, 'Tu predicción');
  assertWeights(grade.course.grades, { id, weight: input.weight ?? grade.weight, archived: archived ?? Boolean(grade.archivedAt) });
  await prisma.academicGrade.update({ where: { id }, data: { ...input, date: dayOrNull(input.date), ...archivedAt(archived) } });
  return { course: await courseOf(userId, grade.courseId) };
}

export async function deleteGrade(userId: string, id: string) {
  const grade = await prisma.academicGrade.findFirst({ where: { id, course: { userId } }, select: { courseId: true } });
  if (!grade) throw gone('Esa evaluación');
  await prisma.academicGrade.delete({ where: { id } });
  return { course: await courseOf(userId, grade.courseId) };
}

/** El tema solo puede enlazarse a una evaluación de su misma materia. */
async function assertGradeOfCourse(gradeId: string | null | undefined, courseId: string) {
  if (!gradeId) return;
  if (!(await prisma.academicGrade.findFirst({ where: { id: gradeId, courseId }, select: { id: true } }))) {
    throw new ApiError('Esa evaluación no es de esta materia.');
  }
}

export async function createTopic(userId: string, courseId: string, input: TopicInput) {
  const course = await courseOf(userId, courseId);
  if (!course) throw gone('Esa materia');
  if (course.topics.length >= MAX_TOPICS_PER_COURSE) throw new ApiError(`Una materia admite hasta ${MAX_TOPICS_PER_COURSE} temas.`, 409);
  await assertGradeOfCourse(input.gradeId, courseId);
  const order = input.order ?? course.topics.reduce((max, t) => Math.max(max, t.order + 1), 0);
  await prisma.academicTopic.create({ data: { courseId, ...input, order } });
  return { course: await courseOf(userId, courseId) };
}

export async function updateTopic(userId: string, id: string, { archived, ...input }: TopicPatch) {
  const topic = await prisma.academicTopic.findFirst({ where: { id, course: { userId } }, select: { courseId: true } });
  if (!topic) throw gone('Ese tema');
  await assertGradeOfCourse(input.gradeId, topic.courseId);
  await prisma.academicTopic.update({ where: { id }, data: { ...input, ...archivedAt(archived) } });
  return { course: await courseOf(userId, topic.courseId) };
}

export async function deleteTopic(userId: string, id: string) {
  const topic = await prisma.academicTopic.findFirst({ where: { id, course: { userId } }, select: { courseId: true } });
  if (!topic) throw gone('Ese tema');
  await prisma.academicTopic.delete({ where: { id } });
  return { course: await courseOf(userId, topic.courseId) };
}

async function assertOwnCourse(userId: string, courseId: string | null | undefined) {
  if (!courseId) return;
  if (!(await prisma.academicCourse.findFirst({ where: { id: courseId, userId }, select: { id: true } }))) throw gone('Esa materia');
}

export async function createTask(userId: string, input: TaskInput) {
  if ((await prisma.academicTask.count({ where: { userId, done: false } })) >= MAX_OPEN_TASKS) {
    throw new ApiError(`Tienes ${MAX_OPEN_TASKS} compromisos abiertos. Cierra o elimina alguno.`, 409);
  }
  await assertOwnCourse(userId, input.courseId);
  const task = await prisma.academicTask.create({ data: { userId, ...input, dueAt: calendarDay(input.dueAt) } });
  return { task };
}

export async function updateTask(userId: string, id: string, { archived, done, dueAt, ...input }: TaskPatch) {
  const current = await prisma.academicTask.findFirst({ where: { id, userId }, select: { id: true, done: true } });
  if (!current) throw gone('Ese compromiso');
  await assertOwnCourse(userId, input.courseId);
  const task = await prisma.academicTask.update({
    where: { id },
    data: {
      ...input,
      ...(dueAt !== undefined && { dueAt: calendarDay(dueAt) }),
      // La fecha de cierre se pone al marcarlo; volver a marcar algo ya hecho no la mueve.
      ...(done !== undefined && done !== current.done && { done, doneAt: done ? new Date() : null }),
      ...archivedAt(archived),
    },
  });
  return { task };
}

export async function deleteTask(userId: string, id: string) {
  const { count } = await prisma.academicTask.deleteMany({ where: { id, userId } });
  if (!count) throw gone('Ese compromiso');
  return { ok: true };
}
