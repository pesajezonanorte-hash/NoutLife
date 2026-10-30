// Tótem de racha: un monolito de cuarzo (Blender, scripts/blender/props.py) flota sobre una isla
// hexagonal. Con la racha, el cuerpo del cristal se estira sin deformar la punta, el neón se
// intensifica, suben más motas de energía y, en los hitos, se suman fragmentos y anillos en
// órbita. Las siete marcas del pedestal son los últimos siete días (hoy al frente). Al sumar un
// día, onda expansiva y chispas. Se gira arrastrando en horizontal (en vertical sigue la página).
// Rendimiento: ~9 draw calls (marcas y fragmentos instanciados, motas en un Points).
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, CylinderGeometry, DoubleSide, Group, InstancedBufferAttribute,
  InstancedMesh, Mesh, NormalBlending, Object3D, Points, RingGeometry, ShaderMaterial, TorusGeometry, Vector3,
  type Blending,
} from 'three';
import habitsUrl from '@/assets/models/props-habits.glb?url';
import { Stage, type StageOptions } from '@/components/three3d/stage';
import { loadProps, propGeometry } from '@/components/three3d/models';
import { propMaterial, setPropPalette } from '@/components/three3d/propMaterial';
import type { PropPalette } from '@/components/three3d/palette';
import { TOTEM_MAX_GROW, TOTEM_MAX_MOTES, TOTEM_MAX_SHARDS, totemState, type TotemState } from '../totemMath';

export interface TotemData {
  streak: number;
  /** Últimos 7 días, el más antiguo primero (hoy al final). */
  week: boolean[];
}

export interface TotemSceneOptions extends StageOptions {
  data: TotemData;
}

const CRYSTAL_Y = 0.98;
const BURST = 72;
const TAP_PX = 8;

