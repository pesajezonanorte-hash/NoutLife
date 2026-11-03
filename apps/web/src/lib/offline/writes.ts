// Escrituras que funcionan sin conexión. Cada una sabe tres cosas:
//   plan     qué responder ya a quien la pidió (la misma forma que la API) y cómo queda la cola.
//   reads    cómo se ve reflejada en las lecturas mientras sigue pendiente.
// Las lecturas guardadas son siempre la verdad del servidor: lo pendiente se aplica encima al leer. Así, si
// una escritura se rechaza al sincronizar, su efecto desaparece solo y no hay nada que deshacer.
// Lógica pura: sin red ni almacenamiento (se prueba en tests/unit/offline.unit.ts).
import { dayKey, pathnameOf, queryOf } from './policy';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Data = any;
type Json = Record<string, any>;

export type WriteMethod = 'post' | 'put' | 'patch' | 'delete';

export interface QueuedWrite {
  /** Orden de la cola (lo da el almacén). */
  id?: number;
  userId: string;
  kind: string;
  method: WriteMethod;
  path: string;
  body: Json | null;
  at: number;
  /** Clave de idempotencia: un reenvío de la misma escritura no se aplica dos veces. */
  key: string;
  /** El recurso al que afecta (su id real o el temporal). */
  target?: string;
  extra?: Json;
}

export interface WriteContext {
  user: Json | null;
  /** Lo que ve la persona ahora: lo guardado más lo pendiente. */
  read: (path: string) => Promise<Data>;
  queue: QueuedWrite[];
  now: number;
  newId: () => string;
}

export interface WritePlan {
  /** Lo que entra en la cola (null si se anuló contra algo pendiente). */
  write: (Omit<QueuedWrite, 'id' | 'userId' | 'at' | 'key' | 'method' | 'path' | 'kind'> & { kind?: string }) | null;
  /** Lo que sale de la cola: anulado o sustituido por esta escritura. */
  removes?: QueuedWrite[];
  /** Si la escritura va dentro de otra pendiente (p. ej. editar lo que aún no se creó): su cuerpo nuevo. */
  merges?: { into: QueuedWrite; body: Json };
  response: Data;
  status?: number;
}

interface ReadPatch {
  path: RegExp;
  apply: (data: Data, write: QueuedWrite, ctx: { match: RegExpMatchArray; query: URLSearchParams; now: number }) => Data;
}

interface WriteDef {
  kind: string;
  method: WriteMethod;
  path: RegExp;
  /** Crea un recurso: su id temporal se cambia por el real al sincronizar. */
  creates?: (response: Data) => string | undefined;
  plan: (ctx: WriteContext, match: RegExpMatchArray, body: Json) => Promise<WritePlan> | WritePlan;
  reads: ReadPatch[];
}

const iso = (at: number) => new Date(at).toISOString();
const list = (value: unknown): any[] => (Array.isArray(value) ? value : []);
const without = (items: any[], id?: string) => items.filter((x) => x?.id !== id);
const merge = (items: any[], id: string | undefined, patch: Json) => items.map((x) => (x?.id === id ? { ...x, ...patch } : x));
/** Lee una propiedad-lista de la respuesta y la devuelve cambiada; una respuesta sin esa forma no se toca. */
const inList = (data: Data, key: string, change: (items: any[]) => any[]) => (data && typeof data === 'object' ? { ...data, [key]: change(list(data[key])) } : data);

/* ─── Hábitos ─── */

const HABITS = /^\/habits$/;
const HABIT = /^\/habits\/([^/]+)$/;
const HEATMAP = /^\/habits\/([^/]+)\/heatmap$/;
const DASHBOARD = /^\/dashboard$/;

const isDone = (h: Json) => Boolean(h?.todayCompleted) || h?.todayStatus === 'completed';

function logged(h: Json, status: string): Json {
  const done = status === 'completed';
  const streak = Number(h.currentStreak ?? 0);
  const currentStreak = done && !isDone(h) ? streak + 1 : status === 'failed' ? 0 : streak;
  return { ...h, todayStatus: status, todayCompleted: done, currentStreak, longestStreak: Math.max(Number(h.longestStreak ?? 0), currentStreak) };
}

function unlogged(h: Json): Json {
  return { ...h, todayStatus: 'pending', todayCompleted: false, currentStreak: isDone(h) ? Math.max(0, Number(h.currentStreak ?? 0) - 1) : h.currentStreak };
}

