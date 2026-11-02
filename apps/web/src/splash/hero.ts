// Héroe del splash: la cinta de Blender (juego hero de scripts/blender/calm.py) con WebGL 2 a pelo.
// Corre en un Worker sobre OffscreenCanvas: mientras React monta la app el hilo principal se traba,
// y el nacimiento, la respiración y el vuelo al navbar no pueden depender de él. Por eso tampoco usa
// three.js: en el Worker serían otros 142 KB antes de poder dibujar nada.
//
// Un solo lienzo a pantalla completa, encima del splash y de la app. Cada objeto se proyecta con su
// propia perspectiva alrededor de su centro: el canto rodado se ve igual que el del navbar en
// cualquier punto de la pantalla, y la sombra cae de verdad sobre el nombre y sobre la interfaz.
import { clipLength, readGlbScene, sampleClip, type GlbClip } from '@/components/three3d/glb';
import { KEY_DIR, studioChunk } from '@/components/three3d/calmShader';
import { BIRTH_RUSH, LEAVE_HOLD_MS } from './timing';

export type Rgb = readonly [number, number, number];

/** Colores del tema en lineal (splash/boot.ts los lee de los tokens --lq-*). */
export interface HeroTones {
  dark: boolean;
  clay: Rgb;
  mint: Rgb;
  deep: Rgb;
  glass: Rgb;
  light: Rgb;
  shade: Rgb;
  shadow: Rgb;
}

/** Medidas en px CSS. `size`: diámetro del objeto; `text`: caja del nombre. */
export interface HeroLayout {
  width: number;
  height: number;
  dpr: number;
  x: number;
  y: number;
  size: number;
  text: { x: number; y: number; w: number; h: number };
}

