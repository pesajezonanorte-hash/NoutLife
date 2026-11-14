import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chartData, evaluateSheet, expandRange, formatValue, literal, parseCell, toCsv, usedRange } from '../../src/lib/sheet';

const value = (cells: Record<string, string>, id: string) => evaluateSheet(cells)[id];

test('referencias y rangos', () => {
  assert.deepEqual(parseCell('C12'), { col: 2, row: 11 });
  assert.equal(parseCell('AA1'), null, 'solo columnas A–Z');
  assert.equal(parseCell('A0'), null);
  assert.deepEqual(expandRange('B2:A1'), ['A1', 'B1', 'A2', 'B2'], 'en cualquier orden, fila por fila');
  assert.equal(expandRange('A1'), null);
});

test('lo escrito sin «=»: números con coma o punto, porcentajes y texto', () => {
  assert.equal(literal('3,5'), 3.5);
  assert.equal(literal(' -12.25 '), -12.25);
  assert.equal(literal('15%'), 0.15);
  assert.equal(literal('Arriendo'), 'Arriendo');
  assert.equal(literal('1.000.000'), '1.000.000', 'un número con puntos de miles queda como texto');
});

test('aritmética con la precedencia de una hoja de cálculo', () => {
  const cells = { A1: '10', A2: '4', B1: '=A1+A2*2', B2: '=(A1+A2)/2', B3: '=2^3^2', B4: '=-2^2', B5: '=A1*10%', B6: '=0.1+0.2', B7: '=A9+1' };
  const v = evaluateSheet(cells);
  assert.equal(v.B1, 18);
  assert.equal(v.B2, 7);
  assert.equal(v.B3, 64, 'la potencia se encadena de izquierda a derecha');
  assert.equal(v.B4, 4, 'el signo va antes que la potencia');
  assert.equal(v.B5, 1);
  assert.equal(v.B6, 0.3, 'sin ruido de coma flotante');
  assert.equal(v.B7, 1, 'una celda vacía vale 0');
});

test('funciones en inglés y en español, con «;» o «,»', () => {
  const cells = { A1: '5', A2: '7', A3: 'texto', A4: '', A5: '8', B1: '=SUM(A1:A5)', B2: '=PROMEDIO(A1:A5)', B3: '=MIN(A1;A2;A5)', B4: '=max(A1:A5)', B5: '=CONTAR(A1:A5)', B6: '=REDONDEAR(2/3, 2)', B7: '=ROUND(1.005; 2)', B8: '=ABS(-3)', B9: '=SUMA(A1, 10)' };
  const v = evaluateSheet(cells);
  assert.equal(v.B1, 20, 'el texto y lo vacío se saltan en un rango');
  assert.equal(v.B2, 6.66666666666667, 'con 15 cifras, como una hoja de cálculo');
  assert.equal(v.B3, 5);
  assert.equal(v.B4, 8);
  assert.equal(v.B5, 3);
  assert.equal(v.B6, 0.67);
  assert.equal(v.B7, 1.01);
  assert.equal(v.B8, 3);
  assert.equal(v.B9, 15);
  assert.equal(value({ A1: '2', B1: '=$A$1*A$1+$A1' }, 'B1'), 6, 'las referencias con $ (como en Excel) funcionan');
});

test('SI: compara, solo evalúa la rama elegida y devuelve FALSO sin rama «si no»', () => {
  const cells = { A1: '3', B1: '=SI(A1>=3; "Aprobado"; "Reprobado")', B2: '=IF(A1<3, 1/0, "ok")', B3: '=IF(A1=4, 1)', B4: '=IF("Hola"="hola", 1, 0)', B5: '="Nota: "&A1' };
  const v = evaluateSheet(cells);
  assert.equal(v.B1, 'Aprobado');
  assert.equal(v.B2, 'ok', 'la división por cero de la otra rama no importa');
  assert.equal(v.B3, false);
  assert.equal(v.B4, 1, 'el texto se compara sin mayúsculas');
  assert.equal(v.B5, 'Nota: 3');
});

test('errores: división por cero, nombre desconocido, texto en una cuenta, ciclos y fórmulas mal escritas', () => {
  const cells = { A1: '=1/0', A2: '=FOO(1)', A3: '="a"*2', A4: '=A5', A5: '=A4+1', A6: '=A1+1', A7: '=SUM(', A8: '=PROMEDIO(B1:B3)', A9: '=A7', B9: '=A9:A9' };
  const v = evaluateSheet(cells);
  assert.deepEqual(v.A1, { error: '#DIV/0!' });
  assert.deepEqual(v.A2, { error: '#NOMBRE?' });
  assert.deepEqual(v.A3, { error: '#VALOR!' });
  assert.deepEqual(v.A4, { error: '#CICLO!' });
  assert.deepEqual(v.A5, { error: '#CICLO!' });
  assert.deepEqual(v.A6, { error: '#DIV/0!' }, 'el error se propaga');
  assert.deepEqual(v.A7, { error: '#ERROR!' });
  assert.deepEqual(v.A8, { error: '#DIV/0!' }, 'promedio sin números');
  assert.deepEqual(v.A9, { error: '#ERROR!' });
  assert.deepEqual(v.B9, { error: '#VALOR!' }, 'un rango suelto no es un valor');
  assert.deepEqual(value({ A1: '=A1' }, 'A1'), { error: '#CICLO!' });
});

test('para mostrar, exportar y graficar', () => {
  const cells = { A1: 'Mes', B1: 'Gasto', A2: 'Enero', B2: '1200', A3: 'Febrero', B3: '=B2*1.5', A4: 'Nota, con "comillas"', D6: ' ' };
  const v = evaluateSheet(cells);
  assert.deepEqual(usedRange(cells), { rows: 4, cols: 2 }, 'una celda con solo espacios no cuenta');
  assert.equal(toCsv(cells, v), 'Mes,Gasto\nEnero,1200\nFebrero,1800\n"Nota, con ""comillas""",');
  assert.deepEqual(chartData('A1:B4', v), [{ label: 'Enero', value: 1200 }, { label: 'Febrero', value: 1800 }], 'el encabezado y las filas sin número se saltan');
  assert.deepEqual(chartData('B2:B3', v), [{ label: '2', value: 1200 }, { label: '3', value: 1800 }]);
  assert.equal(formatValue(1800.5, 'es-CO', { true: 'VERDADERO', false: 'FALSO' }), '1.800,5');
  assert.equal(formatValue(true, 'es-CO', { true: 'VERDADERO', false: 'FALSO' }), 'VERDADERO');
  assert.equal(formatValue({ error: '#REF!' }, 'es-CO', { true: '', false: '' }), '#REF!');
});
