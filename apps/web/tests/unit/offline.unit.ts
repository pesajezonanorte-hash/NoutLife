import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, isPersistable, readMode, toPath, zoneOfPath } from '../../src/lib/offline/policy';
import { bodyForSend, createdIdOf, fallbackFrom, findWrite, forNewDay, overlayWrites, type QueuedWrite, type WriteContext } from '../../src/lib/offline/writes';

const NOW = new Date(2026, 10, 3, 10, 0).getTime();
const TODAY = dayKey(NOW);
const habit = (over: Record<string, unknown> = {}) => ({ id: 'h1', title: 'Leer', currentStreak: 4, longestStreak: 4, todayStatus: null, todayCompleted: null, steps: [], todayStepIds: [], ...over });

/** Planea una escritura sobre un estado de lecturas y la deja en la cola, como el motor. */
async function plan(queue: QueuedWrite[], reads: Record<string, unknown>, method: string, path: string, body: Record<string, unknown> = {}, now = NOW) {
  const found = findWrite(method, path);
  assert.ok(found, `${method} ${path} debería admitir cola`);
  let counter = 0;
  const context: WriteContext = {
    user: { id: 'u1', displayName: 'Alex' },
    queue,
    now,
    newId: () => `offline-test${(counter += 1)}`,
    read: async (p) => overlayWrites(p, reads[p], queue, now),
  };
  const result = await found.def.plan(context, found.match, body);
  let next = queue.filter((w) => !(result.removes ?? []).includes(w));
  if (result.merges) result.merges.into.body = result.merges.body;
  if (result.write) {
    next = [...next, { id: queue.length + 1, userId: 'u1', kind: found.def.kind, method: found.def.method, path, at: now, key: `k${queue.length}`, target: result.write.target, body: result.write.body, extra: result.write.extra }];
  }
  return { queue: next, response: result.response, status: result.status ?? 200 };
}

test('política: sesión y pagos nunca se guardan; lo esencial sale al instante', () => {
  for (const path of ['/auth/me', '/auth/refresh', '/billing/status', '/admin/users', '/social/live?s=1', '/sage/chat', '/notifications/unread-count']) assert.equal(readMode(path), 'none', path);
  for (const path of ['/habits', '/dashboard', '/agenda?from=a&to=b', '/agenda/upcoming', '/notebooks', '/quests?status=ACTIVE', '/habits/h1/heatmap?days=7']) assert.equal(readMode(path), 'swr', path);
  for (const path of ['/finances/debts', '/notebooks/n1/pages/0', '/notifications/preferences', '/journal?month=2026-11']) assert.equal(readMode(path), 'network', path);
});

test('política: los datos de salud no van al disco', () => {
  assert.equal(isPersistable('/cycle'), false);
  assert.equal(isPersistable('/cycle/overview?x=1'), false);
  assert.equal(isPersistable('/habits'), true);
});

test('política: la ruta se normaliza venga como venga', () => {
  assert.equal(toPath('/api/v1/habits?days=7'), '/habits?days=7');
  assert.equal(toPath('https://lifequest2-api.vercel.app/api/v1/habits'), '/habits');
  assert.equal(toPath('/habits'), '/habits');
});

test('política: una escritura invalida su zona; Inicio depende de todas', () => {
  assert.equal(zoneOfPath('/habits/h1/log'), 'habits');
  assert.equal(zoneOfPath('/habits?x=1'), 'habits');
  assert.equal(zoneOfPath('/dashboard'), '*');
  assert.equal(zoneOfPath('/users/me/profile'), '*');
});

test('solo admiten cola las escrituras conocidas', () => {
  assert.ok(findWrite('post', '/habits/h1/log'));
  assert.ok(findWrite('put', '/notebooks/n1/pages/3'));
  assert.ok(findWrite('patch', '/users/me/profile'));
  assert.equal(findWrite('post', '/agenda/google/sync'), null);
  assert.equal(findWrite('post', '/billing/checkout'), null);
  assert.equal(findWrite('post', '/auth/oauth'), null);
  assert.equal(findWrite('delete', '/agenda/google/disconnect'), null);
});

