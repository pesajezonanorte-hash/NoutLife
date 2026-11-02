// Héroe del splash: hojas → N → líquido → logo, con las mallas y los tiempos de Blender (juego hero de
// scripts/blender/calm.py) y WebGL 2 a pelo. Corre en un Worker sobre OffscreenCanvas: mientras React
// monta la app el hilo principal se traba, y la secuencia no puede depender de él. Por eso tampoco usa
// three.js: en el Worker serían otros 142 KB antes de poder dibujar nada.
//
// Todo lo sólido o líquido sale de un solo campo, y por eso pasa de un estado a otro sin cortes:
//   · La N se dibuja a una textura (altura con signo, normal y color), en su sitio o a la medida del logo.
//   · Las gotas se suman en otra textura, pequeña: valor y pendiente de cada una.
//   · Un paso final a pantalla completa suma las dos: donde el total pasa de 1 hay materia, y su normal
//     sale de esas mismas pendientes. Por eso la N se funde con las gotas al tocarlas.
// Las hojas son geometría de verdad, encima, con su propia perspectiva.
import { clipLength, readGlbScene, sampleClip, type GlbClip, type GlbPrimitive } from '@/components/three3d/glb';
import { KEY_DIR, lightChunk } from '@/components/three3d/calmShader';
import { BIRTH_RUSH, LEAVE_HOLD_MS, N_HOLD_MS } from './timing';

export type Rgb = readonly [number, number, number];

/** Color en lineal (splash/boot.ts los lee de los tokens --lq-*), salvo el logo, que va en sRGB como el SVG. */
export interface HeroTones {
  dark: boolean;
  mint: Rgb;
  deep: Rgb;
  light: Rgb;
  leaf: Rgb;
  shadow: Rgb;
  /** Paradas de los degradados del logo, en sRGB: las hojas c, a y b, en ese orden. */
  logo: readonly (readonly Rgb[])[];
}

/** Medidas en px CSS. `size`: alto de la N en el centro del splash. */
export interface HeroLayout {
  width: number;
  height: number;
  dpr: number;
  x: number;
  y: number;
  size: number;
}

/** A dónde va: el logo de la cabecera o, sin logo a la vista, se recoge ahí mismo. `h`: alto de la N. */
export interface HeroTarget {
  kind: 'mark' | 'none';
  x: number;
  y: number;
  h: number;
}

export interface HeroInit {
  url: string;
  tones: HeroTones;
  layout: HeroLayout;
  /** Momento en que se abrió la página (ms de época): si ya se ve la N de CSS, las hojas sobran. */
  openedAt: number;
  /** Recarga en la misma pestaña: la historia de las hojas ya se contó. */
  seen: boolean;
}

export type HeroCommand = { type: 'layout'; layout: HeroLayout } | { type: 'tones'; tones: HeroTones } | { type: 'leave'; target: HeroTarget } | { type: 'stop' };
export type HeroEvent = { type: 'ready' } | { type: 'landed' } | { type: 'fail' };

/** Pasado este tiempo, index.html ya muestra la N de CSS (.n): el 3D la releva sin repetir las hojas. */
export const SKIP_LEAVES_AFTER_MS = 1600;

/** Media medida de la zona de la N en su textura, en unidades de la N (mide 2 de alto). */
const EXTENT = 1.32;
/** Lo que abre la web la pared de la pieza: la altura con signo que rodea al borde. */
const FLARE = 0.17;
/** Altura máxima de la almohada y de la gota. */
const TOP_H = 0.42;
/** Cómo pasa la altura al campo: 1 en el borde, cae fuera y sube dentro. */
const FIELD_K = 11;
/** Las gotas se dibujan a una textura de esta fracción de la pantalla. */
const FIELD_SCALE = 1 / 2;
/** Distancia de la cámara de las hojas, en unidades de la N. */
const CAMERA = 8;
/** Gotas por cada hoja del mosaico: con menos, la corriente se corta. */
const DROPS_PER_LEAF = 4;
/** Radio de la gota en la que se recoge, igual que HERO_DROP_R en calm.py. */
const DROP_R = 0.6;

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));

/** Avance a lo largo de la corriente, para `lag` (0 sale primero): arranca suave y llega sin frenazo. */
export function streamAt(flow: number, lag: number) {
  const u = clamp((flow - lag * 0.5) / 0.5);
  return u * u * (3 - 2 * u);
}

