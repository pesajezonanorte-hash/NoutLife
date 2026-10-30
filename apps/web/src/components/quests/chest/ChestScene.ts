// Cofre de metas cumplidas (Blender, scripts/blender/props.py): cuerpo con flejes, tapa
// abovedada y candado. Mientras la misión no se completa, el cofre flota cerrado y con el
// candado puesto (un destello recorre el metal de vez en cuando). Al completarla, la escena
// cinemática: el candado tiembla, el arco salta y el candado cae; la tapa se abre con un muelle,
// el interior se enciende, sube un haz de luz y estalla la XP en chispas y gemas que caen.
// Rendimiento: gemas instanciadas, chispas y destellos en Points (~10 draw calls); con
// «Reducir movimiento», el cofre pasa abierto y quieto, sin estallido.
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, CylinderGeometry, DoubleSide, Group, IcosahedronGeometry,
  InstancedMesh, Mesh, NormalBlending, Object3D, Points, ShaderMaterial, Vector3, type Blending,
} from 'three';
import goalsUrl from '@/assets/models/props-goals.glb?url';
import { audio } from '@/lib/audio';
import { Stage, type StageOptions } from '@/components/three3d/stage';
import { loadProps, propGeometry, type PropData } from '@/components/three3d/models';
import { propMaterial, setPropPalette } from '@/components/three3d/propMaterial';
import type { PropPalette } from '@/components/three3d/palette';

export interface ChestSceneOptions extends StageOptions {
  /** Empieza ya abierto (la misión se completó antes de montar). */
  open?: boolean;
}

const SPARKS = 150;
const GEMS = 14;
const LID_OPEN = 1.92;
// Tiempos de la escena (s desde open()).
const T_UNLOCK = 0.42;
const T_DROP = 0.62;
const T_LID = 0.7;
const T_BURST = 0.86;

const sparkVert = /* glsl */ `
  attribute vec3 aDir;
  attribute float aSeed;
  uniform float uT;
  uniform float uSize;
  uniform float uPx;
  varying float vA;
  varying float vSeed;
  void main() {
    float t = max(uT, 0.0);
    float speed = 1.1 + aSeed * 1.5;
    vec3 p = aDir * speed * t * (1.0 - 0.18 * t) + vec3(0.0, -1.25 * t * t, 0.0);
    vSeed = aSeed;
    vA = step(0.0, uT) * (1.0 - smoothstep(1.0, 2.4, t)) * (0.55 + 0.45 * sin(t * 18.0 + aSeed * 40.0));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.5 + aSeed) * uPx / max(0.5, -mv.z);
  }`;

const sparkFrag = /* glsl */ `
  uniform vec3 uGlow;
  uniform vec3 uGold;
  uniform float uAlpha;
  varying float vA;
  varying float vSeed;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    // Estrella de cuatro puntas: núcleo redondo y dos destellos en cruz.
    float star = max(pow(max(0.0, 1.0 - d), 2.0), max(smoothstep(0.12, 0.0, abs(c.x)), smoothstep(0.12, 0.0, abs(c.y))) * (1.0 - d) * 0.8);
    gl_FragColor = vec4(mix(uGlow, uGold, step(0.5, vSeed)), star * vA * uAlpha);
    #include <colorspace_fragment>
  }`;

const twinkleVert = /* glsl */ `
  attribute vec3 aSeed;
  uniform float uTime;
  uniform float uOpen;
  uniform float uSize;
  uniform float uPx;
  varying float vA;
  varying float vSeed;
  void main() {
    float y = mod(aSeed.y * 1.1 + uTime * (0.12 + aSeed.z * 0.1), 1.1);
    vec3 p = vec3((aSeed.x - 0.5) * 0.7, 0.36 + y, (aSeed.z - 0.5) * 0.4);
    vSeed = aSeed.x;
    vA = uOpen * smoothstep(0.0, 0.2, y) * smoothstep(1.1, 0.6, y) * (0.5 + 0.5 * sin(uTime * 6.0 + aSeed.x * 30.0));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPx / max(0.5, -mv.z);
  }`;

