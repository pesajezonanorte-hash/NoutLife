// Plantillas de zonas: un entorno armado con módulos que abren partes reales de la app (Académico, Coliseo,
// Finanzas, la oficina…), el Modo enfoque o la música, más hábitos para empezar. Crear desde una plantilla no
// usa IA. Los textos se guardan en el idioma en que se crea la zona.
import { BookOpen, CalendarDays, CheckCircle2, Clapperboard, GraduationCap, Moon, Music, Notebook, Swords, UtensilsCrossed, Wallet, Zap, type LucideIcon } from 'lucide-react';
import type { Locale } from '@/lib/i18n';

export interface ZoneSection { type: string; title: string; description: string; to?: string }
export interface ZoneTemplate {
  id: 'work' | 'study' | 'health' | 'finance' | 'creativity';
  name: string;
  description: string;
  icon: string;
  color: string;
  isMeasurable: boolean;
  measureReason: string;
  sections: ZoneSection[];
  habits: { title: string; frequency: string }[];
  actions: { label: string; type: string }[];
}

/** Un módulo que se puede abrir: enlace a otra zona, el Modo enfoque o la música. */
export const isModule = (s: ZoneSection) => Boolean(s.to) || s.type === 'focus' || s.type === 'music';

const ROUTE_ICONS: Array<[RegExp, LucideIcon]> = [
  [/^\/learning\?tab=academico/, GraduationCap], [/^\/learning/, BookOpen], [/^\/finances/, Wallet], [/^\/coliseo/, Swords],
  [/^\/sleep/, Moon], [/^\/food/, UtensilsCrossed], [/^\/libreta/, Notebook], [/^\/agenda/, CalendarDays], [/^\/recreacion/, Clapperboard],
];
export function moduleIcon(s: ZoneSection): LucideIcon {
  if (s.type === 'focus') return Zap;
  if (s.type === 'music') return Music;
  return ROUTE_ICONS.find(([re]) => re.test(s.to ?? ''))?.[1] ?? CheckCircle2;
}

const link = (title: string, description: string, to: string): ZoneSection => ({ type: 'link', title, description, to });