const crystalVert = /* glsl */ `
  uniform float uGrow;
  varying vec3 vN;
  varying vec3 vV;
  varying float vY;
  void main() {
    vec3 p = position;
    // Todo lo que está por encima del ecuador sube: el cuerpo se alarga y la punta no cambia.
    p.y += step(0.001, p.y) * uGrow;
    vY = clamp((p.y + 0.78) / (1.78 + uGrow), 0.0, 1.0);
    vec4 lp = vec4(p, 1.0);
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

// Cuarzo facetado: cada cara con su matiz (las normales son planas), luz interior que sube
// con la racha, una veta de energía que asciende, borde fresnel y destellos en las facetas.
const crystalFrag = /* glsl */ `
  uniform vec3 uBody;
  uniform vec3 uAccent;
  uniform vec3 uGlow;
  uniform float uEnergy;
  uniform float uDark;
  uniform float uTime;
  uniform float uFlash;
  varying vec3 vN;
  varying vec3 vV;
  varying float vY;
  void main() {
    vec3 n = normalize(vN);
    vec3 v = normalize(vV);
    float facet = fract(sin(dot(floor(n * 24.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    float key = max(dot(n, normalize(vec3(-0.45, 0.75, 0.5))), 0.0);
    float fres = pow(1.0 - abs(dot(n, v)), 2.0);
    // En claro el cuarzo es del color del acento (un cristal casi blanco desaparecía en el fondo).
    vec3 col = mix(uBody, uAccent, mix(mix(0.55, 0.28, uDark), mix(0.92, 0.62, uDark), vY)) * (0.5 + 0.48 * key + 0.16 * facet);
    float vein = smoothstep(0.16, 0.0, abs(fract(vY * 1.6 - uTime * 0.22) - 0.5) - 0.32);
    col += uGlow * (0.06 + 0.9 * uEnergy) * (pow(vY, 1.4) * mix(0.35, 0.7, uDark) + vein * 0.28 * uEnergy);
    col += uGlow * fres * (0.25 + 0.95 * uEnergy) * mix(0.7, 1.0, uDark);
    col += mix(vec3(1.0), uGlow, 0.4) * pow(key, 28.0) * (0.35 + 0.4 * facet);
    col += uGlow * uFlash * 0.7;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

const motesVert = /* glsl */ `
  attribute vec3 aSeed;
  uniform float uTime;
  uniform float uSize;
  uniform float uPx;
  uniform float uHeight;
  uniform float uEnergy;
  varying float vA;
  void main() {
    float speed = 0.1 + aSeed.z * 0.2;
    float y = mod(aSeed.y * uHeight + uTime * speed * (0.6 + uEnergy), uHeight);
    float ang = aSeed.x * 6.2832 + uTime * (0.22 + aSeed.z * 0.28) + y * 1.4;
    float rad = 0.34 + aSeed.z * 0.5 + 0.06 * sin(uTime * 1.3 + aSeed.x * 9.0);
    vec3 p = vec3(cos(ang) * rad, y + 0.05, sin(ang) * rad);
    vA = smoothstep(0.0, 0.35, y) * smoothstep(uHeight, uHeight * 0.55, y) * (0.35 + 0.65 * aSeed.z);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.55 + 0.9 * aSeed.z) * uPx / max(0.5, -mv.z);
  }`;

const burstVert = /* glsl */ `
  attribute vec3 aDir;
  uniform float uT;
  uniform float uSize;
  uniform float uPx;
  varying float vA;
  void main() {
    float t = max(uT, 0.0);
    vec3 p = aDir * (0.4 + 1.3 * t) * (1.0 - 0.32 * t) + vec3(0.0, 0.35 * t - 0.6 * t * t, 0.0);
    vA = step(0.0, uT) * (1.0 - smoothstep(0.35, 1.2, t));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPx * (1.0 - 0.5 * t) / max(0.5, -mv.z);
  }`;

const softFrag = /* glsl */ `
  uniform vec3 uGlow;
  uniform float uAlpha;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    gl_FragColor = vec4(uGlow, pow(max(0.0, 1.0 - d), 2.0) * vA * uAlpha);
    #include <colorspace_fragment>
  }`;

const flatVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  varying float vH;
  void main() {
    vH = position.y;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const glowFrag = /* glsl */ `
  uniform vec3 uGlow;
  uniform float uAlpha;
  void main() {
    gl_FragColor = vec4(uGlow, uAlpha);
    #include <colorspace_fragment>
  }`;

const beamFrag = /* glsl */ `
  uniform vec3 uGlow;
  uniform float uAlpha;
  varying vec3 vN;
  varying vec3 vV;
  varying float vH;
  void main() {
    float facing = abs(dot(normalize(vN), normalize(vV)));
    gl_FragColor = vec4(uGlow, pow(1.0 - vH, 1.3) * pow(facing, 1.6) * uAlpha);
    #include <colorspace_fragment>
  }`;

export class TotemScene extends Stage {
  private world = new Group();
  private floater = new Group();
  private crystal: Mesh<BufferGeometry, ShaderMaterial> | null = null;
  private crystalMat: ShaderMaterial;
  private shardMat: ShaderMaterial;
  private shards: InstancedMesh | null = null;
  private pedestalMat: ShaderMaterial;
  private notchMat: ShaderMaterial;
  private notches: InstancedMesh | null = null;
  private rings: Array<Mesh<TorusGeometry, ShaderMaterial>> = [];
  private motes: Points<BufferGeometry, ShaderMaterial>;
  private burst: Points<BufferGeometry, ShaderMaterial>;
  private shock: Mesh<RingGeometry, ShaderMaterial>;
  private beam: Mesh<CylinderGeometry, ShaderMaterial>;
  private tmp = new Object3D();
  private camGoal = new Vector3();

  private data: TotemData;
  private target: TotemState;
  private grow = 0;
  private energy = 0;
  private ringLevel = new Float32Array(3);
  private shardLevel = new Float32Array(TOTEM_MAX_SHARDS);
  private burstT = -1;
  private flash = 0;
  private yaw = 0.5;
  private yawVel = 0;
  private press: { id: number; x: number; y: number; dragging: boolean; lastX: number } | null = null;
  private camY = 1;
  private camDist = 6;

  constructor(host: HTMLElement, private opts: TotemSceneOptions) {
    super(host, { ...opts, fov: 30 });
    this.data = opts.data;
    this.target = totemState(opts.data.streak);
    const p = opts.palette;
    // Sin animación de entrada con «Reducir movimiento»: el cristal aparece ya crecido.
    if (opts.reduceMotion) { this.grow = this.target.growth * TOTEM_MAX_GROW; this.energy = this.target.energy; }

    this.crystalMat = this.makeCrystalMaterial(p);
    this.shardMat = this.makeCrystalMaterial(p);
    this.pedestalMat = propMaterial(p);
    this.notchMat = propMaterial(p, { lit: true });

    // Motas de energía en espiral alrededor del cristal.
    const moteGeo = new BufferGeometry();
    const seeds = new Float32Array(TOTEM_MAX_MOTES * 3);
    for (let i = 0; i < TOTEM_MAX_MOTES; i++) seeds.set([(i * 0.618034) % 1, (i * 0.381966 + 0.13) % 1, (i * 0.7548777 + 0.31) % 1], i * 3);
    moteGeo.setAttribute('position', new BufferAttribute(new Float32Array(TOTEM_MAX_MOTES * 3), 3));
    moteGeo.setAttribute('aSeed', new BufferAttribute(seeds, 3));
    this.motes = new Points(moteGeo, this.points(motesVert, { uHeight: { value: 2.4 }, uEnergy: { value: 0 }, uSize: { value: 15 } }, p.dark ? 0.95 : 0.7));
    this.motes.frustumCulled = false;

    // Chispas del día sumado: salen del centro del cristal.
    const burstGeo = new BufferGeometry();
    const dirs = new Float32Array(BURST * 3);
    for (let i = 0; i < BURST; i++) {
      const y = 1 - ((i + 0.5) / BURST) * 2;
      const r = Math.sqrt(1 - y * y);
      const a = i * 2.39996;
      dirs.set([Math.cos(a) * r, y * 0.7 + 0.25, Math.sin(a) * r], i * 3);
    }
    burstGeo.setAttribute('position', new BufferAttribute(new Float32Array(BURST * 3), 3));
    burstGeo.setAttribute('aDir', new BufferAttribute(dirs, 3));
    this.burst = new Points(burstGeo, this.points(burstVert, { uT: { value: -1 }, uSize: { value: 22 } }, 1));
    this.burst.frustumCulled = false;
    this.burst.position.y = CRYSTAL_Y + 0.2;

    // Onda expansiva sobre el pedestal.
    this.shock = new Mesh(new RingGeometry(0.92, 1, 72), new ShaderMaterial({
      vertexShader: flatVert, fragmentShader: glowFrag, transparent: true, depthWrite: false, side: DoubleSide,
      blending: this.blend(), uniforms: { uGlow: { value: p.glow.clone() }, uAlpha: { value: 0 } },
    }));
    this.shock.rotation.x = -Math.PI / 2;
    this.shock.position.y = 0.06;
    this.shock.visible = false;

    // Haz de luz del pedestal al cristal.
    const beamGeo = new CylinderGeometry(0.05, 0.24, 1, 28, 1, true);
    beamGeo.translate(0, 0.5, 0);
    this.beam = new Mesh(beamGeo, new ShaderMaterial({
      vertexShader: flatVert, fragmentShader: beamFrag, transparent: true, depthWrite: false, side: DoubleSide,
      blending: this.blend(), uniforms: { uGlow: { value: p.glow.clone() }, uAlpha: { value: 0 } },
    }));
    this.beam.position.y = 0.05;
    this.beam.scale.y = CRYSTAL_Y - 0.8;

    // Anillos en órbita (7, 30 y 100 días).
    [[0.62, 1.15, 0.2], [0.78, 1.4, -0.5], [0.94, 1.75, 0.9]].forEach(([r, tilt, spin]) => {
      const ring = new Mesh(new TorusGeometry(r, 0.0065, 6, 120), new ShaderMaterial({
        vertexShader: flatVert, fragmentShader: glowFrag, transparent: true, depthWrite: false, blending: this.blend(),
        uniforms: { uGlow: { value: p.glow.clone() }, uAlpha: { value: 0 } },
      }));
      ring.rotation.set(tilt, spin, 0);
      ring.visible = false;
      this.rings.push(ring);
      this.floater.add(ring);
    });

    this.floater.position.y = CRYSTAL_Y;
    this.world.add(this.floater, this.motes, this.burst, this.shock, this.beam);
    this.scene.add(this.world);

    this.listen(this.canvas, 'pointerdown', this.onDown);
    this.listen(this.canvas, 'pointermove', this.onMove);
    this.listen(this.canvas, 'pointerup', this.onUp);
    this.listen(this.canvas, 'pointercancel', () => { this.press = null; });

    this.loading = true;
    loadProps(habitsUrl).then((models) => {
      if (this.disposed) return;
      const get = (name: string) => {
        const d = models.get(name);
        if (!d) throw new Error(`totem: falta ${name}`);
        return d;
      };
      this.crystal = new Mesh(propGeometry(get('crystal')), this.crystalMat);
      // El sombreador lo estira más allá de su esfera: sin recorte por frustum.
      this.crystal.frustumCulled = false;
      this.floater.add(this.crystal);
      const pedestal = new Mesh(propGeometry(get('pedestal')), this.pedestalMat);
      this.world.add(pedestal);
      this.notches = new InstancedMesh(propGeometry(get('notch')), this.notchMat, 7);
      this.notches.geometry.setAttribute('aLit', new InstancedBufferAttribute(new Float32Array(7), 1));
      for (let i = 0; i < 7; i++) {
        // Hoy al frente; los días anteriores siguen el borde hacia atrás.
        const a = (i - 6) * ((Math.PI * 2) / 7);
        this.tmp.position.set(Math.sin(a) * 0.33, 0.012, Math.cos(a) * 0.33);
        this.tmp.rotation.set(0, a, 0);
        this.tmp.scale.setScalar(1);
        this.tmp.updateMatrix();
        this.notches.setMatrixAt(i, this.tmp.matrix);
      }
      this.notches.instanceMatrix.needsUpdate = true;
      this.world.add(this.notches);
      this.shards = new InstancedMesh(propGeometry(get('shard')), this.shardMat, TOTEM_MAX_SHARDS);
      this.shards.count = 0;
      this.shards.frustumCulled = false;
      this.floater.add(this.shards);
      this.loading = false;
      this.applyWeek();
      this.request();
    }).catch(() => this.fail());

    this.applyPalette(p);
    this.start();
  }

  /* ───────── API ───────── */

  setData(data: TotemData) {
    const before = this.data.streak;
    this.data = data;
    this.target = totemState(data.streak);
    if (this.reduceMotion) { this.grow = this.target.growth * TOTEM_MAX_GROW; this.energy = this.target.energy; }
    this.applyWeek();
    this.layout();
    this.camera.updateProjectionMatrix();
    if (data.streak > before) this.celebrate();
    this.request();
  }

  /** Onda y chispas (un día más de racha). */
  celebrate() {
    if (this.reduceMotion) { this.flash = 0.6; this.request(); return; }
    this.burstT = 0;
    this.flash = 1;
    this.shock.visible = true;
    this.request();
  }

  /* ───────── Interno ───────── */

  protected applyPalette(p: PropPalette) {
    for (const m of [this.crystalMat, this.shardMat]) {
      (m.uniforms.uBody.value as Color).copy(p.body);
      (m.uniforms.uAccent.value as Color).copy(p.accent);
      (m.uniforms.uGlow.value as Color).copy(p.glow);
      m.uniforms.uDark.value = p.dark ? 1 : 0;
    }
    setPropPalette(this.pedestalMat, p);
    setPropPalette(this.notchMat, p);
    const blend = this.blend();
    for (const m of [this.motes.material, this.burst.material, this.shock.material, this.beam.material, ...this.rings.map((r) => r.material)]) {
      (m.uniforms.uGlow.value as Color).copy(p.glow);
      if (m.blending !== blend) { m.blending = blend; m.needsUpdate = true; }
    }
    this.motes.material.uniforms.uAlpha.value = p.dark ? 0.95 : 0.7;
  }

  protected layout() {
    // Encuadra la isla y el cristal a su altura objetivo (también en lienzos estrechos).
    const top = CRYSTAL_Y + 0.98 + this.target.growth * TOTEM_MAX_GROW + 0.15;
    const bottom = -0.7;
    const half = (top - bottom) / 2 + 0.12;
    const vHalf = (this.camera.fov * Math.PI) / 360;
    const aspect = this.width / Math.max(1, this.height);
    const byHeight = half / Math.tan(vHalf);
    const byWidth = 1.05 / (Math.tan(vHalf) * aspect);
    this.camDist = Math.max(byHeight, byWidth) + 0.6;
    this.camY = (top + bottom) / 2;
  }

  protected step(dt: number): boolean {
    const t = this.clock;
    const ambient = !this.reduceMotion;
    const k = 1 - Math.exp(-dt * 3.2);
    const goalGrow = this.target.growth * TOTEM_MAX_GROW;
    let busy = false;
    const ease = (cur: number, goal: number) => {
      const d = goal - cur;
      if (Math.abs(d) > 0.0005) busy = true;
      return Math.abs(d) > 0.0005 ? cur + d * k : goal;
    };
    this.grow = ease(this.grow, goalGrow);
    this.energy = ease(this.energy, this.target.energy);
    for (let i = 0; i < 3; i++) this.ringLevel[i] = ease(this.ringLevel[i], i < this.target.rings ? 1 : 0);
    for (let i = 0; i < TOTEM_MAX_SHARDS; i++) this.shardLevel[i] = ease(this.shardLevel[i], i < this.target.shards ? 1 : 0);

    // Giro: arrastre con inercia o vuelta lenta de ambiente.
    if (!this.press?.dragging) {
      this.yaw += this.yawVel;
      this.yawVel *= Math.pow(0.9, dt * 60);
      if (Math.abs(this.yawVel) > 0.0004) busy = true;
      if (ambient) this.yaw += dt * 0.32;
    }
    this.world.rotation.y = this.yaw;

    // El cristal flota y respira; la cámara sigue la altura con suavidad.
    this.floater.position.y = CRYSTAL_Y + (ambient ? Math.sin(t * 1.3) * 0.045 : 0);
    if (this.crystal) this.crystal.rotation.y = ambient ? t * 0.18 : 0.4;
    const cm = this.crystalMat.uniforms;
    cm.uGrow.value = this.grow;
    cm.uEnergy.value = this.energy;
    cm.uTime.value = ambient ? t : 0;
    this.flash = Math.max(0, this.flash - dt * 1.8);
    if (this.flash > 0) busy = true;
    cm.uFlash.value = this.flash;
    this.shardMat.uniforms.uEnergy.value = this.energy;
    this.shardMat.uniforms.uTime.value = cm.uTime.value;
    this.pedestalMat.uniforms.uGlow.value = this.energy;
    this.notchMat.uniforms.uGlow.value = 0.3 + this.energy * 0.7;

    // Motas: tantas como pide la racha; suben hasta la punta del cristal.
    const height = CRYSTAL_Y + 0.98 + this.grow + 0.2;
    const mu = this.motes.material.uniforms;
    mu.uTime.value = ambient ? t : 0;
    mu.uHeight.value = height;
    mu.uEnergy.value = this.energy;
    this.motes.geometry.setDrawRange(0, Math.round(this.target.motes * Math.min(1, this.energy / Math.max(0.01, this.target.energy))));
    this.beam.material.uniforms.uAlpha.value = (this.palette.dark ? 0.5 : 0.28) * this.energy;
    this.beam.scale.y = this.floater.position.y - 0.76 - 0.05;

    this.rings.forEach((ring, i) => {
      const level = this.ringLevel[i];
      ring.visible = level > 0.01;
      ring.material.uniforms.uAlpha.value = level * (this.palette.dark ? 0.85 : 0.6) * (0.5 + 0.5 * this.energy);
      ring.scale.setScalar(0.6 + 0.4 * level);
      ring.position.y = 0.15 + i * 0.32 + (this.grow * (i + 1)) / 4;
      if (ambient) ring.rotation.z = t * (0.35 + i * 0.12) * (i % 2 ? -1 : 1);
    });

    if (this.shards) {
      let n = 0;
      for (let i = 0; i < TOTEM_MAX_SHARDS; i++) {
        const level = this.shardLevel[i];
        if (level < 0.01) continue;
        const a = (i / TOTEM_MAX_SHARDS) * Math.PI * 2 + (ambient ? t * 0.4 : 0);
        const r = 0.62 + (i % 3) * 0.13;
        this.tmp.position.set(Math.cos(a) * r, 0.1 + ((i * 0.37) % 1) * (0.9 + this.grow * 0.8) + (ambient ? Math.sin(t * 1.7 + i) * 0.05 : 0), Math.sin(a) * r);
        this.tmp.rotation.set(0.3 + i, ambient ? t * (0.8 + i * 0.1) : i, 0.4);
        this.tmp.scale.setScalar(level * (0.8 + (i % 2) * 0.35));
        this.tmp.updateMatrix();
        this.shards.setMatrixAt(n++, this.tmp.matrix);
      }
      this.shards.count = n;
      this.shards.instanceMatrix.needsUpdate = true;
    }

    // Onda y chispas.
    if (this.burstT >= 0) {
      this.burstT += dt;
      busy = true;
      const p = this.burstT / 0.95;
      this.shock.scale.setScalar(0.25 + p * 1.9);
      this.shock.material.uniforms.uAlpha.value = Math.max(0, 1 - p) * (this.palette.dark ? 0.9 : 0.6);
      if (this.burstT > 1.4) { this.burstT = -1; this.shock.visible = false; }
    }
    this.burst.material.uniforms.uT.value = this.burstT;

    // La cámara se acerca o se aleja con la altura del cristal.
    const cam = this.camera.position;
    const goal = this.camGoal.set(0, this.camY + this.camDist * 0.16, this.camDist);
    if (cam.distanceToSquared(goal) > 1e-6) { cam.lerp(goal, this.reduceMotion || cam.lengthSq() === 0 ? 1 : k); busy = true; }
    this.camera.lookAt(0, this.camY, 0);
    return busy;
  }

  private applyWeek() {
    if (!this.notches) return;
    const lit = this.notches.geometry.getAttribute('aLit') as InstancedBufferAttribute;
    for (let i = 0; i < 7; i++) lit.setX(i, this.data.week[i] ? 1 : 0.12);
    lit.needsUpdate = true;
  }

  private makeCrystalMaterial(p: PropPalette) {
    return new ShaderMaterial({
      vertexShader: crystalVert,
      fragmentShader: crystalFrag,
      uniforms: {
        uGrow: { value: 0 }, uBody: { value: p.body.clone() }, uAccent: { value: p.accent.clone() }, uGlow: { value: p.glow.clone() },
        uEnergy: { value: 0 }, uDark: { value: p.dark ? 1 : 0 }, uTime: { value: 0 }, uFlash: { value: 0 },
      },
    });
  }

  private points(vertexShader: string, extra: Record<string, { value: unknown }>, alpha: number) {
    return new ShaderMaterial({
      vertexShader,
      fragmentShader: softFrag,
      transparent: true,
      depthWrite: false,
      blending: this.blend(),
      uniforms: {
        uGlow: { value: this.palette.glow.clone() }, uAlpha: { value: alpha }, uTime: { value: 0 },
        uPx: { value: Math.min(window.devicePixelRatio || 1, 2) }, ...extra,
      },
    });
  }

  private blend(): Blending {
    return this.palette.dark ? AdditiveBlending : NormalBlending;
  }

  private onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.press = { id: e.pointerId, x: e.clientX, y: e.clientY, dragging: false, lastX: e.clientX };
  };

  private onMove = (e: PointerEvent) => {
    const p = this.press;
    if (!p || p.id !== e.pointerId) return;
    const dx = e.clientX - p.x;
    if (!p.dragging && Math.abs(dx) > TAP_PX && Math.abs(dx) > Math.abs(e.clientY - p.y)) {
      p.dragging = true;
      this.canvas.setPointerCapture(e.pointerId);
      this.canvas.style.cursor = 'grabbing';
    }
    if (!p.dragging) return;
    const stepX = (e.clientX - p.lastX) * 0.012;
    this.yaw += stepX;
    this.yawVel = stepX * 0.5;
    p.lastX = e.clientX;
    this.request();
  };

  private onUp = (e: PointerEvent) => {
    const p = this.press;
    this.press = null;
    if (!p || p.id !== e.pointerId) return;
    this.canvas.style.cursor = '';
    if (!p.dragging) { this.flash = 0.8; this.request(); }
  };
}