const beamVert = /* glsl */ `
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

const beamFrag = /* glsl */ `
  uniform vec3 uGlow;
  uniform float uAlpha;
  varying vec3 vN;
  varying vec3 vV;
  varying float vH;
  void main() {
    float facing = abs(dot(normalize(vN), normalize(vV)));
    gl_FragColor = vec4(uGlow, pow(1.0 - vH, 1.5) * pow(facing, 1.4) * uAlpha);
    #include <colorspace_fragment>
  }`;

export class ChestScene extends Stage {
  private root = new Group();
  private lidPivot = new Group();
  private lockGroup = new Group();
  private shacklePivot = new Group();
  private bodyMat: ShaderMaterial;
  private lockMat: ShaderMaterial;
  private gemMat: ShaderMaterial;
  private gems: InstancedMesh<IcosahedronGeometry, ShaderMaterial>;
  private sparks: Points<BufferGeometry, ShaderMaterial>;
  private twinkles: Points<BufferGeometry, ShaderMaterial>;
  private beam: Mesh<CylinderGeometry, ShaderMaterial>;
  private tmp = new Object3D();
  private camGoal = new Vector3();
  private gemSeeds: Array<{ dir: Vector3; spin: Vector3; speed: number }> = [];

  /** Segundos desde open(); −1 cerrado. */
  private t = -1;
  private lid = 0;
  private lidVel = 0;
  private openLevel = 0;
  private soundsPlayed = new Set<string>();
  private lockBase = new Vector3();
  private shackleBase = new Vector3();

  constructor(host: HTMLElement, opts: ChestSceneOptions) {
    super(host, { ...opts, fov: 28 });
    const p = opts.palette;
    this.bodyMat = propMaterial(p);
    this.lockMat = propMaterial(p, { transparent: true });
    this.gemMat = propMaterial(p);

    const gemGeo = new IcosahedronGeometry(0.035, 0);
    gemGeo.setAttribute('part', new BufferAttribute(new Float32Array(gemGeo.getAttribute('position').count).fill(2), 1));
    this.gems = new InstancedMesh(gemGeo, this.gemMat, GEMS);
    this.gems.count = 0;
    this.gems.frustumCulled = false;
    for (let i = 0; i < GEMS; i++) {
      const a = i * 2.39996;
      this.gemSeeds.push({ dir: new Vector3(Math.cos(a) * 0.55, 1.6 + (i % 4) * 0.25, Math.sin(a) * 0.35), spin: new Vector3(3 + i, 2 + (i % 3), 1), speed: 0.9 + (i % 5) * 0.08 });
    }

    const sparkGeo = new BufferGeometry();
    const dirs = new Float32Array(SPARKS * 3);
    const seed = new Float32Array(SPARKS);
    for (let i = 0; i < SPARKS; i++) {
      const y = 0.35 + 0.65 * ((i * 0.618034) % 1);
      const r = Math.sqrt(1 - y * y);
      const a = i * 2.39996;
      dirs.set([Math.cos(a) * r, y, Math.sin(a) * r * 0.7], i * 3);
      seed[i] = (i * 0.7548777) % 1;
    }
    sparkGeo.setAttribute('position', new BufferAttribute(new Float32Array(SPARKS * 3), 3));
    sparkGeo.setAttribute('aDir', new BufferAttribute(dirs, 3));
    sparkGeo.setAttribute('aSeed', new BufferAttribute(seed, 1));
    this.sparks = new Points(sparkGeo, new ShaderMaterial({
      vertexShader: sparkVert, fragmentShader: sparkFrag, transparent: true, depthWrite: false, blending: this.blend(),
      uniforms: { uT: { value: -1 }, uSize: { value: 30 }, uPx: { value: Math.min(window.devicePixelRatio || 1, 2) }, uGlow: { value: p.glow.clone() }, uGold: { value: p.gold.clone() }, uAlpha: { value: 1 } },
    }));
    this.sparks.frustumCulled = false;
    this.sparks.position.set(0, 0.42, 0);

    const twGeo = new BufferGeometry();
    const tw = new Float32Array(40 * 3);
    for (let i = 0; i < 40; i++) tw.set([(i * 0.618034) % 1, (i * 0.381966 + 0.13) % 1, (i * 0.7548777 + 0.31) % 1], i * 3);
    twGeo.setAttribute('position', new BufferAttribute(new Float32Array(40 * 3), 3));
    twGeo.setAttribute('aSeed', new BufferAttribute(tw, 3));
    this.twinkles = new Points(twGeo, new ShaderMaterial({
      vertexShader: twinkleVert, fragmentShader: sparkFrag, transparent: true, depthWrite: false, blending: this.blend(),
      uniforms: { uTime: { value: 0 }, uOpen: { value: 0 }, uSize: { value: 16 }, uPx: { value: Math.min(window.devicePixelRatio || 1, 2) }, uGlow: { value: p.glow.clone() }, uGold: { value: p.gold.clone() }, uAlpha: { value: 1 } },
    }));
    this.twinkles.frustumCulled = false;

    const beamGeo = new CylinderGeometry(0.42, 0.3, 1, 32, 1, true);
    beamGeo.translate(0, 0.5, 0);
    this.beam = new Mesh(beamGeo, new ShaderMaterial({
      vertexShader: beamVert, fragmentShader: beamFrag, transparent: true, depthWrite: false, side: DoubleSide, blending: this.blend(),
      uniforms: { uGlow: { value: p.glow.clone() }, uAlpha: { value: 0 } },
    }));
    this.beam.position.y = 0.36;
    this.beam.scale.set(1, 0.001, 0.62);
    this.beam.visible = false;

    this.root.add(this.lidPivot, this.lockGroup, this.gems, this.sparks, this.twinkles, this.beam);
    this.scene.add(this.root);

    this.loading = true;
    loadProps(goalsUrl).then((models) => {
      if (this.disposed) return;
      const get = (name: string): PropData => {
        const d = models.get(name);
        if (!d) throw new Error(`chest: falta ${name}`);
        return d;
      };
      this.root.add(new Mesh(propGeometry(get('chest_body')), this.bodyMat));
      // Cada pieza móvil cuelga de un grupo en su pivote (los datos vienen en coordenadas del cofre).
      const hang = (group: Group, d: PropData, mat: ShaderMaterial) => {
        const [x, y, z] = (d.extras.pivot as [number, number, number] | undefined) ?? [0, 0, 0];
        group.position.set(x, y, z);
        const mesh = new Mesh(propGeometry(d), mat);
        mesh.position.set(-x, -y, -z);
        group.add(mesh);
        return { x, y, z };
      };
      hang(this.lidPivot, get('chest_lid'), this.bodyMat);
      const lock = hang(this.lockGroup, get('chest_lock'), this.lockMat);
      this.lockBase.set(lock.x, lock.y, lock.z);
      // El arco cuelga del grupo del candado: su pivote va relativo al candado y la malla,
      // desplazada al revés del pivote (vuelve a sus coordenadas del cofre).
      const shackle = get('chest_shackle');
      const [sx, sy, sz] = (shackle.extras.pivot as [number, number, number] | undefined) ?? [0, 0, 0];
      const sm = new Mesh(propGeometry(shackle), this.lockMat);
      sm.position.set(-sx, -sy, -sz);
      this.shacklePivot.add(sm);
      this.shacklePivot.position.set(sx - lock.x, sy - lock.y, sz - lock.z);
      this.shackleBase.copy(this.shacklePivot.position);
      this.lockGroup.add(this.shacklePivot);
      this.loading = false;
      if (opts.open) this.finish();
      this.request();
    }).catch(() => this.fail());

    if (opts.open && opts.reduceMotion) this.openLevel = 1;
    this.applyPalette(p);
    this.start();
  }

  /* ───────── API ───────── */

  /** La escena de apertura (o el cofre ya abierto con «Reducir movimiento»). */
  open() {
    if (this.t >= 0) return;
    if (this.reduceMotion) { this.finish(); audio.play('chest'); return; }
    this.t = 0;
    this.soundsPlayed.clear();
    this.request();
  }

  /* ───────── Interno ───────── */

  private finish() {
    this.t = 99;
    this.lid = LID_OPEN;
    this.lidVel = 0;
    this.openLevel = 1;
    this.lockGroup.visible = false;
    this.request();
  }

  protected applyPalette(p: PropPalette) {
    setPropPalette(this.bodyMat, p);
    setPropPalette(this.lockMat, p);
    setPropPalette(this.gemMat, p);
    const blend = this.blend();
    for (const m of [this.sparks.material, this.twinkles.material, this.beam.material]) {
      (m.uniforms.uGlow.value as Color).copy(p.glow);
      if ('uGold' in m.uniforms) (m.uniforms.uGold.value as Color).copy(p.gold);
      if (m.blending !== blend) { m.blending = blend; m.needsUpdate = true; }
    }
  }

  protected layout() {
    const vHalf = (this.camera.fov * Math.PI) / 360;
    const aspect = this.width / Math.max(1, this.height);
    const dist = Math.max(0.5 / Math.tan(vHalf), 0.62 / (Math.tan(vHalf) * aspect)) + 0.75;
    this.camGoal.set(0.85 * dist * 0.32, 0.45 + dist * 0.36, dist * 0.94);
  }

  protected step(dt: number): boolean {
    const clock = this.clock;
    const ambient = !this.reduceMotion;
    let busy = false;
    const t = this.t;

    // Cerrado: flota y un destello recorre el candado cada pocos segundos.
    this.root.position.y = ambient ? Math.sin(clock * 1.5) * 0.012 : 0;
    const glint = t < 0 && ambient ? Math.pow(Math.max(0, Math.sin(clock * 1.1)), 24) : 0;
    this.lockMat.uniforms.uFlash.value = glint * 0.8;

    if (t >= 0 && t < 99) {
      this.t += dt;
      busy = true;
      // 1. El candado tiembla.
      const shake = t < T_UNLOCK ? Math.sin(t * 70) * 0.14 * (t / T_UNLOCK) : 0;
      this.lockGroup.rotation.z = shake;
      this.lockMat.uniforms.uFlash.value = t < T_UNLOCK ? (t / T_UNLOCK) * 0.9 : Math.max(0, 0.9 - (t - T_UNLOCK) * 3);
      // 2. Clic: el arco salta y gira sobre su pata.
      if (t >= T_UNLOCK) {
        this.once('unlock', () => { audio.play('unlock'); navigator.vibrate?.(14); });
        const u = Math.min(1, (t - T_UNLOCK) / 0.18);
        this.shacklePivot.position.y = this.shackleBase.y + 0.028 * Math.sin(u * Math.PI * 0.5);
        this.shacklePivot.rotation.y = -1.7 * u;
      }
      // 3. El candado cae girando y se desvanece.
      if (t >= T_DROP) {
        const d = t - T_DROP;
        this.lockGroup.position.set(this.lockBase.x + d * 0.08, this.lockBase.y - 2.4 * d * d, this.lockBase.z + d * 0.35);
        this.lockGroup.rotation.x = d * 5;
        this.lockMat.uniforms.uOpacity.value = Math.max(0, 1 - d * 2.2);
        if (d > 0.5) this.lockGroup.visible = false;
      } else {
        this.lockGroup.position.copy(this.lockBase);
      }
      // 4. La tapa se abre con un muelle que rebota un poco.
      if (t >= T_LID) {
        this.once('lid', () => audio.play('chest'));
        const kSpring = 70;
        const damp = 9;
        this.lidVel += ((LID_OPEN - this.lid) * kSpring - this.lidVel * damp) * dt;
        this.lid += this.lidVel * dt;
        this.openLevel = Math.min(1, this.openLevel + dt * 2.2);
      }
      if (t > 3.6) this.t = 99;
    }
    this.lidPivot.rotation.x = -this.lid;

    // Interior encendido, haz de luz y destellos que suben.
    this.bodyMat.uniforms.uGlow.value = this.openLevel * 1.6 + (t >= T_LID && t < 2 ? Math.max(0, 1 - (t - T_LID)) * 1.2 : 0);
    this.beam.visible = this.openLevel > 0.01;
    this.beam.scale.y = 0.001 + this.openLevel * 1.25;
    this.beam.material.uniforms.uAlpha.value = this.openLevel * (this.palette.dark ? 0.6 : 0.35) * (t >= 0 && t < 2.4 ? 1.4 - Math.min(0.4, Math.max(0, t - 1.6)) : 1);
    this.twinkles.material.uniforms.uOpen.value = this.openLevel;
    this.twinkles.material.uniforms.uTime.value = ambient ? clock : 0;

    // 5. Estallido de XP: chispas en estrella y gemas que suben y caen.
    const burst = t >= T_BURST && t < 99 ? t - T_BURST : -1;
    this.sparks.material.uniforms.uT.value = burst;
    if (burst >= 0 && burst < 2.6) {
      let n = 0;
      for (const g of this.gemSeeds) {
        const s = burst * g.speed;
        const y = 0.4 + g.dir.y * s - 2.2 * s * s;
        if (y < -0.4) continue;
        this.tmp.position.set(g.dir.x * s, y, g.dir.z * s + 0.05);
        this.tmp.rotation.set(g.spin.x * s, g.spin.y * s, g.spin.z * s);
        this.tmp.scale.setScalar(Math.min(1, burst * 6) * (1 - Math.max(0, burst - 2) * 1.6));
        this.tmp.updateMatrix();
        this.gems.setMatrixAt(n++, this.tmp.matrix);
      }
      this.gems.count = n;
      this.gems.instanceMatrix.needsUpdate = true;
    } else if (this.gems.count) {
      this.gems.count = 0;
    }

    const cam = this.camera.position;
    if (cam.distanceToSquared(this.camGoal) > 1e-6) { cam.copy(this.camGoal); busy = true; }
    this.camera.lookAt(0, 0.34, 0);
    return busy;
  }

  private once(key: string, fn: () => void) {
    if (this.soundsPlayed.has(key)) return;
    this.soundsPlayed.add(key);
    fn();
  }

  private blend(): Blending {
    return this.palette.dark ? AdditiveBlending : NormalBlending;
  }
}
