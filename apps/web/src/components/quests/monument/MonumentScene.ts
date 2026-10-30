// Monumento de Misiones: pirámide escalonada de 10 peldaños (Blender, scripts/blender/props.py),
// cada uno un 10 %. La franja de luz de cada peldaño se enciende hasta el avance de la misión
// elegida. Cada misión activa es un núcleo de energía que flota junto a su peldaño; las
// cumplidas izan banderas que ondean en la cima. Al completar una misión, su núcleo sube en
// espiral hasta la cima, estalla en chispas y se iza una bandera nueva.
// Rendimiento: peldaños, núcleos y banderas son InstancedMesh; halos, motas y chispas, Points
// (~9 draw calls). Se gira arrastrando en horizontal; tocar un núcleo elige su misión.
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CircleGeometry, Color, DoubleSide, Group, IcosahedronGeometry,
  InstancedBufferAttribute, InstancedMesh, Mesh, NormalBlending, Object3D, Points, ShaderMaterial, Vector3, type Blending,
} from 'three';
import goalsUrl from '@/assets/models/props-goals.glb?url';
import { Stage, type StageOptions } from '@/components/three3d/stage';
import { loadProps, propGeometry } from '@/components/three3d/models';
import { propMaterial, setPropPalette } from '@/components/three3d/propMaterial';
import type { PropPalette } from '@/components/three3d/palette';
import {
  MONUMENT_MAX_FLAGS, MONUMENT_MAX_ORBS, MONUMENT_TIERS, SUMMIT_Y, TIER_H, orbSpots, tierFill, tierScale, type MonumentGoal,
} from '../monumentMath';

export interface MonumentData {
  goals: MonumentGoal[];
  completedIds: string[];
  selected: string | null;
}

export interface MonumentSceneOptions extends StageOptions {
  data: MonumentData;
  label?: HTMLElement | null;
  onSelect?: (id: string) => void;
}

interface Orb {
  id: string;
  angle: number;
  radius: number;
  y: number;
  /** 0–1: aparece al crearse, desaparece al irse. */
  life: number;
  gone: boolean;
  /** Subida a la cima (segundos desde que empezó) o −1. */
  rise: number;
  from: { angle: number; radius: number; y: number } | null;
  sel: number;
}

const ASCEND_S = 2.3;
const BURST = 64;
const MOTES = 48;
const TAP_PX = 8;
const PICK_PX = 30;

