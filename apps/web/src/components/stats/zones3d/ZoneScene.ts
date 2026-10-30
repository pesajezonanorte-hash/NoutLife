// Mapa 3D de zonas (three.js, sin React). Geometría generada con los datos: una columna de
// vidrio hexagonal por zona (altura = ritmo; las zonas con registros brillan), en círculo
// sobre un disco con anillos de luz que se expanden, y en el centro un cristal facetado cuyo
// tamaño sigue al Life Score, con un haz de luz y un anillo en órbita. Hilos de luz unen el
// núcleo con cada columna. Todo el color sale del acento del tema (lo lee ZoneMap3D).
// Rendimiento: ~8 draw calls (las columnas son un InstancedMesh), sombreadores sin luces de
// three, sin posproceso; solo dibuja mientras se ve (IntersectionObserver + pestaña visible).
// Se gira arrastrando en horizontal (en vertical la página sigue); tocar una columna la elige.
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CircleGeometry, Color, CylinderGeometry, DoubleSide, Group,
  IcosahedronGeometry, InstancedBufferAttribute, InstancedMesh, LineSegments, MathUtils, Mesh, NormalBlending,
  Object3D, PerspectiveCamera, Points, Raycaster, Scene, ShaderMaterial, SRGBColorSpace, TorusGeometry, Vector2, Vector3,
  WebGLRenderer, type Blending,
} from 'three';
import type { ZoneColumn } from '../statsMath';

export interface ZonePalette {
  /** Acento (luz interior de las columnas, cristal). */
  accent: Color;
  /** Luz (halos, anillos, cantos): el tono claro del acento en oscuro, el profundo en claro. */
  glow: Color;
  /** Cuerpo del vidrio: superficie del tema (oscura en oscuro, casi blanca en claro). */
  body: Color;
  /** Placa del suelo. */
  base: Color;
  dark: boolean;
}

export interface ZoneSceneOptions {
  columns: ZoneColumn[];
  /** Life Score 0–100: tamaño y brillo del cristal central. */
  score: number;
  palette: ZonePalette;
  reduceMotion: boolean;
  /** Etiqueta HTML que sigue a la columna elegida (la escena solo la posiciona). */
  label?: HTMLElement | null;
  onSelect?: (id: string | null) => void;
  onReady?: () => void;
}

const CAP = 16;
const TAP_PX = 8;
const FLOOR_R = 3;
const MOTES = 64;

/** sRGB «R G B» (tokens --lq-*) → Color lineal de three. */
export function tokenColor(triplet: string, fallback = '128 128 128'): Color {
  const [r, g, b] = (triplet.trim() || fallback).split(/[\s,]+/).map(Number);
  return new Color().setRGB((r || 0) / 255, (g || 0) / 255, (b || 0) / 255, SRGBColorSpace);
}