test('marcar un hábito sin conexión: responde como la API y se ve en lista, Inicio y calendario', async () => {
  const reads = { '/habits': { habits: [habit(), habit({ id: 'h2' })] } };
  const { queue, response } = await plan([], reads, 'post', '/habits/h1/log', { status: 'completed' });
  assert.equal(response.success, true);
  assert.equal(response.rewards, null);
  assert.equal(response.currentStreak, 5);
  assert.equal(response.habit.todayCompleted, true);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].body?.date, TODAY, 'el día queda fijado: si sincroniza mañana cuenta para hoy');

  const list = overlayWrites('/habits', reads['/habits'], queue, NOW);
  assert.equal(list.habits[0].todayStatus, 'completed');
  assert.equal(list.habits[0].currentStreak, 5);
  assert.equal(list.habits[1].todayStatus, null, 'los demás no cambian');

  const home = overlayWrites('/dashboard', { todayHabits: [habit()] }, queue, NOW);
  assert.equal(home.todayHabits[0].todayCompleted, true);

  const heat = overlayWrites('/habits/h1/heatmap?days=7', { heatmap: [] }, queue, NOW);
  assert.deepEqual(heat.heatmap, [{ date: TODAY, status: 'completed', completed: true }]);
});

test('marcar y desmarcar sin conexión se anulan: el servidor no se entera', async () => {
  const reads = { '/habits': { habits: [habit()] } };
  const first = await plan([], reads, 'post', '/habits/h1/log', { status: 'completed' });
  const second = await plan(first.queue, reads, 'post', '/habits/h1/log/undo');
  assert.equal(second.queue.length, 0);
  assert.equal(second.response.undone, true);
  assert.equal(second.response.log.completed, false);
  assert.equal(overlayWrites('/habits', reads['/habits'], second.queue, NOW).habits[0].todayStatus, null);
});

test('desmarcar lo marcado con conexión y volver a marcarlo: también se anulan', async () => {
  const reads = { '/habits': { habits: [habit({ todayStatus: 'completed', todayCompleted: true, currentStreak: 5 })] } };
  const undone = await plan([], reads, 'post', '/habits/h1/log/undo');
  assert.equal(undone.queue.length, 1);
  assert.equal(overlayWrites('/habits', reads['/habits'], undone.queue, NOW).habits[0].currentStreak, 4);
  const redone = await plan(undone.queue, reads, 'post', '/habits/h1/log', { status: 'completed' });
  assert.equal(redone.queue.length, 0);
});

test('un día nuevo: el registro pendiente de ayer ya no marca el hábito de hoy, y se envía con su fecha', async () => {
  const reads = { '/habits': { habits: [habit()] } };
  const { queue } = await plan([], reads, 'post', '/habits/h1/log', { status: 'completed' });
  const tomorrow = NOW + 24 * 60 * 60_000;
  assert.equal(overlayWrites('/habits', reads['/habits'], queue, tomorrow).habits[0].todayStatus, null);
  assert.equal(bodyForSend(queue[0], tomorrow)?.date, TODAY);
  assert.equal(bodyForSend(queue[0], NOW)?.date, undefined, 'el mismo día, el servidor decide qué es hoy');
});

test('una lectura guardada ayer: los hábitos vuelven a estar por hacer', () => {
  const yesterday = NOW - 24 * 60 * 60_000;
  const data = { habits: [habit({ todayStatus: 'completed', todayCompleted: true })] };
  assert.equal(forNewDay('/habits', data, yesterday, NOW).habits[0].todayCompleted, null);
  assert.equal(forNewDay('/habits', data, NOW, NOW).habits[0].todayCompleted, true);
  assert.equal(forNewDay('/dashboard', { todayHabits: data.habits }, yesterday, NOW).todayHabits[0].todayStatus, null);
  assert.equal(forNewDay('/quests', { quests: [] }, yesterday, NOW).quests.length, 0);
});

test('crear un hábito y editarlo sin conexión: un solo envío, con lo último', async () => {
  const reads = { '/habits': { habits: [] } };
  const created = await plan([], reads, 'post', '/habits', { title: 'Correr', category: 'health' });
  assert.equal(created.status, 201);
  assert.match(created.response.habit.id, /^offline-/);
  assert.equal(created.response.habit.frequency.type, 'daily');
  const id = created.response.habit.id;
  const list = overlayWrites('/habits', reads['/habits'], created.queue, NOW);
  assert.equal(list.habits[0].title, 'Correr');

  assert.deepEqual(overlayWrites(`/habits/${id}/heatmap?days=7`, {}, created.queue, NOW).heatmap, [], 'su calendario existe y está vacío');
  const edited = await plan(created.queue, reads, 'patch', `/habits/${id}`, { title: 'Correr 5 km' });
  assert.equal(edited.queue.length, 1);
  assert.equal(edited.queue[0].body?.title, 'Correr 5 km');
  assert.equal(createdIdOf('habit.create', { habit: { id: 'real' } }), 'real');

  const removed = await plan(edited.queue, reads, 'delete', `/habits/${id}`);
  assert.equal(removed.queue.length, 0, 'lo creado y borrado sin conexión nunca existió');
});

