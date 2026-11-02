// Materia calma: modelos de Blender (calm-*.glb), clips de animación, héroe del splash, tubo de los
// íconos del navbar y la inclinación de las tarjetas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clipLength, decodeCalm, sampleClip, type CalmModel } from '../../src/components/three3d/calmModels';
import { readGlbScene } from '../../src/components/three3d/glb';
import { buildTube, type Point } from '../../src/components/layout/nav3d/iconTube';
import { castShadow, settled, springStep, tiltLimits, tiltTarget } from '../../src/lib/motion/tiltMath';
import { pathPoint, streamAt, streamPath } from '../../src/splash/hero';
import { BIRTH_MS, BIRTH_RUSH, LEAVE_HOLD_MS, leaveDelay, N_HOLD_MS } from '../../src/splash/timing';

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
  for (const [name, kb] of [['calm-pad', 40], ['calm-focus', 80]] as const) {
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

const heroScene = async () => {
  const file = readFileSync(new URL('../../src/assets/models/calm-hero.glb', import.meta.url));
  return readGlbScene(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer);
};

test('héroe: las mallas, los shape keys, los tiempos y el peso para el splash', async () => {
  const scene = await heroScene();
  const n = scene.nodes.find((x) => x.name === 'hero_n')!;
  const leaves = scene.nodes.find((x) => x.name === 'hero_hojas')!;
  const timeline = scene.nodes.find((x) => x.name === 'hero_tiempo')!;
  assert.deepEqual([...n.targetNames].sort(), ['drop', 'puff']);
  assert.deepEqual(n.primitives.map((p) => p.material.slice(-1)).sort(), ['a', 'b', 'c'], 'una primitiva por hoja del logo');
  for (const name of ['_OUT', '_LAG', '_SHADE']) assert.ok(n.primitives[0].attributes[name], name);
  assert.deepEqual(leaves.targetNames, ['scatter']);
  for (const name of ['_PIVOT', '_AXIS', '_LAG', '_PART']) assert.ok(leaves.primitives[0].attributes[name], name);
  assert.deepEqual([...timeline.targetNames].sort(), ['assemble', 'drop', 'flat', 'flow', 'liquid', 'pool', 'puff', 'reform', 'solid']);
  for (const name of ['hero_birth', 'hero_breath', 'hero_outro']) assert.ok(scene.clips.some((c) => c.name === name), name);
  assert.ok(!scene.clips.some((c) => c.name === 'hero_sequence'), 'la secuencia completa no pesa en la web');
  const verts = n.primitives.reduce((sum, p) => sum + p.attributes.POSITION.array.length / 3, 0);
  assert.ok(verts < 2600, `N ligera: ${verts} vértices`);
  const size = readFileSync(new URL('../../src/assets/models/calm-hero.glb', import.meta.url)).length / 1024;
  assert.ok(size < 100, `${size.toFixed(1)} KB < 100 KB`);
});

test('héroe: el contorno de la N es el del logo y la gota cabe en su radio', async () => {
  const scene = await heroScene();
  const n = scene.nodes.find((x) => x.name === 'hero_n')!;
  const dropAt = n.targetNames.indexOf('drop');
  let [minX, maxX, minY, maxY, maxH, maxDrop] = [Infinity, -Infinity, Infinity, -Infinity, -Infinity, 0];
  for (const prim of n.primitives) {
    const pos = prim.attributes.POSITION.array;
    const out = prim.attributes._OUT.array;
    const drop = prim.targets[dropAt].POSITION.array;
    for (let i = 0; i < pos.length; i += 3) {
      // glTF: (x, z, −y).
      minX = Math.min(minX, pos[i]);
      maxX = Math.max(maxX, pos[i]);
      minY = Math.min(minY, -pos[i + 2]);
      maxY = Math.max(maxY, -pos[i + 2]);
      maxH = Math.max(maxH, pos[i + 1]);
      maxDrop = Math.max(maxDrop, Math.hypot(pos[i] + drop[i], pos[i + 2] + drop[i + 2]));
      const wall = pos[i + 1] < -0.1;
      // Los atributos propios van como en Blender: (x, y, z).
      assert.equal(Math.hypot(out[i], out[i + 1]) > 0.5, wall, 'solo la pared se abre hacia fuera');
    }
  }
  // viewBox 0 0 670 786 con 2 unidades de alto, centrado.
  assert.ok(Math.abs(minX + 335 / 393) < 0.012 && Math.abs(maxX - 335 / 393) < 0.012, `ancho del logo: ${minX} a ${maxX}`);
  assert.ok(Math.abs(minY + 1) < 0.012 && Math.abs(maxY - 1) < 0.012, `alto del logo: ${minY} a ${maxY}`);
  assert.ok(maxH > 0.1 && maxH < 0.2, `almohada baja: ${maxH}`);
  assert.ok(Math.abs(maxDrop - 0.6) < 0.03, `radio de la gota: ${maxDrop}`);
});

test('héroe: tres hojas, una por trazo del logo, que empiezan lejos de la N', async () => {
  const scene = await heroScene();
  const leaves = scene.nodes.find((x) => x.name === 'hero_hojas')!.primitives[0];
  const part = leaves.attributes._PART.array;
  const pivot = leaves.attributes._PIVOT.array;
  const fly = leaves.targets[0].POSITION.array;
  const per = new Map<number, number>();
  for (const p of part) per.set(Math.round(p * 2), (per.get(Math.round(p * 2)) ?? 0) + 1);
  assert.deepEqual([...per.keys()].sort(), [0, 1, 2], 'una hoja por trazo');
  for (let i = 0; i < pivot.length; i += 3) {
    assert.ok(Math.abs(pivot[i]) < 0.9 && Math.abs(pivot[i + 1]) < 1.05, 'el centro cae dentro del logo');
    assert.ok(Math.hypot(fly[i], fly[i + 2]) > 2, 'empieza lejos de la N');
  }
});

test('héroe: los mismos tres trazados en el logo, en el splash de CSS y en Blender', () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
  const brand = [...read('../../src/components/layout/Brand.tsx').matchAll(/key: '[abc]', d: '([^']+)'/g)].map((m) => m[1]);
  assert.equal(brand.length, 3);
  const html = read('../../index.html');
  const python = read('../../scripts/blender/calm.py');
  for (const d of brand) {
    assert.ok(html.includes(`d="${d}"`), 'index.html');
    assert.ok(python.includes(`'${d}'`), 'calm.py');
  }
});

