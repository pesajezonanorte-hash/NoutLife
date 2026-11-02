// Materia calma: modelos de Blender (calm-*.glb), clips de animación, tubo de los íconos del navbar
// y la inclinación de las tarjetas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clipLength, decodeCalm, sampleClip, type CalmModel } from '../../src/components/three3d/calmModels';
import { buildTube, type Point } from '../../src/components/layout/nav3d/iconTube';
import { castShadow, settled, springStep, tiltLimits, tiltTarget } from '../../src/lib/motion/tiltMath';

const load = async (name: string) => {
  const file = readFileSync(new URL(`../../src/assets/models/${name}.glb`, import.meta.url));
  return decodeCalm(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
};

/** Volumen de una malla cerrada (teorema de la divergencia), con un desplazamiento opcional. */
function volume(m: CalmModel, delta?: Float32Array, weight = 1, part = 0) {
  let v = 0;
  const at = (i: number): [number, number, number] => [0, 1, 2].map((c) => m.position[i * 3 + c] + (delta ? delta[i * 3 + c] * weight : 0)) as [number, number, number];
  for (let t = 0; t < m.index.length; t += 3) {
    if (m.part[m.index[t]] !== part) continue;
    const [a, b, c] = [at(m.index[t]), at(m.index[t + 1]), at(m.index[t + 2])];
    v += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  return Math.abs(v);
}

const bounds = (m: CalmModel, delta?: Float32Array, weight = 1, part = 0) => {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.position.length / 3; i++) {
    if (m.part[i] !== part) continue;
    for (let c = 0; c < 3; c++) {
      const p = m.position[i * 3 + c] + (delta ? delta[i * 3 + c] * weight : 0);
      lo[c] = Math.min(lo[c], p);
      hi[c] = Math.max(hi[c], p);
    }
  }
  return { lo, hi, size: hi.map((h, c) => h - lo[c]) };
};

const SETS = {
  'calm-pad': { node: 'pad', targets: ['press', 'release', 'fill'], clips: ['pad_press', 'pad_release', 'pad_fill'], normalMap: true },
  'calm-focus': { node: 'focus_ring', targets: ['inhale', 'exhale', 'flow_a', 'flow_b'], clips: ['focus_breath', 'focus_flow'], normalMap: true },
  'calm-nav': { node: 'pebble', targets: ['stretch_x', 'stretch_y', 'squash'], clips: ['nav_travel'], normalMap: true },
} as const;

test('modelos: cada .glb trae su malla, sus shape keys, sus animaciones y su mapa de normales', async () => {
  for (const [file, want] of Object.entries(SETS)) {
    const set = await load(file);
    const model = set.models.get(want.node);
    assert.ok(model, `${file}: nodo ${want.node}`);
    assert.deepEqual(Object.keys(model.targets).sort(), [...want.targets].sort(), `${file}: shape keys`);
    const verts = model.position.length / 3;
    assert.ok(model.index.every((i) => i < verts), `${file}: índices dentro de la malla`);
    assert.ok(verts < 1500 && model.index.length / 3 < 3000, `${file}: malla baja (${verts} vértices, ${model.index.length / 3} triángulos)`);
    for (let i = 0; i < model.normal.length; i += 3) {
      const l = Math.hypot(model.normal[i], model.normal[i + 1], model.normal[i + 2]);
      if (Math.abs(l - 1) > 0.03) assert.fail(`${file}: normal de largo ${l}`);
    }
    for (const name of want.clips) {
      const clip = set.clips.get(name);
      assert.ok(clip, `${file}: animación ${name}`);
      assert.equal(clip.targets, want.targets.length, `${file}/${name}: un peso por shape key`);
      assert.equal(clip.weights.length, clip.times.length * clip.targets, `${file}/${name}: pesos por clave`);
    }
    assert.equal(Boolean(set.normalMap), want.normalMap, `${file}: mapa de normales`);
  }
});

test('modelos: los archivos para la web pesan poco', () => {
  for (const [name, kb] of [['calm-pad', 40], ['calm-focus', 80], ['calm-nav', 40]] as const) {
    const size = readFileSync(new URL(`../../src/assets/models/${name}.glb`, import.meta.url)).length / 1024;
    assert.ok(size < kb, `${name}: ${size.toFixed(1)} KB < ${kb} KB`);
  }
});

test('almohadilla: presionar la aplasta y la ensancha; rebotar conserva el volumen; llenar la hincha', async () => {
  const { models } = await load('calm-pad');
  const pad = models.get('pad')!;
  const rest = bounds(pad);
  const pressed = bounds(pad, pad.targets.press.position);
  // En three.js la altura es y.
  assert.ok(pressed.size[1] < rest.size[1] * 0.85, `se aplasta: ${pressed.size[1]} < ${rest.size[1]}`);
  assert.ok(pressed.size[0] > rest.size[0] * 1.01, `se ensancha: ${pressed.size[0]} > ${rest.size[0]}`);
  assert.ok(pressed.size[0] < rest.size[0] * 1.13, 'sin exagerar');
  const v0 = volume(pad);
  const pressedV = volume(pad, pad.targets.press.position);
  assert.ok(pressedV / v0 > 0.72 && pressedV / v0 < 1, `cede solo el aire: ${(pressedV / v0).toFixed(3)}`);
  const bounced = volume(pad, pad.targets.release.position);
  assert.ok(Math.abs(bounced / v0 - 1) < 0.03, `rebote con el mismo volumen: ${(bounced / v0).toFixed(3)}`);
  const filled = bounds(pad, pad.targets.fill.position);
  assert.ok(filled.size[1] > rest.size[1], 'la luz la hincha');
});

test('almohadilla: la palomita se esconde en reposo y sale al llenarse', async () => {
  const { models } = await load('calm-pad');
  const pad = models.get('pad')!;
  const crown = bounds(pad).hi[1];
  const check = bounds(pad, undefined, 1, 1);
  assert.ok(check.hi[1] < crown - 0.02, `escondida: ${check.hi[1]} bajo ${crown}`);
  const out = bounds(pad, pad.targets.fill.position, 1, 1);
  const crownFilled = bounds(pad, pad.targets.fill.position).hi[1];
  assert.ok(out.hi[1] > crownFilled - 0.04, `sale con la luz: ${out.hi[1]} frente a ${crownFilled}`);
});

test('clips de la almohadilla: rebota apenas y termina en reposo; la luz se pasa y se asienta', async () => {
  const { clips, models } = await load('calm-pad');
  const names = Object.keys(models.get('pad')!.targets);
  const press = names.indexOf('press');
  const release = names.indexOf('release');
  const fill = names.indexOf('fill');
  const w: number[] = [];
  const releaseClip = clips.get('pad_release')!;
  const end = sampleClip(releaseClip, clipLength(releaseClip), w).slice();
  assert.ok(Math.abs(end[press]) < 0.01 && Math.abs(end[release]) < 0.01, 'termina en reposo');
  let peak = 0;
  for (let t = 0; t < clipLength(releaseClip); t += 0.01) peak = Math.max(peak, sampleClip(releaseClip, t, w)[release]);
  assert.ok(peak > 0.4 && peak <= 0.85, `rebote sutil: ${peak}`);
  const fillClip = clips.get('pad_fill')!;
  let over = 0;
  for (let t = 0; t < clipLength(fillClip); t += 0.01) over = Math.max(over, sampleClip(fillClip, t, w)[fill]);
  assert.ok(over > 1 && over < 1.15, `se pasa apenas: ${over}`);
  assert.ok(Math.abs(sampleClip(fillClip, 99, w)[fill] - 1) < 0.01, 'se asienta en 1');
});

test('aro: respira a 5,5 ciclos por minuto, se expande al inhalar y se recoge al exhalar', async () => {
  const { models, clips } = await load('calm-focus');
  const ring = models.get('focus_ring')!;
  const rest = bounds(ring);
  const inhale = bounds(ring, ring.targets.inhale.position);
  const exhale = bounds(ring, ring.targets.exhale.position);
  assert.ok(inhale.size[0] > rest.size[0] * 1.03, 'inhalar lo agranda');
  assert.ok(exhale.size[0] < rest.size[0] * 0.985, 'exhalar lo recoge');
  const breath = clips.get('focus_breath')!;
  assert.ok(Math.abs(clipLength(breath) - 11) < 0.1, `ciclo de 11 s: ${clipLength(breath)}`);
  const w: number[] = [];
  const names = Object.keys(ring.targets);
  const at = (t: number) => sampleClip(breath, t, w)[names.indexOf('inhale')];
  assert.ok(at(0) < 0.02, 'empieza vacío');
  assert.ok(at(4.5) > 0.97, 'pecho lleno a los 4,5 s');
  assert.ok(Math.abs(at(4.5 / 2) - 0.5) < 0.2, 'inhala suave');
  // Sin saltos: la curva es lenta, por eso alcanzan pocas muestras.
  let jump = 0;
  for (let t = 0; t < 11; t += 1 / 60) jump = Math.max(jump, Math.abs(at(t + 1 / 60) - at(t)));
  assert.ok(jump < 0.02, `sin saltos: ${jump}`);
});

test('aro: la ola y la costura', async () => {
  const { models, clips } = await load('calm-focus');
  const ring = models.get('focus_ring')!;
  // La ola no cambia el tamaño: solo el reflejo fluye.
  const rest = bounds(ring);
  const flow = bounds(ring, ring.targets.flow_a.position);
  assert.ok(Math.abs(flow.size[0] / rest.size[0] - 1) < 0.03, 'la ola no mueve el tamaño');
  assert.ok(clipLength(clips.get('focus_flow')!) > 20, 'la ola da la vuelta despacio');
  // u = 0 a las 12 y crece en sentido horario: el progreso empieza arriba.
  let top = -1;
  let right = -1;
  for (let i = 0; i < ring.uv.length / 2; i++) {
    const x = ring.position[i * 3];
    const screenUp = -ring.position[i * 3 + 2]; // three (x, y, z) ← Blender (x, z, −y)
    if (top < 0 && Math.abs(x) < 0.02 && screenUp > 0.8 && ring.uv[i * 2] < 0.02) top = i;
    if (right < 0 && Math.abs(screenUp) < 0.05 && x > 0.8) right = i;
  }
  assert.ok(top >= 0, 'u = 0 a las 12');
  assert.ok(right >= 0 && Math.abs(ring.uv[right * 2] - 0.25) < 0.03, `u = 0,25 a las 3 (${ring.uv[right * 2]})`);
});

test('canto rodado: estirarse sigue al eje del viaje y el clip termina en reposo', async () => {
  const { models, clips } = await load('calm-nav');
  const pebble = models.get('pebble')!;
  const rest = bounds(pebble);
  const sx = bounds(pebble, pebble.targets.stretch_x.position);
  const sy = bounds(pebble, pebble.targets.stretch_y.position);
  const squash = bounds(pebble, pebble.targets.squash.position);
  assert.ok(sx.size[0] > rest.size[0] * 1.1 && sx.size[2] < rest.size[2], 'stretch_x alarga en x y estrecha en el otro');
  assert.ok(sy.size[2] > rest.size[2] * 1.1 && sy.size[0] < rest.size[0], 'stretch_y alarga en y');
  assert.ok(squash.size[1] < rest.size[1] * 0.8, 'squash baja la altura');
  assert.ok(Math.abs(rest.size[0] / rest.size[2] - 1.75) < 0.02, `proporción de la pestaña (56 × 32): ${rest.size[0] / rest.size[2]}`);
  const travel = clips.get('nav_travel')!;
  const end = sampleClip(travel, 99, []);
  assert.ok(end.every((v) => Math.abs(v) < 0.01), 'termina en reposo');
});

test('sampleClip: interpola, sujeta los extremos y no reserva memoria', () => {
  const clip = { name: 'x', times: new Float32Array([0, 1, 2]), weights: new Float32Array([0, 10, 1, 20, 3, 40]), targets: 2 };
  const out: number[] = [];
  assert.equal(sampleClip(clip, 0.5, out), out);
  assert.deepEqual(out, [0.5, 15]);
  assert.deepEqual(sampleClip(clip, -1, out), [0, 10]);
  assert.deepEqual(sampleClip(clip, 5, out), [3, 40]);
  assert.deepEqual(sampleClip(clip, 1, out), [1, 20]);
  assert.equal(clipLength(clip), 2);
});

const line: Point[] = [[4, 12], [12, 12], [20, 12]];
const circle: Point[] = Array.from({ length: 25 }, (_, i): Point => [12 + 8 * Math.cos((i / 24) * Math.PI * 2), 12 + 8 * Math.sin((i / 24) * Math.PI * 2)]);

test('tubo del ícono: normales unitarias, índices válidos y centro en el trazo', () => {
  for (const strokes of [[line], [circle], [line, circle]]) {
    const tube = buildTube(strokes);
    const verts = tube.position.length / 3;
    assert.equal(tube.center.length, tube.position.length);
    assert.equal(tube.normal.length, tube.position.length);
    assert.ok(tube.index.every((i) => i < verts), 'índices dentro de la malla');
    assert.equal(tube.index.length % 3, 0);
    for (let i = 0; i < verts * 3; i += 3) {
      const l = Math.hypot(tube.normal[i], tube.normal[i + 1], tube.normal[i + 2]);
      if (Math.abs(l - 1) > 0.02) assert.fail(`normal de largo ${l}`);
      const d = Math.hypot(tube.position[i] - tube.center[i], tube.position[i + 1] - tube.center[i + 1], tube.position[i + 2] - tube.center[i + 2]);
      if (d > 1.13) assert.fail(`vértice a ${d} del centro`);
    }
  }
});

test('tubo del ícono: las coordenadas del SVG quedan centradas y con y hacia arriba', () => {
  const tube = buildTube([[[12, 2], [12, 6]]]);
  let top = -Infinity;
  for (let i = 1; i < tube.center.length; i += 3) top = Math.max(top, tube.center[i]);
  // y = 2 en el SVG (arriba) → 12 − 2 = 10, más la punta redonda del tubo.
  assert.ok(top > 10 && top < 11.2, `arriba: ${top}`);
});

test('tubo del ícono: un trazo cerrado no se tapa y tiene más caras que uno abierto del mismo largo', () => {
  const closed = buildTube([circle]);
  // Un aro cerrado: cada anillo se une con el siguiente, también el último con el primero.
  assert.equal(closed.index.length / 3, 24 * 8 * 2);
});

test('inclinación: el lado tocado se aleja, sin pasarse, y las grandes se inclinan menos', () => {
  const center = tiltTarget(150, 100, 300, 200);
  assert.ok(Math.abs(center.rx) < 1e-9 && Math.abs(center.ry) < 1e-9, 'en el centro no se inclina');
  const rightEdge = tiltTarget(300, 100, 300, 200);
  assert.ok(rightEdge.ry > 0, 'a la derecha, gira hacia allá');
  const top = tiltTarget(150, 0, 300, 200);
  assert.ok(top.rx > 0, 'arriba, se inclina hacia atrás');
  const outside = tiltTarget(9000, -9000, 300, 200);
  const { deg } = tiltLimits(300, 200);
  assert.ok(Math.abs(outside.rx) <= deg && Math.abs(outside.ry) <= deg, 'no pasa del límite');
  assert.ok(tiltLimits(900, 300).deg < tiltLimits(240, 200).deg, 'menos en las grandes');
  assert.ok(tiltLimits(4000, 4000).deg >= 1, 'pero no cero');
  const touch = tiltTarget(300, 100, 300, 200, true);
  assert.ok(touch.ry < rightEdge.ry && touch.z < rightEdge.z, 'con el dedo, más contenido');
});

test('muelle: llega, se pasa muy poco y se detiene', () => {
  let x = 0;
  let v = 0;
  let over = 0;
  let steps = 0;
  while (!settled(x, v, 1) && steps < 400) {
    ({ x, v } = springStep(x, v, 1, 1 / 60));
    over = Math.max(over, x - 1);
    steps++;
  }
  assert.ok(steps < 120, `se asienta en menos de 2 s (${steps} pasos)`);
  assert.ok(over > 0 && over < 0.12, `rebote pequeño: ${over}`);
});

test('sombra: se separa y se difumina al subir, y se corre hacia donde se inclina', () => {
  const nums = (s: string) => {
    const [, x, y, blur] = s.match(/, (-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px/)!;
    return { x: Number(x), y: Number(y), blur: Number(blur) };
  };
  const low = nums(castShadow(0, 0, 0));
  const high = nums(castShadow(0, 0, 14));
  assert.ok(high.y > low.y && high.blur > low.blur, 'sube: más lejos y más difusa');
  assert.ok(nums(castShadow(0, 4, 8)).x < nums(castShadow(0, -4, 8)).x, 'se corre con el giro');
  assert.ok(castShadow(0, 0, 0).includes('--lq-shadow-ink'), 'color del tema');
});