/** A dónde vuela: el canto rodado del navbar, la marca de la cabecera o, sin nada, se recoge ahí mismo. */
export interface HeroTarget {
  kind: 'pebble' | 'mark' | 'none';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HeroInit {
  url: string;
  tones: HeroTones;
  layout: HeroLayout;
}

export type HeroCommand = { type: 'layout'; layout: HeroLayout } | { type: 'tones'; tones: HeroTones } | { type: 'leave'; target: HeroTarget } | { type: 'stop' };
export type HeroEvent = { type: 'ready' } | { type: 'landed' } | { type: 'fail' };

/** Radio exterior del modelo (R + tubo × (1 + cresta)): con él, `size` es el diámetro en pantalla. */
export const HERO_RADIUS = 1.57;
/** Px por unidad en el navbar y distancia de la cámara: los de NavPebbleScene, para que empalmen. */
const PEBBLE_PX = 32;
const CAMERA = 6.71;
const PEBBLE_TILT = 13;
/** Reposo: tumbada e inclinada lo justo para ver el agujero y el grosor. */
const REST_TILT = 21;
const REST_YAW = -11;
/** Micro-rotación (grados/s) y ola que rueda por la superficie (segundos por vuelta de fase). */
const SPIN = 6;
const ROLL_SECONDS = 9;
/** Medio lado (en unidades) del recuadro que se dibuja aparte para verlo a través del vidrio. */
const BOX = 1.9;
const BEHIND_SIZE = 256;
/** La y de los UV llega dividida por esto (calm.py, HERO_UV_MARGIN). */
const UV_MARGIN = '1.08';

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Avance del vuelo: arranca lento, cruza y se posa sin frenazo. */
export function flightEase(t: number) {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/** Punto del vuelo en un arco suave, con el tamaño cambiando en proporción (no en línea recta). */
export function flightAt(t: number, from: { x: number; y: number; unit: number }, to: { x: number; y: number; unit: number }) {
  const k = flightEase(t);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const bow = 0.14 * Math.sin(Math.PI * k);
  return {
    x: from.x + dx * k - dy * bow,
    y: from.y + dy * k + dx * bow,
    unit: from.unit * (to.unit / from.unit) ** k,
  };
}

/** Giro de la fase de la ola sobre la pose (a, b) de los dos shape keys de cresta. */
export function rollWeights(amount: number, phase: number) {
  return [amount * Math.cos(phase), amount * Math.sin(phase)] as const;
}

const VERT = /* glsl */ `#version 300 es
precision highp float;
in vec3 position; in vec3 normal; in vec2 uv;
in vec3 aT0; in vec3 aN0; in vec3 aT1; in vec3 aN1; in vec3 aT2; in vec3 aN2; in vec3 aT3; in vec3 aN3; in vec3 aT4; in vec3 aN4;
uniform float uW[5];
uniform float uInset;
uniform mat3 uRot;
uniform vec3 uScale;
uniform vec2 uCenter;
uniform vec2 uUnit;
uniform float uCam;
out vec3 vN; out vec3 vW; out vec3 vV; out vec3 vO; out vec3 vRay; out vec2 vUv; out float vPart;
out vec3 vBox;
void main() {
  vUv = uv;
  vPart = 0.0;
  vec3 nor = normal + aN0 * uW[0] + aN1 * uW[1] + aN2 * uW[2] + aN3 * uW[3] + aN4 * uW[4];
  nor = normalize(nor + vec3(0.0, 1e-5, 0.0));
  vec3 pos = position + aT0 * uW[0] + aT1 * uW[1] + aT2 * uW[2] + aT3 * uW[3] + aT4 * uW[4] - nor * uInset;
  vO = pos;
  vec3 wp = uRot * (pos * uScale);
  vN = uRot * nor;
  vW = wp;
  vV = normalize(vec3(0.0, 0.0, uCam) - wp);
  vRay = wp - vec3(0.0, 0.0, uCam);
  float w = (uCam - wp.z) / uCam;
  vBox = vec3(wp.xy / ${BOX.toFixed(2)}, w);
  gl_Position = vec4(uCenter * w + wp.xy * uUnit, -wp.z * 0.2 * w, w);
}`;

const FRAG_HEAD = /* glsl */ `#version 300 es
precision highp float;
#define varying in
#define texture2D texture
out vec4 outColor;
#define gl_FragColor outColor
vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float dither() { return fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5; }
`;

const FRAG = /* glsl */ `${FRAG_HEAD}
${studioChunk}
#define TAU 6.28318530718
in vec3 vBox;
uniform float uLayer;
uniform float uRoll;
uniform float uRidge;
uniform float uMass;
uniform float uPebble;
uniform float uFade;
uniform vec3 uClay;
uniform vec3 uMint;
uniform vec3 uDeep;
uniform vec3 uGlass;
uniform vec3 uLight;
uniform vec3 uShade;
uniform sampler2D uBehind;

// Contraluz: muy tenue, solo despega la silueta del fondo.
float rimLight(vec3 n, float ndv) {
  return pow(1.0 - ndv, 3.0) * max(dot(n, normalize(vec3(0.42, 0.62, -0.66))) + 0.35, 0.0);
}

void main() {
  vec3 v = normalize(vV);
  vec3 n = surfaceNormal();
  float ndv = max(dot(n, v), 0.0);
  float fres = pow(1.0 - ndv, 2.2);
  // Las dos vueltas de la malla (calm.py, grid_mesh): x el aro; y el tubo, con 0 afuera.
  float U = vUv.x * TAU;
  float V = (1.0 - vUv.y) * ${UV_MARGIN} * TAU - 3.14159265;
  // 1 en la cresta que corre por la cinta, 0 en el valle; una sola cara, así que es una sola línea.
  float crest = 0.5 + 0.5 * cos(2.0 * V + 3.0 * U - uRoll);
  float mass = clamp(uMass, 0.0, 1.0);
  float pebble = clamp(uPebble, 0.0, 1.0);
  float ridge = clamp(uRidge, 0.0, 1.0);
  // La forma de reposo; en la gota y en el canto rodado no hay agujero ni crestas que oscurecer.
  float form = (1.0 - mass) * (1.0 - pebble);
  float hole = smoothstep(-1.0, 0.35, cos(V));
  float occlusion = form * ((1.0 - hole) * 0.5 + (1.0 - crest) * 0.26 * ridge);

  // Un degradado continuo de crema a menta a lo largo de la cinta: es una sola superficie.
  float along = 0.5 + 0.5 * cos(U + 0.45 * sin(V) - 2.2);
  vec3 albedo = mix(uClay, uDeep, smoothstep(0.08, 0.92, along));

  if (uLayer < 0.5) {
    // Núcleo de arcilla: solo se ve a través del vidrio.
    vec3 col = clayLight(albedo, n, v, 0.7);
    col *= mix(vec3(1.0), uShade, occlusion);
    gl_FragColor = vec4(toSrgb(col), 1.0);
    return;
  }

  // Vidrio esmerilado: la piel lechosa deja pasar el núcleo desenfocado y corrido por la refracción.
  // Donde hay más grosor de vidrio (la cresta) se tiñe más y deja pasar menos.
  float thick = crest * ridge * form;
  vec2 at = vBox.xy / vBox.z * 0.5 + 0.5 + n.xy * 0.018;
  vec4 behind = textureLod(uBehind, at, mix(mix(1.5, 2.6, thick), 3.0, mass));
  float through = mix(0.88, 0.5, thick) * (1.0 - fres * 0.82);
  through = mix(through, 0.66 * (1.0 - fres * 0.7), mass);
  through *= 1.0 - smoothstep(0.1, 0.8, uPebble);
  // Sobre un fondo oscuro, dejar pasar la página solo apaga el borde: ahí el vidrio se queda con su luz.
  through *= 1.0 - 0.9 * uDark * (1.0 - behind.a);

  vec3 glass = mix(mix(uGlass, albedo, 0.35 + 0.4 * thick), uMint, pebble);
  vec3 col = clayLight(glass, n, v, 0.85 + 0.4 * pebble);
  col *= mix(vec3(1.0), uShade, occlusion * 0.75);
  col += mix(vec3(1.0), uLight, 0.5 + 0.35 * uDark) * (pow(1.0 - ndv, 5.0) * 0.22 + rimLight(n, ndv) * 0.26) * (1.0 - pebble);
  // En oscuro la cinta no recibe luz del fondo: el vidrio guarda un poco de la suya y el borde no se apaga.
  col += uLight * fres * 0.34 * uDark * (1.0 - pebble);
  // El reflejo de la ventana del estudio, de borde más definido que el resto: es lo que hace leer la piel como vidrio.
  col += vec3(1.0) * softbox(reflect(-v, n), uKey, 0.03, 0.2) * (0.13 + 0.05 * uDark) * (1.0 - pebble);
  // Grano fino pegado a la superficie: el mate de la arcilla y el esmerilado.
  float grain = fract(sin(dot(floor(vUv * vec2(1400.0, 620.0)), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  vec3 skin = toSrgb(col) + (dither() / 255.0 + grain * 0.016) * (1.0 - pebble);
  // Premultiplicado: la piel más lo que deja pasar; lo que no tapa nadie es la página de atrás.
  vec3 rgb = skin * (1.0 - through) + behind.rgb * through;
  float alpha = (1.0 - through) + behind.a * through;
  gl_FragColor = vec4(rgb, alpha) * uFade;
}`;

// Sombra muy difusa (cae sobre el nombre y, en el vuelo, sobre la interfaz) y paso de luz sobre el nombre.
const PLANE_VERT = /* glsl */ `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID & 1) << 2) - 1.0, float((gl_VertexID & 2) << 1) - 1.0);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const PLANE_FRAG = /* glsl */ `${FRAG_HEAD}
uniform vec2 uView;
uniform float uDpr;
uniform float uMode;
uniform vec2 uAt;
uniform float uRadius;
uniform float uSoft;
uniform float uStrength;
uniform vec3 uTint;
uniform vec4 uText;
uniform float uSweep;

void main() {
  vec2 p = vec2(gl_FragCoord.x, uView.y * uDpr - gl_FragCoord.y) / uDpr;
  if (uMode < 0.5) {
    // Un aro difuso: a esta distancia del fondo, el agujero casi no se nota en la sombra.
    float d = length((p - uAt) * vec2(1.0, 1.08));
    float ring = exp(-pow((d - uRadius * 0.62) / uSoft, 2.0));
    float fill = exp(-pow(d / (uRadius * 0.8 + uSoft * 0.4), 4.0));
    float a = uStrength * max(ring, fill * 0.7);
    gl_FragColor = vec4(uTint, a + dither() / 255.0);
    return;
  }
  // Paso de luz: una franja ancha e inclinada que cruza solo la caja del nombre.
  float x = p.x - uSweep + (p.y - uText.y) * 0.34;
  float band = exp(-pow(x / (uText.z * 0.2), 2.0));
  float edge = smoothstep(uText.y - 10.0, uText.y + 8.0, p.y) * (1.0 - smoothstep(uText.y + uText.w - 8.0, uText.y + uText.w + 10.0, p.y));
  gl_FragColor = vec4(uTint, band * edge * uStrength);
}`;

type Canvas = HTMLCanvasElement | OffscreenCanvas;

export function startHero(canvas: Canvas, init: HeroInit, post: (e: HeroEvent) => void) {
  // Sin GPU de verdad (WebGL por software) no hay 3D: se queda la gota.
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'low-power', failIfMajorPerformanceCaveat: true }) as WebGL2RenderingContext | null;
  if (!gl) {
    post({ type: 'fail' });
    return { handle() {} };
  }

  let tones = init.tones;
  let layout = init.layout;
  let frame = 0;
  let last = 0;
  let frames = 0;
  let slow = 0;
  let stopped = false;
  let ready = false;

  // Tiempo de cada fase. `birth` empieza con el primer fotograma.
  let birthT = 0;
  let breathT = 0;
  let leaveT = -1;
  let target: HeroTarget | null = null;
  let pending: HeroTarget | null = null;
  let hold = 0;
  let roll = 0;
  let spin = -0.5;
  let sweep = 0;
  let from = { x: 0, y: 0, unit: 1 };

  let birth: GlbClip;
  let breath: GlbClip;
  let outro: GlbClip;
  let names: string[] = [];
  let count = 0;
  const weights = [0, 0, 0, 0, 0];
  const clip: number[] = [];

  const compile = (type: number, source: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    return s;
  };
  const link = (vs: string, fs: string) => {
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'hero: shader');
    const cache = new Map<string, WebGLUniformLocation | null>();
    const at = (name: string) => {
      if (!cache.has(name)) cache.set(name, gl.getUniformLocation(p, name));
      return cache.get(name)!;
    };
    return { p, at };
  };

  const main = link(VERT, FRAG);
  const plane = link(PLANE_VERT, PLANE_FRAG);
  const vao = gl.createVertexArray();

  // Lo que se ve a través del vidrio: el núcleo, en un lienzo pequeño con mipmaps. Los niveles altos
  // son el desenfoque del esmerilado.
  const behind = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, behind);
  gl.texStorage2D(gl.TEXTURE_2D, 5, gl.RGBA8, BEHIND_SIZE, BEHIND_SIZE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const behindFbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, behindFbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, behind, 0);
  const behindDepth = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, behindDepth);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, BEHIND_SIZE, BEHIND_SIZE);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, behindDepth);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  const applyLayout = (next: HeroLayout) => {
    layout = next;
    canvas.width = Math.round(next.width * next.dpr);
    canvas.height = Math.round(next.height * next.dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  const pick = (name: string, source: readonly number[]) => source[names.indexOf(name)] ?? 0;

  /** Pose del fotograma: pesos, giro y sitio en pantalla. */
  const pose = () => {
    const rest = { x: layout.x, y: layout.y, unit: layout.size / 2 / HERO_RADIUS };
    let amount = 1;
    let mass = 0;
    let pebble = 0;
    let breathing = 0;
    let at = rest;
    let tilt = REST_TILT;
    const sway = REST_YAW + Math.sin((birthT + breathT) * 0.5) * 1.6;
    let yaw = sway;
    let turn = spin;
    let scaleX = 1;
    let scaleY = 1;
    let fade = 1;
    let height = 1;

    if (leaveT >= 0 && target) {
      const d = clipLength(outro);
      const t = Math.min(leaveT, d);
      sampleClip(outro, t, clip);
      amount = pick('ridge_a', clip);
      breathing = pick('breath', clip);
      const shape = pick('pebble', clip);
      const p = clamp((t - 0.05) / (d - 0.05));
      const k = flightEase(p);
      if (target.kind === 'pebble') {
        pebble = shape;
        at = flightAt(p, from, { x: target.x, y: target.y, unit: PEBBLE_PX });
        scaleX = lerp(1, target.w / 56, clamp(shape));
        scaleY = lerp(1, target.h / 32, clamp(shape));
        tilt = lerp(REST_TILT, PEBBLE_TILT, k);
        yaw = lerp(sway, 0, k);
        // Entra un poco grande y se asienta en su sitio.
        at.unit *= 1 + 0.07 * Math.sin(Math.PI * smooth(0.66, 1, p)) * (1 - smooth(0.92, 1, p));
        height = 1 - k;
      } else {
        // Se recoge en una gota: hacia la marca de la cabecera o, sin destino, ahí mismo.
        mass = shape;
        const end = target.kind === 'mark'
          ? { x: target.x, y: target.y, unit: Math.max(target.w, target.h) / 2 / 0.92 }
          : { x: from.x, y: from.y, unit: from.unit * 0.42 };
        at = flightAt(p, from, end);
        fade = 1 - smooth(0.62, 1, p);
        height = 1 - k;
      }
      // El giro se deshace antes de posarse: el canto rodado es alargado y va derecho.
      turn = lerp(spin, Math.round(spin / Math.PI) * Math.PI, smooth(0.08, 0.72, p));
    } else if (birthT < clipLength(birth)) {
      sampleClip(birth, birthT, clip);
      amount = pick('ridge_a', clip);
      mass = pick('mass', clip);
      breathing = pick('breath', clip);
    } else {
      sampleClip(breath, breathT % clipLength(breath), clip);
      breathing = pick('breath', clip);
    }
    const [a, b] = rollWeights(amount, roll);
    weights[names.indexOf('ridge_a')] = a;
    weights[names.indexOf('ridge_b')] = b;
    weights[names.indexOf('breath')] = breathing;
    weights[names.indexOf('mass')] = mass;
    weights[names.indexOf('pebble')] = pebble;
    return { at, tilt, yaw, turn, scaleX, scaleY, amount, mass, pebble, fade, height };
  };

  /** El eje del aro (y del modelo) mira hacia quien usa la app. */
  const rotation = (tilt: number, yaw: number, turn: number) => {
    const x = Math.PI / 2 - (tilt * Math.PI) / 180;
    const y = (yaw * Math.PI) / 180;
    return matrix(Math.cos(y), Math.sin(y), Math.cos(x), Math.sin(x), Math.cos(turn), Math.sin(turn));
  };

  const draw = () => {
    const { at, tilt, yaw, turn, scaleX, scaleY, amount, mass, pebble, fade, height } = pose();
    gl.bindVertexArray(vao);
    gl.useProgram(main.p);
    const shell = weights.slice();
    const core = weights.slice();
    core[names.indexOf('ridge_a')] *= CORE_RIDGE;
    core[names.indexOf('ridge_b')] *= CORE_RIDGE;
    gl.uniformMatrix3fv(main.at('uRot'), false, rotation(tilt, yaw, turn));
    gl.uniform3f(main.at('uScale'), scaleX, 1, scaleY);
    gl.uniform1f(main.at('uCam'), CAMERA);
    gl.uniform1f(main.at('uRoll'), roll);
    gl.uniform1f(main.at('uRidge'), amount);
    gl.uniform1f(main.at('uMass'), mass);
    gl.uniform1f(main.at('uPebble'), pebble);
    gl.uniform1f(main.at('uFade'), fade);
    gl.uniform1f(main.at('uDark'), tones.dark ? 1 : 0);
    gl.uniform3fv(main.at('uClay'), tones.clay);
    gl.uniform3fv(main.at('uMint'), tones.mint);
    gl.uniform3fv(main.at('uDeep'), tones.deep);
    gl.uniform3fv(main.at('uGlass'), tones.glass);
    gl.uniform3fv(main.at('uLight'), tones.light);
    gl.uniform3fv(main.at('uShade'), tones.shade);
    const key = Math.hypot(...KEY_DIR);
    gl.uniform3f(main.at('uKey'), KEY_DIR[0] / key, KEY_DIR[1] / key, KEY_DIR[2] / key);

    // Primero el núcleo, aparte, en su recuadro; el vidrio lo mira desde sus mipmaps. Mientras se
    // dibuja ahí, la textura no puede seguir enlazada (sería un bucle de realimentación).
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, behindFbo);
    gl.viewport(0, 0, BEHIND_SIZE, BEHIND_SIZE);
    gl.clearColor(0, 0, 0, 0);
    gl.depthMask(true); // sin esto, clear no borra la profundidad
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.uniform1fv(main.at('uW'), core);
    gl.uniform1f(main.at('uInset'), lerp(CORE_INSET, 0.46, clamp(mass)) * (1 - 0.6 * clamp(pebble)));
    gl.uniform1f(main.at('uLayer'), 0);
    gl.uniform2f(main.at('uCenter'), 0, 0);
    gl.uniform2f(main.at('uUnit'), 1 / BOX, 1 / BOX);
    gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_INT, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, behind);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.uniform1i(main.at('uBehind'), 1);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);

    // Sombra: lejos del fondo en reposo, se acerca y se aprieta al posarse.
    gl.useProgram(plane.p);
    gl.uniform2f(plane.at('uView'), layout.width, layout.height);
    gl.uniform1f(plane.at('uDpr'), layout.dpr);
    const radius = at.unit * lerp(0.95, HERO_RADIUS, clamp(1 - mass) * clamp(1 - pebble));
    const open = clamp(1 - mass);
    gl.bindVertexArray(null);
    gl.uniform1f(plane.at('uMode'), 0);
    gl.uniform2f(plane.at('uAt'), at.x + radius * lerp(0.05, 0.2, height), at.y + radius * lerp(0.1, 0.5, height));
    gl.uniform1f(plane.at('uRadius'), radius);
    gl.uniform1f(plane.at('uSoft'), radius * lerp(0.3, 0.5, height));
    gl.uniform1f(plane.at('uStrength'), (tones.dark ? 0.42 : 0.075) * fade * (0.45 + 0.55 * open));
    gl.uniform3fv(plane.at('uTint'), srgb(tones.shadow));
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Paso de luz sobre el nombre: una sola vez, cuando la cinta termina de abrirse.
    if (sweep > 0 && sweep < 1 && leaveT < 0) {
      const { text } = layout;
      gl.uniform1f(plane.at('uMode'), 1);
      gl.uniform4f(plane.at('uText'), text.x, text.y, text.w, text.h);
      gl.uniform1f(plane.at('uSweep'), lerp(text.x - text.w * 0.4, text.x + text.w * 1.4, sweep));
      gl.uniform1f(plane.at('uStrength'), (tones.dark ? 0.05 : 0.24) * Math.sin(Math.PI * sweep));
      gl.uniform3fv(plane.at('uTint'), [1, 1, 1]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.bindVertexArray(vao);

    // La piel de vidrio. Una pasada de solo profundidad: así cada píxel pinta lo más cercano y nada
    // más, sin importar el orden de los triángulos; la sombra de abajo sigue viéndose por lo que transparenta.
    gl.useProgram(main.p);
    gl.uniform1fv(main.at('uW'), shell);
    gl.uniform1f(main.at('uInset'), 0);
    gl.uniform1f(main.at('uLayer'), 1);
    gl.uniform2f(main.at('uCenter'), (at.x / layout.width) * 2 - 1, 1 - (at.y / layout.height) * 2);
    gl.uniform2f(main.at('uUnit'), (at.unit * 2) / layout.width, (at.unit * 2) / layout.height);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.depthMask(true);
    gl.colorMask(false, false, false, false);
    gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_INT, 0);
    gl.colorMask(true, true, true, true);
    gl.depthMask(false);
    gl.depthFunc(gl.LEQUAL);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_INT, 0);
    gl.depthFunc(gl.LESS);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(null);
  };

  /** Si los fotogramas pasan de 24 ms de forma sostenida, baja la resolución (los 60 fps mandan). */
  const adapt = (ms: number) => {
    if (ms > 200) return;
    frames++;
    if (ms > 24) slow++;
    if (frames < 30) return;
    if (slow > 12 && layout.dpr > 1) applyLayout({ ...layout, dpr: Math.max(1, layout.dpr - 0.25) });
    frames = 0;
    slow = 0;
  };

  const finish = () => {
    stopped = true;
    cancelAnimationFrame(frame);
    post({ type: 'landed' });
  };

  const beginLeave = (t: HeroTarget) => {
    target = t;
    leaveT = 0;
    from = { x: layout.x, y: layout.y, unit: layout.size / 2 / HERO_RADIUS };
  };

  const tick = (now: number) => {
    if (stopped) return;
    frame = requestAnimationFrame(tick);
    if (last) adapt(now - last);
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
    last = now;
    roll += (dt * Math.PI * 2) / ROLL_SECONDS;
    spin += (dt * SPIN * Math.PI) / 180;
    if (leaveT >= 0) {
      leaveT += dt;
      if (leaveT >= clipLength(outro) + 0.04) { draw(); finish(); return; }
    } else if (birthT < clipLength(birth)) {
      // Si la app ya espera (el modelo llegó tarde), abre más deprisa.
      birthT += pending ? dt * BIRTH_RUSH : dt;
    } else if (pending && hold <= 0) {
      beginLeave(pending);
      pending = null;
    } else {
      breathT += dt;
    }
    hold -= dt;
    if (birthT > 0.75) sweep = Math.min(1, sweep + dt / 1.3);
    draw();
    if (!ready) {
      ready = true;
      post({ type: 'ready' });
    }
  };

  const load = async () => {
    const res = await fetch(init.url);
    if (!res.ok) throw new Error(`hero ${res.status}`);
    const scene = await readGlbScene(await res.arrayBuffer());
    const node = scene.nodes.find((n) => n.name === 'hero');
    if (!node) throw new Error('hero: sin malla');
    const prim = node.primitives[0];
    names = node.targetNames;
    const named = (name: string) => {
      const c = scene.clips.find((x) => x.name === name);
      if (!c) throw new Error(`hero: sin ${name}`);
      return c;
    };
    birth = named('hero_birth');
    breath = named('hero_breath');
    outro = named('hero_outro');

    gl.bindVertexArray(vao);
    const attr = (name: string, data: Float32Array, size: number) => {
      const at = gl.getAttribLocation(main.p, name);
      if (at < 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(at);
      gl.vertexAttribPointer(at, size, gl.FLOAT, false, 0, 0);
    };
    attr('position', prim.attributes.POSITION.array, 3);
    attr('normal', prim.attributes.NORMAL.array, 3);
    attr('uv', prim.attributes.TEXCOORD_0.array, 2);
    prim.targets.forEach((t, i) => {
      attr(`aT${i}`, t.POSITION.array, 3);
      attr(`aN${i}`, t.NORMAL.array, 3);
    });
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, prim.index, gl.STATIC_DRAW);
    count = prim.index.length;
    gl.bindVertexArray(null);

    gl.useProgram(main.p);
    const image = scene.images[0];
    const bitmap = image ? await createImageBitmap(new Blob([image.bytes], { type: image.mimeType })).catch(() => null) : null;
    gl.uniform1f(main.at('uHasMap'), bitmap ? 1 : 0);
    gl.uniform1f(main.at('uMapStrength'), 1);
    gl.uniform2f(main.at('uMapRepeat'), 1, 1);
    gl.uniform1i(main.at('uMap'), 0);
    if (bitmap) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    }
    if (stopped) return;
    applyLayout(layout);
    frame = requestAnimationFrame(tick);
  };

  load().catch(() => post({ type: 'fail' }));

  return {
    handle(cmd: HeroCommand) {
      if (cmd.type === 'layout') {
        applyLayout(cmd.layout);
      } else if (cmd.type === 'tones') {
        tones = cmd.tones;
      } else if (cmd.type === 'leave') {
        // No se corta el nacimiento: sale al terminarlo. Mientras, la app se pinta debajo.
        pending = cmd.target;
        hold = LEAVE_HOLD_MS / 1000;
      } else {
        stopped = true;
        cancelAnimationFrame(frame);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
    },
  };
}

/** Núcleo de arcilla respecto al vidrio: su cresta y cuánto se mete (calm.py, HERO_CORE*). */
const CORE_RIDGE = (0.9 * 0.444) / 0.46;
const CORE_INSET = 0.39 * 0.1;

/** El color de la sombra va directo al lienzo: en sRGB. */
const srgb = (c: Rgb) => c.map((v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));

/** Ry(yaw) · Rx(x) · Ry(turn), por columnas. */
function matrix(cy: number, sy: number, cx: number, sx: number, ct: number, st: number) {
  const a = [ct, sx * st, -cx * st];
  const b = [0, cx, sx];
  const c = [st, -sx * ct, cx * ct];
  const y = (v: number[]) => [cy * v[0] + sy * v[2], v[1], -sy * v[0] + cy * v[2]];
  return new Float32Array([...y(a), ...y(b), ...y(c)]);
}
