// Figura anatómica del Coliseo en 3D, generada por código (no hay modelo que
// descargar): un maniquí base y los 16 músculos de lib/coliseo. Cada músculo es
// una sola geometría con sus dos lados, así se dibuja en una llamada y se
// colorea con un solo material. Metros, pies en y = 0, frente hacia +z.
// Sin DOM ni WebGL: MuscleScene la pinta y tests/unit/coliseo.unit.ts la prueba.
import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Matrix4, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MUSCLE_IDS, type Muscle } from '@/lib/coliseo';

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Interpolación cúbica monótona (Fritsch–Carlson) de una tabla [x, y]: suave y sin pasarse de los nodos. */
function smooth(keys: Array<[number, number]>) {
  const xs = keys.map((k) => k[0]);
  const ys = keys.map((k) => k[1]);
  const n = keys.length;
  if (n === 1) return () => ys[0];
  const d = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / (x - xs[i]));
  const m = ys.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (3 * t2 - 2 * t3) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

/* ───────── Perfiles: semiancho w (sobre la piel) y semigrosor d (hacia afuera) a lo largo de t ∈ [0, 1] ───────── */

type Profile = (t: number) => [w: number, d: number];

/** Puntas redondeadas: lleva el perfil a 0 en los extremos como un cuarto de círculo. */
const roundEnds = (t: number, e0: number, e1: number) => {
  const a = clamp01(t / e0);
  const b = clamp01((1 - t) / e1);
  return Math.sqrt(1 - (1 - a) ** 2) * Math.sqrt(1 - (1 - b) ** 2);
};

/** Vientre muscular: máximo en `peak` y afilado hacia los tendones (`full` < 1 lo hace más redondo). */
function spindle(w: number, d: number, peak = 0.5, full = 0.55): Profile {
  const a = Math.log(0.5) / Math.log(peak);
  return (t) => {
    const s = Math.sin(Math.PI * Math.pow(clamp01(t), a)) ** full;
    return [w * s, d * s];
  };
}

/** Almohadilla de abdominal: casi rectangular con las puntas redondas. */
const pad = (w: number, d: number): Profile => (t) => {
  const s = (1 - Math.abs(2 * t - 1) ** 4) ** 0.25;
  return [w * s, d * s];
};

function keyed(w: Array<[number, number]>, d: Array<[number, number]>, ends: [number, number] = [0.12, 0.12]): Profile {
  const W = smooth(w);
  const D = smooth(d);
  return (t) => {
    const r = roundEnds(t, ends[0], ends[1]);
    return [W(t) * r, D(t) * r];
  };
}

/**
 * Tubo de sección elíptica que sigue `path` (Catmull-Rom). `out` da la dirección
 * hacia afuera de la piel en cada punto: ahí crece el grosor d; el ancho w queda
 * pegado a la superficie. Más anillos cerca de las puntas, donde cambia la forma.
 */
