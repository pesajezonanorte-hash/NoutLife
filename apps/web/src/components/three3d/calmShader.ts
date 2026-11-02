// Estudio de luz de «Materia calma» en GLSL, sin three.js: lo comparten las escenas de three3d y el
// splash (splash/hero.ts), que corre en un Worker y no descarga el motor.

/** Dirección de reposo de la luz principal, sin normalizar: arriba a la izquierda, hacia quien mira. */
export const KEY_DIR = [-0.42, 0.74, 0.52] as const;

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