/** Aplica un cambio al hábito donde sea que se lea: lista, detalle e Inicio. */
function habitReads(change: (h: Json, w: QueuedWrite, now: number) => Json, applies: (w: QueuedWrite, now: number) => boolean = () => true): ReadPatch[] {
  const one = (w: QueuedWrite, now: number) => (h: Json) => (h?.id === w.target && applies(w, now) ? change(h, w, now) : h);
  return [
    { path: HABITS, apply: (d, w, { now }) => inList(d, 'habits', (l) => l.map(one(w, now))) },
    { path: DASHBOARD, apply: (d, w, { now }) => inList(d, 'todayHabits', (l) => l.map(one(w, now))) },
    { path: HABIT, apply: (d, w, { match, now }) => (match[1] === w.target && d?.habit ? { ...d, habit: one(w, now)(d.habit) } : d) },
  ];
}

const findHabit = async (ctx: WriteContext, id: string): Promise<Json> => list((await ctx.read('/habits'))?.habits).find((h) => h.id === id) ?? { id };
const sameDay = (w: QueuedWrite, now: number) => w.extra?.day === dayKey(now);

const habitDefs: WriteDef[] = [
  {
    kind: 'habit.log',
    method: 'post',
    path: /^\/habits\/([^/]+)\/log$/,
    plan: async (ctx, m, body) => {
      const id = m[1];
      const day = (body.date as string | undefined) ?? dayKey(ctx.now);
      const status = String(body.status);
      const current = await findHabit(ctx, id);
      const habit = day === dayKey(ctx.now) ? logged(current, status) : current;
      const result = {
        success: true,
        log: { id: `offline-log-${id}-${day}`, habitId: id, userId: ctx.user?.id, completed: status === 'completed', status, date: day, notes: body.notes, loggedAt: iso(ctx.now) },
        habit,
        currentStreak: habit.currentStreak ?? 0,
        longestStreak: habit.longestStreak ?? 0,
        rewards: null,
        achievementsUnlocked: [],
      };
      // Volver a marcar lo que se desmarcó sin conexión: el servidor nunca supo nada.
      const undo = ctx.queue.find((w) => w.kind === 'habit.undo' && w.target === id && w.extra?.day === day);
      if (undo && status === 'completed') return { write: null, removes: [undo], response: result };
      // El día va en el cuerpo: si sincroniza mañana, cuenta para hoy.
      return { write: { target: id, body: { ...body, date: day }, extra: { day } }, removes: ctx.queue.filter((w) => w.kind === 'habit.log' && w.target === id && w.extra?.day === day), response: result };
    },
    reads: [
      ...habitReads((h, w) => logged(h, String(w.body?.status)), sameDay),
      {
        path: HEATMAP,
        apply: (d, w, { match }) => (match[1] === w.target
          ? inList(d, 'heatmap', (l) => [...l.filter((x) => String(x.date).slice(0, 10) !== w.extra?.day), { date: w.extra?.day, status: w.body?.status, completed: w.body?.status === 'completed' }])
          : d),
      },
    ],
  },
  {
    kind: 'habit.undo',
    method: 'post',
    path: /^\/habits\/([^/]+)\/log\/undo$/,
    plan: async (ctx, m) => {
      const id = m[1];
      const day = dayKey(ctx.now);
      const current = await findHabit(ctx, id);
      const habit = unlogged(current);
      const result = {
        undone: isDone(current), xpRemoved: 0, goldRemoved: 0,
        log: { id: `offline-log-${id}-${day}`, habitId: id, completed: false, status: 'pending', date: day },
        habit, currentStreak: habit.currentStreak ?? 0, longestStreak: habit.longestStreak ?? 0,
      };
      // Marcado y desmarcado sin conexión: se anulan y el servidor no se entera.
      const log = ctx.queue.find((w) => w.kind === 'habit.log' && w.target === id && w.extra?.day === day);
      if (log) return { write: null, removes: [log], response: result };
      return { write: { target: id, body: null, extra: { day } }, response: result };
    },
    reads: [
      ...habitReads((h) => unlogged(h), sameDay),
      { path: HEATMAP, apply: (d, w, { match }) => (match[1] === w.target ? inList(d, 'heatmap', (l) => l.filter((x) => String(x.date).slice(0, 10) !== w.extra?.day)) : d) },
    ],
  },
  {
    kind: 'habit.step',
    method: 'post',
    path: /^\/habits\/([^/]+)\/steps\/([^/]+)$/,
    plan: async (ctx, m, body) => {
      const [, id, stepId] = m;
      const updated = withStep(await findHabit(ctx, id), stepId, Boolean(body.completed));
      return {
        write: { target: id, body, extra: { stepId } },
        removes: ctx.queue.filter((w) => w.kind === 'habit.step' && w.target === id && w.extra?.stepId === stepId),
        response: { stepIds: updated.todayStepIds, completed: Boolean(updated.todayCompleted) },
      };
    },
    reads: habitReads((h, w) => withStep(h, String(w.extra?.stepId), Boolean(w.body?.completed))),
  },
  {
    kind: 'habit.create',
    method: 'post',
    path: HABITS,
    creates: (r) => r?.habit?.id,
    plan: (ctx, _m, body) => {
      const id = ctx.newId();
      return { write: { target: id, body, extra: { entity: newHabit(id, body, ctx) } }, response: { habit: newHabit(id, body, ctx) }, status: 201 };
    },
    reads: [
      { path: HABITS, apply: (d, w) => inList(d, 'habits', (l) => [...without(l, w.target), w.extra?.entity]) },
      { path: DASHBOARD, apply: (d, w) => inList(d, 'todayHabits', (l) => [...without(l, w.target), w.extra?.entity]) },
      { path: HABIT, apply: (d, w, { match }) => (match[1] === w.target ? { ...d, habit: w.extra?.entity } : d) },
      { path: HEATMAP, apply: (d, w, { match }) => (match[1] === w.target ? { ...d, heatmap: d?.heatmap ?? [] } : d) },
    ],
  },
  {
    kind: 'habit.update',
    method: 'patch',
    path: HABIT,
    plan: async (ctx, m, body) => {
      const id = m[1];
      const patch = habitPatch(body, ctx);
      const response = { habit: { ...(await findHabit(ctx, id)), ...patch } };
      const created = ctx.queue.find((w) => w.kind === 'habit.create' && w.target === id);
      if (created) return { write: null, merges: { into: created, body: { ...created.body, ...body } }, response };
      const earlier = ctx.queue.find((w) => w.kind === 'habit.update' && w.target === id);
      return {
        write: { target: id, body: { ...earlier?.body, ...body }, extra: { patch: { ...earlier?.extra?.patch, ...patch } } },
        removes: earlier ? [earlier] : [],
        response,
      };
    },
    reads: habitReads((h, w) => ({ ...h, ...w.extra?.patch })),
  },
  {
    kind: 'habit.delete',
    method: 'delete',
    path: HABIT,
    plan: (ctx, m) => {
      const id = m[1];
      const related = ctx.queue.filter((w) => w.target === id);
      // Se creó sin conexión: nunca llegó a existir para el servidor.
      if (related.some((w) => w.kind === 'habit.create')) return { write: null, removes: related, response: { success: true } };
      return { write: { target: id, body: null }, removes: related, response: { success: true } };
    },
    reads: [
      { path: HABITS, apply: (d, w) => inList(d, 'habits', (l) => without(l, w.target)) },
      { path: DASHBOARD, apply: (d, w) => inList(d, 'todayHabits', (l) => without(l, w.target)) },
    ],
  },
];