test('pasos de un ritual: con todos hechos, se completa', async () => {
  const steps = [{ id: 's1', title: 'A', order: 0 }, { id: 's2', title: 'B', order: 1 }];
  const reads = { '/habits': { habits: [habit({ kind: 'ritual', steps, todayStepIds: ['s1'] })] } };
  const { response, queue } = await plan([], reads, 'post', '/habits/h1/steps/s2', { completed: true });
  assert.deepEqual(response, { stepIds: ['s1', 's2'], completed: true });
  assert.equal(overlayWrites('/habits', reads['/habits'], queue, NOW).habits[0].todayStatus, 'completed');
});

test('agenda: lo creado aparece solo en las listas de su fecha', async () => {
  const start = new Date(2026, 10, 10, 9, 0).toISOString();
  const { queue, response } = await plan([], {}, 'post', '/agenda', { title: 'Dentista', startDate: start });
  assert.equal(response.event.isCompleted, false);
  const inMonth = `/agenda?from=${encodeURIComponent(new Date(2026, 10, 1).toISOString())}&to=${encodeURIComponent(new Date(2026, 11, 1).toISOString())}`;
  const otherMonth = `/agenda?from=${encodeURIComponent(new Date(2026, 11, 1).toISOString())}&to=${encodeURIComponent(new Date(2027, 0, 1).toISOString())}`;
  assert.equal(overlayWrites(inMonth, { events: [] }, queue, NOW).events.length, 1);
  assert.equal(overlayWrites(otherMonth, { events: [] }, queue, NOW).events.length, 0);
  assert.equal(overlayWrites('/agenda/upcoming', { events: [] }, queue, NOW).events[0].title, 'Dentista');
});

test('agenda: editar y borrar lo que vino del servidor', async () => {
  const event = { id: 'e1', title: 'Reunión', startDate: new Date(2026, 10, 10).toISOString(), isCompleted: false };
  const reads = { '/agenda': { events: [event] } };
  const edited = await plan([], reads, 'patch', '/agenda/e1', { isCompleted: true });
  assert.equal(edited.response.event.isCompleted, true);
  assert.equal(overlayWrites('/agenda?from=&to=', { events: [event] }, edited.queue, NOW).events[0].isCompleted, true);
  const again = await plan(edited.queue, reads, 'patch', '/agenda/e1', { title: 'Reunión 2' });
  assert.equal(again.queue.length, 1, 'los cambios al mismo evento se juntan');
  assert.deepEqual(again.queue[0].body, { isCompleted: true, title: 'Reunión 2' });
  const gone = await plan(again.queue, reads, 'delete', '/agenda/e1');
  assert.equal(gone.queue.length, 1, 'un evento del servidor sí hay que borrarlo allí');
  assert.equal(gone.queue[0].kind, 'event.delete');
  assert.equal(overlayWrites('/agenda?x=1', { events: [event] }, gone.queue, NOW).events.length, 0);
});

test('agenda sin copia exacta: se arma con otras guardadas', () => {
  const inside = { id: 'a', startDate: new Date(2026, 10, 10).toISOString() };
  const outside = { id: 'b', startDate: new Date(2027, 5, 10).toISOString() };
  const path = `/agenda?from=${encodeURIComponent(new Date(2026, 10, 1).toISOString())}&to=${encodeURIComponent(new Date(2026, 11, 1).toISOString())}`;
  const built = fallbackFrom(path, [{ path: '/agenda?x', data: { events: [inside, outside] } }, { path: '/agenda?y', data: { events: [inside] } }]);
  assert.deepEqual(built.events.map((e: { id: string }) => e.id), ['a']);
  assert.equal(fallbackFrom('/journal?x=1', [{ path: '/journal?y', data: { entries: [] } }]), undefined);
});

test('libreta: cada guardado de la hoja sustituye al anterior y va al final de la cola', async () => {
  const content = (html: string) => ({ html, strokes: [], stickies: [], images: [] });
  const one = await plan([], {}, 'put', '/notebooks/n1/pages/0', content('<p>uno</p>'));
  const image = await plan(one.queue, {}, 'post', '/notebooks/n1/images', { mime: 'image/jpeg', data: 'AAA' });
  const two = await plan(image.queue, {}, 'put', '/notebooks/n1/pages/0', content('<p>dos</p>'));
  assert.deepEqual(two.queue.map((w) => w.kind), ['notebook.image', 'notebook.page'], 'la hoja va después de la imagen que nombra');

  const page = overlayWrites('/notebooks/n1/pages/0', { page: null }, two.queue, NOW);
  assert.equal(page.page.content.html, '<p>dos</p>');
  assert.equal(page.page.updatedAt, two.response.page.updatedAt, 'la versión coincide con lo que se respondió');
  assert.equal(overlayWrites('/notebooks/n1/pages/1', { page: null }, two.queue, NOW).page, null, 'otra hoja no cambia');

  const imageId = image.response.image.id;
  assert.equal(overlayWrites(`/notebooks/n1/images/${imageId}`, undefined, two.queue, NOW).image.data, 'AAA');
});