function sweep(path: Vector3[], profile: Profile, out: (p: Vector3) => Vector3, radial = 14, rings = 18): BufferGeometry {
  const curve = new CatmullRomCurve3(path, false, 'centripetal');
  const pos: number[] = [];
  const index: number[] = [];
  const p = new Vector3();
  const T = new Vector3();
  const N = new Vector3();
  const B = new Vector3();
  for (let i = 0; i <= rings; i++) {
    const t = (1 - Math.cos((Math.PI * i) / rings)) / 2;
    curve.getPointAt(t, p);
    curve.getTangentAt(t, T);
    const o = out(p);
    N.copy(o).addScaledVector(T, -o.dot(T)).normalize();
    B.crossVectors(T, N).normalize();
    const [w, d] = profile(t);
    for (let j = 0; j < radial; j++) {
      const a = (2 * Math.PI * j) / radial;
      const cw = Math.cos(a) * w;
      const sd = Math.sin(a) * d;
      pos.push(p.x + B.x * cw + N.x * sd, p.y + B.y * cw + N.y * sd, p.z + B.z * cw + N.z * sd);
    }
  }
  // (a, a+radial, b) gira en sentido antihorario visto desde afuera: cara frontal hacia fuera.
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      index.push(a, a + radial, b, b, a + radial, b + radial);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** Elipsoide con ejes `x`, `y`, `z` (ya escalados) centrado en `at`. */
function ellipsoid(at: Vector3, x: Vector3, y: Vector3, z: Vector3, w = 20, h = 14) {
  const g = new SphereGeometry(1, w, h);
  g.deleteAttribute('uv');
  const m = new Matrix4().makeBasis(x, y, z);
  // Una base zurda daría la vuelta a la esfera (caras hacia dentro): el signo de un eje no cambia la forma.
  if (m.determinant() < 0) m.makeBasis(x, y, z.clone().negate());
  return g.applyMatrix4(m.setPosition(at));
}
const ball = (at: Vector3, r: number) => ellipsoid(at, v(r, 0, 0), v(0, r, 0), v(0, 0, r), 16, 12);

/** Copia espejo (lado izquierdo). El espejo invierte el giro de los triángulos: se corrige. */
function mirrored(g: BufferGeometry) {
  const m = g.clone().applyMatrix4(new Matrix4().makeScale(-1, 1, 1));
  const idx = m.getIndex()!;
  for (let i = 0; i < idx.count; i += 3) {
    const b = idx.getX(i + 1);
    idx.setX(i + 1, idx.getX(i + 2));
    idx.setX(i + 2, b);
  }
  return m;
}

function merge(parts: BufferGeometry[]) {
  const g = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  if (!g) throw new Error('figure: geometrías incompatibles');
  g.computeBoundingSphere();
  return g;
}
const bothSides = (parts: BufferGeometry[]) => merge([...parts, ...parts.map(mirrored)]);

/* ───────── Torso: elipses apiladas (semiancho W, semifondo D, centro en z) ───────── */

const torsoW = smooth([[0.8, 0.06], [0.85, 0.135], [0.92, 0.165], [1.0, 0.161], [1.06, 0.146], [1.13, 0.148], [1.21, 0.162], [1.29, 0.178], [1.36, 0.184], [1.42, 0.172], [1.465, 0.115], [1.49, 0.055], [1.5, 0.02]]);
const torsoD = smooth([[0.8, 0.05], [0.85, 0.095], [0.92, 0.112], [1.0, 0.108], [1.06, 0.098], [1.13, 0.1], [1.21, 0.11], [1.29, 0.118], [1.36, 0.114], [1.42, 0.1], [1.465, 0.076], [1.49, 0.048], [1.5, 0.02]]);
const torsoZ = smooth([[0.8, 0], [0.92, -0.006], [1.06, 0], [1.29, 0.01], [1.42, 0], [1.5, -0.004]]);

const torsoF = (x: number, y: number, z: number) => (x / torsoW(y)) ** 2 + ((z - torsoZ(y)) / torsoD(y)) ** 2 - 1;
/** Normal de la piel del torso (gradiente numérico): sirve también en la pendiente del trapecio. */
function torsoOut(p: Vector3) {
  const e = 1e-4;
  return v(
    torsoF(p.x + e, p.y, p.z) - torsoF(p.x - e, p.y, p.z),
    torsoF(p.x, p.y + e, p.z) - torsoF(p.x, p.y - e, p.z),
    torsoF(p.x, p.y, p.z + e) - torsoF(p.x, p.y, p.z - e),
  ).normalize();
}
/** Punto de la piel del torso a la altura y, en x, por delante o por detrás; `lift` < 0 lo hunde. */
function onTorso(x: number, y: number, back: boolean, lift: number) {
  const W = torsoW(y);
  const s = Math.max(-1, Math.min(1, x / W));
  const p = v(W * s, y, torsoZ(y) + torsoD(y) * Math.sqrt(1 - s * s) * (back ? -1 : 1));
  return p.addScaledVector(torsoOut(p), lift);
}
/** Punto de la parte de arriba del torso (hombros y cuello) sobre (x, z): busca la altura por bisección. */
function onTorsoTop(x: number, z: number, lift: number) {
  let lo = 1.36;
  let hi = 1.499;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (torsoF(x, mid, z) < 0) lo = mid; else hi = mid;
  }
  const p = v(x, lo, z);
  return p.addScaledVector(torsoOut(p), lift);
}

/* ───────── Extremidades (lado derecho, +x) ───────── */

interface Limb { a: Vector3; b: Vector3; r: (t: number) => number }

const S = v(0.185, 1.395, -0.006); // hombro
const E = v(0.252, 1.118, -0.016); // codo
const Wr = v(0.318, 0.878, 0.014); // muñeca
const H = v(0.088, 0.905, 0); // cadera
const K = v(0.097, 0.49, 0.012); // rodilla
const A = v(0.103, 0.088, -0.014); // tobillo