const orbVert = /* glsl */ `
  attribute float aSel;
  attribute float aLevel;
  varying vec3 vN;
  varying vec3 vV;
  varying float vSel;
  varying float vLevel;
  void main() {
    vSel = aSel;
    vLevel = aLevel;
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const orbFrag = /* glsl */ `
  uniform vec3 uAccent;
  uniform vec3 uGlow;
  uniform float uTime;
  uniform float uAnySel;
  varying vec3 vN;
  varying vec3 vV;
  varying float vSel;
  varying float vLevel;
  void main() {
    vec3 n = normalize(vN);
    vec3 v = normalize(vV);
    float facing = max(dot(n, v), 0.0);
    float fres = pow(1.0 - facing, 1.6);
    vec3 col = mix(uAccent * 0.95, uGlow * 1.25, fres) + uGlow * pow(facing, 3.0) * (0.3 + 0.6 * vLevel);
    col *= mix(1.0, 0.55, uAnySel * (1.0 - vSel));
    col += uGlow * vSel * (0.25 + 0.15 * sin(uTime * 5.0));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

// El faro de la cima: el mismo núcleo, suelto y siempre elegido.
const beaconVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  varying float vSel;
  varying float vLevel;
  void main() {
    vSel = 1.0;
    vLevel = 1.0;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const pointVert = /* glsl */ `
  attribute float aScale;
  uniform float uSize;
  uniform float uPx;
  varying float vA;
  void main() {
    vA = 1.0;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * aScale * uPx / max(0.5, -mv.z);
  }`;

const motesVert = /* glsl */ `
  attribute vec3 aSeed;
  uniform float uTime;
  uniform float uSize;
  uniform float uPx;
  varying float vA;
  void main() {
    float h = 1.9;
    float y = mod(aSeed.y * h + uTime * (0.07 + aSeed.z * 0.08), h);
    float ang = aSeed.x * 6.2832 + uTime * 0.04;
    float rad = 0.55 + aSeed.z * 0.55 - y * 0.18;
    vec3 p = vec3(cos(ang) * rad, y, sin(ang) * rad);
    vA = smoothstep(0.0, 0.3, y) * smoothstep(h, h * 0.6, y) * (0.3 + 0.7 * aSeed.z);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPx / max(0.5, -mv.z);
  }`;

const burstVert = /* glsl */ `
  attribute vec3 aDir;
  uniform float uT;
  uniform float uSize;
  uniform float uPx;
  varying float vA;
  void main() {
    float t = max(uT, 0.0);
    vec3 p = aDir * (0.15 + 0.9 * t) * (1.0 - 0.3 * t) + vec3(0.0, 0.5 * t - 0.5 * t * t, 0.0);
    vA = step(0.0, uT) * (1.0 - smoothstep(0.3, 1.1, t));
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
    gl_FragColor = vec4(uGlow, pow(max(0.0, 1.0 - d), 2.2) * vA * uAlpha);
    #include <colorspace_fragment>
  }`;

const groundVert = /* glsl */ `
  varying vec2 vP;
  void main() {
    vP = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const groundFrag = /* glsl */ `
  uniform vec3 uGlow;
  uniform float uAlpha;
  uniform float uTime;
  varying vec2 vP;
  void main() {
    float r = length(vP) / 1.45;
    float ring = smoothstep(0.05, 0.0, abs(fract(r * 4.0 - uTime * 0.08) - 0.5) - 0.44) * (1.0 - r);
    float core = exp(-r * r * 5.0);
    float a = (core * 0.55 + ring * 0.35) * smoothstep(1.0, 0.5, r);
    gl_FragColor = vec4(uGlow, a * uAlpha);
    #include <colorspace_fragment>
  }`;

export class MonumentScene extends Stage {
  private world = new Group();
  private tierMat: ShaderMaterial;
  private tiers: InstancedMesh | null = null;
  private flagMat: ShaderMaterial;
  private flags: InstancedMesh | null = null;
  private orbMat: ShaderMaterial;
  private orbMesh: InstancedMesh<IcosahedronGeometry, ShaderMaterial>;
  private halos: Points<BufferGeometry, ShaderMaterial>;
  private motes: Points<BufferGeometry, ShaderMaterial>;
  private burst: Points<BufferGeometry, ShaderMaterial>;
  private beacon: Mesh<IcosahedronGeometry, ShaderMaterial>;
  private ground: Mesh<CircleGeometry, ShaderMaterial>;
  private tmp = new Object3D();
  private v3 = new Vector3();
  private camGoal = new Vector3();

  private data: MonumentData;
  private orbs: Orb[] = [];
  private build = new Float32Array(MONUMENT_TIERS);
  private buildStart = 0;
  private fill = 0;
  private flagLevel = new Float32Array(MONUMENT_MAX_FLAGS);
  private flagCount = 0;
  private burstT = -1;
  private beaconFlash = 0;
  private yaw = -0.5;
  private yawVel = 0;
  private press: { id: number; x: number; y: number; dragging: boolean; lastX: number } | null = null;
  private labelTransform = '';

  constructor(host: HTMLElement, private opts: MonumentSceneOptions) {
    super(host, { ...opts, fov: 30 });
    const p = opts.palette;
    this.data = opts.data;
    this.tierMat = propMaterial(p, { lit: true });
    this.flagMat = propMaterial(p, { wave: true, doubleSide: true });
    if (opts.reduceMotion) this.build.fill(1);

    this.orbMat = new ShaderMaterial({
      vertexShader: orbVert,
      fragmentShader: orbFrag,
      uniforms: { uAccent: { value: p.accent.clone() }, uGlow: { value: p.glow.clone() }, uTime: { value: 0 }, uAnySel: { value: 0 } },
    });
    const orbGeo = new IcosahedronGeometry(0.058, 2);
    orbGeo.setAttribute('aSel', new InstancedBufferAttribute(new Float32Array(MONUMENT_MAX_ORBS), 1));
    orbGeo.setAttribute('aLevel', new InstancedBufferAttribute(new Float32Array(MONUMENT_MAX_ORBS), 1));
    this.orbMesh = new InstancedMesh(orbGeo, this.orbMat, MONUMENT_MAX_ORBS);
    this.orbMesh.count = 0;
    this.orbMesh.frustumCulled = false;

    const haloGeo = new BufferGeometry();
    haloGeo.setAttribute('position', new BufferAttribute(new Float32Array(MONUMENT_MAX_ORBS * 3), 3));
    haloGeo.setAttribute('aScale', new BufferAttribute(new Float32Array(MONUMENT_MAX_ORBS), 1));
    this.halos = new Points(haloGeo, this.points(pointVert, 95, p.dark ? 0.9 : 0.55));
    this.halos.frustumCulled = false;

    const moteGeo = new BufferGeometry();
    const seeds = new Float32Array(MOTES * 3);
    for (let i = 0; i < MOTES; i++) seeds.set([(i * 0.618034) % 1, (i * 0.381966 + 0.13) % 1, (i * 0.7548777 + 0.31) % 1], i * 3);
    moteGeo.setAttribute('position', new BufferAttribute(new Float32Array(MOTES * 3), 3));
    moteGeo.setAttribute('aSeed', new BufferAttribute(seeds, 3));
    this.motes = new Points(moteGeo, this.points(motesVert, 9, p.dark ? 0.7 : 0.3));
    this.motes.frustumCulled = false;

    const burstGeo = new BufferGeometry();
    const dirs = new Float32Array(BURST * 3);
    for (let i = 0; i < BURST; i++) {
      const y = 1 - ((i + 0.5) / BURST) * 2;
      const r = Math.sqrt(1 - y * y);
      dirs.set([Math.cos(i * 2.39996) * r, Math.abs(y) * 0.8 + 0.2, Math.sin(i * 2.39996) * r], i * 3);
    }
    burstGeo.setAttribute('position', new BufferAttribute(new Float32Array(BURST * 3), 3));
    burstGeo.setAttribute('aDir', new BufferAttribute(dirs, 3));
    this.burst = new Points(burstGeo, this.points(burstVert, 20, 1));
    this.burst.material.uniforms.uT = { value: -1 };
    this.burst.frustumCulled = false;
    this.burst.position.y = SUMMIT_Y + 0.25;

    this.beacon = new Mesh(new IcosahedronGeometry(0.07, 0), new ShaderMaterial({
      vertexShader: beaconVert,
      fragmentShader: orbFrag,
      uniforms: { uAccent: { value: p.accent.clone() }, uGlow: { value: p.glow.clone() }, uTime: { value: 0 }, uAnySel: { value: 0 } },
    }));
    this.beacon.position.y = SUMMIT_Y + 0.3;

    this.ground = new Mesh(new CircleGeometry(1.45, 72), new ShaderMaterial({
      vertexShader: groundVert, fragmentShader: groundFrag, transparent: true, depthWrite: false, side: DoubleSide, blending: this.blend(),
      uniforms: { uGlow: { value: p.glow.clone() }, uAlpha: { value: p.dark ? 0.8 : 0.45 }, uTime: { value: 0 } },
    }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.005;
    this.ground.renderOrder = -1;

    this.world.add(this.ground, this.orbMesh, this.halos, this.motes, this.burst, this.beacon);
    this.scene.add(this.world);

    this.listen(this.canvas, 'pointerdown', this.onDown);
    this.listen(this.canvas, 'pointermove', this.onMove);
    this.listen(this.canvas, 'pointerup', this.onUp);
    this.listen(this.canvas, 'pointercancel', () => { this.press = null; });

    this.loading = true;
    loadProps(goalsUrl).then((models) => {
      if (this.disposed) return;
      const tier = models.get('tier');
      const flag = models.get('flag');
      if (!tier || !flag) throw new Error('monument: faltan modelos');
      this.tiers = new InstancedMesh(propGeometry(tier), this.tierMat, MONUMENT_TIERS);
      this.tiers.geometry.setAttribute('aLit', new InstancedBufferAttribute(new Float32Array(MONUMENT_TIERS), 1));
      this.flags = new InstancedMesh(propGeometry(flag), this.flagMat, MONUMENT_MAX_FLAGS);
      this.flags.count = 0;
      this.flags.frustumCulled = false;
      this.world.add(this.tiers, this.flags);
      this.buildStart = this.clock;
      this.loading = false;
      this.request();
    }).catch(() => this.fail());

    this.setData(opts.data, true);
    this.start();
  }

  /* ───────── API ───────── */

  setData(data: MonumentData, first = false) {
    const prevCompleted = new Set(this.data.completedIds);
    this.data = data;
    const spots = orbSpots(data.goals);
    const byId = new Map(this.orbs.map((o) => [o.id, o]));
    const next: Orb[] = [];
    for (const s of spots) {
      const o = byId.get(s.id);
      if (o && !o.gone) {
        // Cambió de peldaño: se desliza hasta su nuevo sitio.
        Object.assign(o, { angle: s.angle, radius: s.radius, y: s.y });
        next.push(o);
        byId.delete(s.id);
      } else {
        next.push({ id: s.id, angle: s.angle, radius: s.radius, y: s.y, life: first || this.reduceMotion ? 1 : 0, gone: false, rise: -1, from: null, sel: 0 });
      }
    }
    // Las que ya no están: si se completó ahora, sube a la cima; si no (archivada), se apaga.
    for (const o of byId.values()) {
      if (o.gone) continue;
      const done = data.completedIds.includes(o.id) && !prevCompleted.has(o.id) && !first;
      o.gone = true;
      if (done && !this.reduceMotion) { o.rise = 0; o.from = { angle: o.angle, radius: o.radius, y: o.y }; }
      next.push(o);
    }
    this.orbs = next.slice(0, MONUMENT_MAX_ORBS);
    const ascending = this.orbs.filter((o) => o.rise >= 0).length;
    this.flagCount = Math.min(MONUMENT_MAX_FLAGS, Math.max(0, data.completedIds.length - ascending));
    if (first || this.reduceMotion) this.flagLevel.fill(0).fill(1, 0, this.flagCount);
    this.request();
  }

  /* ───────── Interno ───────── */

  protected applyPalette(p: PropPalette) {
    setPropPalette(this.tierMat, p);
    setPropPalette(this.flagMat, p);
    for (const m of [this.orbMat, this.beacon.material]) {
      (m.uniforms.uAccent.value as Color).copy(p.accent);
      (m.uniforms.uGlow.value as Color).copy(p.glow);
    }
    const blend = this.blend();
    for (const m of [this.halos.material, this.motes.material, this.burst.material, this.ground.material]) {
      (m.uniforms.uGlow.value as Color).copy(p.glow);
      if (m.blending !== blend) { m.blending = blend; m.needsUpdate = true; }
    }
    this.halos.material.uniforms.uAlpha.value = p.dark ? 0.9 : 0.55;
    this.motes.material.uniforms.uAlpha.value = p.dark ? 0.7 : 0.3;
    this.ground.material.uniforms.uAlpha.value = p.dark ? 0.8 : 0.45;
  }

  protected layout() {
    const vHalf = (this.camera.fov * Math.PI) / 360;
    const aspect = this.width / Math.max(1, this.height);
    const half = 1.15;
    const dist = Math.max(half / Math.tan(vHalf), 1.05 / (Math.tan(vHalf) * aspect)) + 0.9;
    this.camGoal.set(0, 0.85 + dist * 0.38, dist);
  }

  protected step(dt: number): boolean {
    const t = this.clock;
    const ambient = !this.reduceMotion;
    const k = 1 - Math.exp(-dt * 4);
    let busy = false;

    // Peldaños: suben uno tras otro al montar (la pirámide se construye).
    for (let i = 0; i < MONUMENT_TIERS; i++) {
      if (this.build[i] < 1) {
        const ready = this.clock - this.buildStart > i * 0.07;
        if (ready) this.build[i] = Math.min(1, this.build[i] + dt * 2.6);
        busy = true;
      }
    }
    const sel = this.data.goals.find((g) => g.id === this.data.selected);
    const goalFill = sel ? sel.pct : this.data.goals.length === 0 && this.data.completedIds.length > 0 ? 100 : 0;
    if (Math.abs(goalFill - this.fill) > 0.05) { this.fill += (goalFill - this.fill) * (this.reduceMotion ? 1 : k); busy = true; } else this.fill = goalFill;
    if (this.tiers) {
      const lit = this.tiers.geometry.getAttribute('aLit') as InstancedBufferAttribute;
      for (let i = 0; i < MONUMENT_TIERS; i++) {
        const b = this.build[i];
        const e = 1 - Math.pow(1 - b, 3);
        const s = tierScale(i) * (0.75 + 0.25 * e);
        this.tmp.position.set(0, i * TIER_H - (1 - e) * 0.5, 0);
        this.tmp.rotation.set(0, 0, 0);
        this.tmp.scale.set(s, 1, s);
        this.tmp.updateMatrix();
        this.tiers.setMatrixAt(i, this.tmp.matrix);
        lit.setX(i, tierFill(this.fill, i) * e);
      }
      this.tiers.instanceMatrix.needsUpdate = true;
      lit.needsUpdate = true;
      this.tierMat.uniforms.uGlow.value = 0.35 + 0.5 * (this.fill / 100);
    }

    // Núcleos: aparecen, se deslizan a su peldaño, suben a la cima o se apagan.
    const sp = this.halos.geometry.getAttribute('position') as BufferAttribute;
    const ss = this.halos.geometry.getAttribute('aScale') as BufferAttribute;
    const selAttr = this.orbMesh.geometry.getAttribute('aSel') as InstancedBufferAttribute;
    const lvlAttr = this.orbMesh.geometry.getAttribute('aLevel') as InstancedBufferAttribute;
    let n = 0;
    let arrived = false;
    this.orbs = this.orbs.filter((o) => {
      const isSel = o.id === this.data.selected && !o.gone;
      o.sel += ((isSel ? 1 : 0) - o.sel) * k;
      let angle = o.angle;
      let radius = o.radius;
      let y = o.y + (ambient ? Math.sin(t * 1.6 + o.angle * 3) * 0.02 : 0);
      if (o.rise >= 0 && o.from) {
        o.rise += dt;
        busy = true;
        const u = Math.min(1, o.rise / ASCEND_S);
        const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        angle = o.from.angle + e * Math.PI * 2.5;
        radius = o.from.radius + (0.16 - o.from.radius) * e;
        y = o.from.y + (SUMMIT_Y + 0.3 - o.from.y) * e;
        if (u >= 1) { arrived = true; return false; }
      } else if (o.gone) {
        o.life = Math.max(0, o.life - dt * 2.5);
        busy = true;
        if (o.life <= 0) return false;
      } else if (o.life < 1) {
        o.life = Math.min(1, o.life + dt * 2);
        busy = true;
      }
      if (n >= MONUMENT_MAX_ORBS) return true;
      const scale = (0.85 + 0.55 * o.sel) * (o.rise >= 0 ? 1.2 : o.life);
      this.tmp.position.set(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
      this.tmp.rotation.set(t * 0.6, t * 0.9, 0);
      this.tmp.scale.setScalar(Math.max(0.001, scale));
      this.tmp.updateMatrix();
      this.orbMesh.setMatrixAt(n, this.tmp.matrix);
      selAttr.setX(n, o.sel);
      const g = this.data.goals.find((x) => x.id === o.id);
      lvlAttr.setX(n, g ? g.pct / 100 : 1);
      sp.setXYZ(n, this.tmp.position.x, y, this.tmp.position.z);
      ss.setX(n, (0.35 + o.sel * 0.6 + (o.rise >= 0 ? 0.8 : 0)) * o.life);
      n++;
      return true;
    });
    this.orbMesh.count = n;
    this.orbMesh.instanceMatrix.needsUpdate = true;
    selAttr.needsUpdate = true;
    lvlAttr.needsUpdate = true;
    sp.needsUpdate = true;
    ss.needsUpdate = true;
    this.halos.geometry.setDrawRange(0, n);
    this.orbMat.uniforms.uAnySel.value = this.data.selected ? 1 : 0;
    this.orbMat.uniforms.uTime.value = ambient ? t : 0;

    // Llegó a la cima: chispas, destello del faro y una bandera más.
    if (arrived) {
      this.burstT = 0;
      this.beaconFlash = 1;
      const ascending = this.orbs.filter((o) => o.rise >= 0).length;
      this.flagCount = Math.min(MONUMENT_MAX_FLAGS, Math.max(0, this.data.completedIds.length - ascending));
    }
    if (this.burstT >= 0) {
      this.burstT += dt;
      busy = true;
      if (this.burstT > 1.3) this.burstT = -1;
    }
    this.burst.material.uniforms.uT.value = this.burstT;

    // Banderas en corro sobre la cima.
    if (this.flags) {
      for (let i = 0; i < MONUMENT_MAX_FLAGS; i++) {
        const goal = i < this.flagCount ? 1 : 0;
        if (Math.abs(goal - this.flagLevel[i]) > 0.002) { this.flagLevel[i] += (goal - this.flagLevel[i]) * (this.reduceMotion ? 1 : k * 0.8); busy = true; } else this.flagLevel[i] = goal;
      }
      let f = 0;
      const count = this.flagLevel.filter((v) => v > 0.01).length;
      for (let i = 0; i < MONUMENT_MAX_FLAGS; i++) {
        const level = this.flagLevel[i];
        if (level <= 0.01) continue;
        const a = (f / Math.max(1, count)) * Math.PI * 2 + 0.6;
        const r = count === 1 ? 0 : 0.075;
        this.tmp.position.set(Math.sin(a) * r, SUMMIT_Y - 0.004, Math.cos(a) * r);
        this.tmp.rotation.set(0, a + Math.PI / 2, 0);
        this.tmp.scale.set(1, level, 1);
        this.tmp.updateMatrix();
        this.flags.setMatrixAt(f++, this.tmp.matrix);
      }
      this.flags.count = f;
      this.flags.instanceMatrix.needsUpdate = true;
      this.flagMat.uniforms.uTime.value = ambient ? t : 0;
    }

    // Faro: late más con cada meta cumplida.
    this.beaconFlash = Math.max(0, this.beaconFlash - dt * 1.2);
    if (this.beaconFlash > 0) busy = true;
    const glow = Math.min(1, this.data.completedIds.length / 4);
    this.beacon.visible = this.data.completedIds.length > 0 || this.beaconFlash > 0;
    this.beacon.scale.setScalar(0.7 + glow * 0.4 + this.beaconFlash * 0.8 + (ambient ? Math.sin(t * 2.4) * 0.06 : 0));
    this.beacon.rotation.set(t * 0.5, t * 0.8, 0);
    this.beacon.position.y = SUMMIT_Y + 0.42 + (ambient ? Math.sin(t * 1.3) * 0.03 : 0);
    this.beacon.material.uniforms.uTime.value = ambient ? t : 0;

    this.motes.material.uniforms.uTime.value = ambient ? t : 0;
    this.ground.material.uniforms.uTime.value = ambient ? t : 0;

    // Giro: arrastre con inercia o vuelta lenta de ambiente.
    if (!this.press?.dragging) {
      this.yaw += this.yawVel;
      this.yawVel *= Math.pow(0.9, dt * 60);
      if (Math.abs(this.yawVel) > 0.0004) busy = true;
      if (ambient) this.yaw += dt * 0.14;
    }
    this.world.rotation.y = this.yaw;

    const cam = this.camera.position;
    if (cam.distanceToSquared(this.camGoal) > 1e-6) { cam.lerp(this.camGoal, cam.lengthSq() === 0 || this.reduceMotion ? 1 : k); busy = true; }
    this.camera.lookAt(0, 0.78, 0);
    this.placeLabel();
    return busy;
  }

  /** Lleva la etiqueta HTML sobre el núcleo de la misión elegida. */
  private placeLabel() {
    const label = this.opts.label;
    if (!label) return;
    const i = this.orbs.findIndex((o) => o.id === this.data.selected && !o.gone);
    if (i < 0 || i >= this.orbMesh.count) {
      if (label.style.opacity !== '0') label.style.opacity = '0';
      return;
    }
    const pos = this.halos.geometry.getAttribute('position') as BufferAttribute;
    this.world.updateMatrixWorld();
    this.v3.set(pos.getX(i), pos.getY(i) + 0.1, pos.getZ(i)).applyMatrix4(this.world.matrixWorld).project(this.camera);
    const x = Math.min(this.width - 70, Math.max(70, (this.v3.x * 0.5 + 0.5) * this.width));
    const y = Math.max(36, (-this.v3.y * 0.5 + 0.5) * this.height - 8);
    const transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
    if (transform !== this.labelTransform) { label.style.transform = transform; this.labelTransform = transform; }
    if (label.style.opacity !== '1') label.style.opacity = '1';
  }

  /** Núcleo más cercano al punto tocado (en píxeles; los núcleos son pequeños para el dedo). */
  private pick(clientX: number, clientY: number): string | null {
    const r = this.canvas.getBoundingClientRect();
    const pos = this.halos.geometry.getAttribute('position') as BufferAttribute;
    this.world.updateMatrixWorld();
    let best: string | null = null;
    let bestD = PICK_PX;
    this.orbs.forEach((o, i) => {
      if (o.gone || i >= this.orbMesh.count) return;
      this.v3.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(this.world.matrixWorld).project(this.camera);
      const d = Math.hypot((this.v3.x * 0.5 + 0.5) * r.width - (clientX - r.left), (-this.v3.y * 0.5 + 0.5) * r.height - (clientY - r.top));
      if (d < bestD) { bestD = d; best = o.id; }
    });
    return best;
  }

  private points(vertexShader: string, size: number, alpha: number) {
    return new ShaderMaterial({
      vertexShader,
      fragmentShader: softFrag,
      transparent: true,
      depthWrite: false,
      blending: this.blend(),
      uniforms: {
        uGlow: { value: this.palette.glow.clone() }, uAlpha: { value: alpha }, uSize: { value: size }, uTime: { value: 0 },
        uPx: { value: Math.min(window.devicePixelRatio || 1, 2) },
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
    if (!p) {
      if (e.pointerType === 'mouse') this.canvas.style.cursor = this.pick(e.clientX, e.clientY) ? 'pointer' : 'grab';
      return;
    }
    if (p.id !== e.pointerId) return;
    const dx = e.clientX - p.x;
    if (!p.dragging && Math.abs(dx) > TAP_PX && Math.abs(dx) > Math.abs(e.clientY - p.y)) {
      p.dragging = true;
      this.canvas.setPointerCapture(e.pointerId);
      this.canvas.style.cursor = 'grabbing';
    }
    if (!p.dragging) return;
    const stepX = (e.clientX - p.lastX) * 0.011;
    this.yaw += stepX;
    this.yawVel = stepX * 0.5;
    p.lastX = e.clientX;
    this.request();
  };

  private onUp = (e: PointerEvent) => {
    const p = this.press;
    this.press = null;
    if (!p || p.id !== e.pointerId) return;
    this.canvas.style.cursor = 'grab';
    if (p.dragging) { this.request(); return; }
    const id = this.pick(e.clientX, e.clientY);
    if (id) this.opts.onSelect?.(id);
  };
}
