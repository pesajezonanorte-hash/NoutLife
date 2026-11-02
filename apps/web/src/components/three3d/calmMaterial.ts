// Luz y materiales de «Materia calma». El mismo estudio suave del mundo de scripts/blender/calm.py,
// sin mapas de entorno: cielo claro, suelo cálido y dos softboxes en el reflejo. Sin luces duras
// ni sombras proyectadas. `uKey` se mueve un poco con el objeto: la luz reacciona al movimiento.
import { Color, type ShaderMaterial, Vector3 } from 'three';
import { tokenColor, type PropPalette } from './palette';

/** Dirección de reposo de la luz principal: arriba a la izquierda, hacia quien mira. */
export const KEY_LIGHT = new Vector3(-0.42, 0.74, 0.52).normalize();

/** Vértice común: posición y normal con hasta cuatro shape keys (calmGeometry, uniform uW). */
export function morphVertex(morphs: number, extra = '') {
  const range = Array.from({ length: morphs }, (_, i) => i);
  const comp = 'xyzw';
  return /* glsl */ `
  attribute float part;
  ${range.map((i) => `attribute vec3 aT${i}; attribute vec3 aN${i};`).join('\n  ')}
  uniform vec4 uW;
  varying vec3 vN;
  varying vec3 vW;
  varying vec3 vV;
  varying vec3 vO;
  varying vec3 vRay;
  varying vec2 vUv;
  varying float vPart;
  ${extra}
  void main() {
    vPart = part;
    vUv = uv;
    vec3 pos = position ${range.map((i) => `+ aT${i} * uW.${comp[i]}`).join(' ')};
    vec3 nor = normal ${range.map((i) => `+ aN${i} * uW.${comp[i]}`).join(' ')};
    vO = pos;
    mat3 rot = mat3(modelMatrix);
    vN = normalize(transpose(inverse(rot)) * nor);
    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vW = wp.xyz;
    vV = normalize(cameraPosition - wp.xyz);
    // El rayo de la cámara en coordenadas del objeto (la matriz es solo giro y posición).
    vRay = transpose(rot) * (wp.xyz - cameraPosition);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
}

/** Fragmento común: varyings, mapa de normales por derivadas (vale con la malla deformada) y estudio. */
export const studioChunk = /* glsl */ `
  varying vec3 vN;
  varying vec3 vW;
  varying vec3 vV;
  varying vec3 vO;
  varying vec3 vRay;
  varying vec2 vUv;
  varying float vPart;
  uniform vec3 uKey;
  uniform float uDark;
  uniform float uHasMap;
  uniform float uMapStrength;
  uniform vec2 uMapRepeat;
  uniform sampler2D uMap;

  vec3 surfaceNormal() {
    vec3 n = normalize(vN);
    if (!gl_FrontFacing) n = -n;
    if (uHasMap < 0.5) return n;
    vec2 uv = vUv * uMapRepeat;
    vec3 q0 = dFdx(vW);
    vec3 q1 = dFdy(vW);
    vec2 st0 = dFdx(uv);
    vec2 st1 = dFdy(uv);
    vec3 t = q0 * st1.t - q1 * st0.t;
    vec3 b = q1 * st0.s - q0 * st1.s;
    float len = max(dot(t, t), dot(b, b));
    if (len <= 0.0) return n;
    float k = inversesqrt(len);
    vec3 m = texture2D(uMap, uv).xyz * 2.0 - 1.0;
    // Se apaga en los ángulos rasantes: si no, el grano deja el contorno dentado.
    m.xy *= uMapStrength * smoothstep(0.05, 0.5, abs(dot(n, normalize(vV))));
    vec3 mapped = normalize(mat3(t * k, b * k, n) * m);
    // En triángulos menores que un píxel (el centro de un abanico) las derivadas no sirven.
    return dot(mapped, n) < 0.55 ? n : mapped;
  }

  float softbox(vec3 r, vec3 dir, float inner, float outer) {
    return smoothstep(outer, inner, 1.0 - dot(r, dir));
  }

  // Reflejo del estudio: la luz principal y otra de relleno, grandes y de borde difuso.
  float studioGloss(vec3 r) {
    return softbox(r, uKey, 0.05, 0.42) + 0.32 * softbox(r, normalize(vec3(0.82, 0.3, 0.5)), 0.03, 0.3);
  }

  // Arcilla o silicona mate: luz que envuelve, subsuperficie en el paso a la sombra y brillo abierto.
  vec3 clayLight(vec3 albedo, vec3 n, vec3 v, float gloss) {
    float ndl = dot(n, uKey);
    float wrap = clamp((ndl + 0.62) / 1.62, 0.0, 1.0);
    float hemi = 0.5 + 0.5 * n.y;
    vec3 col = albedo * (mix(0.52, 0.72, hemi) + wrap * wrap * 0.46);
    float scatter = smoothstep(-0.75, -0.1, ndl) * (1.0 - smoothstep(-0.1, 0.5, ndl));
    col += albedo * albedo * scatter * 0.2;
    vec3 r = reflect(-v, n);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
    col += vec3(1.0) * studioGloss(r) * (0.035 + 0.42 * fres) * gloss;
    col += mix(vec3(1.0), albedo, 0.4) * fres * (0.06 + 0.1 * uDark);
    return col;
  }
`;

/** Uniforms que usan morphVertex y studioChunk. */
export function studioUniforms() {
  return {
    uW: { value: [0, 0, 0, 0] as unknown },
    uKey: { value: KEY_LIGHT.clone() },
    uDark: { value: 0 },
    uHasMap: { value: 0 },
    uMapStrength: { value: 1 },
    uMapRepeat: { value: [1, 1] as unknown },
    uMap: { value: null as unknown },
  };
}

/** Pesos a vec4 (three admite un array de cuatro números como vec4). */
export function setWeights(m: ShaderMaterial, a = 0, b = 0, c = 0, d = 0) {
  const w = m.uniforms.uW.value as number[];
  w[0] = a;
  w[1] = b;
  w[2] = c;
  w[3] = d;
}

/** Colores de Materia calma: la paleta de los objetos más la escala del acento del tema. */
export interface CalmTones {
  dark: boolean;
  /** Arcilla en reposo: la superficie con un toque del acento. */
  clay: Color;
  /** Arcilla del acento, para volúmenes con color (almohadilla encendida, canto rodado). */
  clayAccent: Color;
  /** Luz interna en el centro y en el borde. */
  lightCore: Color;
  lightDeep: Color;
  /** Marca sobre la luz (la palomita): siempre con contraste contra lightCore. */
  mark: Color;
  /** Tinta de los íconos con volumen. */
  ink: Color;
}

const luminance = (c: Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

export function readCalmTones(p: PropPalette): CalmTones {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => tokenColor(css.getPropertyValue(`--lq-${name}`), fallback);
  const j100 = v('jade-100', '220 243 225');
  const j200 = v('jade-200', '196 226 202');
  const j300 = v('jade-300', '165 210 181');
  const j400 = v('jade-400', '133 199 161');
  const j500 = v('jade-500', '112 180 141');
  const j600 = v('jade-600', '84 143 111');
  const j800 = v('jade-800', '35 68 51');
  const j900 = v('jade-900', '14 29 22');
  const white = new Color(1, 1, 1);
  const lightCore = p.dark ? j300.clone() : j300.clone().lerp(j200, 0.35);
  // La marca más legible sobre el centro de la luz, oscura o clara según el tema.
  const mark = luminance(lightCore) > 0.3 ? j900.clone() : white.clone();
  return {
    dark: p.dark,
    clay: p.dark ? p.surface.clone().lerp(j400, 0.16) : p.surface.clone().lerp(j100, 0.72),
    clayAccent: p.dark ? j600.clone().lerp(j400, 0.5) : j200.clone().lerp(j300, 0.55),
    lightCore,
    lightDeep: p.dark ? j500.clone() : j400.clone().lerp(j500, 0.5),
    mark,
    ink: luminance(j800) < 0.15 && !p.dark ? j800.clone().lerp(j900, 0.45) : j900.clone(),
  };
}
