// Académico: materias de un periodo, sus evaluaciones (con peso), los temas por estudiar y las entregas.
import { z } from 'zod';
import { isValidCalendarDate } from '../lib/calendar';

export const ACADEMIC_COLORS = ['jade', 'ambar', 'oceano', 'coral', 'bosque', 'oro'] as const;
export const GRADE_KINDS = ['EXAM', 'MIDTERM', 'QUIZ', 'HOMEWORK', 'PROJECT', 'OTHER'] as const;
export const TASK_KINDS = ['DELIVERY', 'READING', 'GROUP', 'PAPERWORK', 'OTHER'] as const;

export const MAX_COURSES = 80;
export const MAX_GRADES_PER_COURSE = 60;
export const MAX_TOPICS_PER_COURSE = 300;
export const MAX_OPEN_TASKS = 300;

const day = z.string().refine(isValidCalendarDate, 'La fecha no es válida.');
/** Una nota en cualquier escala (0–5, 0–10, 0–100…). Que quepa en la escala de la materia lo comprueba el servicio. */
const mark = z.number({ invalid_type_error: 'La nota debe ser un número.' }).finite().min(0).max(1000);

const courseFields = {
  name: z.string().trim().min(1, 'Ponle nombre a la materia.').max(80),
  period: z.string().trim().min(1, 'Indica el periodo.').max(30),
  teacher: z.string().trim().max(80).nullable().optional(),
  color: z.enum(ACADEMIC_COLORS).optional(),
  credits: z.number().finite().positive('Los créditos deben ser mayores que cero.').max(30).optional(),
  scaleMin: mark.optional(),
  scaleMax: mark.optional(),
  passGrade: mark.optional(),
  targetGrade: mark.nullable().optional(),
};
export const createCourseSchema = z.object(courseFields).strict();
export const updateCourseSchema = z.object({ ...courseFields, archived: z.boolean() }).partial().strict();

const gradeFields = {
  title: z.string().trim().min(1, 'Ponle nombre a la evaluación.').max(80),
  kind: z.enum(GRADE_KINDS).optional(),
  weight: z.number({ invalid_type_error: 'El peso debe ser un número.' }).finite().positive('El peso debe ser mayor que cero.').max(100, 'El peso no puede pasar de 100 %.'),
  score: mark.nullable().optional(),
  predicted: mark.nullable().optional(),
  date: day.nullable().optional(),
};
export const createGradeSchema = z.object(gradeFields).strict();
export const updateGradeSchema = z.object({ ...gradeFields, archived: z.boolean() }).partial().strict();

const topicFields = {
  title: z.string().trim().min(1, 'Escribe el tema.').max(120),
  mastery: z.number().int().min(0).max(3).optional(),
  gradeId: z.string().min(1).max(40).nullable().optional(),
  order: z.number().int().min(0).max(10_000).optional(),
};
export const createTopicSchema = z.object(topicFields).strict();
export const updateTopicSchema = z.object({ ...topicFields, archived: z.boolean() }).partial().strict();

const taskFields = {
  title: z.string().trim().min(1, 'Escribe el compromiso.').max(120),
  kind: z.enum(TASK_KINDS).optional(),
  dueAt: day,
  courseId: z.string().min(1).max(40).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
};
export const createTaskSchema = z.object(taskFields).strict();
export const updateTaskSchema = z.object({ ...taskFields, done: z.boolean(), archived: z.boolean() }).partial().strict();

export type CourseInput = z.infer<typeof createCourseSchema>;
export type CoursePatch = z.infer<typeof updateCourseSchema>;
export type GradeInput = z.infer<typeof createGradeSchema>;
export type GradePatch = z.infer<typeof updateGradeSchema>;
export type TopicInput = z.infer<typeof createTopicSchema>;
export type TopicPatch = z.infer<typeof updateTopicSchema>;
export type TaskInput = z.infer<typeof createTaskSchema>;
export type TaskPatch = z.infer<typeof updateTaskSchema>;