function withStep(h: Json, stepId: string, completed: boolean): Json {
  const done = new Set<string>(list(h.todayStepIds));
  if (completed) done.add(stepId); else done.delete(stepId);
  const stepIds = [...done];
  const steps = list(h.steps);
  const all = steps.length > 0 && steps.every((s) => done.has(s.id));
  return { ...h, todayStepIds: stepIds, todayCompleted: all, todayStatus: all ? 'completed' : h.todayStatus === 'completed' ? 'pending' : h.todayStatus };
}

/** En la API los pasos se mandan como títulos; en la lectura son objetos. */
function habitPatch(body: Json, ctx: WriteContext): Json {
  if (!Array.isArray(body.steps)) return body;
  return { ...body, steps: body.steps.map((title: string, order: number) => ({ id: `${ctx.newId()}-${order}`, title, order })) };
}

function newHabit(id: string, body: Json, ctx: WriteContext): Json {
  return {
    userId: ctx.user?.id, description: '', category: 'other', icon: 'check', color: '', xpReward: 10, goldReward: 5, currentStreak: 0, longestStreak: 0,
    frequency: { type: 'daily', days: [] }, resetTime: '00:00', reminderTime: null, reminderEndTime: null, isActive: true, syncToGoogleCalendar: false,
    createsColiseoAttendance: false, kind: 'habit', todayStepIds: [], todayStatus: null, todayCompleted: null,
    ...habitPatch(body, ctx), id, createdAt: iso(ctx.now), updatedAt: iso(ctx.now),
  };
}