const upperArm: Limb = { a: S, b: E, r: smooth([[0, 0.046], [1, 0.037]]) };
const forearm: Limb = { a: E, b: Wr, r: smooth([[0, 0.036], [0.35, 0.034], [1, 0.024]]) };
const thigh: Limb = { a: H, b: K, r: smooth([[0, 0.08], [0.5, 0.066], [1, 0.05]]) };
const shin: Limb = { a: K, b: A, r: smooth([[0, 0.05], [0.3, 0.047], [1, 0.03]]) };

/** Ejes del segmento: U a lo largo, F al frente, L hacia afuera del cuerpo. */
function frameOf({ a, b }: Limb) {
  const U = b.clone().sub(a).normalize();
  const F = v(0, 0, 1).addScaledVector(U, -U.z).normalize();
  const L = new Vector3().crossVectors(F, U).normalize();
  return { U, F, L };
}
/** Punto de la piel de un segmento: t a lo largo (0 = articulación de arriba), φ alrededor (0 frente, π/2 afuera, π atrás). */
function onLimb(l: Limb, t: number, phi: number, lift: number) {
  const { U, F, L } = frameOf(l);
  const r = l.r(t) + lift;
  return l.a.clone().addScaledVector(U, t * l.a.distanceTo(l.b)).addScaledVector(F, Math.cos(phi) * r).addScaledVector(L, Math.sin(phi) * r);
}
const limbPath = (l: Limb, t0: number, t1: number, phi: number, lift = -0.008) =>
  [0, 1 / 3, 2 / 3, 1].map((k) => onLimb(l, t0 + (t1 - t0) * k, phi, lift));

/** Hacia afuera desde el hueso más cercano (uno o varios segmentos). */
function radialFrom(...bones: Array<[Vector3, Vector3]>) {
  const q = new Vector3();
  const best = new Vector3();
  return (p: Vector3) => {
    let min = Infinity;
    for (const [a, b] of bones) {
      const ab = b.clone().sub(a);
      q.copy(a).addScaledVector(ab, clamp01(p.clone().sub(a).dot(ab) / ab.lengthSq()));
      const dist = q.distanceToSquared(p);
      if (dist < min) { min = dist; best.copy(q); }
    }
    return p.clone().sub(best).normalize();
  };
}

function limbBody(l: Limb, radial = 16) {
  const { F } = frameOf(l);
  return sweep([l.a, l.b], (t) => { const r = l.r(t) * roundEnds(t, 0.04, 0.04); return [r, r]; }, () => F, radial, 12);
}

/* ───────── Maniquí ───────── */

function buildBody() {
  const torso = sweep(
    [0.8, 0.92, 1.06, 1.29, 1.42, 1.5].map((y) => v(0, y, torsoZ(y))),
    (t) => { const y = 0.8 + 0.7 * t; const r = roundEnds(t, 0.03, 0.03); return [torsoW(y) * r, torsoD(y) * r]; },
    () => v(0, 0, 1), 28, 40,
  );
  const neck = sweep([v(0, 1.44, -0.012), v(0, 1.58, 0.004)], keyed([[0, 0.05], [1, 0.044]], [[0, 0.047], [1, 0.044]], [0.05, 0.05]), () => v(0, 0, 1), 16, 8);
  const head = ellipsoid(v(0, 1.66, 0.012), v(0.078, 0, 0), v(0, 0.104, 0), v(0, 0, 0.093), 28, 20);

  const fore = frameOf(forearm);
  const hand = ellipsoid(Wr.clone().addScaledVector(fore.U, 0.08), fore.L.clone().multiplyScalar(0.036), fore.U.clone().multiplyScalar(0.082), fore.F.clone().multiplyScalar(0.017), 14, 10);
  const toesOut = new Matrix4().makeRotationY(0.12);
  const foot = ellipsoid(v(0.108, 0.036, 0.048), v(0.042, 0, 0).applyMatrix4(toesOut), v(0, 0.036, 0), v(0, 0, 0.112).applyMatrix4(toesOut), 16, 10);
  const side = [
    ball(S, 0.05), limbBody(upperArm), ball(E, 0.037), limbBody(forearm, 14), hand,
    limbBody(thigh, 18), ball(K, 0.052), limbBody(shin), foot,
  ];
  return merge([torso, neck, head, ...side, ...side.map(mirrored)]);
}

/* ───────── Músculos (lado derecho; el izquierdo es su espejo) ───────── */

