// Escena 3D de la rosa del Jardín (three.js, sin React). La rosa, modelada en Blender
// (scripts/blender/rose.py), se mece con la brisa; al tocarla se abre o se cierra
// (morph de capullo a flor) y suelta pétalos que caen girando. Una mariposa le da
// vueltas y, si la tocas, huye y vuelve. De noche (tema oscuro) brillan luciérnagas.
// Se gira arrastrando en horizontal: en vertical la página sigue desplazándose.
// Solo dibuja mientras se ve; la brisa va a 30 fps; con «Reducir movimiento», todo
// queda quieto y el toque abre la flor sin animación.
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, DirectionalLight, DoubleSide, Float32BufferAttribute, Group,
  HemisphereLight, InstancedMesh, MathUtils, Mesh, MeshStandardMaterial, Object3D, PerspectiveCamera, Points,
  Quaternion, Raycaster, Scene, ShaderMaterial, Shape, ShapeGeometry, SRGBColorSpace, Vector2, Vector3, WebGLRenderer, type Texture,
} from 'three';
import roseUrl from '@/assets/models/rose.nlf?url';
import { decodeNlf } from './nlf';

export interface RoseSceneOptions {
  /** Apertura inicial (0 capullo, 1 abierta). */
  bloom: number;
  reduceMotion: boolean;
  dark: boolean;
  onReady?: (ok: boolean) => void;
  /** La persona abrió (true) o cerró (false) la rosa. */
  onBloom?: (open: boolean) => void;
}

const TAP_PX = 8;
const PETALS = 22;
const FIREFLIES = 14;
const HEAD = new Vector3(0, 0.385, 0);

let roseGeometry: Promise<BufferGeometry> | null = null;
/** La rosa se descarga y decodifica una vez por sesión. */
function loadRose(): Promise<BufferGeometry> {
  roseGeometry ??= fetch(roseUrl)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`rose ${r.status}`))))
    .then((buf) => {
      const m = decodeNlf(buf);
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(m.closed, 3));
      // Colores sRGB del modelo a lineal (three ilumina en lineal).
      const c = new Color();
      const lin = new Float32Array(m.color.length);
      for (let i = 0; i < m.color.length; i += 3) {
        c.setRGB(m.color[i] / 255, m.color[i + 1] / 255, m.color[i + 2] / 255, SRGBColorSpace);
        lin[i] = c.r; lin[i + 1] = c.g; lin[i + 2] = c.b;
      }
      g.setAttribute('color', new BufferAttribute(lin, 3));
      g.setIndex(new BufferAttribute(m.index, 1));
      g.computeVertexNormals();
      // Morph relativo: la flor abierta es el capullo más este desplazamiento (también en normales).
      const open = new BufferGeometry();
      open.setAttribute('position', new Float32BufferAttribute(m.open, 3));
      open.setIndex(new BufferAttribute(m.index, 1));
      open.computeVertexNormals();
      const dp = new Float32Array(m.open.length);
      const dn = new Float32Array(m.open.length);
      const n0 = g.getAttribute('normal').array;
      const n1 = open.getAttribute('normal').array;
      for (let i = 0; i < dp.length; i++) { dp[i] = m.open[i] - m.closed[i]; dn[i] = n1[i] - n0[i]; }
      open.dispose();
      g.morphTargetsRelative = true;
      g.morphAttributes.position = [new Float32BufferAttribute(dp, 3)];
      g.morphAttributes.normal = [new Float32BufferAttribute(dn, 3)];
      g.computeBoundingSphere();
      return g;
    });
  roseGeometry.catch(() => { roseGeometry = null; });
  return roseGeometry;
}

/** Pétalo suelto: forma de corazón alargado, un poco curvado. */
function petalGeometry() {
  const s = new Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.008, 0.004, 0.012, 0.014, 0.006, 0.02);
  s.bezierCurveTo(0.003, 0.023, 0.001, 0.021, 0, 0.019);
  s.bezierCurveTo(-0.001, 0.021, -0.003, 0.023, -0.006, 0.02);
  s.bezierCurveTo(-0.012, 0.014, -0.008, 0.004, 0, 0);
  const g = new ShapeGeometry(s, 6);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setZ(i, -((p.getX(i) / 0.01) ** 2) * 0.003);
  g.computeVertexNormals();
  return g;
}

/** Ala de mariposa (la otra es su espejo). */
function wingGeometry() {
  const s = new Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.012, 0.014, 0.03, 0.016, 0.028, 0.002);
  s.bezierCurveTo(0.03, -0.008, 0.016, -0.018, 0.006, -0.012);
  s.bezierCurveTo(0.003, -0.006, 0.001, -0.002, 0, 0);
  return new ShapeGeometry(s, 8);
}