/* ─── Colecciones simples: crear, editar y borrar ─── */

interface Collection {
  name: string;
  /** Ruta de la colección y de un elemento. */
  base: string;
  /** Propiedad con el elemento en las respuestas (`{ event }`) y con la lista al leerla (`{ events }`). */
  one: string;
  many: string;
  /** Lo que el servidor pondría y la API no recibe. */
  defaults?: (body: Json, ctx: WriteContext) => Json;
  /** ¿Aparece el elemento en esta lista filtrada? */
  inView?: (item: Json, query: URLSearchParams, now: number) => boolean;
  /** Otras lecturas donde se ve la colección. */
  also?: { path: RegExp; key: string; inView?: (item: Json, now: number) => boolean; sort?: (a: Json, b: Json) => number }[];
}

function collection(c: Collection): WriteDef[] {
  const LIST = new RegExp(`^${c.base}$`);
  const ITEM = new RegExp(`^${c.base}/([^/]+)$`);
  const current = async (ctx: WriteContext, id: string): Promise<Json> => {
    const direct = await ctx.read(`${c.base}/${id}`);
    return direct?.[c.one] ?? list((await ctx.read(c.base))?.[c.many]).find((x) => x.id === id) ?? { id };
  };
  const views = (change: (items: any[], w: QueuedWrite, now: number, query: URLSearchParams) => any[]): ReadPatch[] => [
    { path: LIST, apply: (d, w, { query, now }) => inList(d, c.many, (l) => change(l, w, now, query)) },
    ...(c.also ?? []).map((a) => ({
      path: a.path,
      apply: (d: Data, w: QueuedWrite, { query, now }: { query: URLSearchParams; now: number }) => inList(d, a.key, (l) => {
        const next = change(l, w, now, query).filter((x) => !a.inView || a.inView(x, now));
        return a.sort ? [...next].sort(a.sort) : next;
      }),
    })),
  ];
  return [
    {
      kind: `${c.name}.create`,
      method: 'post',
      path: LIST,
      creates: (r) => r?.[c.one]?.id,
      plan: (ctx, _m, body) => {
        const id = ctx.newId();
        const entity = { ...c.defaults?.(body, ctx), ...body, id, userId: ctx.user?.id, createdAt: iso(ctx.now), updatedAt: iso(ctx.now) };
        return { write: { target: id, body, extra: { entity } }, response: { [c.one]: entity }, status: 201 };
      },
      reads: [
        ...views((l, w, now, query) => (!c.inView || c.inView(w.extra?.entity, query, now) ? [w.extra?.entity, ...without(l, w.target)] : l)),
        { path: ITEM, apply: (d, w, { match }) => (match[1] === w.target ? { ...d, [c.one]: w.extra?.entity } : d) },
      ],
    },
    {
      kind: `${c.name}.update`,
      method: 'patch',
      path: ITEM,
      plan: async (ctx, m, body) => {
        const id = m[1];
        const response = { [c.one]: { ...(await current(ctx, id)), ...body, updatedAt: iso(ctx.now) } };
        const created = ctx.queue.find((w) => w.kind === `${c.name}.create` && w.target === id);
        if (created) return { write: null, merges: { into: created, body: { ...created.body, ...body } }, response };
        const earlier = ctx.queue.find((w) => w.kind === `${c.name}.update` && w.target === id);
        return { write: { target: id, body: { ...earlier?.body, ...body } }, removes: earlier ? [earlier] : [], response };
      },
      reads: [
        ...views((l, w) => merge(l, w.target, w.body ?? {})),
        { path: ITEM, apply: (d, w, { match }) => (match[1] === w.target && d?.[c.one] ? { ...d, [c.one]: { ...d[c.one], ...w.body } } : d) },
      ],
    },
    {
      kind: `${c.name}.delete`,
      method: 'delete',
      path: ITEM,
      plan: (ctx, m) => {
        const id = m[1];
        const related = ctx.queue.filter((w) => w.target === id);
        if (related.some((w) => w.kind === `${c.name}.create`)) return { write: null, removes: related, response: { success: true } };
        return { write: { target: id, body: null }, removes: related, response: { success: true } };
      },
      reads: views((l, w) => without(l, w.target)),
    },
  ];
}