test('héroe: la línea de tiempo arma la N, respira en bucle y termina en el logo', async () => {
  const scene = await heroScene();
  const names = scene.nodes.find((x) => x.name === 'hero_tiempo')!.targetNames;
  const clip = (name: string) => scene.clips.find((c) => c.name === name)!;
  const w: number[] = [];
  const weight = (name: string, target: string, t: number) => sampleClip(clip(name), t, w)[names.indexOf(target)];
  const birth = clipLength(clip('hero_birth'));
  assert.ok(Math.abs(birth - BIRTH_MS / 1000) < 0.05, `dura ${birth} s: splash/timing dice ${BIRTH_MS} ms`);
  assert.equal(weight('hero_birth', 'assemble', 0), 0);
  assert.equal(weight('hero_birth', 'solid', 0), 0);
  assert.ok(Math.abs(weight('hero_birth', 'assemble', birth) - 1) < 0.01 && Math.abs(weight('hero_birth', 'solid', birth) - 1) < 0.01, 'termina armada');
  assert.ok(Math.abs(weight('hero_birth', 'puff', birth)) < 0.02, 'sin hincharse al acabar: empalma con la respiración');
  const breath = clipLength(clip('hero_breath'));
  assert.ok(Math.abs(weight('hero_breath', 'puff', 0) - weight('hero_breath', 'puff', breath)) < 0.01, 'cierra el bucle');
  const outro = clipLength(clip('hero_outro'));
  for (const [name, value] of [['drop', 1], ['pool', 0], ['flow', 1], ['reform', 1], ['flat', 1], ['liquid', 0]] as const) {
    assert.ok(Math.abs(weight('hero_outro', name, outro) - value) < 0.01, `${name} al final`);
  }
  // En orden: se funde, sale la corriente, aparece en el logo y solo entonces se vacía la gota de origen.
  const first = (target: string) => { for (let t = 0; t <= outro; t += 1 / 60) if (weight('hero_outro', target, t) > 0.02) return t; return Infinity; };
  assert.ok(first('drop') < first('flow'), 'primero se funde');
  assert.ok(first('flow') < first('reform'), 'la corriente llega antes de abrirse en la N');
  const emptied = (() => { for (let t = 0; t <= outro; t += 1 / 60) if (weight('hero_outro', 'pool', t) < 0.02) return t; return Infinity; })();
  assert.ok(first('reform') < emptied, 'al logo ya está llegando cuando la gota se vacía');
  assert.ok(first('flat') > first('reform'), 'se aplana al final');
});

test('salida del héroe: deja pintar la app y no corta el armado', () => {
  assert.equal(leaveDelay(5000), Math.max(LEAVE_HOLD_MS, N_HOLD_MS), 'ya armada: solo la espera del pintado');
  assert.equal(leaveDelay(0), BIRTH_MS / BIRTH_RUSH + N_HOLD_MS, 'acaba de empezar: lo que le falta, a ritmo rápido, y la N a la vista');
});

test('corriente: sale de la N, llega exacta al logo y cada gota avanza sin volver atrás', () => {
  const from = { x: 640, y: 400 };
  const to = { x: 36, y: 32 };
  const view = { width: 1280, height: 800 };
  const path = streamPath(from, to, view);
  assert.deepEqual(pathPoint(path, 0), from);
  const end = pathPoint(path, 1);
  assert.ok(Math.abs(end.x - to.x) < 1e-6 && Math.abs(end.y - to.y) < 1e-6);
  for (let t = 0; t <= 1; t += 0.02) {
    const p = pathPoint(path, t);
    assert.ok(p.x >= 0 && p.x <= view.width && p.y >= 0 && p.y <= view.height, `dentro de la pantalla: ${p.x}, ${p.y}`);
  }
  // En un teléfono, sin sitio abajo, tampoco se sale.
  const phone = streamPath({ x: 195, y: 700 }, { x: 30, y: 28 }, { width: 390, height: 720 });
  for (let t = 0; t <= 1; t += 0.02) assert.ok(pathPoint(phone, t).y <= 720, 'sin salirse por abajo');
  for (const lag of [0, 0.3, 1]) {
    let previous = -1;
    for (let flow = 0; flow <= 1.001; flow += 0.02) {
      const u = streamAt(flow, lag);
      assert.ok(u >= previous, 'no retrocede');
      previous = u;
    }
    assert.equal(streamAt(1, lag), 1, 'todas llegan');
  }
  assert.ok(streamAt(0.3, 0) > streamAt(0.3, 0.5), 'las primeras van delante');
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
