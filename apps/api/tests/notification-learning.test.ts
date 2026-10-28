import assert from 'node:assert/strict';
import { test } from 'node:test';
import { iconEmoji, plainText } from '../src/lib/notification-text';
import {
  COOL_AFTER, DEFAULT_SMART_SETTINGS, coolingPrefixes, learnedHabitTime, mergeSmartSettings, planPushes, sanitizeSmartSettings, usualWeekdays,
} from '../src/lib/smart-reminders';

test('el título de un hábito lleva su emoji, nunca la clave del ícono', () => {
  assert.equal(iconEmoji('code'), '💻');
  assert.equal(iconEmoji('strong'), '💪');
  assert.equal(iconEmoji('⭐'), '⭐', 'los emoji antiguos se quedan tal cual');
  assert.equal(iconEmoji('desconocido'), '✅');
  assert.equal(iconEmoji(null), '✅');
});

test('los avisos llegan en texto plano: sin etiquetas, markdown ni entidades', () => {
  assert.equal(plainText('<strong>Leer</strong> 20 min'), 'Leer 20 min');
  assert.equal(plainText('Usa `code` y **fuerza**'), 'Usa code y fuerza');
  assert.equal(plainText('&lt;code&gt;Agua&lt;/code&gt; &amp; más'), 'Agua & más');
  assert.equal(plainText('Línea 1<br/>Línea 2'), 'Línea 1 Línea 2');
  assert.equal(plainText('Peso < 80 kg'), 'Peso < 80 kg', 'un «<» suelto no es una etiqueta');
});

test('aprendizaje: activo por defecto en Coliseo y Sabiduría, sin pisar una hora elegida', () => {
  assert.equal(DEFAULT_SMART_SETTINGS.coliseo.learn, true);
  assert.equal(DEFAULT_SMART_SETTINGS.wisdom.manual, false);
  // Ajustes guardados antes del campo: sin `learn` aprende; una cita a otra hora la eligió la persona.
  const legacy = sanitizeSmartSettings({ coliseo: { time: null }, wisdom: { enabled: true, time: '07:30' } });
  assert.equal(legacy.coliseo.learn, true);
  assert.equal(legacy.wisdom.manual, true);
  assert.equal(sanitizeSmartSettings({ wisdom: { time: '08:00' } }).wisdom.manual, false);
  // Cambiar la hora a mano la fija; volver a «según mi costumbre» la libera.
  assert.equal(mergeSmartSettings(undefined, { wisdom: { time: '06:45' } }).wisdom.manual, true);
  assert.equal(mergeSmartSettings({ wisdom: { time: '06:45', manual: true } }, { wisdom: { manual: false } }).wisdom.manual, false);
  assert.equal(mergeSmartSettings(undefined, { coliseo: { learn: false } }).coliseo.learn, false);
});

test('hora aprendida con antelación propia (Sabiduría llega a la hora de empezar el día)', () => {
  assert.equal(learnedHabitTime([7 * 60, 7 * 60 + 20, 7 * 60 + 10], 0), 7 * 60 + 10);
  assert.equal(learnedHabitTime([7 * 60, 7 * 60 + 20, 7 * 60 + 10]), 6 * 60 + 40);
});

test('días habituales de entreno: los que se repiten en las últimas semanas', () => {
  assert.deepEqual(usualWeekdays([1, 3, 5, 1, 3, 5, 6]), [1, 3, 5]);
  assert.deepEqual(usualWeekdays([2]), []);
});

test('una zona cuyos últimos avisos nadie abrió deja de sonar; abrir uno la reanuda', () => {
  const now = new Date('2026-10-28T15:00:00Z');
  const day = (n: number) => new Date(now.getTime() - n * 86_400_000);
  const wisdom = (n: number, isRead = false) => ({ key: `wisdom-2026-10-${28 - n}`, isRead, createdAt: day(n) });
  const ignored = [wisdom(1), wisdom(2), wisdom(3)];
  assert.ok(coolingPrefixes(ignored, now).has('wisdom-'));
  assert.ok(!coolingPrefixes([wisdom(1, true), wisdom(2), wisdom(3)], now).has('wisdom-'), 'leyó el último: vuelve');
  assert.ok(!coolingPrefixes(ignored.slice(0, COOL_AFTER - 1), now).has('wisdom-'), 'pocos datos: no se pausa');
  assert.ok(!coolingPrefixes([wisdom(30), wisdom(31), wisdom(32)], now).has('wisdom-'), 'lo viejo no cuenta');

  // En pausa no sale el push (la bandeja lo guarda igual); lo programado por la persona sale siempre.
  const queued = [
    { key: 'wisdom-2026-10-28', title: 'Sabiduría del día', body: '…' },
    { key: 'zone-reminder:habitos-pendientes:2026-10-28', title: '2 hábitos pendientes', body: '…' },
    { key: 'hydration-2026-10-28-600', title: 'Hora de hidratarte', body: '…', userScheduled: true },
  ];
  const plan = planPushes(queued, { minutes: 10 * 60, sentToday: 0, inactive: false, cooling: coolingPrefixes(ignored, now) });
  assert.deepEqual(plan.send.map((p) => p.title), ['Hora de hidratarte', '2 hábitos pendientes']);
  assert.equal(plan.group, null);
});