/** Curva de la corriente: sale hacia abajo, como si pesara, y sube pegada al borde hasta el logo. */
export function streamPath(from: { x: number; y: number }, to: { x: number; y: number }, view: { width: number; height: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const room = Math.min(view.height - from.y - 24, Math.abs(dy) * 0.62 + 40);
  return [
    { x: from.x, y: from.y },
    { x: from.x + dx * 0.26, y: from.y + Math.max(0, room) },
    { x: to.x - dx * 0.03, y: to.y - dy * 0.58 },
    { x: to.x, y: to.y },
  ];
}

/** Punto de la curva (Bézier cúbica). */
export function pathPoint(p: readonly { x: number; y: number }[], t: number) {
  const u = 1 - t;
  const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return { x: k[0] * p[0].x + k[1] * p[1].x + k[2] * p[2].x + k[3] * p[3].x, y: k[0] * p[0].y + k[1] * p[1].y + k[2] * p[2].y + k[3] * p[3].y };
}

const HEAD = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;
`;

const FRAG_HEAD = /* glsl */ `${HEAD}
vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 toLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
float dither() { return fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5; }
`;

// La N a textura. El .glb trae (x, z, −y), salvo los atributos propios (_OUT, _PIVOT, _AXIS), que el
// exportador deja como en Blender; aquí se trabaja en coordenadas de la N, y arriba.
const N_VERT = /* glsl */ `${HEAD}
in vec3 position; in vec3 normal; in vec3 aOut; in float aLag; in float aShade; in float aPart;
in vec3 aPuffP; in vec3 aPuffN; in vec3 aDropP; in vec3 aDropN;
uniform float uPuff;
uniform float uDrop;
uniform vec4 uRegion; // x, y: centro en el recorte; z, w: escala
out float vH;
out vec3 vN;
out vec2 vLogo;
out float vShade;
flat out float vPart;
void main() {
  // Se funde por tandas: unos puntos antes que otros (_LAG).
  float w = smoothstep(aLag * 0.55, aLag * 0.55 + 0.45, uDrop);
  vec3 p = position + aPuffP * uPuff + aDropP * w;
  vec3 n = normal + aPuffN * uPuff + aDropN * w;
  vec2 xy = p.xz * vec2(1.0, -1.0) + aOut.xy * ${FLARE.toFixed(2)};
  vH = p.y;
  vN = normalize(vec3(n.x, -n.z, n.y));
  vLogo = vec2(position.x * 393.0 + 335.0, 393.0 + position.z * 393.0);
  vShade = aShade;
  vPart = aPart;
  gl_Position = vec4(uRegion.xy + xy * uRegion.zw, 0.0, 1.0);
}`;

const N_FRAG = /* glsl */ `${HEAD}
in float vH;
in vec3 vN;
in vec2 vLogo;
in float vShade;
flat in float vPart;
uniform float uPass;
uniform vec3 uStops[9];
layout(location = 0) out vec4 out0;
layout(location = 1) out vec4 out1;

// Los degradados del logo, por hoja, con las mismas líneas y paradas que el SVG (components/layout/Brand.tsx).
vec3 logoColor() {
  vec2 a, b;
  vec3 c0, c1, c2, c3;
  float t;
  if (vPart < 0.5) {
    a = vec2(520.0, 210.0); b = vec2(669.0, 780.0);
    t = clamp(dot(vLogo - a, b - a) / dot(b - a, b - a), 0.0, 1.0);
    return t < 0.45 ? mix(uStops[0], uStops[1], t / 0.45) : mix(uStops[1], uStops[2], (t - 0.45) / 0.55);
  }
  if (vPart < 1.5) {
    a = vec2(60.0, 40.0); b = vec2(650.0, 770.0);
    t = clamp(dot(vLogo - a, b - a) / dot(b - a, b - a), 0.0, 1.0);
    if (t < 0.35) return mix(uStops[3], uStops[4], t / 0.35);
    if (t < 0.72) return mix(uStops[4], uStops[5], (t - 0.35) / 0.37);
    return mix(uStops[5], uStops[6], (t - 0.72) / 0.28);
  }
  a = vec2(30.0, 290.0); b = vec2(250.0, 740.0);
  t = clamp(dot(vLogo - a, b - a) / dot(b - a, b - a), 0.0, 1.0);
  return mix(uStops[7], uStops[8], t);
}

void main() {
  if (uPass < 0.5) {
    // Altura con signo, la más alta de las tres: se mezcla con MAX.
    out0 = vec4(vH, 0.0, 0.0, 1.0);
    return;
  }
  // Superficie, pintada en el orden del logo: cada hoja tapa a la anterior dentro de su contorno. Antes
  // una pasada sin recortar, para que el borde, al interpolar, no lea negro de lo que hay fuera.
  if (uPass > 1.5 && vH < 0.0) discard;
  vec3 n = normalize(vN);
  out0 = vec4(n.xy, vShade, 1.0);
  out1 = vec4(logoColor(), 1.0);
}`;

// Las gotas: cada una suma su valor y su pendiente. Salen del mosaico de la N, corren al logo y caen en
// el mosaico de la N pequeña.
const DROP_VERT = /* glsl */ `${HEAD}
in vec4 aDrop; // x, y: sitio en la N; z: radio; w: en qué tanda sale (0 a 1)
in vec2 aRand;
uniform vec2 uView;
uniform vec4 uFrom; // x, y, unidad (px), tamaño de la gota grande
uniform vec4 uTo;   // x, y, unidad (px), 1 si hay logo al que llegar
uniform vec2 uP1;
uniform vec2 uP2;
uniform vec2 uPool; // dónde está la gota grande: se va yendo tras la corriente
uniform float uDropW;
uniform float uLiquid;
uniform float uFlow;
uniform float uReform;
uniform float uTime;
uniform float uStream; // px de grosor de la corriente
out vec2 vQ;
out float vSigma;
out float vAmp;

vec2 bez(float t) {
  float u = 1.0 - t;
  return u * u * u * uFrom.xy + 3.0 * u * u * t * uP1 + 3.0 * u * t * t * uP2 + t * t * t * uTo.xy;
}

void main() {
  vec2 corner = vec2(float(gl_VertexID & 1) * 2.0 - 1.0, float((gl_VertexID >> 1) & 1) * 2.0 - 1.0);
  float lag = aDrop.w;
  // Se recogen hacia la gota: cada una a un punto del disco, con un temblor de líquido.
  vec2 home = uFrom.xy + vec2(aDrop.x, -aDrop.y) * uFrom.z;
  float ang = aRand.x * 6.2832;
  vec2 disc = vec2(cos(ang), sin(ang)) * sqrt(aRand.y);
  vec2 pool = uPool + disc * ${DROP_R.toFixed(2)} * uFrom.z * 0.78 * uFrom.w;
  float g = smoothstep(lag * 0.5, lag * 0.5 + 0.5, uDropW);
  vec2 wob = vec2(sin(uTime * 3.1 + ang * 3.0), cos(uTime * 2.7 + ang * 5.0)) * 0.018 * uFrom.z * uLiquid;
  vec2 inN = mix(home, pool, g) + wob;
  // La corriente.
  float u = clamp((uFlow - lag * 0.5) / 0.5, 0.0, 1.0);
  u = u * u * (3.0 - 2.0 * u);
  vec2 on = bez(u);
  vec2 tan = normalize(bez(min(u + 0.01, 1.0)) - bez(max(u - 0.01, 0.0)) + 1e-4);
  vec2 nor = vec2(-tan.y, tan.x);
  // Algunas gotas se apartan un poco de la corriente y vuelven: el hilo no es un tubo.
  float loose = step(0.93, aRand.y) * 2.6 + 1.0;
  float side = (aRand.x - 0.5) * sin(3.14159 * u) * uStream * 0.5 * loose;
  float wave = sin(u * 11.0 + uTime * 2.4) * sin(3.14159 * u) * uStream * 0.9;
  on += nor * (side + wave);
  float out_ = smoothstep(0.0, 0.1, u);
  vec2 pos = mix(inN, on, out_);
  // Al llegar, cada gota a su sitio en la N pequeña.
  vec2 dest = uTo.xy + vec2(aDrop.x, -aDrop.y) * uTo.z;
  float arrive = smoothstep(0.86, 1.0, u) * uTo.w;
  pos = mix(pos, dest, arrive);
  // Tamaño: el de su hoja en la N; un hilo que se afina en la corriente; casi nada en el logo.
  float inSize = aDrop.z * uFrom.z * 0.62;
  float along = mix(uStream, uStream * 0.6, u) * (0.82 + 0.4 * aRand.x);
  float landed = max(aDrop.z * uTo.z * 0.9, 3.0);
  float sigma = mix(mix(inSize, along, out_), landed, arrive);
  // Aparecen con el líquido, poco dentro de la N para no hincharla, y se apagan al entrar en la pequeña.
  float amp = mix(0.15, 0.46, out_) * uLiquid * (1.0 - arrive);
  vAmp = amp;
  vSigma = sigma;
  vec2 q = corner * sigma * 3.1;
  vQ = q;
  vec2 px = pos + vec2(q.x, -q.y);
  gl_Position = vec4(px.x / uView.x * 2.0 - 1.0, 1.0 - px.y / uView.y * 2.0, 0.0, 1.0);
}`;

const DROP_FRAG = /* glsl */ `${HEAD}
in vec2 vQ;
in float vSigma;
in float vAmp;
out vec4 color;
void main() {
  vec2 q = vQ / vSigma;
  float f = vAmp * exp(-0.5 * dot(q, q));
  color = vec4(f, -q.x / vSigma * f, -q.y / vSigma * f, 0.0);
}`;

const FULL_VERT = /* glsl */ `${HEAD}
void main() {
  vec2 p = vec2(float((gl_VertexID & 1) << 2) - 1.0, float((gl_VertexID & 2) << 1) - 1.0);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

// El paso final: suma la N y las gotas, y pinta la materia con la luz del estudio.
const SCENE_FRAG = /* glsl */ `${FRAG_HEAD}
out vec4 outColor;
#define gl_FragColor outColor
${lightChunk}
uniform vec2 uView;
uniform float uDpr;
uniform sampler2D uH;
uniform sampler2D uS;
uniform sampler2D uC;
uniform sampler2D uField;
uniform vec4 uA;   // la N grande: x, y, unidad (px), 1 si se dibuja
uniform vec4 uB;   // la N pequeña
uniform vec4 uAtlasA;
uniform vec4 uAtlasB;
uniform float uLift;
uniform float uLiquidK;
uniform float uFlat;
uniform float uStream;
uniform vec3 uMint;
uniform vec3 uDeep;
uniform vec3 uLight;
uniform vec3 uTint;
uniform float uShadowK;

vec2 atlasAt(vec2 p, vec4 place, vec4 atlas, out float inside) {
  vec2 q = (p - place.xy) / place.z;
  q.y = -q.y;
  vec2 a = q / ${EXTENT.toFixed(2)};
  inside = step(max(abs(a.x), abs(a.y)), 0.995);
  return atlas.xy + (a * 0.5 + 0.5) * atlas.zw;
}

float heightAt(vec2 p, vec4 place, vec4 atlas) {
  float inside;
  vec2 uv = atlasAt(p, place, atlas, inside);
  return mix(-1.0, texture(uH, uv).r, inside);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uView.y * uDpr - gl_FragCoord.y) / uDpr;
  vec2 screen = gl_FragCoord.xy / (uView * uDpr);
  vec3 drops = texture(uField, screen).xyz;

  // La N grande sube desde dentro al solidificarse (uLift baja de la altura máxima a 0).
  float fa = 0.0;
  float fb = 0.0;
  float inA = 0.0;
  float inB = 0.0;
  vec2 uvA = vec2(0.0);
  vec2 uvB = vec2(0.0);
  if (uA.w > 0.0) {
    uvA = atlasAt(p, uA, uAtlasA, inA);
    float h = mix(-1.0, texture(uH, uvA).r, inA);
    fa = h > -0.99 ? exp(${FIELD_K.toFixed(1)} * (h - uLift)) : 0.0;
  }
  if (uB.w > 0.0) {
    uvB = atlasAt(p, uB, uAtlasB, inB);
    float h = mix(-1.0, texture(uH, uvB).r, inB);
    fb = (h > -0.99 ? exp(${FIELD_K.toFixed(1)} * h) : 0.0);
  }
  float solid = fa + fb;
  float field = solid + drops.x;
  float phi = field - 1.0;

  // Sombra difusa, en el suelo, de lo que tiene encima.
  float under = texture(uField, screen + vec2(-5.0, 9.0) / uView).x;
  float shadowN = 0.0;
  if (uA.w > 0.0) shadowN = max(shadowN, smoothstep(-0.27, 0.06, heightAt(p - vec2(0.05, 0.1) * uA.z, uA, uAtlasA) - uLift));
  if (uB.w > 0.0) shadowN = max(shadowN, smoothstep(-0.27, 0.06, heightAt(p - vec2(0.05, 0.1) * uB.z, uB, uAtlasB)));
  float shadow = uShadowK * max(smoothstep(0.08, 1.0, under) * 0.85, shadowN * (1.0 - uFlat));

  float aa = max(fwidth(phi), 1e-4);
  float a = smoothstep(-aa * 0.75, aa * 0.75, phi);
  if (a <= 0.0) {
    gl_FragColor = vec4(uTint * shadow, shadow) + dither() / 255.0 * shadow;
    return;
  }

  // Normal: la de la N donde manda la N; la de las pendientes de las gotas donde mandan ellas. El
  // borde es lo que más se curva: una gota es casi plana arriba y cae de golpe al llegar al canto.
  float depth = max(phi, 0.0);
  float rim = exp(-depth * 3.0);
  vec2 slope = drops.yz * uStream * (0.5 + 2.4 * rim);
  vec3 nDrop = normalize(vec3(-slope, 1.0));
  vec3 nSolid = vec3(0.0, 0.0, 1.0);
  vec3 logo = vec3(0.5);
  float shade = 1.0;
  float pickB = step(fa, fb);
  if (solid > 0.0) {
    vec2 uv = pickB > 0.5 ? uvB : uvA;
    vec3 s = texture(uS, uv).xyz;
    nSolid = normalize(vec3(s.xy, sqrt(max(1.0 - dot(s.xy, s.xy), 0.02))));
    shade = s.z;
    logo = texture(uC, uv).rgb;
  }
  float w = solid / max(field, 1e-3);
  vec3 n = normalize(mix(nDrop, nSolid, w * w));

  vec3 v = vec3(0.0, 0.0, 1.0);
  float t = 1.0 - exp(-depth * 1.15);
  float liquid = uLiquidK * (1.0 - uFlat);
  vec3 wet = mix(uLight, uDeep, smoothstep(0.05, 0.95, t));
  vec3 base = mix(toLinear(logo) * mix(1.0, 0.72, 1.0 - shade), wet, liquid);
  vec3 col = clayLight(base, n, v, mix(0.8, 1.7, liquid));
  vec3 r = reflect(-v, n);
  // El brillo del líquido: la ventana del estudio, con borde; lo fino deja pasar luz de dentro.
  col += vec3(1.0) * softbox(r, uKey, 0.008, 0.06) * (0.06 + 0.5 * liquid);
  col += vec3(1.0) * softbox(r, normalize(vec3(0.55, -0.32, 0.77)), 0.004, 0.03) * 0.16 * liquid;
  col += uMint * rim * 0.24 * liquid;
  vec3 srgb = toSrgb(col);
  // Al final, la N se aplana hasta ser el logo.
  srgb = mix(srgb, logo, uFlat);
  // Vidrio: lo delgado deja ver lo de atrás.
  float skin = mix(1.0, mix(0.66, 0.97, t), liquid);
  float cover = a * skin;
  float rest = shadow * (1.0 - cover);
  vec3 outRgb = srgb * cover + uTint * rest;
  gl_FragColor = vec4(outRgb + dither() / 255.0 * cover, cover + rest);
}`;

// Las hojas: geometría de verdad, con su perspectiva. Vuelan atraídas por la N y al llegar se recortan
// exactas contra su contorno.
const LEAF_VERT = /* glsl */ `${HEAD}
in vec3 position; in vec3 normal; in vec3 aPivot; in vec3 aAxis; in float aLag; in vec3 aFly;
uniform float uAssemble;
uniform float uTime;
uniform vec2 uCenter;
uniform vec2 uUnit;
out vec3 vN;
out vec3 vV;
out float vLanded;
out float vFar;

vec3 turn(vec3 v, vec3 axis, float a) {
  float c = cos(a);
  float s = sin(a);
  return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
}

void main() {
  vec3 pos = vec3(position.x, -position.z, position.y);
  vec3 nor = vec3(normal.x, -normal.z, normal.y);
  vec3 pivot = aPivot * 4.0;
  vec3 axis = aAxis;
  vec3 fly = vec3(aFly.x, -aFly.z, aFly.y);
  float span = 0.46;
  float tl = clamp((uAssemble - aLag * (1.0 - span)) / span, 0.0, 1.0);
  // Atracción: flotan sin prisa y, cerca, se precipitan. Un pelín de más al llegar.
  float e = tl * tl * tl * (tl * (6.0 * tl - 15.0) + 10.0);
  e = pow(e, 1.5);
  float settle = sin(clamp((tl - 0.86) / 0.14, 0.0, 1.0) * 3.14159) * 0.028;
  float rest = 1.0 - e;
  float spin = rest * 1.15;
  vec3 away = fly * rest;
  float cs = cos(spin);
  float sn = sin(spin);
  away.xy = vec2(cs * away.x - sn * away.y, sn * away.x + cs * away.y);
  float seed = dot(aPivot, vec3(91.3, 47.7, 13.1));
  away += vec3(sin(uTime * 0.9 + seed), cos(uTime * 0.7 + seed * 1.7), sin(uTime * 0.6 + seed * 0.6) * 1.4) * 0.05 * rest;
  float amount = length(axis);
  vec3 dir = axis / max(amount, 1e-3);
  float a = rest * amount * 6.2832 + rest * sin(uTime * 0.8 + seed) * 0.4;
  vec3 local = (pos - pivot) * (1.0 + rest * 0.25 + settle * 2.0);
  vec3 wp = pivot + turn(local, dir, a) + away;
  wp.z += settle * 0.2;
  vN = turn(nor, dir, a);
  vLanded = smoothstep(0.82, 1.0, tl);
  vFar = clamp(-wp.z * 0.5, 0.0, 1.0);
  vV = normalize(vec3(0.0, 0.0, ${CAMERA.toFixed(1)}) - wp);
  float w = (${CAMERA.toFixed(1)} - wp.z) / ${CAMERA.toFixed(1)};
  gl_Position = vec4(uCenter * w + wp.xy * uUnit, -wp.z * 0.1 * w, w);
}`;

const LEAF_FRAG = /* glsl */ `${FRAG_HEAD}
in vec3 vN;
in vec3 vV;
in float vLanded;
in float vFar;
uniform vec3 uKey;
uniform vec3 uLeaf;
uniform vec3 uDeep;
uniform float uFade;
uniform sampler2D uH;
uniform vec4 uA;
uniform vec4 uAtlasA;
uniform vec2 uView;
uniform float uDpr;
out vec4 color;
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(vV);
  float ndv = abs(dot(n, v));
  float wrap = clamp((dot(n, uKey) + 0.5) / 1.5, 0.0, 1.0);
  vec3 col = mix(uLeaf, uDeep, 0.15 + 0.5 * (1.0 - wrap)) * (0.82 + 0.3 * wrap);
  // Translúcida: de canto se ve más y de frente deja pasar el fondo.
  float alpha = mix(0.86, 0.5, ndv) * mix(1.0, 0.62, vFar);
  vec3 r = reflect(-v, n);
  col += vec3(1.0) * smoothstep(0.16, 0.02, 1.0 - dot(r, uKey)) * 0.34;
  // Ya en su sitio, se recorta contra el contorno exacto de la N.
  vec2 p = vec2(gl_FragCoord.x, uView.y * uDpr - gl_FragCoord.y) / uDpr;
  vec2 q = (p - uA.xy) / uA.z;
  q.y = -q.y;
  vec2 a = q / ${EXTENT.toFixed(2)};
  float inside = step(max(abs(a.x), abs(a.y)), 0.995);
  float h = mix(-1.0, texture(uH, uAtlasA.xy + (a * 0.5 + 0.5) * uAtlasA.zw).r, inside);
  float clip = smoothstep(-0.012, 0.012, h);
  alpha *= mix(1.0, clip, vLanded) * uFade;
  vec3 srgb = toSrgb(col);
  color = vec4(srgb * alpha, alpha);
}`;

type Canvas = HTMLCanvasElement | OffscreenCanvas;

interface Target2D {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
}

/** Une las tres primitivas de la N en el orden del logo (c, a, b): una sola llamada de dibujo las pinta así. */
function joinN(prims: GlbPrimitive[]) {
  const order = ['c', 'a', 'b'].map((p) => prims.find((x) => x.material.endsWith(`_${p}`))!);
  const pick = (get: (x: GlbPrimitive) => Float32Array) => {
    const parts = order.map(get);
    const out = new Float32Array(parts.reduce((n, a) => n + a.length, 0));
    let at = 0;
    for (const a of parts) {
      out.set(a, at);
      at += a.length;
    }
    return out;
  };
  const counts = order.map((x) => x.attributes.POSITION.array.length / 3);
  const part = new Float32Array(counts.reduce((a, b) => a + b, 0));
  const index = new Uint32Array(order.reduce((n, x) => n + x.index.length, 0));
  let vertex = 0;
  let at = 0;
  order.forEach((x, k) => {
    part.fill(k, vertex, vertex + counts[k]);
    for (let i = 0; i < x.index.length; i++) index[at + i] = x.index[i] + vertex;
    at += x.index.length;
    vertex += counts[k];
  });
  return { pick, part, index };
}

export function startHero(canvas: Canvas, init: HeroInit, post: (e: HeroEvent) => void) {
  // Sin GPU de verdad (WebGL por software) no hay 3D: se queda la N de CSS.
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'low-power', failIfMajorPerformanceCaveat: true }) as WebGL2RenderingContext | null;
  // El campo necesita texturas de punto flotante en las que se pueda dibujar.
  if (!gl || !(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'))) {
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
  let time = 0;

  // Tiempo de cada fase. `birth` empieza con el primer fotograma.
  let birthT = 0;
  let breathT = 0;
  let leaveT = -1;
  let target: HeroTarget | null = null;
  let pending: HeroTarget | null = null;
  let hold = 0;

  let birth: GlbClip;
  let breath: GlbClip;
  let outro: GlbClip;
  let names: string[] = [];
  const clip: number[] = [];
  let nIndex = 0;
  let leafIndex = 0;
  let dropCount = 0;

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
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getAttachedShaders(p)?.map((s) => gl.getShaderInfoLog(s)).join('') || gl.getProgramInfoLog(p) || 'hero: shader');
    const cache = new Map<string, WebGLUniformLocation | null>();
    const at = (name: string) => {
      if (!cache.has(name)) cache.set(name, gl.getUniformLocation(p, name));
      return cache.get(name)!;
    };
    return { p, at };
  };

  const nProg = link(N_VERT, N_FRAG);
  const dropProg = link(DROP_VERT, DROP_FRAG);
  const sceneProg = link(FULL_VERT, SCENE_FRAG);
  const leafProg = link(LEAF_VERT, LEAF_FRAG);
  const nVao = gl.createVertexArray();
  const dropVao = gl.createVertexArray();
  const leafVao = gl.createVertexArray();
  const emptyVao = gl.createVertexArray();

  const texture = (w: number, h: number, format: number) => {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, format, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  };
  const target2D = (tex: WebGLTexture): Target2D => {
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { fbo, tex };
  };

  // Texturas: la N (dos zonas: la grande y la del logo) y las gotas. Se rehacen si cambia la medida.
  let atlas = { w: 1, h: 1, a: 1, b: 1 };
  let hTarget: Target2D | null = null;
  let sFbo: WebGLFramebuffer | null = null;
  let sTex: WebGLTexture | null = null;
  let cTex: WebGLTexture | null = null;
  let field: Target2D | null = null;
  let fieldW = 1;
  let fieldH = 1;

  const destroy = () => {
    if (hTarget) {
      gl.deleteTexture(hTarget.tex);
      gl.deleteFramebuffer(hTarget.fbo);
    }
    if (sTex) gl.deleteTexture(sTex);
    if (cTex) gl.deleteTexture(cTex);
    if (sFbo) gl.deleteFramebuffer(sFbo);
    if (field) {
      gl.deleteTexture(field.tex);
      gl.deleteFramebuffer(field.fbo);
    }
  };

  const unitOf = (l: HeroLayout) => l.size / 2;

  const allocate = () => {
    destroy();
    const a = Math.min(1024, Math.ceil(2 * EXTENT * unitOf(layout) * layout.dpr));
    const b = 192;
    atlas = { w: a + b, h: Math.max(a, b), a, b };
    hTarget = target2D(texture(atlas.w, atlas.h, gl.RGBA16F));
    sTex = texture(atlas.w, atlas.h, gl.RGBA16F);
    cTex = texture(atlas.w, atlas.h, gl.RGBA8);
    sFbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, sFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sTex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, cTex, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    fieldW = Math.max(16, Math.ceil(layout.width * FIELD_SCALE));
    fieldH = Math.max(16, Math.ceil(layout.height * FIELD_SCALE));
    field = target2D(texture(fieldW, fieldH, gl.RGBA16F));
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  const applyLayout = (next: HeroLayout) => {
    const resized = !hTarget || next.width !== layout.width || next.height !== layout.height || next.size !== layout.size;
    layout = next;
    canvas.width = Math.round(next.width * next.dpr);
    canvas.height = Math.round(next.height * next.dpr);
    if (resized) allocate();
  };

  const pick = (name: string, source: readonly number[]) => source[names.indexOf(name)] ?? 0;

  /** Los pesos del fotograma, de los clips de Blender. */
  const timeline = () => {
    const w = { assemble: 1, solid: 1, puff: 0, drop: 0, liquid: 0, pool: 1, flow: 0, reform: 0, flat: 0 };
    if (leaveT >= 0) {
      sampleClip(outro, Math.min(leaveT, clipLength(outro)), clip);
      w.puff = pick('puff', clip);
      w.drop = pick('drop', clip);
      w.liquid = pick('liquid', clip);
      w.pool = pick('pool', clip);
      w.flow = pick('flow', clip);
      w.reform = pick('reform', clip);
      w.flat = pick('flat', clip);
    } else if (birthT < clipLength(birth)) {
      sampleClip(birth, birthT, clip);
      w.assemble = pick('assemble', clip);
      w.solid = pick('solid', clip);
      w.puff = pick('puff', clip);
    } else {
      sampleClip(breath, breathT % clipLength(breath), clip);
      w.puff = pick('puff', clip);
    }
    return w;
  };

  /** Lado de la zona de la N pequeña: un 50 % más que lo que mide en pantalla. */
  let zoneB = 96;

  /** Dibuja la N en una zona de su textura: la altura con MAX y encima la superficie, en orden. */
  const drawN = (zone: 'a' | 'b', puff: number, drop: number) => {
    const size = zone === 'a' ? atlas.a : zoneB;
    const ox = zone === 'a' ? 0 : atlas.a;
    const sx = (size / atlas.w) / EXTENT;
    const sy = (size / atlas.h) / EXTENT;
    const cx = ((ox + size / 2) / atlas.w) * 2 - 1;
    const cy = (size / 2 / atlas.h) * 2 - 1;
    gl.useProgram(nProg.p);
    gl.bindVertexArray(nVao);
    gl.uniform1f(nProg.at('uPuff'), puff);
    gl.uniform1f(nProg.at('uDrop'), drop);
    gl.uniform4f(nProg.at('uRegion'), cx, cy, sx, sy);
    gl.uniform3fv(nProg.at('uStops[0]'), tones.logo.flat(2) as number[]);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(ox, 0, size, size);
    gl.viewport(0, 0, atlas.w, atlas.h);

    gl.bindFramebuffer(gl.FRAMEBUFFER, hTarget!.fbo);
    gl.clearColor(-1, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.MAX);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.uniform1f(nProg.at('uPass'), 0);
    gl.drawElements(gl.TRIANGLES, nIndex, gl.UNSIGNED_INT, 0);
    gl.blendEquation(gl.FUNC_ADD);
    gl.disable(gl.BLEND);

    gl.bindFramebuffer(gl.FRAMEBUFFER, sFbo);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(nProg.at('uPass'), 1);
    gl.drawElements(gl.TRIANGLES, nIndex, gl.UNSIGNED_INT, 0);
    gl.uniform1f(nProg.at('uPass'), 2);
    gl.drawElements(gl.TRIANGLES, nIndex, gl.UNSIGNED_INT, 0);
    gl.disable(gl.SCISSOR_TEST);
    gl.bindVertexArray(null);
  };

  /** Última pose dibujada de cada zona: solo se redibuja si cambia. */
  const drawn = { a: '', b: '' };

  const draw = () => {
    const w = timeline();
    const unit = unitOf(layout);
    const hasMark = target?.kind === 'mark';
    const toX = target && hasMark ? target.x : layout.x;
    const toY = target && hasMark ? target.y : layout.y;
    const toUnit = target && hasMark ? target.h / 2 : unit * 0.2;
    // Grosor de la corriente, en px: sigue al tamaño de la N.
    const stream = Math.max(4.5, unit * 0.06);
    const fade = target && !hasMark ? clamp(1 - (w.flow - 0.2) / 0.5) : 1;

    // La N grande: se ve hasta que la gota se vacía. La pequeña aparece al final.
    const showA = w.pool > 0.002 && w.solid > 0;
    const showB = hasMark && w.reform > 0;
    const keyA = `${w.puff.toFixed(3)}/${w.drop.toFixed(3)}/${layout.size}/${atlas.a}`;
    if (showA && drawn.a !== keyA) {
      drawN('a', w.puff, w.drop);
      drawn.a = keyA;
    }
    // En el logo, primero crece la gota con lo que va llegando; luego se abre en la N, otra vez por tandas.
    const grown = clamp(w.reform / 0.35);
    const open = clamp((w.reform - 0.35) / 0.65);
    if (showB) {
      zoneB = Math.min(atlas.b, Math.ceil(2 * EXTENT * toUnit * layout.dpr * 1.5));
      const keyB = `${open.toFixed(3)}/${zoneB}`;
      if (drawn.b !== keyB) {
        drawN('b', 0, 1 - open);
        drawn.b = keyB;
      }
    }

    // Las gotas.
    const fieldOn = w.liquid > 0 || w.flow > 0;
    const path = streamPath({ x: layout.x, y: layout.y }, { x: toX, y: toY }, layout);
    const poolAt = pathPoint(path, 0.16 * clamp(w.flow / 0.8));
    gl.bindFramebuffer(gl.FRAMEBUFFER, field!.fbo);
    gl.viewport(0, 0, fieldW, fieldH);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (fieldOn) {
      gl.useProgram(dropProg.p);
      gl.bindVertexArray(dropVao);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.uniform2f(dropProg.at('uView'), layout.width, layout.height);
      gl.uniform4f(dropProg.at('uFrom'), layout.x, layout.y, unit, Math.max(w.pool, 0.04));
      gl.uniform4f(dropProg.at('uTo'), toX, toY, toUnit, hasMark ? 1 : 0);
      gl.uniform2f(dropProg.at('uP1'), path[1].x, path[1].y);
      gl.uniform2f(dropProg.at('uP2'), path[2].x, path[2].y);
      gl.uniform2f(dropProg.at('uPool'), poolAt.x, poolAt.y);
      gl.uniform1f(dropProg.at('uDropW'), w.drop);
      gl.uniform1f(dropProg.at('uLiquid'), Math.max(w.liquid, w.flow > 0 && w.flow < 1 ? 1 : 0) * fade);
      gl.uniform1f(dropProg.at('uFlow'), w.flow);
      gl.uniform1f(dropProg.at('uReform'), w.reform);
      gl.uniform1f(dropProg.at('uTime'), time);
      gl.uniform1f(dropProg.at('uStream'), stream);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, dropCount);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
    }

    // El paso final.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(sceneProg.p);
    gl.bindVertexArray(emptyVao);
    const bind = (slot: number, name: string, tex: WebGLTexture | null, prog = sceneProg) => {
      gl.activeTexture(gl.TEXTURE0 + slot);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(prog.at(name), slot);
    };
    bind(0, 'uH', hTarget!.tex);
    bind(1, 'uS', sTex);
    bind(2, 'uC', cTex);
    bind(3, 'uField', field!.tex);
    const atlasA = [0, 0, atlas.a / atlas.w, atlas.a / atlas.h] as const;
    const atlasB = [atlas.a / atlas.w, 0, zoneB / atlas.w, zoneB / atlas.h] as const;
    gl.uniform2f(sceneProg.at('uView'), layout.width, layout.height);
    gl.uniform1f(sceneProg.at('uDpr'), layout.dpr);
    gl.uniform4f(sceneProg.at('uA'), poolAt.x, poolAt.y, unit * Math.max(w.pool, 0.001), showA ? 1 : 0);
    gl.uniform4f(sceneProg.at('uB'), toX, toY, toUnit * Math.max(grown, 0.001), showB ? 1 : 0);
    gl.uniform4fv(sceneProg.at('uAtlasA'), atlasA);
    gl.uniform4fv(sceneProg.at('uAtlasB'), atlasB);
    gl.uniform1f(sceneProg.at('uLift'), (1 - w.solid) * TOP_H * 0.5);
    gl.uniform1f(sceneProg.at('uLiquidK'), w.liquid);
    gl.uniform1f(sceneProg.at('uFlat'), w.flat);
    gl.uniform1f(sceneProg.at('uStream'), stream);
    gl.uniform1f(sceneProg.at('uDark'), tones.dark ? 1 : 0);
    gl.uniform3fv(sceneProg.at('uMint'), tones.mint);
    gl.uniform3fv(sceneProg.at('uDeep'), tones.deep);
    gl.uniform3fv(sceneProg.at('uLight'), tones.light);
    gl.uniform3fv(sceneProg.at('uTint'), srgb(tones.shadow));
    gl.uniform1f(sceneProg.at('uShadowK'), (tones.dark ? 0.42 : 0.1) * fade * clamp(w.solid * 1.4 + w.liquid));
    const key = Math.hypot(...KEY_DIR);
    gl.uniform3f(sceneProg.at('uKey'), KEY_DIR[0] / key, KEY_DIR[1] / key, KEY_DIR[2] / key);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Las hojas, encima, hasta fundirse en la N.
    const leafFade = 1 - clamp((w.solid - 0.55) / 0.42);
    if (leafFade > 0 && leaveT < 0) {
      gl.useProgram(leafProg.p);
      gl.bindVertexArray(leafVao);
      bind(0, 'uH', hTarget!.tex, leafProg);
      gl.uniform1f(leafProg.at('uAssemble'), w.assemble);
      gl.uniform1f(leafProg.at('uTime'), time);
      gl.uniform2f(leafProg.at('uCenter'), (layout.x / layout.width) * 2 - 1, 1 - (layout.y / layout.height) * 2);
      gl.uniform2f(leafProg.at('uUnit'), (unit * 2) / layout.width, (unit * 2) / layout.height);
      gl.uniform3f(leafProg.at('uKey'), KEY_DIR[0] / key, KEY_DIR[1] / key, KEY_DIR[2] / key);
      gl.uniform3fv(leafProg.at('uLeaf'), tones.leaf);
      gl.uniform3fv(leafProg.at('uDeep'), tones.deep);
      // Entran con un fundido corto; al fundirse en la N, se apagan.
      gl.uniform1f(leafProg.at('uFade'), leafFade * clamp(birthT / 0.28));
      gl.uniform4f(leafProg.at('uA'), layout.x, layout.y, unit, 1);
      gl.uniform4fv(leafProg.at('uAtlasA'), atlasA);
      gl.uniform2f(leafProg.at('uView'), layout.width, layout.height);
      gl.uniform1f(leafProg.at('uDpr'), layout.dpr);
      gl.drawElements(gl.TRIANGLES, leafIndex, gl.UNSIGNED_INT, 0);
    }
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

  const tick = (now: number) => {
    if (stopped) return;
    frame = requestAnimationFrame(tick);
    if (last) adapt(now - last);
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
    last = now;
    time += dt;
    if (leaveT >= 0) {
      leaveT += dt;
      if (leaveT >= clipLength(outro) + 0.04) { draw(); finish(); return; }
    } else if (birthT < clipLength(birth)) {
      // Si la app ya espera (el modelo llegó tarde), arma más deprisa.
      birthT += pending ? dt * BIRTH_RUSH : dt;
    } else if (pending && hold <= 0 && breathT >= N_HOLD_MS / 1000) {
      target = pending;
      pending = null;
      leaveT = 0;
    } else {
      breathT += dt;
    }
    hold -= dt;
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
    const nodeOf = (name: string) => {
      const node = scene.nodes.find((n) => n.name === name);
      if (!node) throw new Error(`hero: sin ${name}`);
      return node;
    };
    const clipOf = (name: string) => {
      const c = scene.clips.find((x) => x.name === name);
      if (!c) throw new Error(`hero: sin ${name}`);
      return c;
    };
    birth = clipOf('hero_birth');
    breath = clipOf('hero_breath');
    outro = clipOf('hero_outro');
    names = nodeOf('hero_tiempo').targetNames;

    const attr = (prog: { p: WebGLProgram }, name: string, data: Float32Array, size: number, divisor = 0) => {
      const at = gl.getAttribLocation(prog.p, name);
      if (at < 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(at);
      gl.vertexAttribPointer(at, size, gl.FLOAT, false, 0, 0);
      if (divisor) gl.vertexAttribDivisor(at, divisor);
    };

    // La N.
    const n = nodeOf('hero_n');
    const puffAt = n.targetNames.indexOf('puff');
    const dropAt = n.targetNames.indexOf('drop');
    const joined = joinN(n.primitives);
    gl.bindVertexArray(nVao);
    attr(nProg, 'position', joined.pick((x) => x.attributes.POSITION.array), 3);
    attr(nProg, 'normal', joined.pick((x) => x.attributes.NORMAL.array), 3);
    attr(nProg, 'aOut', joined.pick((x) => x.attributes._OUT.array), 3);
    attr(nProg, 'aLag', joined.pick((x) => x.attributes._LAG.array), 1);
    attr(nProg, 'aShade', joined.pick((x) => x.attributes._SHADE.array), 1);
    attr(nProg, 'aPart', joined.part, 1);
    attr(nProg, 'aPuffP', joined.pick((x) => x.targets[puffAt].POSITION.array), 3);
    attr(nProg, 'aPuffN', joined.pick((x) => x.targets[puffAt].NORMAL.array), 3);
    attr(nProg, 'aDropP', joined.pick((x) => x.targets[dropAt].POSITION.array), 3);
    attr(nProg, 'aDropN', joined.pick((x) => x.targets[dropAt].NORMAL.array), 3);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, joined.index, gl.STATIC_DRAW);
    nIndex = joined.index.length;

    // Las hojas.
    const leaves = nodeOf('hero_hojas').primitives[0];
    const flyAt = nodeOf('hero_hojas').targetNames.indexOf('scatter');
    gl.bindVertexArray(leafVao);
    attr(leafProg, 'position', leaves.attributes.POSITION.array, 3);
    attr(leafProg, 'normal', leaves.attributes.NORMAL.array, 3);
    attr(leafProg, 'aPivot', leaves.attributes._PIVOT.array, 3);
    attr(leafProg, 'aAxis', leaves.attributes._AXIS.array, 3);
    attr(leafProg, 'aLag', leaves.attributes._LAG.array, 1);
    attr(leafProg, 'aFly', leaves.targets[flyAt].POSITION.array, 3);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, leaves.index, gl.STATIC_DRAW);
    leafIndex = leaves.index.length;

    // Las gotas salen de las mismas hojas: una por cada hoja del mosaico, con su sitio y su tamaño.
    const pivots = leaves.attributes._PIVOT.array;
    const seen = new Map<string, number>();
    const pts: number[] = [];
    for (let i = 0; i < pivots.length; i += 3) {
      const key = `${pivots[i].toFixed(4)},${pivots[i + 1].toFixed(4)},${pivots[i + 2].toFixed(4)}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
      if (seen.get(key) === 1) pts.push(pivots[i] * 4, pivots[i + 1] * 4);
    }
    dropCount = (pts.length / 2) * DROPS_PER_LEAF;
    const instance = new Float32Array(dropCount * 4);
    const rand = new Float32Array(dropCount * 2);
    const hash = (x: number) => { const s = Math.sin(x) * 43758.5453; return s - Math.floor(s); };
    for (let i = 0; i < dropCount; i++) {
      const home = i % (pts.length / 2);
      // Las tandas repartidas por igual, pero sin orden: de cualquier parte de la N salen en cualquier momento.
      instance.set([pts[home * 2], pts[home * 2 + 1], 0.1 + hash(i * 3.17) * 0.13, ((i * 0.618034) % 1)], i * 4);
      rand.set([hash(i * 12.9898), hash(i * 78.233)], i * 2);
    }
    gl.bindVertexArray(dropVao);
    attr(dropProg, 'aDrop', instance, 4, 1);
    attr(dropProg, 'aRand', rand, 2, 1);
    gl.bindVertexArray(null);

    if (stopped) return;
    // Si la N de CSS ya se ve, el 3D la releva sin repetir las hojas.
    if (init.seen || Date.now() - init.openedAt > SKIP_LEAVES_AFTER_MS) birthT = clipLength(birth) - 0.01;
    applyLayout(layout);
    frame = requestAnimationFrame(tick);
  };

  load().catch((err) => {
    console.error(err);
    post({ type: 'fail' });
  });

  return {
    handle(cmd: HeroCommand) {
      if (cmd.type === 'layout') {
        applyLayout(cmd.layout);
        drawn.a = '';
      } else if (cmd.type === 'tones') {
        tones = cmd.tones;
        drawn.a = '';
        drawn.b = '';
      } else if (cmd.type === 'leave') {
        // No se corta el armado: sale al terminarlo. Mientras, la app se pinta debajo.
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

/** El color de la sombra va directo al lienzo: en sRGB. */
const srgb = (c: Rgb) => c.map((v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));