function fireflyMaterial() {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uSize: { value: 22 } },
    vertexShader: /* glsl */ `
      attribute float phase;
      uniform float uTime; uniform float uSize;
      varying float vGlow;
      void main() {
        vGlow = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 1.7 + phase * 6.28));
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * vGlow / max(0.2, -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      varying float vGlow;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vGlow;
        gl_FragColor = vec4(1.0, 0.86, 0.45, a);
      }`,
  });
}

interface Petal { live: boolean; p: Vector3; v: Vector3; q: Quaternion; spin: Vector3; age: number; life: number }

export class RoseScene {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(30, 1, 0.01, 10);
  private plant = new Group();
  private rose: Mesh<BufferGeometry, MeshStandardMaterial> | null = null;
  private roseMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.52, metalness: 0, side: DoubleSide });
  private petalGeo = petalGeometry();
  private petalMat = new MeshStandardMaterial({ color: 0xc8283a, roughness: 0.55, side: DoubleSide });
  private petals: InstancedMesh;
  private petalState: Petal[] = [];
  private butterfly = new Group();
  private wingGeo = wingGeometry();
  private wingMat = new MeshStandardMaterial({ color: 0xf2a541, roughness: 0.6, side: DoubleSide });
  private wings: Mesh[] = [];
  private flee = 0;
  private fireflies: Points<BufferGeometry, ShaderMaterial>;
  private raycaster = new Raycaster();
  private ndc = new Vector2();
  private tmp = new Object3D();

  private bloom: number;
  private bloomTarget: number;
  private bloomVel = 0;
  private yaw = 0.4;
  private yawVel = 0;
  private press: { x: number; y: number; t: number; dragging: boolean; lastX: number; lastT: number } | null = null;
  private reduceMotion: boolean;
  private frame = 0;
  private last = 0;
  private clock = 0;
  private visible = typeof IntersectionObserver === 'undefined';
  private lost = false;
  private disposed = false;
  private cleanup: Array<() => void> = [];

  constructor(host: HTMLElement, private opts: RoseSceneOptions) {
    this.reduceMotion = opts.reduceMotion;
    this.bloom = this.bloomTarget = opts.bloom;
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    const canvas = this.renderer.domElement;
    canvas.style.cssText = 'display:block;width:100%;height:100%;outline:none;touch-action:pan-y;cursor:grab;-webkit-tap-highlight-color:transparent';
    host.appendChild(canvas);

    // Luz de atardecer: cielo cálido, rebote verde del pasto y un contraluz rosado que enciende los bordes.
    this.scene.add(new HemisphereLight(0xfff1dc, 0x4c7a3a, 0.75));
    const key = new DirectionalLight(0xffe2c4, 1.7);
    key.position.set(-0.6, 1.2, 0.8);
    const rim = new DirectionalLight(0xff9db0, 1.25);
    rim.position.set(0.5, 0.6, -1);
    this.scene.add(key, rim);
    this.scene.add(this.plant);

    this.petals = new InstancedMesh(this.petalGeo, this.petalMat, PETALS);
    this.petals.count = 0;
    this.petals.frustumCulled = false;
    this.scene.add(this.petals);
    for (let i = 0; i < PETALS; i++) this.petalState.push({ live: false, p: new Vector3(), v: new Vector3(), q: new Quaternion(), spin: new Vector3(), age: 0, life: 1 });

    for (const side of [1, -1]) {
      const w = new Mesh(this.wingGeo, this.wingMat);
      w.scale.x = side;
      this.wings.push(w);
      this.butterfly.add(w);
    }
    this.scene.add(this.butterfly);

    const fly = new BufferGeometry();
    const pos = new Float32Array(FIREFLIES * 3);
    const phase = new Float32Array(FIREFLIES);
    for (let i = 0; i < FIREFLIES; i++) {
      const a = (i / FIREFLIES) * Math.PI * 2;
      const r = 0.07 + ((i * 37) % 11) / 110;
      pos.set([Math.cos(a) * r, 0.3 + ((i * 53) % 17) / 110, Math.sin(a) * r], i * 3);
      phase[i] = ((i * 71) % 13) / 13;
    }
    fly.setAttribute('position', new BufferAttribute(pos, 3));
    fly.setAttribute('phase', new BufferAttribute(phase, 1));
    this.fireflies = new Points(fly, fireflyMaterial());
    this.fireflies.visible = opts.dark;
    this.scene.add(this.fireflies);

    this.listen(canvas, 'pointerdown', this.onDown);
    this.listen(canvas, 'pointermove', this.onMove);
    this.listen(canvas, 'pointerup', this.onUp);
    this.listen(canvas, 'pointercancel', () => { this.press = null; });
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
    const r = host.getBoundingClientRect();
    this.resize(r.width, r.height);

    loadRose().then((g) => {
      if (this.disposed) return;
      this.rose = new Mesh(g, this.roseMat);
      this.rose.morphTargetInfluences = [this.bloom];
      this.plant.add(this.rose);
      this.request();
      this.opts.onReady?.(true);
    }, () => { if (!this.disposed) this.opts.onReady?.(false); });
  }

  /* ───────── API ───────── */

  setDark(dark: boolean) {
    this.fireflies.visible = dark;
    this.request();
  }

  setReduceMotion(reduce: boolean) {
    this.reduceMotion = reduce;
    this.request();
  }

  /** Abre o cierra la rosa (botón accesible o toque en la flor). */
  toggle() {
    this.bloomTarget = this.bloomTarget > 0.5 ? 0.12 : 1;
    if (this.bloomTarget > 0.5) this.burst(HEAD.clone().add(new Vector3(0, 0.03, 0)), 9);
    if (this.reduceMotion) this.bloom = this.bloomTarget;
    this.opts.onBloom?.(this.bloomTarget > 0.5);
    this.request();
  }

  get isOpen() { return this.bloomTarget > 0.5; }

  dispose() {
    this.disposed = true;
    this.stop();
    this.cleanup.forEach((fn) => fn());
    const props = this.renderer.properties.get(this.roseMat) as { uniforms?: { dfgLUT?: { value: Texture | null } } };
    props.uniforms?.dfgLUT?.value?.dispose();
    this.rose?.geometry.dispose(); // solo los búferes de GPU: la geometría queda para el próximo montaje
    [this.roseMat, this.petalMat, this.wingMat, this.fireflies.material].forEach((m) => m.dispose());
    [this.petalGeo, this.wingGeo, this.fireflies.geometry].forEach((g) => g.dispose());
    this.petals.dispose();
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  /* ───────── Bucle ───────── */

  private request = () => {
    if (this.frame || !this.visible || this.lost || document.hidden || this.disposed) return;
    this.frame = requestAnimationFrame(this.tick);
  };

  private stop() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private busy() {
    return Math.abs(this.bloomTarget - this.bloom) > 0.002 || Math.abs(this.bloomVel) > 0.002 || Math.abs(this.yawVel) > 0.0005
      || this.press?.dragging || this.petalState.some((p) => p.live);
  }

  private tick = (now: number) => {
    this.frame = 0;
    const ambient = !this.reduceMotion;
    const busy = this.busy();
    // La brisa sola va a 30 fps; abrir, girar o pétalos en el aire, a 60.
    if (!busy && ambient && now - this.last < 32) { this.request(); return; }
    const dt = Math.min(0.05, this.last ? (now - this.last) / 1000 : 0.016);
    this.last = now;
    this.clock += dt;
    this.step(dt, ambient);
    this.renderer.render(this.scene, this.camera);
    if (busy || ambient) this.request();
  };

  private step(dt: number, ambient: boolean) {
    // Apertura con muelle (un poco de rebote al terminar de abrir).
    if (this.reduceMotion) this.bloom = this.bloomTarget;
    else {
      const k = 34;
      const c = 9.5;
      this.bloomVel += ((this.bloomTarget - this.bloom) * k - this.bloomVel * c) * dt;
      this.bloom += this.bloomVel * dt;
    }
    if (this.rose?.morphTargetInfluences) this.rose.morphTargetInfluences[0] = MathUtils.clamp(this.bloom, 0, 1.06);

    // Giro con inercia; la brisa mece la planta.
    if (!this.press?.dragging) { this.yaw += this.yawVel; this.yawVel *= 0.93; }
    const t = this.clock;
    const sway = ambient ? Math.sin(t * 1.3) * 0.035 + Math.sin(t * 0.47) * 0.02 : 0;
    this.plant.rotation.set(sway * 0.4, this.yaw + (ambient ? Math.sin(t * 0.21) * 0.08 : 0), sway);

    // Mariposa: vuela en un lazo alrededor de la flor; asustada, se aleja y vuelve.
    this.flee = Math.max(0, this.flee - dt * 0.45);
    const r = 0.085 + this.flee * 0.22;
    const a = t * (0.55 + this.flee * 1.6);
    this.butterfly.position.set(Math.cos(a) * r, HEAD.y + 0.035 + Math.sin(t * 1.9) * 0.012 + this.flee * 0.06, Math.sin(a) * r);
    this.butterfly.rotation.set(0.25, -a + Math.PI, 0);
    const flap = ambient ? Math.sin(t * (14 + this.flee * 10)) * 0.9 : 0.4;
    this.wings[0].rotation.y = flap;
    this.wings[1].rotation.y = -flap;

    // Pétalos sueltos: caen con algo de viento, giran y se desvanecen.
    let n = 0;
    for (const p of this.petalState) {
      if (!p.live) continue;
      p.age += dt;
      if (p.age > p.life) { p.live = false; continue; }
      p.v.y -= 0.035 * dt;
      p.v.x += Math.sin(t * 2 + p.life * 9) * 0.004 * dt;
      p.v.multiplyScalar(0.985);
      p.p.addScaledVector(p.v, dt);
      const spin = new Quaternion().setFromAxisAngle(p.spin.clone().normalize(), p.spin.length() * dt);
      p.q.multiply(spin);
      const fade = 1 - Math.max(0, (p.age - p.life * 0.7) / (p.life * 0.3));
      this.tmp.position.copy(p.p);
      this.tmp.quaternion.copy(p.q);
      this.tmp.scale.setScalar(fade);
      this.tmp.updateMatrix();
      this.petals.setMatrixAt(n++, this.tmp.matrix);
    }
    this.petals.count = n;
    this.petals.instanceMatrix.needsUpdate = true;

    (this.fireflies.material.uniforms.uTime as { value: number }).value = t;
    this.fireflies.rotation.y = t * 0.05;
  }

  private burst(at: Vector3, count: number) {
    if (this.reduceMotion) return;
    let made = 0;
    for (const p of this.petalState) {
      if (p.live || made >= count) continue;
      made++;
      const a = Math.random() * Math.PI * 2;
      p.live = true;
      p.age = 0;
      p.life = 2.2 + Math.random() * 1.4;
      p.p.copy(at).add(new Vector3(Math.cos(a) * 0.02, Math.random() * 0.01, Math.sin(a) * 0.02));
      p.v.set(Math.cos(a) * (0.04 + Math.random() * 0.05), 0.05 + Math.random() * 0.05, Math.sin(a) * (0.04 + Math.random() * 0.05));
      p.q.setFromAxisAngle(new Vector3(Math.random(), Math.random(), Math.random()).normalize(), Math.random() * Math.PI);
      p.spin.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(9);
    }
    this.request();
  }

  /* ───────── Puntero: arrastre horizontal gira, toque abre o asusta ───────── */

  private onDown = (e: PointerEvent) => {
    this.press = { x: e.clientX, y: e.clientY, t: e.timeStamp, dragging: false, lastX: e.clientX, lastT: e.timeStamp };
  };

  private onMove = (e: PointerEvent) => {
    const p = this.press;
    if (!p) return;
    const dx = e.clientX - p.x;
    if (!p.dragging && Math.abs(dx) > TAP_PX && Math.abs(dx) > Math.abs(e.clientY - p.y)) {
      p.dragging = true;
      this.renderer.domElement.style.cursor = 'grabbing';
    }
    if (!p.dragging) return;
    const step = (e.clientX - p.lastX) * 0.012;
    this.yaw += step;
    this.yawVel = step * 0.6;
    p.lastX = e.clientX;
    p.lastT = e.timeStamp;
    this.request();
  };

  private onUp = (e: PointerEvent) => {
    const p = this.press;
    this.press = null;
    this.renderer.domElement.style.cursor = 'grab';
    if (!p || p.dragging || Math.hypot(e.clientX - p.x, e.clientY - p.y) > TAP_PX) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    if (this.raycaster.intersectObjects(this.wings, false).length) { this.flee = 1; this.request(); return; }
    const hit = this.rose ? this.raycaster.intersectObject(this.rose, false)[0] : undefined;
    if (hit) this.toggle();
    else this.burst(this.raycaster.ray.at(0.42, new Vector3()), 4);
  };

  private resize(w: number, h: number) {
    if (w < 1 || h < 1) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // La flor y un poco de tallo; en un lienzo estrecho, la cámara se aleja.
    const dist = 0.3 / Math.min(1, this.camera.aspect * 0.9);
    this.camera.position.set(0, HEAD.y + dist * 0.42, dist);
    this.camera.lookAt(0, HEAD.y - 0.012, 0);
    this.camera.updateProjectionMatrix();
    this.request();
  }

  private listen<E extends Event>(target: EventTarget, type: string, fn: (e: E) => void) {
    target.addEventListener(type, fn as EventListener);
    this.cleanup.push(() => target.removeEventListener(type, fn as EventListener));
  }
}
