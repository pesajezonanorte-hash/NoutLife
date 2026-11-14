// Zonas personalizadas: las sugerencias de El Sabio pasan aunque traigan campos de más, textos largos o enlaces que no son rutas.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createZoneSchema, updateZoneSchema } from '../src/schemas/custom-zone.schemas';

test('una sugerencia del Sabio con campos de más se acepta: lo de más se descarta', () => {
  const parsed = createZoneSchema.parse({
    name: 'Guitarra con un nombre que se pasa bastante de los cuarenta caracteres',
    icon: '🎸',
    accentColor: '#548f6f',
    isMeasurable: true,
    sobra: 'x',
    sections: [
      { type: 'habits', title: 'Práctica', description: 'Diario', icon: '🎵' },
      { type: 'link', title: 'Enlace externo', description: 'x', to: 'https://evil.example' },
    ],
    actions: [{ label: 'Nuevo hábito', type: 'new_habit', extra: 1 }],
  });
  assert.equal(parsed.name.length, 40, 'el nombre se recorta');
  assert.equal('sobra' in parsed, false);
  assert.equal(parsed.sections?.[0].type, 'habits');
  assert.equal(parsed.sections?.[1].to, undefined, 'un enlace que no es ruta se quita; la zona se crea igual');
  assert.equal(parsed.actions?.[0].label, 'Nuevo hábito');
});

test('una zona sin nombre o con un color inválido se rechaza', () => {
  assert.equal(createZoneSchema.safeParse({ name: '   ' }).success, false);
  assert.equal(createZoneSchema.safeParse({ name: 'Ok', accentColor: 'rojo' }).success, false);
});

test('más de 12 módulos se recortan a 12', () => {
  const sections = Array.from({ length: 15 }, (_, i) => ({ type: 'habits', title: `M${i}`, description: '' }));
  assert.equal(createZoneSchema.parse({ name: 'x', sections }).sections?.length, 12);
});

test('editar una zona acepta cambios parciales y no un nombre vacío', () => {
  assert.equal(updateZoneSchema.safeParse({ icon: '📍' }).success, true);
  assert.equal(updateZoneSchema.safeParse({ name: '' }).success, false);
});
