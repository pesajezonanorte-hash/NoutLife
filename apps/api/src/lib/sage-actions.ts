// Propuestas de cambio en metas financieras que hace el Sabio. El modelo nunca cambia
// nada: al final de su respuesta puede escribir UNA línea «ACCION: {json}». Aquí se
// separa esa línea del texto y se valida con el mismo esquema que usa el endpoint de
// aplicar; el cambio solo ocurre cuando la persona lo confirma en la app.
import { z } from 'zod';
import { extractJsonObject } from './json-extract';

const COP_MAX = 1_000_000_000_000;
const money = z.number().positive().max(COP_MAX);
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe ser AAAA-MM-DD.');
const goalId = z.string().trim().min(1).max(60);
const goalTitle = z.string().trim().min(1).max(120);

/** Lo que el Sabio (o la app, al confirmar) puede hacer con las metas financieras. */
export const sageFinanceActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create_goal'),
    title: goalTitle,
    targetAmount: money,
    deadline: isoDay.optional(),
  }).strict(),
  z.object({
    action: z.literal('update_goal'),
    goalId,
    title: goalTitle.optional(),
    targetAmount: money.optional(),
    deadline: isoDay.nullable().optional(),
  }).strict(),
  z.object({
    action: z.literal('contribute_goal'),
    goalId,
    amount: money,
  }).strict(),
]).superRefine((value, ctx) => {
  // Un cambio sin nada que cambiar no es una propuesta.
  if (value.action === 'update_goal' && value.title === undefined && value.targetAmount === undefined && value.deadline === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Indica qué cambiar en la meta.' });
  }
});

export type SageFinanceAction = z.infer<typeof sageFinanceActionSchema>;

const MARKER = /^\s*ACCION:\s*/i;

/**
 * Separa la línea «ACCION: {…}» de la respuesta. El texto sale sin ella; la acción
 * solo se devuelve si es válida (si no, se descarta en silencio).
 */
export function splitSageAction(raw: string): { text: string; action: SageFinanceAction | null } {
  const lines = raw.split('\n');
  let at = -1;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (MARKER.test(lines[i])) { at = i; break; }
  }
  if (at < 0) return { text: raw.trim(), action: null };

  // El JSON puede venir en la misma línea o en las siguientes (bloque de código): todo lo que sigue es la propuesta.
  const payload = [lines[at].replace(MARKER, ''), ...lines.slice(at + 1)].join('\n');
  const text = lines.slice(0, at).join('\n').trim();
  const parsed = sageFinanceActionSchema.safeParse(extractJsonObject(payload));
  return { text, action: parsed.success ? parsed.data : null };
}

/** Texto que acompaña a una propuesta cuando el modelo solo escribió la línea de acción. */
export const SAGE_ACTION_LEAD: Record<'es' | 'en', string> = {
  es: 'Te propongo este cambio en tus metas. Si estás de acuerdo, confírmalo abajo.',
  en: 'I suggest this change to your goals. If you agree, confirm it below.',
};

/** Instrucciones de propuesta para el chat (no para los botones de análisis). */
export const SAGE_ACTION_INSTRUCTIONS: Record<'es' | 'en', string> = {
  es: [
    'METAS FINANCIERAS: puedes PROPONER crear una meta, cambiar su monto, título o fecha, o registrar un aporte, solo si la persona lo pide con cifras claras.',
    'Nunca digas que ya lo hiciste: la persona lo confirma con un botón.',
    'Si propones un cambio, termina tu respuesta con UNA sola línea, sin formato extra:',
    'ACCION: {"action":"create_goal","title":"…","targetAmount":número_en_COP,"deadline":"AAAA-MM-DD"}',
    'ACCION: {"action":"update_goal","goalId":"id de la lista","targetAmount":número,"title":"…","deadline":"AAAA-MM-DD" o null}',
    'ACCION: {"action":"contribute_goal","goalId":"id de la lista","amount":número_en_COP}',
    'Incluye solo los campos que cambian. Si falta una cifra, pregunta en vez de proponer.',
  ].join('\n'),
  en: [
    'FINANCIAL GOALS: you may PROPOSE creating a goal, changing its amount, title or date, or logging a contribution, only when the person asks with clear figures.',
    'Never say you already did it: the person confirms with a button.',
    'If you propose a change, end your reply with ONE single line, no extra formatting:',
    'ACCION: {"action":"create_goal","title":"…","targetAmount":number_in_COP,"deadline":"YYYY-MM-DD"}',
    'ACCION: {"action":"update_goal","goalId":"id from the list","targetAmount":number,"title":"…","deadline":"YYYY-MM-DD" or null}',
    'ACCION: {"action":"contribute_goal","goalId":"id from the list","amount":number_in_COP}',
    'Include only the fields that change. If a figure is missing, ask instead of proposing.',
  ].join('\n'),
};