const inRange = (item: Json, query: URLSearchParams) => {
  const start = new Date(item.startDate).getTime();
  const from = query.get('from');
  const to = query.get('to');
  const day = query.get('date');
  if (day) return dayKey(start) === day.slice(0, 10);
  return (!from || start >= new Date(from).getTime()) && (!to || start <= new Date(to).getTime());
};

const eventDefs = collection({
  name: 'event',
  base: '/agenda',
  one: 'event',
  many: 'events',
  defaults: () => ({ isCompleted: false, eventType: 'personal', isAllDay: false, category: 'personal' }),
  inView: inRange,
  also: [{
    path: /^\/agenda\/upcoming$/,
    key: 'events',
    inView: (item, now) => new Date(item.endDate ?? item.startDate).getTime() >= now && !item.isCompleted,
    sort: (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  }],
});

const questDefs: WriteDef[] = [
  ...collection({
    name: 'quest',
    base: '/quests',
    one: 'quest',
    many: 'quests',
    defaults: () => ({ status: 'ACTIVE', xpReward: 0, goldReward: 0, isRecurring: false, subObjectives: [] }),
    inView: (item, query) => ['status', 'type', 'category', 'difficulty'].every((k) => !query.get(k) || item[k] === query.get(k)),
    also: [{ path: /^\/dashboard$/, key: 'todayQuests', inView: (item) => item.status === 'ACTIVE' }],
  }),
  {
    kind: 'quest.complete',
    method: 'post',
    path: /^\/quests\/([^/]+)\/complete$/,
    plan: async (ctx, m) => {
      const id = m[1];
      const quest = list((await ctx.read('/quests'))?.quests).find((q) => q.id === id);
      // La recompensa real la da el servidor al sincronizar; aquí, la anunciada en la misión.
      return {
        write: { target: id, body: null },
        response: { success: true, rewards: { xpEarned: Number(quest?.xpReward ?? 0), goldEarned: Number(quest?.goldReward ?? 0), leveledUp: false }, achievementsUnlocked: [], user: ctx.user },
      };
    },
    reads: [
      { path: /^\/quests$/, apply: (d, w, { now, query }) => inList(d, 'quests', (l) => (query.get('status') === 'ACTIVE' ? without(l, w.target) : merge(l, w.target, { status: 'COMPLETED', completedAt: iso(now) }))) },
      { path: DASHBOARD, apply: (d, w) => inList(d, 'todayQuests', (l) => without(l, w.target)) },
    ],
  },
  {
    kind: 'quest.step',
    method: 'patch',
    path: /^\/quests\/([^/]+)\/subobjective$/,
    plan: async (ctx, m, body) => {
      const id = m[1];
      const quest = list((await ctx.read('/quests'))?.quests).find((q) => q.id === id) ?? { id, subObjectives: [] };
      return { write: { target: id, body }, response: { quest: { ...quest, subObjectives: withSubObjective(quest.subObjectives, body) } } };
    },
    reads: [{ path: /^\/quests$/, apply: (d, w) => inList(d, 'quests', (l) => l.map((q) => (q.id === w.target ? { ...q, subObjectives: withSubObjective(q.subObjectives, w.body ?? {}) } : q))) }],
  },
];

const withSubObjective = (items: unknown, body: Json) => list(items).map((s) => (s.id === body.subObjectiveId ? { ...s, completed: Boolean(body.completed) } : s));

const journalDefs = collection({
  name: 'journal',
  base: '/journal',
  one: 'entry',
  many: 'entries',
  defaults: (_b, ctx) => ({ tags: [], date: iso(ctx.now) }),
  inView: (item, query) => !query.get('month') || String(item.date).startsWith(String(query.get('month'))),
});

/* ─── Libreta ─── */

const isBlankPage = (c: Json | null) => !c || (!String(c.html ?? '').replace(/<[^>]*>/g, '').trim() && !list(c.strokes).length && !list(c.stickies).length && !list(c.images).length);
const PAGE = /^\/notebooks\/([^/]+)\/pages\/(\d+)$/;
const IMAGE = /^\/notebooks\/([^/]+)\/images\/([^/]+)$/;

const notebookDefs: WriteDef[] = [
  ...collection({
    name: 'notebook',
    base: '/notebooks',
    one: 'notebook',
    many: 'notebooks',
    defaults: () => ({ usedPages: 0 }),
  }),
  {
    // Cada guardado sustituye al anterior de la misma hoja: va al final de la cola, después de las imágenes que nombra.
    kind: 'notebook.page',
    method: 'put',
    path: PAGE,
    plan: (ctx, m, body) => {
      const updatedAt = iso(ctx.now);
      return {
        write: { target: m[1], body, extra: { updatedAt } },
        removes: ctx.queue.filter((w) => w.kind === 'notebook.page' && w.path === m[0]),
        response: { page: isBlankPage(body) ? null : { index: Number(m[2]), content: body, updatedAt } },
      };
    },
    reads: [{ path: PAGE, apply: (d, w, { match }) => (w.path === match[0] ? { ...d, page: isBlankPage(w.body) ? null : { content: w.body, updatedAt: w.extra?.updatedAt } } : d) }],
  },
  {
    kind: 'notebook.image',
    method: 'post',
    path: /^\/notebooks\/([^/]+)\/images$/,
    creates: (r) => r?.image?.id,
    plan: (ctx, m, body) => {
      const id = ctx.newId();
      return { write: { target: id, body, extra: { notebook: m[1] } }, response: { image: { id } }, status: 201 };
    },
    reads: [{ path: IMAGE, apply: (d, w, { match }) => (match[2] === w.target ? { ...d, image: w.body } : d) }],
  },
];

/* ─── Perfil y ajustes ─── */

const settingDefs: WriteDef[] = [
  {
    kind: 'profile.update',
    method: 'patch',
    path: /^\/users\/me\/profile$/,
    plan: (ctx, _m, body) => {
      const earlier = ctx.queue.find((w) => w.kind === 'profile.update');
      return { write: { body: { ...earlier?.body, ...body } }, removes: earlier ? [earlier] : [], response: { user: { ...ctx.user, ...body } } };
    },
    reads: [{ path: /^\/users\/me\/character$/, apply: (d, w) => (d ? { ...d, ...w.body } : d) }],
  },
  {
    kind: 'avatar.update',
    method: 'put',
    path: /^\/users\/me\/avatar$/,
    plan: (ctx, _m, body) => {
      const earlier = ctx.queue.find((w) => w.kind === 'avatar.update');
      return {
        write: { body: { ...earlier?.body, ...body } },
        removes: earlier ? [earlier] : [],
        response: { user: { ...ctx.user, avatarConfig: { ...ctx.user?.avatarConfig, ...body } } },
      };
    },
    reads: [{ path: /^\/users\/me\/character$/, apply: (d, w) => (d ? { ...d, avatarConfig: { ...d.avatarConfig, ...w.body } } : d) }],
  },
  {
    kind: 'prefs.update',
    method: 'patch',
    path: /^\/notifications\/preferences$/,
    plan: async (ctx, _m, body) => {
      const current = (await ctx.read('/notifications/preferences'))?.preferences ?? {};
      const earlier = ctx.queue.find((w) => w.kind === 'prefs.update');
      const merged = { ...earlier?.body, ...body, reminderSettings: mergeZones(earlier?.body?.reminderSettings, body.reminderSettings) };
      if (!merged.reminderSettings) delete merged.reminderSettings;
      return { write: { body: merged }, removes: earlier ? [earlier] : [], response: { preferences: withPrefs(current, body) } };
    },
    reads: [{ path: /^\/notifications\/preferences$/, apply: (d, w) => (d?.preferences ? { ...d, preferences: withPrefs(d.preferences, w.body ?? {}) } : d) }],
  },
];

function mergeZones(a: Json | undefined, b: Json | undefined): Json | undefined {
  if (!a && !b) return undefined;
  const out: Json = { ...a };
  for (const [zone, patch] of Object.entries(b ?? {})) out[zone] = { ...out[zone], ...(patch as Json) };
  return out;
}

function withPrefs(prefs: Json, body: Json): Json {
  const { reminderSettings, categoryPreferences, ...rest } = body;
  return {
    ...prefs,
    ...rest,
    ...(categoryPreferences ? { categories: categoryPreferences } : {}),
    ...(reminderSettings ? { reminderSettings: mergeZones(prefs.reminderSettings, reminderSettings) } : {}),
  };
}

/* ─── Tabla ─── */

const DEFS: WriteDef[] = [...habitDefs, ...eventDefs, ...questDefs, ...journalDefs, ...notebookDefs, ...settingDefs];
const BY_KIND = new Map(DEFS.map((d) => [d.kind, d]));

/** La definición de esta escritura, si funciona sin conexión. `/agenda/google/…` y compañía no. */
export function findWrite(method: string, path: string): { def: WriteDef; match: RegExpMatchArray } | null {
  const clean = pathnameOf(path);
  if (clean.startsWith('/agenda/google')) return null;
  for (const def of DEFS) {
    if (def.method !== method) continue;
    const match = clean.match(def.path);
    if (match) return { def, match };
  }
  return null;
}

/** ¿Crea un recurso? Entonces su respuesta trae el id real que sustituye al temporal. */
export const createdIdOf = (kind: string, response: Data) => BY_KIND.get(kind)?.creates?.(response);

/** Lo que se ve en una lectura con lo pendiente aplicado encima, en orden. */
export function overlayWrites(path: string, data: Data, queue: QueuedWrite[], now: number): Data {
  if (!queue.length) return data;
  const clean = pathnameOf(path);
  const query = queryOf(path);
  let out = data;
  for (const write of queue) {
    const def = BY_KIND.get(write.kind);
    if (!def) continue;
    for (const patch of def.reads) {
      const match = clean.match(patch.path);
      if (match) out = patch.apply(out, write, { match, query, now });
    }
  }
  return out;
}

const NEW_DAY: RegExp[] = [HABITS, HABIT, DASHBOARD];
const resetToday = (h: Json) => (h && typeof h === 'object' ? { ...h, todayStatus: null, todayCompleted: null, todayStepIds: [] } : h);

/**
 * Una lectura guardada ayer dice cómo iba el día de ayer: los hábitos vuelven a estar por hacer.
 * (Sin conexión no se puede preguntar; con ella, esto solo se ve hasta que llega la respuesta.)
 */
export function forNewDay(path: string, data: Data, fetchedAt: number, now: number): Data {
  if (dayKey(fetchedAt) === dayKey(now)) return data;
  const clean = pathnameOf(path);
  if (!NEW_DAY.some((re) => re.test(clean)) || !data || typeof data !== 'object') return data;
  if (HABITS.test(clean)) return inList(data, 'habits', (l) => l.map(resetToday));
  if (DASHBOARD.test(clean)) return inList(data, 'todayHabits', (l) => l.map(resetToday));
  return data.habit ? { ...data, habit: resetToday(data.habit) } : data;
}

/** El cuerpo al enviarse: el registro de un hábito lleva la fecha solo si ya no es hoy (el servidor decide qué es hoy). */
export function bodyForSend(write: QueuedWrite, now: number): Json | null {
  if (write.kind === 'habit.log' && write.body?.date === dayKey(now)) {
    const { date: _date, ...rest } = write.body;
    return rest;
  }
  return write.body;
}

/** Una lectura sin copia exacta, sin conexión: se arma con otras guardadas de la misma colección. */
export function fallbackFrom(path: string, others: { path: string; data: Data }[]): Data | undefined {
  const clean = pathnameOf(path);
  const query = queryOf(path);
  const ranged = clean === '/agenda' ? { key: 'events', keep: (x: Json) => inRange(x, query) }
    : clean === '/quests' ? { key: 'quests', keep: (x: Json) => ['status', 'type', 'category', 'difficulty'].every((k) => !query.get(k) || x[k] === query.get(k)) }
      : null;
  if (!ranged || !others.length) return undefined;
  const byId = new Map<string, Json>();
  for (const other of others) for (const item of list(other.data?.[ranged.key])) if (item?.id) byId.set(item.id, item);
  return { [ranged.key]: [...byId.values()].filter(ranged.keep) };
}