const pillarVert = /* glsl */ `
  attribute float aLevel;
  attribute float aLit;
  attribute float aSel;
  varying vec3 vN;
  varying vec3 vV;
  varying vec2 vUv;
  varying float vH;
  varying float vTop;
  varying float vLevel;
  varying float vLit;
  varying float vSel;
  void main() {
    vH = position.y;
    vUv = uv;
    vTop = step(0.9, normal.y);
    vLevel = aLevel; vLit = aLit; vSel = aSel;
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

// Vidrio facetado: cuerpo del color de la superficie, luz interior del acento que sube con
// el ritmo, cantos verticales y tapa de neón, y borde fresnel.
const pillarFrag = /* glsl */ `
  uniform vec3 uAccent;
  uniform vec3 uGlow;
  uniform vec3 uBody;
  uniform float uDark;
  uniform float uTime;
  uniform float uAnySel;
  varying vec3 vN;
  varying vec3 vV;
  varying vec2 vUv;
  varying float vH;
  varying float vTop;
  varying float vLevel;
  varying float vLit;
  varying float vSel;
  void main() {
    vec3 n = normalize(vN);
    float fres = pow(1.0 - max(dot(n, normalize(vV)), 0.0), 2.2);
    float lit = mix(0.25, 1.0, vLit);
    float side = 0.7 + 0.3 * max(dot(n, normalize(vec3(-0.5, 0.35, 0.8))), 0.0);
    vec3 col = uBody * side * mix(0.75, 1.15, vH);
    col += uAccent * pow(vH, 1.7) * (0.12 + 0.6 * vLevel) * lit * mix(0.35, 0.95, uDark);
    float e = fract(vUv.x * 6.0);
    float edge = smoothstep(0.075, 0.0, min(e, 1.0 - e)) * (1.0 - vTop);
    col += uGlow * edge * (0.18 + 0.62 * vLit) * mix(0.35, 1.0, vH);
    col += uGlow * smoothstep(0.86, 1.0, vH) * (1.0 - vTop) * (0.2 + 0.5 * vLevel) * lit;
    col += uGlow * fres * (0.25 + 0.55 * vLit) * mix(0.6, 1.0, uDark);
    col = mix(col, uGlow * (0.95 + 0.45 * vLevel), vTop * lit);
    col += uGlow * vSel * (0.22 + 0.16 * sin(uTime * 4.0));
    col *= mix(1.0, 0.45, uAnySel * (1.0 - vSel));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

const floorVert = /* glsl */ `
  varying vec2 vP;
  void main() {
    vP = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const floorFrag = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uGlow;
  uniform float uTime;
  uniform float uRadius;
  uniform float uDark;
  uniform vec3 uCols[${CAP}];
  uniform int uCount;
  varying vec2 vP;
  void main() {
    float r = length(vP) / uRadius;
    float fade = smoothstep(1.0, 0.45, r);
    float f = fract(r * 7.0 - uTime * 0.07);
    float ring = smoothstep(0.07, 0.0, min(f, 1.0 - f)) * (1.0 - r);
    float grid = smoothstep(0.012, 0.0, abs(fract(r * 14.0) - 0.5) - 0.48) * 0.25;
    float core = exp(-r * r * 26.0);
    float pool = 0.0;
    for (int i = 0; i < ${CAP}; i++) {
      if (i >= uCount) break;
      vec2 d = vP - uCols[i].xy;
      pool += uCols[i].z * exp(-dot(d, d) * 9.0);
    }
    float glow = clamp((ring * 0.55 + grid + core * 0.7 + pool * 0.55) * fade, 0.0, 1.0);
    vec3 col = mix(uBase, uGlow, glow);
    float a = max(mix(0.5, 0.75, uDark) * fade, glow);
    gl_FragColor = vec4(col, a * fade);
    #include <colorspace_fragment>
  }`;

const glowPointsVert = /* glsl */ `
  attribute float aScale;
  uniform float uSize;
  uniform float uPx;
  uniform float uTime;
  varying float vA;
  void main() {
    vA = 0.75 + 0.25 * sin(uTime * 2.2 + position.x * 3.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * aScale * uPx / max(0.5, -mv.z);
  }`;

const motesVert = /* glsl */ `
  attribute vec3 aSeed;
  uniform float uSize;
  uniform float uPx;
  uniform float uTime;
  varying float vA;
  void main() {
    float y = mod(aSeed.y * 2.4 + uTime * (0.08 + aSeed.z * 0.1), 2.4);
    float ang = aSeed.x * 6.2832 + uTime * 0.05;
    float rad = 0.4 + aSeed.z * 1.9;
    vec3 p = vec3(cos(ang) * rad, y, sin(ang) * rad);
    vA = smoothstep(0.0, 0.4, y) * smoothstep(2.4, 1.6, y) * (0.35 + 0.65 * aSeed.z);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPx / max(0.5, -mv.z);
  }`;

const softPointFrag = /* glsl */ `
  uniform vec3 uGlow;
  uniform float uAlpha;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = pow(max(0.0, 1.0 - d), 2.2) * vA * uAlpha;
    gl_FragColor = vec4(uGlow, a);
    #include <colorspace_fragment>
  }`;

const crystalVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const crystalFrag = /* glsl */ `
  uniform vec3 uAccent;
  uniform vec3 uGlow;
  uniform float uDark;
  uniform float uEnergy;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec3 n = normalize(vN);
    float key = max(dot(n, normalize(vec3(-0.4, 0.8, 0.6))), 0.0);
    float fill = max(dot(n, normalize(vec3(0.7, -0.2, 0.5))), 0.0);
    float fres = pow(1.0 - max(dot(n, normalize(vV)), 0.0), 2.0);
    vec3 col = uAccent * (0.32 + 0.55 * key + 0.2 * fill) * mix(1.0, 0.85, uDark);
    col += uGlow * (fres * 0.9 + pow(key, 12.0) * 0.7) * (0.6 + 0.6 * uEnergy);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

const beamVert = /* glsl */ `
  varying float vH;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vH = position.y;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const beamFrag = /* glsl */ `
  uniform vec3 uGlow;
  uniform float uAlpha;
  varying float vH;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float facing = abs(dot(normalize(vN), normalize(vV)));
    float a = pow(1.0 - vH, 1.6) * pow(facing, 1.5) * uAlpha;
    gl_FragColor = vec4(uGlow, a);
    #include <colorspace_fragment>
  }`;

const lineVert = /* glsl */ `
  attribute float aA;
  varying float vA;
  void main() {
    vA = aA;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const lineFrag = /* glsl */ `
  uniform vec3 uGlow;
  uniform float uAlpha;
  varying float vA;
  void main() {
    gl_FragColor = vec4(uGlow, vA * uAlpha);
    #include <colorspace_fragment>
  }`;

export class ZoneScene {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(34, 1, 0.1, 60);
  private world = new Group();
  private pillars: InstancedMesh<BufferGeometry, ShaderMaterial>;
  private pillarMat: ShaderMaterial;
  private floor: Mesh<CircleGeometry, ShaderMaterial>;
  private halos: Points<BufferGeometry, ShaderMaterial>;
  private motes: Points<BufferGeometry, ShaderMaterial>;
  private links: LineSegments<BufferGeometry, ShaderMaterial>;
  private crystal: Mesh<IcosahedronGeometry, ShaderMaterial>;
  private ring: Mesh<TorusGeometry, ShaderMaterial>;
  private beam: Mesh<CylinderGeometry, ShaderMaterial>;
  private core = new Group();
  private raycaster = new Raycaster();
  private ndc = new Vector2();
  private tmp = new Object3D();
  private v3 = new Vector3();

  private columns: ZoneColumn[] = [];
  private heights = new Float32Array(CAP);
  private targets = new Float32Array(CAP);
  private score: number;
  private energy = 0;
  private selected = -1;
  private yaw = 0.35;
  private yawVel = 0;
  private yawTarget: number | null = null;
  private press: { id: number; x: number; y: number; dragging: boolean; lastX: number } | null = null;
  private reduceMotion: boolean;
  private dark: boolean;
  private radius = 1.6;
  private width = 1;
  private height = 1;
  private frame = 0;
  private last = 0;
  private clock = 0;
  private visible = typeof IntersectionObserver === 'undefined';
  private lost = false;
  private disposed = false;
  private readied = false;
  private labelTransform = '';
  private cleanup: Array<() => void> = [];

  constructor(private host: HTMLElement, private opts: ZoneSceneOptions) {
    this.reduceMotion = opts.reduceMotion;
    this.score = opts.score;
    this.dark = opts.palette.dark;
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    const canvas = this.renderer.domElement;
    canvas.style.cssText = 'display:block;width:100%;height:100%;outline:none;touch-action:pan-y;cursor:grab;-webkit-tap-highlight-color:transparent';
    host.appendChild(canvas);

    const p = opts.palette;
    const colorUniforms = () => ({ uAccent: { value: p.accent.clone() }, uGlow: { value: p.glow.clone() }, uDark: { value: p.dark ? 1 : 0 } });

    // Columnas: prisma hexagonal apenas cónico, facetado (normales planas), con la base en
    // y = 0 (la altura es la escala Y de cada instancia).
    const hex = new CylinderGeometry(0.115, 0.14, 1, 6, 1, false);
    hex.translate(0, 0.5, 0);
    const pillarGeo = hex.toNonIndexed();
    hex.dispose();
    pillarGeo.computeVertexNormals();
    pillarGeo.setAttribute('aLevel', new InstancedBufferAttribute(new Float32Array(CAP), 1));
    pillarGeo.setAttribute('aLit', new InstancedBufferAttribute(new Float32Array(CAP), 1));
    pillarGeo.setAttribute('aSel', new InstancedBufferAttribute(new Float32Array(CAP), 1));
    this.pillarMat = new ShaderMaterial({
      vertexShader: pillarVert,
      fragmentShader: pillarFrag,
      uniforms: { ...colorUniforms(), uBody: { value: p.body.clone() }, uTime: { value: 0 }, uAnySel: { value: 0 } },
    });
    this.pillars = new InstancedMesh(pillarGeo, this.pillarMat, CAP);
    this.pillars.count = 0;
    this.world.add(this.pillars);

    // Suelo: placa de vidrio con anillos que se expanden y charcos de luz bajo cada columna.
    this.floor = new Mesh(new CircleGeometry(FLOOR_R, 96), new ShaderMaterial({
      vertexShader: floorVert,
      fragmentShader: floorFrag,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uBase: { value: p.base.clone() }, uGlow: { value: p.glow.clone() }, uTime: { value: 0 }, uRadius: { value: FLOOR_R },
        uDark: { value: p.dark ? 1 : 0 }, uCols: { value: Array.from({ length: CAP }, () => new Vector3()) }, uCount: { value: 0 },
      },
    }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.renderOrder = -1;
    this.world.add(this.floor);

    // Halos neón sobre cada tapa.
    const haloGeo = new BufferGeometry();
    haloGeo.setAttribute('position', new BufferAttribute(new Float32Array(CAP * 3), 3));
    haloGeo.setAttribute('aScale', new BufferAttribute(new Float32Array(CAP), 1));
    this.halos = new Points(haloGeo, this.glowMaterial(glowPointsVert, 120, p.dark ? 0.9 : 0.5));
    this.halos.frustumCulled = false;
    this.world.add(this.halos);

    // Motas de luz que suben despacio (solo se notan en oscuro).
    const moteGeo = new BufferGeometry();
    const seeds = new Float32Array(MOTES * 3);
    for (let i = 0; i < MOTES; i++) seeds.set([((i * 0.618034) % 1), ((i * 0.381966 + 0.13) % 1), ((i * 0.7548777 + 0.31) % 1)], i * 3);
    moteGeo.setAttribute('position', new BufferAttribute(new Float32Array(MOTES * 3), 3));
    moteGeo.setAttribute('aSeed', new BufferAttribute(seeds, 3));
    this.motes = new Points(moteGeo, this.glowMaterial(motesVert, 10, p.dark ? 0.75 : 0.28));
    this.motes.frustumCulled = false;
    this.world.add(this.motes);

    // Hilos de luz del núcleo a cada columna.
    const linkGeo = new BufferGeometry();
    linkGeo.setAttribute('position', new BufferAttribute(new Float32Array(CAP * 6), 3));
    linkGeo.setAttribute('aA', new BufferAttribute(new Float32Array(CAP * 2), 1));
    this.links = new LineSegments(linkGeo, new ShaderMaterial({
      vertexShader: lineVert, fragmentShader: lineFrag, transparent: true, depthWrite: false,
      blending: p.dark ? AdditiveBlending : NormalBlending,
      uniforms: { uGlow: { value: p.glow.clone() }, uAlpha: { value: p.dark ? 0.55 : 0.4 } },
    }));
    this.links.frustumCulled = false;
    this.world.add(this.links);

    // Núcleo: cristal facetado, anillo en órbita y haz de luz desde el suelo.
    this.crystal = new Mesh(new IcosahedronGeometry(0.3, 0), new ShaderMaterial({
      vertexShader: crystalVert, fragmentShader: crystalFrag, uniforms: { ...colorUniforms(), uEnergy: { value: 0 } },
    }));
    this.ring = new Mesh(new TorusGeometry(0.56, 0.009, 6, 128), new ShaderMaterial({
      vertexShader: crystalVert,
      fragmentShader: /* glsl */ `uniform vec3 uGlow; uniform float uAlpha; void main() { gl_FragColor = vec4(uGlow, uAlpha);
        #include <colorspace_fragment>
      }`,
      transparent: true, depthWrite: false, blending: p.dark ? AdditiveBlending : NormalBlending,
      uniforms: { uGlow: { value: p.glow.clone() }, uAlpha: { value: p.dark ? 0.9 : 0.7 } },
    }));
    this.ring.rotation.x = Math.PI / 2.3;
    const beamGeo = new CylinderGeometry(0.035, 0.26, 1, 32, 1, true);
    beamGeo.translate(0, 0.5, 0);
    this.beam = new Mesh(beamGeo, new ShaderMaterial({
      vertexShader: beamVert, fragmentShader: beamFrag, transparent: true, depthWrite: false, side: DoubleSide,
      blending: p.dark ? AdditiveBlending : NormalBlending,
      uniforms: { uGlow: { value: p.glow.clone() }, uAlpha: { value: p.dark ? 0.42 : 0.22 } },
    }));
    this.core.add(this.crystal, this.ring);
    this.world.add(this.beam, this.core);
    this.scene.add(this.world);

    this.listen(canvas, 'pointerdown', this.onDown);
    this.listen(canvas, 'pointermove', this.onMove);
    this.listen(canvas, 'pointerup', this.onUp);
    this.listen(canvas, 'pointercancel', () => { this.press = null; });
    this.listen(canvas, 'pointerleave', () => { if (!this.press) canvas.style.cursor = 'grab'; });
    this.listen(canvas, 'webglcontextlost', (e) => { e.preventDefault(); this.lost = true; this.stop(); });
    this.listen(canvas, 'webglcontextrestored', () => { this.lost = false; this.request(); });
    this.listen(document, 'visibilitychange', () => (document.hidden ? this.stop() : this.request()));
    const ro = new ResizeObserver(([e]) => this.resize(e.contentRect.width, e.contentRect.height));
    ro.observe(host);
    this.cleanup.push(() => ro.disconnect());
    if (typeof IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; if (this.visible) this.request(); else this.stop(); });
      io.observe(host);
      this.cleanup.push(() => io.disconnect());
    }

    this.setData(opts.columns, opts.score, true);
    const r = host.getBoundingClientRect();
    this.resize(r.width, r.height);
  }

  /* ───────── API ───────── */

  setData(columns: ZoneColumn[], score: number, instant = false) {
    const prev = new Map(this.columns.map((c, i) => [c.id, this.heights[i]]));
    this.columns = columns.slice(0, CAP);
    this.score = Math.max(0, Math.min(100, score));
    const n = this.columns.length;
    const geo = this.pillars.geometry;
    const level = geo.getAttribute('aLevel') as InstancedBufferAttribute;
    const lit = geo.getAttribute('aLit') as InstancedBufferAttribute;
    this.columns.forEach((c, i) => {
      this.targets[i] = c.height;
      // Una columna que ya estaba crece o baja desde su altura; una nueva sale del suelo.
      this.heights[i] = instant && this.reduceMotion ? c.height : prev.get(c.id) ?? (this.reduceMotion ? c.height : 0.02);
      level.setX(i, c.level);
      lit.setX(i, c.lit);
    });
    level.needsUpdate = true;
    lit.needsUpdate = true;
    this.pillars.count = n;
    this.radius = n ? Math.max(...this.columns.map((c) => Math.hypot(c.x, c.z))) : 0;

    // Suelo: charcos de luz; hilos: núcleo → base de cada columna.
    const fu = this.floor.material.uniforms;
    (fu.uCols.value as Vector3[]).forEach((v, i) => {
      const c = this.columns[i];
      // El disco está girado −90° en X: su eje Y local apunta a −Z del mundo.
      if (c) v.set(c.x, -c.z, 0.35 + c.level * c.lit); else v.set(0, 0, 0);
    });
    fu.uCount.value = n;
    const lp = this.links.geometry.getAttribute('position') as BufferAttribute;
    const la = this.links.geometry.getAttribute('aA') as BufferAttribute;
    for (let i = 0; i < CAP; i++) {
      const c = this.columns[i];
      lp.setXYZ(i * 2, 0, 0.02, 0);
      lp.setXYZ(i * 2 + 1, c ? c.x : 0, 0.02, c ? c.z : 0);
      la.setX(i * 2, c ? 0.9 : 0);
      la.setX(i * 2 + 1, c ? 0.15 + 0.5 * c.level * (0.4 + 0.6 * c.lit) : 0);
    }
    lp.needsUpdate = true;
    la.needsUpdate = true;
    this.links.geometry.setDrawRange(0, n * 2);

    if (this.selected >= n) this.selected = -1;
    this.applySelection();
    this.layoutCamera();
    this.syncInstances();
    this.request();
  }

  setPalette(p: ZonePalette) {
    this.dark = p.dark;
    const blend: Blending = p.dark ? AdditiveBlending : NormalBlending;
    for (const m of [this.pillarMat, this.crystal.material]) {
      m.uniforms.uAccent.value.copy(p.accent);
      m.uniforms.uGlow.value.copy(p.glow);
      m.uniforms.uDark.value = p.dark ? 1 : 0;
    }
    this.pillarMat.uniforms.uBody.value.copy(p.body);
    const fu = this.floor.material.uniforms;
    fu.uBase.value.copy(p.base);
    fu.uGlow.value.copy(p.glow);
    fu.uDark.value = p.dark ? 1 : 0;
    for (const [m, a] of [[this.halos.material, p.dark ? 0.9 : 0.5], [this.motes.material, p.dark ? 0.75 : 0.28], [this.links.material, p.dark ? 0.55 : 0.4], [this.ring.material, p.dark ? 0.9 : 0.7], [this.beam.material, p.dark ? 0.42 : 0.22]] as const) {
      m.uniforms.uGlow.value.copy(p.glow);
      m.uniforms.uAlpha.value = a;
      if (m.blending !== blend) { m.blending = blend; m.needsUpdate = true; }
    }
    this.request();
  }

  setReduceMotion(reduce: boolean) {
    this.reduceMotion = reduce;
    if (reduce) { this.heights.set(this.targets); this.yawVel = 0; this.syncInstances(); }
    this.request();
  }

  /** Elige una columna por id (botones accesibles o toque); null la suelta. */
  select(id: string | null) {
    const i = id ? this.columns.findIndex((c) => c.id === id) : -1;
    if (i === this.selected) return;
    this.selected = i;
    this.applySelection();
    if (i >= 0) {
      // Gira el mapa para dejar la columna elegida de frente (por el camino corto).
      const c = this.columns[i];
      let target = Math.atan2(c.z, c.x) - Math.PI / 2;
      target += Math.round((this.yaw - target) / (Math.PI * 2)) * Math.PI * 2;
      this.yawTarget = target;
      if (this.reduceMotion) { this.yaw = target; this.yawTarget = null; }
    } else this.yawTarget = null;
    this.request();
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.cleanup.forEach((fn) => fn());
    const meshes = [this.pillars, this.floor, this.halos, this.motes, this.links, this.crystal, this.ring, this.beam];
    for (const m of meshes) { m.geometry.dispose(); m.material.dispose(); }
    this.pillars.dispose();
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  /* ───────── Interno ───────── */

  private glowMaterial(vertexShader: string, size: number, alpha: number) {
    return new ShaderMaterial({
      vertexShader,
      fragmentShader: softPointFrag,
      transparent: true,
      depthWrite: false,
      blending: this.dark ? AdditiveBlending : NormalBlending,
      uniforms: {
        uGlow: { value: this.opts.palette.glow.clone() }, uAlpha: { value: alpha }, uSize: { value: size },
        uPx: { value: Math.min(window.devicePixelRatio || 1, 2) }, uTime: { value: 0 },
      },
    });
  }

  private applySelection() {
    const sel = this.pillars.geometry.getAttribute('aSel') as InstancedBufferAttribute;
    for (let i = 0; i < CAP; i++) sel.setX(i, i === this.selected ? 1 : 0);
    sel.needsUpdate = true;
    this.pillarMat.uniforms.uAnySel.value = this.selected >= 0 ? 1 : 0;
    const label = this.opts.label;
    if (label && this.selected < 0) label.style.opacity = '0';
  }

  private syncInstances() {
    const hp = this.halos.geometry.getAttribute('position') as BufferAttribute;
    const hs = this.halos.geometry.getAttribute('aScale') as BufferAttribute;
    for (let i = 0; i < CAP; i++) {
      const c = this.columns[i];
      if (!c) { hs.setX(i, 0); continue; }
      const h = this.heights[i];
      this.tmp.position.set(c.x, 0, c.z);
      this.tmp.scale.set(1, Math.max(0.001, h), 1);
      this.tmp.rotation.set(0, Math.PI / 6, 0);
      this.tmp.updateMatrix();
      this.pillars.setMatrixAt(i, this.tmp.matrix);
      hp.setXYZ(i, c.x, h + 0.02, c.z);
      hs.setX(i, c.lit ? 0.45 + c.level * 0.9 + (i === this.selected ? 0.5 : 0) : 0.18);
    }
    this.pillars.instanceMatrix.needsUpdate = true;
    this.pillars.computeBoundingSphere();
    hp.needsUpdate = true;
    hs.needsUpdate = true;
    this.halos.geometry.setDrawRange(0, this.columns.length);
  }

  private layoutCamera() {
    // Se aleja lo justo para que el círculo entero quepa también en lienzos estrechos (móvil).
    const aspect = this.width / Math.max(1, this.height);
    const half = MathUtils.degToRad(this.camera.fov / 2);
    const hHalf = Math.atan(Math.tan(half) * aspect);
    const reach = Math.max(1.3, this.radius + 0.5);
    // En horizontal cabe el círculo; en vertical, la columna más alta y el cristal. Desde
    // arriba (~30°) las columnas de delante no tapan el cristal, que flota sobre ellas.
    const dist = Math.max(4.4, reach / Math.tan(hHalf) + 0.8, 1.6 / Math.tan(half) + 0.4);
    this.camera.position.set(0, dist * 0.6, dist);
    this.camera.lookAt(0, 0.74, 0);
    this.camera.updateProjectionMatrix();
  }

  private resize(w: number, h: number) {
    if (!w || !h) return;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.layoutCamera();
    this.request();
  }

  private listen<E extends Event>(target: EventTarget, type: string, fn: (e: E) => void) {
    target.addEventListener(type, fn as EventListener);
    this.cleanup.push(() => target.removeEventListener(type, fn as EventListener));
  }

  private request = () => {
    if (this.frame || !this.visible || this.lost || document.hidden || this.disposed) return;
    this.frame = requestAnimationFrame(this.tick);
  };

  private stop() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.last = 0;
  }

  private busy() {
    if (this.press?.dragging || Math.abs(this.yawVel) > 0.0004 || this.yawTarget !== null) return true;
    for (let i = 0; i < this.columns.length; i++) if (Math.abs(this.targets[i] - this.heights[i]) > 0.001) return true;
    return Math.abs(this.score / 100 - this.energy) > 0.002;
  }

  private tick = (now: number) => {
    this.frame = 0;
    const dt = Math.min(0.05, this.last ? (now - this.last) / 1000 : 1 / 60);
    this.last = now;
    const ambient = !this.reduceMotion;
    const busy = this.busy();
    this.clock += dt;
    this.step(dt, ambient);
    this.renderer.render(this.scene, this.camera);
    if (!this.readied) { this.readied = true; this.opts.onReady?.(); }
    if (busy || ambient) this.request();
  };

  private step(dt: number, ambient: boolean) {
    const t = this.clock;
    // Alturas y energía del núcleo: se acercan a su objetivo con un muelle crítico.
    const k = 1 - Math.exp(-dt * 5.5);
    let moved = false;
    for (let i = 0; i < this.columns.length; i++) {
      const d = this.targets[i] - this.heights[i];
      if (Math.abs(d) > 0.0005) { this.heights[i] += d * k; moved = true; }
    }
    this.energy += (this.score / 100 - this.energy) * (this.reduceMotion ? 1 : k);
    if (moved) this.syncInstances();

    // Giro: arrastre con inercia, giro hacia la columna elegida o vuelta lenta de ambiente.
    if (!this.press?.dragging) {
      if (this.yawTarget !== null) {
        const d = this.yawTarget - this.yaw;
        this.yaw += d * (1 - Math.exp(-dt * 6));
        this.yawVel = 0;
        if (Math.abs(d) < 0.002) { this.yaw = this.yawTarget; this.yawTarget = null; }
      } else {
        this.yaw += this.yawVel;
        this.yawVel *= Math.pow(0.92, dt * 60);
        if (ambient && this.selected < 0) this.yaw += dt * 0.09;
      }
    }
    this.world.rotation.y = this.yaw;

    // Núcleo: el cristal crece con el Life Score, flota sobre las columnas y gira; el anillo va al revés.
    const s = 0.5 + this.energy * 0.6;
    const bob = ambient ? Math.sin(t * 1.4) * 0.05 : 0;
    this.core.position.set(0, 1.5 + this.energy * 0.15 + bob, 0);
    this.crystal.scale.setScalar(s);
    this.crystal.rotation.set(ambient ? Math.sin(t * 0.5) * 0.25 : 0.3, ambient ? t * 0.45 : 0.6, 0);
    this.ring.scale.setScalar(0.85 + this.energy * 0.45);
    this.ring.rotation.z = ambient ? -t * 0.6 : 0;
    this.beam.scale.set(1, this.core.position.y, 1);
    this.crystal.material.uniforms.uEnergy.value = this.energy;

    const time = ambient ? t : 0;
    this.pillarMat.uniforms.uTime.value = time;
    this.floor.material.uniforms.uTime.value = time;
    this.halos.material.uniforms.uTime.value = time;
    this.motes.material.uniforms.uTime.value = time;

    this.placeLabel();
  }

  /** Lleva la etiqueta HTML sobre la tapa de la columna elegida. */
  private placeLabel() {
    const label = this.opts.label;
    if (!label || this.selected < 0) return;
    const c = this.columns[this.selected];
    this.world.updateMatrixWorld();
    this.v3.set(c.x, this.heights[this.selected] + 0.2, c.z).applyMatrix4(this.world.matrixWorld).project(this.camera);
    // Dentro del lienzo: ni por encima del borde superior ni fuera de los laterales.
    const x = Math.min(this.width - 60, Math.max(60, (this.v3.x * 0.5 + 0.5) * this.width));
    const y = Math.max(40, (-this.v3.y * 0.5 + 0.5) * this.height - 6);
    // Solo se escribe si cambia: con el mapa quieto, cada escritura recalculaba estilos igual.
    const transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
    const opacity = this.v3.z < 1 ? '1' : '0';
    if (transform !== this.labelTransform) { label.style.transform = transform; this.labelTransform = transform; }
    if (opacity !== label.style.opacity) label.style.opacity = opacity;
  }

  private pick(clientX: number, clientY: number): number {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.pillars, false)[0];
    return hit?.instanceId ?? -1;
  }

  private onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.press = { id: e.pointerId, x: e.clientX, y: e.clientY, dragging: false, lastX: e.clientX };
    this.yawTarget = null;
  };

  private onMove = (e: PointerEvent) => {
    const p = this.press;
    const canvas = this.renderer.domElement;
    if (!p) {
      if (e.pointerType === 'mouse') canvas.style.cursor = this.pick(e.clientX, e.clientY) >= 0 ? 'pointer' : 'grab';
      return;
    }
    if (p.id !== e.pointerId) return;
    const dx = e.clientX - p.x;
    if (!p.dragging && Math.abs(dx) > TAP_PX && Math.abs(dx) > Math.abs(e.clientY - p.y)) {
      p.dragging = true;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    }
    if (!p.dragging) return;
    const step = (e.clientX - p.lastX) * 0.011;
    this.yaw += step;
    this.yawVel = step * 0.55;
    p.lastX = e.clientX;
    this.request();
  };

  private onUp = (e: PointerEvent) => {
    const p = this.press;
    this.press = null;
    if (!p || p.id !== e.pointerId) return;
    this.renderer.domElement.style.cursor = 'grab';
    if (p.dragging) { this.request(); return; }
    const i = this.pick(e.clientX, e.clientY);
    const id = i >= 0 && i !== this.selected ? this.columns[i].id : null;
    this.select(id);
    this.opts.onSelect?.(id);
  };
}
