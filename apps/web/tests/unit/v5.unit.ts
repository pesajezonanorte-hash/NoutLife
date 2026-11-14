// NoutLife v5 en la app: Spotify, duración de la recreación, bienestar digital, texto del copiloto,
// avisos de estudio y plantillas de zonas.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STATIONS, parseSpotify, resolveSource, spotifyEmbedUrl } from '../../src/lib/spotify';
import { digitalBalance, fromMinutes, toMinutes } from '../../src/components/recreation/recreationMeta';
import { bulletLines, textToHtml } from '../../src/lib/office';
import { planReminders, type ReminderData } from '../../src/lib/reminderPlan';
import { isModule, zoneTemplates } from '../../src/components/zones/templates';
import type { RecreationEntry } from '../../src/services/recreation.service';

test('Spotify: reconoce enlaces web (con idioma o embed) y URIs; arma el reproductor', () => {
  assert.deepEqual(parseSpotify('https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ?si=abc'), { kind: 'playlist', id: '37i9dQZF1DWZeKCadgRdKQ' });
  assert.deepEqual(parseSpotify('https://open.spotify.com/intl-es/album/4aawyAB9vmqN3uQ7FjRGTy'), { kind: 'album', id: '4aawyAB9vmqN3uQ7FjRGTy' });
  assert.deepEqual(parseSpotify('spotify:show:5CfCWKI5pZ28U0uOzXkDHe'), { kind: 'show', id: '5CfCWKI5pZ28U0uOzXkDHe' });
  assert.equal(parseSpotify('https://www.youtube.com/watch?v=abc'), null);
  assert.equal(parseSpotify('https://evil.com/open.spotify.com/playlist/x'), null, 'el id debe tener forma de id de Spotify');
  assert.equal(spotifyEmbedUrl({ kind: 'episode', id: '512ojhOuo1ktJprKbVcKyQ' }, true), 'https://open.spotify.com/embed/episode/512ojhOuo1ktJprKbVcKyQ?utm_source=generator&theme=0');
  assert.equal(new Set(STATIONS.map((s) => s.id)).size, STATIONS.length, 'ids de las listas únicos');
  assert.equal(resolveSource('deep-focus', null, null)?.id, '37i9dQZF1DWZeKCadgRdKQ');
  assert.equal(resolveSource('mine', 'https://open.spotify.com/playlist/37i9dQZF1DX4sWSpwq3LiO', null)?.id, '37i9dQZF1DX4sWSpwq3LiO');
  assert.equal(resolveSource('custom', null, 'no es un enlace'), null);
});

test('recreación: duración en minutos u horas', () => {
  assert.equal(toMinutes('90', 'min'), 90);
  assert.equal(toMinutes('1,5', 'h'), 90);
  assert.equal(toMinutes('3', 'h'), 180);
  assert.equal(toMinutes('', 'h'), null);
  assert.ok(Number.isNaN(toMinutes('mucho', 'min')));
  assert.deepEqual(fromMinutes(180), { text: '3', unit: 'h' });
  assert.deepEqual(fromMinutes(90), { text: '1.5', unit: 'h' });
  assert.deepEqual(fromMinutes(45), { text: '45', unit: 'min' });
  assert.deepEqual(fromMinutes(null), { text: '', unit: 'min' });
});

const NOW = new Date(2026, 10, 14, 20, 0).getTime();
const entry = (kind: RecreationEntry['kind'], minutes: number | null, daysAgo = 0, title = kind): RecreationEntry => ({
  id: `${kind}${minutes}${daysAgo}`, title, kind, status: 'DONE', rating: null, minutes, notes: null, date: new Date(NOW - daysAgo * 86_400_000).toISOString(),
  season: null, episode: null, totalSeasons: null, totalEpisodes: null, episodesWatched: 0, xpEarned: 0,
} as RecreationEntry);