const armOut = radialFrom([upperArm.a, upperArm.b]);
const foreOut = radialFrom([forearm.a, forearm.b]);
const thighOut = radialFrom([thigh.a, thigh.b]);
const shinOut = radialFrom([shin.a, shin.b]);
// El deltoides sale de la bola del hombro: el radio se mide desde un poco por encima de la articulación.
const deltOut = radialFrom([S.clone().add(v(0, 0.012, 0)), E]);

/** Dirección desde el hombro: az 0 = afuera, π/2 = frente, −π/2 = atrás; el = elevación. */
const fromShoulder = (az: number, el: number, r: number) =>
  S.clone().add(v(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).multiplyScalar(r));

/** Cabeza del deltoides: nace en el hombro (clavícula, acromion o escápula) y baja a la inserción del húmero. */
const deltHead = (az0: number, az1: number, phiMid: number, phiEnd: number) => sweep(
  [fromShoulder(az0, 0.8, 0.044), fromShoulder(az1, 0.22, 0.05), onLimb(upperArm, 0.24, phiMid, -0.003), onLimb(upperArm, 0.44, phiEnd, -0.008)],
  keyed([[0, 0.025], [0.3, 0.032], [0.7, 0.022], [1, 0.007]], [[0, 0.012], [0.35, 0.02], [0.75, 0.015], [1, 0.006]], [0.12, 0.15]),
  deltOut,
);

const torsoPath = (pts: Array<[number, number]>, back: boolean, lift = -0.004) => pts.map(([x, y]) => onTorso(x, y, back, lift));

