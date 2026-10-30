// Material de los objetos modelados en Blender (scripts/blender/props.py): cada vértice trae su
// parte (atributo `part`) y el sombreador la pinta con el color del tema. Sin luces de three:
// luz principal con envoltura, cielo/suelo, brillo especular y borde fresnel del acento; el
// metal refleja un estudio falso (cielo, suelo y dos franjas de luz), así brilla sin mapas de
// entorno ni texturas. Funciona igual en mallas sueltas y en InstancedMesh (con `lit`, cada
// instancia enciende su luz con el atributo `aLit`).
import { Color, DoubleSide, ShaderMaterial, Vector3 } from 'three';
import type { PropPalette } from './palette';

export const PARTS = ['body', 'glow', 'metal', 'dark', 'accent', 'paint0', 'paint1', 'paint2', 'paint3', 'paint4'] as const;
export type Part = (typeof PARTS)[number];

export interface PropMaterialOptions {
  /** Color del metal: oro del tema (recompensas) o acero (pesas). */
  metal?: 'gold' | 'steel';
  /** InstancedMesh con atributo por instancia `aLit` (0–1) que enciende la parte `glow`. */
  lit?: boolean;
  /** Se ve por los dos lados (banderines). */
  doubleSide?: boolean;
  /** Admite opacidad (uOpacity), para piezas que se desvanecen. */
  transparent?: boolean;
  /** Banderín que ondea desde el mástil (x > 0), con uTime; cada instancia en su fase. */
  wave?: boolean;
}

const vert = /* glsl */ `
  attribute float part;
  #ifdef USE_WAVE
  uniform float uTime;
  #endif
  #ifdef USE_LIT
  attribute float aLit;
  #endif
  varying vec3 vN;
  varying vec3 vV;
  varying float vPart;
  varying float vLit;
  void main() {
    vPart = part;
    #ifdef USE_LIT
    vLit = aLit;
    #else
    vLit = 1.0;
    #endif
    vec3 pos = position;
    #ifdef USE_WAVE
    float amp = max(0.0, pos.x - 0.012) / 0.28;
    float ph = uTime * 4.2 - pos.x * 15.0;
    #ifdef USE_INSTANCING
    ph += float(gl_InstanceID) * 1.7;
    #endif
    pos.z += sin(ph) * 0.03 * amp;
    pos.y += cos(ph * 0.7) * 0.007 * amp;
    #endif
    vec4 lp = vec4(pos, 1.0);
    mat3 nm = mat3(modelMatrix);
    #ifdef USE_INSTANCING
    lp = instanceMatrix * lp;
    nm = nm * mat3(instanceMatrix);
    #endif
    vec4 wp = modelMatrix * lp;
    vN = normalize(nm * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const frag = /* glsl */ `
  uniform vec3 uCol[10];
  uniform vec3 uRim;
  uniform vec3 uKey;
  uniform float uDark;
  uniform float uGlow;
  uniform float uHover;
  uniform float uFlash;
  uniform float uOpacity;
  varying vec3 vN;
  varying vec3 vV;
  varying float vPart;
  varying float vLit;
  void main() {
    int p = int(vPart + 0.5);
    vec3 n = normalize(vN);
    if (!gl_FrontFacing) n = -n;
    vec3 v = normalize(vV);
    vec3 base = uCol[p];
    float ndl = dot(n, uKey);
    float wrap = max(0.0, (ndl + 0.4) / 1.4);
    float hemi = 0.5 + 0.5 * n.y;
    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    float spec = pow(max(dot(n, normalize(uKey + v)), 0.0), 56.0);
    vec3 col;
    if (p == 1) {
      // Luz propia: no depende de la iluminación; apagada queda en un cuarto.
      col = base * (0.9 + 0.7 * uGlow) * mix(0.22, 1.0, vLit);
    } else if (p == 2) {
      vec3 r = reflect(-v, n);
      float sky = smoothstep(-0.35, 0.85, r.y);
      float strip = smoothstep(0.09, 0.0, abs(r.y - 0.38)) + 0.45 * smoothstep(0.12, 0.0, abs(r.x + 0.6));
      vec3 env = mix(base * 0.22, base * 1.25, sky) + mix(vec3(1.0), base, 0.35) * strip * 0.6;
      col = env * (0.62 + 0.38 * wrap) + mix(vec3(1.0), base, 0.25) * spec * 1.2;
    } else {
      float shine = p == 3 ? 0.22 : 0.42;
      col = base * (0.4 + 0.52 * wrap) * mix(0.8, 1.06, hemi) + spec * shine * mix(0.5, 1.0, uDark);
    }
    col += uRim * fres * (0.16 + 0.42 * uDark + 0.55 * uHover);
    col += uRim * uFlash * 0.55;
    gl_FragColor = vec4(col, uOpacity);
    #include <colorspace_fragment>
  }`;

/** Colores por parte, en el orden de PARTS. */
function partColors(p: PropPalette, metal: 'gold' | 'steel'): Color[] {
  return [p.body, p.glow, metal === 'gold' ? p.gold : p.steel, p.shade, p.accent, ...p.paints].map((c) => c.clone());
}

export function propMaterial(p: PropPalette, opts: PropMaterialOptions = {}): ShaderMaterial {
  const m = new ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    defines: { ...(opts.lit ? { USE_LIT: '' } : {}), ...(opts.wave ? { USE_WAVE: '' } : {}) },
    transparent: Boolean(opts.transparent),
    side: opts.doubleSide ? DoubleSide : undefined,
    uniforms: {
      uCol: { value: partColors(p, opts.metal ?? 'gold') },
      uRim: { value: p.glow.clone() },
      uKey: { value: new Vector3(-0.45, 0.8, 0.55).normalize() },
      uDark: { value: p.dark ? 1 : 0 },
      uGlow: { value: 0 },
      uHover: { value: 0 },
      uFlash: { value: 0 },
      uOpacity: { value: 1 },
      uTime: { value: 0 },
    },
  });
  m.userData.metal = opts.metal ?? 'gold';
  return m;
}

/** Relee los colores del tema sin recompilar. */
export function setPropPalette(m: ShaderMaterial, p: PropPalette) {
  const cols = m.uniforms.uCol.value as Color[];
  partColors(p, m.userData.metal).forEach((c, i) => cols[i].copy(c));
  (m.uniforms.uRim.value as Color).copy(p.glow);
  m.uniforms.uDark.value = p.dark ? 1 : 0;
}

/** Cambia el color de una parte (p. ej. el metal de un trofeo según su rareza). */
export function setPartColor(m: ShaderMaterial, part: Part, color: Color) {
  (m.uniforms.uCol.value as Color[])[PARTS.indexOf(part)].copy(color);
}