test('libreta: una hoja vacía se lee como vacía', async () => {
  const { response, queue } = await plan([], {}, 'put', '/notebooks/n1/pages/2', { html: '<p> </p>', strokes: [], stickies: [], images: [] });
  assert.equal(response.page, null);
  assert.equal(overlayWrites('/notebooks/n1/pages/2', { page: { content: {}, updatedAt: 'x' } }, queue, NOW).page, null);
});

test('perfil: responde con la cuenta cambiada y junta los cambios', async () => {
  const first = await plan([], {}, 'patch', '/users/me/profile', { displayName: 'Ale' });
  assert.equal(first.response.user.displayName, 'Ale');
  const second = await plan(first.queue, {}, 'patch', '/users/me/profile', { timezone: 'America/Bogota' });
  assert.equal(second.queue.length, 1);
  assert.deepEqual(second.queue[0].body, { displayName: 'Ale', timezone: 'America/Bogota' });
});

test('avisos: los horarios se mezclan por zona, sin pisar los demás campos', async () => {
  const reads = { '/notifications/preferences': { preferences: { habitReminders: true, reminderSettings: { habits: { enabled: true, time: '21:00' }, wisdom: { enabled: true, time: '08:00' } } } } };
  const first = await plan([], reads, 'patch', '/notifications/preferences', { reminderSettings: { habits: { time: '20:00' } } });
  assert.deepEqual(first.response.preferences.reminderSettings.habits, { enabled: true, time: '20:00' });
  assert.equal(first.response.preferences.reminderSettings.wisdom.time, '08:00');
  const second = await plan(first.queue, reads, 'patch', '/notifications/preferences', { reminderSettings: { wisdom: { enabled: false } }, dailySummary: true });
  assert.equal(second.queue.length, 1);
  assert.deepEqual(second.queue[0].body?.reminderSettings, { habits: { time: '20:00' }, wisdom: { enabled: false } });
  const seen = overlayWrites('/notifications/preferences', reads['/notifications/preferences'], second.queue, NOW);
  assert.equal(seen.preferences.dailySummary, true);
  assert.equal(seen.preferences.reminderSettings.wisdom.enabled, false);
});

test('misiones: crear, respetar el filtro y completar', async () => {
  const created = await plan([], {}, 'post', '/quests', { title: 'Viaje', type: 'MAIN' });
  assert.equal(created.response.quest.status, 'ACTIVE');
  assert.equal(overlayWrites('/quests?status=ACTIVE', { quests: [] }, created.queue, NOW).quests.length, 1);
  assert.equal(overlayWrites('/quests?status=COMPLETED', { quests: [] }, created.queue, NOW).quests.length, 0);

  const reads = { '/quests': { quests: [{ id: 'q1', status: 'ACTIVE', xpReward: 50, goldReward: 10 }] } };
  const done = await plan([], reads, 'post', '/quests/q1/complete');
  assert.equal(done.response.rewards.xpEarned, 50);
  assert.equal(done.response.user.id, 'u1');
  assert.equal(overlayWrites('/quests', reads['/quests'], done.queue, NOW).quests[0].status, 'COMPLETED');
});

test('diario: lo nuevo primero, solo en su mes', async () => {
  const created = await plan([], {}, 'post', '/journal', { content: 'Hoy', date: '2026-11-03' });
  assert.equal(created.response.entry.content, 'Hoy');
  assert.equal(overlayWrites('/journal?month=2026-11', { entries: [{ id: 'old' }] }, created.queue, NOW).entries[0].content, 'Hoy');
  assert.equal(overlayWrites('/journal?month=2026-10', { entries: [] }, created.queue, NOW).entries.length, 0);
});

test('una respuesta sin la forma esperada no se rompe', async () => {
  const { queue } = await plan([], { '/habits': { habits: [habit()] } }, 'post', '/habits/h1/log', { status: 'completed' });
  assert.equal(overlayWrites('/habits', undefined, queue, NOW), undefined);
  assert.equal(overlayWrites('/quests', { quests: [] }, queue, NOW).quests.length, 0);
});
