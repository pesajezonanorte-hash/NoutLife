// Académico (dentro de Aprendizaje): materias, evaluaciones, temas y entregas. Cada escritura devuelve la
// materia o la entrega ya actualizada, así la pantalla la sustituye sin volver a pedir todo.
import api from '../lib/api';

export type AcademicColor = 'jade' | 'ambar' | 'oceano' | 'coral' | 'bosque' | 'oro';
export type GradeKind = 'EXAM' | 'MIDTERM' | 'QUIZ' | 'HOMEWORK' | 'PROJECT' | 'OTHER';
export type TaskKind = 'DELIVERY' | 'READING' | 'GROUP' | 'PAPERWORK' | 'OTHER';
/** 0 sin ver · 1 visto · 2 practicado · 3 dominado */
export type Mastery = 0 | 1 | 2 | 3;

export interface AcademicGrade {
  id: string;
  courseId: string;
  title: string;
  kind: GradeKind;
  /** Peso en la materia, en % (0–100). */
  weight: number;
  /** null: todavía por presentar o por calificar. */
  score: number | null;
  /** Lo que la persona creía que iba a sacar. */
  predicted: number | null;
  date: string | null;
  archivedAt: string | null;
}

export interface AcademicTopic {
  id: string;
  courseId: string;
  gradeId: string | null;
  title: string;
  mastery: Mastery;
  order: number;
  archivedAt: string | null;
}

export interface AcademicCourse {
  id: string;
  name: string;
  period: string;
  teacher: string | null;
  color: AcademicColor;
  credits: number;
  scaleMin: number;
  scaleMax: number;
  passGrade: number;
  targetGrade: number | null;
  archivedAt: string | null;
  createdAt: string;
  grades: AcademicGrade[];
  topics: AcademicTopic[];
}

export interface AcademicTask {
  id: string;
  courseId: string | null;
  title: string;
  kind: TaskKind;
  dueAt: string;
  done: boolean;
  doneAt: string | null;
  notes: string | null;
  archivedAt: string | null;
}

export type CourseInput = Pick<AcademicCourse, 'name' | 'period'> & Partial<Pick<AcademicCourse, 'teacher' | 'color' | 'credits' | 'scaleMin' | 'scaleMax' | 'passGrade' | 'targetGrade'>>;
export type GradeInput = Pick<AcademicGrade, 'title' | 'weight'> & Partial<Pick<AcademicGrade, 'kind' | 'score' | 'predicted' | 'date'>>;
export type TopicInput = Pick<AcademicTopic, 'title'> & Partial<Pick<AcademicTopic, 'mastery' | 'gradeId' | 'order'>>;
export type TaskInput = Pick<AcademicTask, 'title' | 'dueAt'> & Partial<Pick<AcademicTask, 'kind' | 'courseId' | 'notes'>>;
type Archive = { archived: boolean };

const course = (p: Promise<{ data: { course: AcademicCourse } }>) => p.then((r) => r.data.course);
const task = (p: Promise<{ data: { task: AcademicTask } }>) => p.then((r) => r.data.task);

export async function fetchAcademic(): Promise<{ courses: AcademicCourse[]; tasks: AcademicTask[] }> {
  return (await api.get('/academic')).data;
}

export const createCourse = (body: CourseInput) => course(api.post('/academic/courses', body));
export const updateCourse = (id: string, body: Partial<CourseInput & Archive>) => course(api.patch(`/academic/courses/${id}`, body));
export const deleteCourse = (id: string) => api.delete(`/academic/courses/${id}`).then(() => undefined);

export const createGrade = (courseId: string, body: GradeInput) => course(api.post(`/academic/courses/${courseId}/grades`, body));
export const updateGrade = (id: string, body: Partial<GradeInput & Archive>) => course(api.patch(`/academic/grades/${id}`, body));
export const deleteGrade = (id: string) => course(api.delete(`/academic/grades/${id}`));

export const createTopic = (courseId: string, body: TopicInput) => course(api.post(`/academic/courses/${courseId}/topics`, body));
export const updateTopic = (id: string, body: Partial<TopicInput & Archive>) => course(api.patch(`/academic/topics/${id}`, body));
export const deleteTopic = (id: string) => course(api.delete(`/academic/topics/${id}`));

export const createTask = (body: TaskInput) => task(api.post('/academic/tasks', body));
export const updateTask = (id: string, body: Partial<TaskInput & Archive & { done: boolean }>) => task(api.patch(`/academic/tasks/${id}`, body));
export const deleteTask = (id: string) => api.delete(`/academic/tasks/${id}`).then(() => undefined);

/** El texto que mandó la API para la persona (pesos que pasan de 100 %, nota fuera de escala…). */
export const apiMessage = (err: unknown, fallback: string): string =>
  (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