const MUSCLE_PARTS: Record<Muscle, () => BufferGeometry[]> = {
  chest: () => [sweep(
    torsoPath([[0.014, 1.3], [0.058, 1.312], [0.102, 1.33], [0.142, 1.352], [0.172, 1.376]], false),
    keyed([[0, 0.058], [0.3, 0.066], [0.6, 0.058], [0.85, 0.04], [1, 0.018]], [[0, 0.018], [0.35, 0.025], [0.75, 0.02], [1, 0.009]], [0.08, 0.1]),
    torsoOut,
  )],
  frontDelts: () => [deltHead(1.95, 1.3, 0.7, 1.25)],
  sideDelts: () => [deltHead(0.05, 0, Math.PI / 2, Math.PI / 2)],
  rearDelts: () => [deltHead(-1.95, -1.3, Math.PI - 0.7, Math.PI - 1.25)],
  biceps: () => [sweep(limbPath(upperArm, 0.22, 0.9, 0.05), spindle(0.033, 0.026, 0.58), armOut)],
  triceps: () => [
    sweep(limbPath(upperArm, 0.14, 0.88, Math.PI + 0.45), spindle(0.031, 0.022, 0.42), armOut), // cabeza larga
    sweep(limbPath(upperArm, 0.2, 0.72, Math.PI - 0.55), spindle(0.027, 0.02, 0.42), armOut), // cabeza lateral
  ],
  forearms: () => [
    sweep(limbPath(forearm, 0.02, 0.72, -0.55, -0.007), spindle(0.028, 0.02, 0.28), foreOut), // flexores
    sweep(limbPath(forearm, 0.02, 0.74, Math.PI - 0.9, -0.007), spindle(0.026, 0.018, 0.28), foreOut), // extensores
    sweep( // braquiorradial: cruza el codo
      [onLimb(upperArm, 0.72, 1.25, -0.008), onLimb(upperArm, 0.95, 1.0, -0.004), onLimb(forearm, 0.22, 0.7, -0.004), onLimb(forearm, 0.58, 0.55, -0.008)],
      spindle(0.022, 0.019, 0.35, 0.5), radialFrom([upperArm.a, upperArm.b], [forearm.a, forearm.b]),
    ),
  ],
  traps: () => [
    sweep( // superior: de la nuca al acromion
      [v(0.018, 1.535, -0.04), onTorsoTop(0.06, -0.035, -0.004), onTorsoTop(0.11, -0.03, -0.004), onTorsoTop(0.155, -0.015, -0.004)],
      keyed([[0, 0.022], [0.4, 0.032], [1, 0.018]], [[0, 0.013], [0.5, 0.016], [1, 0.01]], [0.15, 0.15]), torsoOut,
    ),
    sweep( // medio e inferior: de la escápula a la columna
      torsoPath([[0.045, 1.455], [0.05, 1.39], [0.043, 1.3], [0.024, 1.2]], true, -0.003),
      keyed([[0, 0.05], [0.3, 0.056], [0.7, 0.034], [1, 0.01]], [[0, 0.012], [0.5, 0.01], [1, 0.006]], [0.1, 0.15]), torsoOut,
    ),
  ],
  lats: () => [sweep(
    torsoPath([[0.06, 1.075], [0.095, 1.15], [0.13, 1.225], [0.158, 1.295], [0.172, 1.345]], true, -0.003),
    keyed([[0, 0.032], [0.25, 0.064], [0.55, 0.07], [0.8, 0.05], [1, 0.02]], [[0, 0.009], [0.45, 0.018], [0.85, 0.016], [1, 0.008]], [0.1, 0.12]),
    torsoOut,
  )],
  lowerBack: () => [sweep(torsoPath([[0.032, 0.97], [0.034, 1.065], [0.03, 1.165]], true), spindle(0.026, 0.017, 0.5, 0.45), torsoOut)],
  abs: () => [[1.236, 1.184], [1.176, 1.124], [1.116, 1.064], [1.054, 0.966]].map(([y0, y1]) =>
    sweep(torsoPath([[0.031, y0], [0.031, (y0 + y1) / 2], [0.031, y1]], false, -0.003), pad(0.026, 0.012), torsoOut, 12, 10)),
  obliques: () => [sweep(torsoPath([[0.118, 1.245], [0.13, 1.17], [0.126, 1.1], [0.108, 1.025]], false), spindle(0.04, 0.013, 0.45, 0.5), torsoOut)],
  glutes: () => [sweep(
    [onLimb(thigh, 0.3, Math.PI + 0.3, -0.012), onTorso(0.082, 0.87, true, -0.012), onTorso(0.075, 0.965, true, -0.014)],
    spindle(0.07, 0.038, 0.45, 0.45), () => v(0.3, -0.12, -1).normalize(),
  )],
  quads: () => [
    sweep(limbPath(thigh, 0.06, 0.86, 0.05), spindle(0.036, 0.025, 0.42), thighOut), // recto femoral
    sweep(limbPath(thigh, 0.1, 0.9, 1.05), spindle(0.042, 0.025, 0.55), thighOut), // vasto lateral
    sweep(limbPath(thigh, 0.5, 0.94, -0.75), spindle(0.036, 0.026, 0.72), thighOut), // vasto medial
  ],
  hamstrings: () => [
    sweep(limbPath(thigh, 0.12, 0.88, Math.PI - 0.45), spindle(0.036, 0.021, 0.45), thighOut), // bíceps femoral
    sweep(limbPath(thigh, 0.1, 0.9, Math.PI + 0.45), spindle(0.038, 0.021, 0.5), thighOut), // semitendinoso y semimembranoso
  ],
  calves: () => [
    sweep(limbPath(shin, 0.02, 0.56, Math.PI + 0.42, -0.006), spindle(0.034, 0.027, 0.32), shinOut), // gemelo interno
    sweep(limbPath(shin, 0.02, 0.48, Math.PI - 0.42, -0.006), spindle(0.03, 0.023, 0.28), shinOut), // gemelo externo
    sweep(limbPath(shin, 0.32, 0.86, Math.PI, -0.01), spindle(0.034, 0.012, 0.38, 0.5), shinOut), // sóleo
  ],
};

export interface Figure {
  body: BufferGeometry;
  muscles: Record<Muscle, BufferGeometry>;
  /** Desde dónde se ve cada músculo: 1 de frente, −1 de espaldas, 0 de los dos lados. */
  facing: Record<Muscle, -1 | 0 | 1>;
}

/** Por dónde asoma el músculo: su centro por delante o por detrás de los ejes del cuerpo (z ≈ 0). */
function facingOf(g: BufferGeometry): -1 | 0 | 1 {
  const p = g.getAttribute('position');
  let z = 0;
  for (let i = 0; i < p.count; i++) z += p.getZ(i);
  const mean = z / p.count;
  return mean > 0.015 ? 1 : mean < -0.015 ? -1 : 0;
}

export function buildFigure(): Figure {
  const muscles = {} as Record<Muscle, BufferGeometry>;
  const facing = {} as Record<Muscle, -1 | 0 | 1>;
  for (const m of MUSCLE_IDS) {
    muscles[m] = bothSides(MUSCLE_PARTS[m]());
    facing[m] = facingOf(muscles[m]);
  }
  return { body: buildBody(), muscles, facing };
}