test('bienestar digital: reparte el ocio de la semana entre pantalla y sin pantalla', () => {
  const balanced = digitalBalance([entry('MOVIE', 120, 1, 'Dune'), entry('OUTING', 180, 2), entry('HOBBY', 60, 3), entry('SERIES', null, 1), entry('GAME', 600, 9)], NOW);
  assert.equal(balanced.screenMinutes, 120, 'la partida de hace 9 días no entra');
  assert.equal(balanced.offlineMinutes, 240);
  assert.equal(balanced.untimed, 1);
  assert.deepEqual(balanced.longest, { title: 'Dune', minutes: 120 });
  assert.equal(balanced.status, 'balanced');
  assert.equal(digitalBalance([entry('GAME', 240, 0), entry('SERIES', 90, 1), entry('MUSIC', 30, 2)], NOW).status, 'screenHeavy');
  assert.equal(digitalBalance(Array.from({ length: 7 }, (_, i) => entry('GAME', 240, i)), NOW).status, 'long', 'más de 3 h diarias de pantalla');
  assert.equal(digitalBalance([], NOW).status, 'empty');
});

test('copiloto: texto plano a HTML seguro del documento', () => {
  assert.equal(textToHtml('Hola <b>mundo</b>\nsegunda línea\n\n- uno\n- dos\n\nIdeas clave:'), '<p>Hola &lt;b&gt;mundo&lt;/b&gt;<br>segunda línea</p><ul><li>uno</li><li>dos</li></ul><h3>Ideas clave</h3>');
  assert.equal(textToHtml('   '), '');
  assert.deepEqual(bulletLines('- Beber\n• Regar\n\n Lavar '), ['Beber', 'Regar', 'Lavar']);
});

test('avisos de estudio: entregas a 3, 1 y 0 días; evaluaciones a 7, 3 y 1, con los temas pendientes', () => {
  const now = new Date(2026, 10, 14, 8, 0);
  const utcNoon = (d: number) => new Date(Date.UTC(2026, 10, d, 12)).toISOString();
  const data: ReminderData = {
    habits: [], events: [], prefs: null,
    study: [
      { id: 't1', type: 'task', title: 'Ensayo', course: 'Filosofía', date: utcNoon(17) },
      { id: 'g1', type: 'exam', title: 'Parcial 2', course: 'Cálculo', date: utcNoon(21), pendingTopics: 3 },
    ],
  };
  const plan = planReminders(data, now, 'es', 8).filter((r) => r.kind === 'study');
  assert.deepEqual(plan.map((r) => [r.title, new Date(r.at).getDate()]), [
    ['Se entrega en 3 días', 14], ['Evaluación en 7 días', 14], ['Se entrega mañana', 16], ['Se entrega hoy', 17], ['Evaluación en 3 días', 18], ['Evaluación mañana', 20],
  ]);
  assert.equal(plan.find((r) => r.title === 'Evaluación en 7 días')?.body, '«Parcial 2», de Cálculo. Te quedan 3 temas sin practicar.');
  assert.equal(plan[3].body, '«Ensayo», de Filosofía. Si ya lo entregaste, márcalo como cumplido.');
  assert.equal(plan[0].link, '/learning?tab=academico');
  const muted = planReminders({ ...data, prefs: { categories: [{ category: 'QUESTS', pushEnabled: false, inAppEnabled: true }] } as unknown as ReminderData['prefs'] }, now, 'es', 8);
  assert.equal(muted.filter((r) => r.kind === 'study').length, 0, 'se respeta la categoría apagada');
});

test('plantillas de zonas: mismas en los dos idiomas y con módulos que abren rutas de la app', () => {
  const es = zoneTemplates('es');
  const en = zoneTemplates('en');
  assert.deepEqual(es.map((z) => z.id), en.map((z) => z.id));
  for (const tpl of [...es, ...en]) {
    assert.ok(tpl.sections.some(isModule), `${tpl.id} tiene módulos`);
    for (const s of tpl.sections) if (s.to) assert.match(s.to, /^\/[\w\-/?=&]{0,80}$/, 'el mismo formato que valida la API');
    assert.ok(tpl.habits.length > 0 && tpl.actions.length > 0);
  }
});