const TEMPLATES: Record<Locale, ZoneTemplate[]> = {
  es: [
    {
      id: 'study', name: 'Estudio', description: 'Notas, temas por dominar y entregas, con enfoque y música para concentrarte.', icon: 'cap', color: '#548f6f',
      isMeasurable: true, measureReason: 'Mide tus misiones cumplidas y tu racha de repaso.',
      sections: [link('Académico', 'Materias, notas y entregas', '/learning?tab=academico'), { type: 'focus', title: 'Modo enfoque', description: 'Sesión con temporizador' }, { type: 'music', title: 'Música para estudiar', description: 'Lo-fi, piano y ruido blanco' }, link('Biblioteca', 'Libros y cursos', '/learning')],
      habits: [{ title: 'Repasar 25 minutos', frequency: 'daily' }, { title: 'Revisar las entregas de la semana', frequency: 'daily' }],
      actions: [{ label: 'Nueva meta de estudio', type: 'study_quest' }, { label: 'Nuevo hábito', type: 'new_habit' }],
    },
    {
      id: 'work', name: 'Trabajo', description: 'Tu agenda, bloques de trabajo profundo y la oficina para documentos y hojas.', icon: 'work', color: '#3b7ea6',
      isMeasurable: true, measureReason: 'Mide los proyectos que cierras.',
      sections: [link('Agenda', 'Reuniones y fechas', '/agenda'), { type: 'focus', title: 'Trabajo profundo', description: 'Sin distracciones' }, link('Oficina', 'Documentos, hojas y presentaciones', '/libreta?vista=oficina')],
      habits: [{ title: 'Planear el día en 5 minutos', frequency: 'daily' }, { title: 'Un bloque de trabajo profundo', frequency: 'daily' }],
      actions: [{ label: 'Nuevo proyecto', type: 'new_quest' }, { label: 'Nuevo hábito', type: 'new_habit' }],
    },
    {
      id: 'health', name: 'Salud', description: 'Movimiento, descanso y comida en un mismo lugar.', icon: 'heart', color: '#3a9b67',
      isMeasurable: true, measureReason: 'Mide tu racha de hábitos de salud.',
      sections: [link('Coliseo', 'Entrenamientos', '/coliseo'), link('Sueño', 'Cómo descansas', '/sleep'), link('Comida', 'Lo que comes', '/food')],
      habits: [{ title: 'Tomar agua al despertar', frequency: 'daily' }, { title: 'Caminar 20 minutos', frequency: 'daily' }],
      actions: [{ label: 'Nuevo reto', type: 'new_quest' }, { label: 'Nuevo hábito', type: 'new_habit' }],
    },
    {
      id: 'finance', name: 'Finanzas', description: 'Tus carteras, presupuestos y una hoja para tus cuentas.', icon: 'money', color: '#b08d57',
      isMeasurable: true, measureReason: 'Mide tus metas de ahorro cumplidas.',
      sections: [link('Carteras y movimientos', 'Nequi, cuentas, tarjetas y efectivo', '/finances'), link('Hoja de cálculo', 'Tus cuentas con fórmulas', '/libreta?vista=oficina')],
      habits: [{ title: 'Anotar los gastos del día', frequency: 'daily' }, { title: 'Un día sin antojos', frequency: 'daily' }],
      actions: [{ label: 'Nueva meta de ahorro', type: 'new_quest' }, { label: 'Nuevo hábito', type: 'new_habit' }],
    },
    {
      id: 'creativity', name: 'Creatividad', description: 'Un espacio para crear: la Libreta, tu música y lo que te inspira.', icon: 'palette', color: '#d4952a',
      isMeasurable: false, measureReason: 'Aquí importa crear, no contar.',
      sections: [link('Libreta', 'Escribe, dibuja y pega ideas', '/libreta'), { type: 'music', title: 'Música', description: 'Lo que te inspira' }, link('Recreación', 'Lo que ves y vives', '/recreacion')],
      habits: [{ title: 'Crear 20 minutos', frequency: 'daily' }, { title: 'Anotar una idea', frequency: 'daily' }],
      actions: [{ label: 'Nuevo proyecto creativo', type: 'new_quest' }, { label: 'Nuevo hábito', type: 'new_habit' }],
    },
  ],
  en: [
    {
      id: 'study', name: 'Study', description: 'Grades, topics to master and hand-ins, with focus and music to concentrate.', icon: 'cap', color: '#548f6f',
      isMeasurable: true, measureReason: 'Tracks the goals you complete and your review streak.',
      sections: [link('Academic', 'Courses, grades and hand-ins', '/learning?tab=academico'), { type: 'focus', title: 'Focus mode', description: 'A timed session' }, { type: 'music', title: 'Study music', description: 'Lo-fi, piano and white noise' }, link('Library', 'Books and courses', '/learning')],
      habits: [{ title: 'Review for 25 minutes', frequency: 'daily' }, { title: 'Check this week’s hand-ins', frequency: 'daily' }],
      actions: [{ label: 'New study goal', type: 'study_quest' }, { label: 'New habit', type: 'new_habit' }],
    },
    {
      id: 'work', name: 'Work', description: 'Your agenda, deep-work blocks and the office for documents and spreadsheets.', icon: 'work', color: '#3b7ea6',
      isMeasurable: true, measureReason: 'Tracks the projects you close.',
      sections: [link('Agenda', 'Meetings and dates', '/agenda'), { type: 'focus', title: 'Deep work', description: 'No distractions' }, link('Office', 'Documents, sheets and slides', '/libreta?vista=oficina')],
      habits: [{ title: 'Plan the day in 5 minutes', frequency: 'daily' }, { title: 'One deep-work block', frequency: 'daily' }],
      actions: [{ label: 'New project', type: 'new_quest' }, { label: 'New habit', type: 'new_habit' }],
    },
    {
      id: 'health', name: 'Health', description: 'Movement, rest and food in one place.', icon: 'heart', color: '#3a9b67',
      isMeasurable: true, measureReason: 'Tracks your streak of health habits.',
      sections: [link('Coliseum', 'Workouts', '/coliseo'), link('Sleep', 'How you rest', '/sleep'), link('Food', 'What you eat', '/food')],
      habits: [{ title: 'Drink water when you wake up', frequency: 'daily' }, { title: 'Walk for 20 minutes', frequency: 'daily' }],
      actions: [{ label: 'New challenge', type: 'new_quest' }, { label: 'New habit', type: 'new_habit' }],
    },
    {
      id: 'finance', name: 'Money', description: 'Your wallets, budgets and a spreadsheet for your accounts.', icon: 'money', color: '#b08d57',
      isMeasurable: true, measureReason: 'Tracks the savings goals you reach.',
      sections: [link('Wallets and movements', 'Accounts, cards and cash', '/finances'), link('Spreadsheet', 'Your accounts with formulas', '/libreta?vista=oficina')],
      habits: [{ title: 'Log today’s spending', frequency: 'daily' }, { title: 'A day without impulse buys', frequency: 'daily' }],
      actions: [{ label: 'New savings goal', type: 'new_quest' }, { label: 'New habit', type: 'new_habit' }],
    },
    {
      id: 'creativity', name: 'Creativity', description: 'A space to create: the Notebook, your music and what inspires you.', icon: 'palette', color: '#d4952a',
      isMeasurable: false, measureReason: 'Here creating matters, not counting.',
      sections: [link('Notebook', 'Write, draw and paste ideas', '/libreta'), { type: 'music', title: 'Music', description: 'What inspires you' }, link('Recreation', 'What you watch and do', '/recreacion')],
      habits: [{ title: 'Create for 20 minutes', frequency: 'daily' }, { title: 'Write down one idea', frequency: 'daily' }],
      actions: [{ label: 'New creative project', type: 'new_quest' }, { label: 'New habit', type: 'new_habit' }],
    },
  ],
};

export const zoneTemplates = (locale: Locale) => TEMPLATES[locale];
