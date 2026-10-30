// Repisa de objetos 3D que se agarran y se lanzan (hobbies de Recreación, pesas del Coliseo,
// trofeos de Logros). Los modelos vienen de Blender (props-<set>.glb) y flotan en su sitio; se
// arrastran con el ratón al instante y con el dedo en cuanto se toca un objeto (tocar el hueco
// sigue desplazando la página). Física en physics.ts: muelle elástico que los devuelve a su
// sitio, choques, rebote contra los bordes e inercia de giro; al soltarlos, además, recuperan
// poco a poco su postura de reposo.
// LOD: cada objeto es un three.LOD. Primero llega el LOD bajo (props-<set>.glb, ligero); si en
// este lienzo algún objeto se ve grande (radio > ~48 px), se pide el alto (props-<set>-hd.glb)
// y el cambio de nivel va por distancia en píxeles, recalculada al cambiar el tamaño.
// Sombras de contacto instanciadas en el suelo; ~1 draw call por objeto.
import {
  Color, Euler, Group, InstancedBufferAttribute, InstancedMesh, LOD, Mesh, Object3D, PlaneGeometry, Quaternion, Ray,
  ShaderMaterial, Sphere, Vector3,
} from 'three';
import { Stage, type StageOptions } from './stage';
import { loadProps, propGeometry, type PropData } from './models';
import { propMaterial, setPartColor, setPropPalette, type Part } from './propMaterial';
import type { PropPalette } from './palette';
import { makeBody, moving, shelfAnchors, stepBodies, type Body, type Bounds } from './physics';

export interface PropItem {
  id: string;
  /** Nombre del objeto en el .glb (sin `_lo`). */
  model: string;
  /** Tamaño relativo (1 = el de la celda). */
  size?: number;
  /** Orientación de reposo (euler XYZ, radianes). */
  rest?: [number, number, number];
  metal?: 'gold' | 'steel';
  /** Colores propios por parte en hex sRGB (p. ej. el metal de un trofeo según su rareza). */
  tint?: Partial<Record<Part, string>>;
  /** Texto de la etiqueta que aparece al pasar el cursor o al agarrarlo. */
  label?: string;
  /** Copias instanciadas pegadas al objeto (discos en la barra), en unidades del modelo. */
  attach?: { model: string; at: Array<[number, number, number]> };
  /** Giro de ambiente sobre el eje vertical (rad/s). */
  spin?: number;
}

export interface PropsSceneOptions extends StageOptions {
  url: string;
  hdUrl?: string;
  items: PropItem[];
  /** Columnas según la proporción del lienzo (ancho / alto). */
  columns?: (aspect: number) => number;
  label?: HTMLElement | null;
  onTap?: (id: string) => void;
}

interface Slot {
  item: PropItem;
  body: Body;
  group: Group;
  inner: Group;
  lod: LOD;
  mat: ShaderMaterial;
  rest: Quaternion;
  phase: number;
  size: number;
  baseY: number;
  hover: number;
  data: PropData | null;
  hi: boolean;
  placed: boolean;
}

const TAP_PX = 8;
const HI_PX = 48;

const shadowVert = /* glsl */ `
  attribute float aAlpha;
  varying vec2 vUv;
  varying float vA;
  void main() {
    vUv = uv;
    vA = aAlpha;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
  }`;

const shadowFrag = /* glsl */ `
  uniform vec3 uShade;
  varying vec2 vUv;
  varying float vA;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    gl_FragColor = vec4(uShade, pow(max(0.0, 1.0 - d), 1.8) * vA);
    #include <colorspace_fragment>
  }`;

export class PropsScene extends Stage {
  private slots: Slot[] = [];
  private bodies: Body[] = [];
  private shadows: InstancedMesh<PlaneGeometry, ShaderMaterial>;
  private bounds: Bounds = { minX: -2, maxX: 2, minY: -1, maxY: 1, minZ: -0.8, maxZ: 1 };
  private floorY = -1;
  private dist = 6;
  private ray = new Ray();
  private sphere = new Sphere();
  private v3 = new Vector3();
  private v3b = new Vector3();
  private q = new Quaternion();
  private q2 = new Quaternion();
  private tmp = new Object3D();
  private planeN = new Vector3(0, 0, 1);
  private planeD = 0;
  private press: { id: number; slot: Slot | null; x: number; y: number; t: number; moved: number; off: Vector3 } | null = null;
  private hovered: Slot | null = null;
  private labelTransform = '';
  private hdRequested = false;

  constructor(host: HTMLElement, private opts: PropsSceneOptions) {
    super(host, { ...opts, fov: 30 });
    const p = opts.palette;
    this.shadows = new InstancedMesh(new PlaneGeometry(1, 1), new ShaderMaterial({
      vertexShader: shadowVert, fragmentShader: shadowFrag, transparent: true, depthWrite: false,
      uniforms: { uShade: { value: this.shadeColor(p) } },
    }), Math.max(1, opts.items.length));
    this.shadows.geometry.setAttribute('aAlpha', new InstancedBufferAttribute(new Float32Array(Math.max(1, opts.items.length)), 1));
    this.shadows.frustumCulled = false;
    this.shadows.renderOrder = -1;
    this.scene.add(this.shadows);

    opts.items.forEach((item, i) => {
      const group = new Group();
      const inner = new Group();
      const lod = new LOD();
      inner.add(lod);
      group.add(inner);
      this.scene.add(group);
      const rest = new Quaternion().setFromEuler(new Euler(...(item.rest ?? [0, 0, 0])));
      group.quaternion.copy(rest);
      this.slots.push({
        item, body: makeBody(0, 0, 0, 0.3), group, inner, lod, mat: propMaterial(p, { metal: item.metal ?? 'gold' }),
        rest, phase: i * 1.7, size: 0.3, baseY: 0, hover: 0, data: null, hi: false, placed: false,
      });
    });
    this.slots.forEach((s) => this.applyTint(s));
    this.bodies = this.slots.map((s) => s.body);

    this.listen(this.canvas, 'pointerdown', this.onDown);
    this.listen(this.canvas, 'pointermove', this.onMove);
    this.listen(this.canvas, 'pointerup', this.onUp);
    this.listen(this.canvas, 'pointercancel', this.onCancel);
    this.listen(this.canvas, 'pointerleave', () => { if (!this.press) this.setHover(null); });
    // Con el dedo: si el toque cae en un objeto, se reclama el gesto (no se desplaza la página).
    this.listen<TouchEvent>(this.canvas, 'touchstart', (e) => {
      const t = e.touches[0];
      if (t && this.pick(t.clientX, t.clientY)) e.preventDefault();
    }, { passive: false });
    this.listen<TouchEvent>(this.canvas, 'touchmove', (e) => { if (this.press?.slot) e.preventDefault(); }, { passive: false });

    this.loading = true;
    loadProps(opts.url).then((models) => {
      if (this.disposed) return;
      for (const s of this.slots) {
        const d = models.get(s.item.model);
        if (!d) continue;
        s.data = d;
        s.lod.addLevel(new Mesh(propGeometry(d), s.mat), 0);
        if (s.item.attach) {
          const ad = models.get(s.item.attach.model);
          if (ad) s.inner.add(this.attachMesh(ad, s.item.attach.at, s.mat));
        }
      }
      this.loading = false;
      this.layout();
      this.request();
    }).catch(() => this.fail());

    this.start();
  }

  /* ───────── API ───────── */

  /** Cambia las copias pegadas a un objeto (p. ej. discos según la asistencia). */
  setAttach(id: string, at: Array<[number, number, number]>) {
    const s = this.slots.find((x) => x.item.id === id);
    if (!s?.item.attach) return;
    s.item.attach = { ...s.item.attach, at };
    const old = s.inner.children.find((c) => c instanceof InstancedMesh) as InstancedMesh | undefined;
    if (old) { s.inner.remove(old); old.geometry.dispose(); old.dispose(); }
    loadProps(this.opts.url).then((models) => {
      const ad = models.get(s.item.attach!.model);
      if (ad && !this.disposed) { s.inner.add(this.attachMesh(ad, at, s.mat)); this.request(); }
    }).catch(() => {});
    // Un pequeño salto para que se note el cambio.
    s.body.vy += 1.6;
    s.body.wy += 4;
    this.request();
  }

  /* ───────── Interno ───────── */

  private attachMesh(d: PropData, at: Array<[number, number, number]>, mat: ShaderMaterial) {
    const mesh = new InstancedMesh(propGeometry(d), mat, Math.max(1, at.length));
    mesh.count = at.length;
    at.forEach(([x, y, z], i) => {
      this.tmp.position.set(x, y, z);
      this.tmp.rotation.set(0, 0, 0);
      this.tmp.scale.setScalar(1);
      this.tmp.updateMatrix();
      mesh.setMatrixAt(i, this.tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  private shadeColor(p: PropPalette) {
    return (p.dark ? new Color(0, 0, 0) : p.shade.clone().multiplyScalar(0.6));
  }

  private applyTint(s: Slot) {
    for (const [part, hex] of Object.entries(s.item.tint ?? {})) if (hex) setPartColor(s.mat, part as Part, new Color(hex));
  }

  protected applyPalette(p: PropPalette) {
    for (const s of this.slots) { setPropPalette(s.mat, p); this.applyTint(s); }
    (this.shadows.material.uniforms.uShade.value as Color).copy(this.shadeColor(p));
  }

  protected layout() {
    const aspect = this.width / Math.max(1, this.height);
    const vHalf = (this.camera.fov * Math.PI) / 360;
    this.dist = 6;
    const halfH = Math.tan(vHalf) * this.dist;
    const halfW = halfH * aspect;
    this.camera.position.set(0, halfH * 0.22, this.dist);
    this.camera.lookAt(0, 0, 0);
    this.bounds = { minX: -halfW * 0.98, maxX: halfW * 0.98, minY: -halfH * 0.95, maxY: halfH * 1.05, minZ: -1.2, maxZ: 1.6 };
    this.floorY = -halfH * 0.92;
    const n = this.slots.length;
    const cols = Math.max(1, Math.min(n, this.opts.columns?.(aspect) ?? (aspect >= 1.7 ? n : Math.ceil(n / 2))));
    const rows = Math.ceil(n / cols);
    const cellW = (halfW * 2 * 0.9) / cols;
    const cellH = (halfH * 2 * 0.74) / rows;
    const anchors = shelfAnchors(n, halfW * 2 * 0.9, halfH * 2 * 0.74, cols);
    const pxPerUnit = this.height / 2 / halfH;
    let wantHi = false;
    this.slots.forEach((s, i) => {
      const [x, y] = anchors[i];
      s.size = Math.min(cellW, cellH) * 0.4 * (s.item.size ?? 1);
      s.baseY = y + halfH * 0.04;
      s.body.ax = x;
      s.body.az = 0;
      s.body.ay = s.baseY;
      s.body.r = s.size * 0.92;
      if (!s.data) return;
      // Primer encuadre: cada objeto aparece ya en su sitio.
      if (!s.placed) { s.placed = true; s.body.x = x; s.body.y = s.baseY; s.body.z = 0; }
      const k = s.size / s.data.radius;
      s.inner.scale.setScalar(k);
      s.inner.position.set(-s.data.center[0] * k, -s.data.center[1] * k, -s.data.center[2] * k);
      const px = s.size * pxPerUnit;
      if (px > HI_PX) wantHi = true;
      // El nivel alto se ve mientras el radio en pantalla pase de HI_PX.
      const switchAt = (s.size * (this.height / 2)) / (Math.tan(vHalf) * HI_PX);
      if (s.lod.levels.length > 1) s.lod.levels[1].distance = switchAt;
    });
    // Suelo de las sombras: justo debajo de la fila más baja.
    const low = Math.min(...this.slots.map((s) => s.baseY - s.size * 1.3));
    this.floorY = Math.max(this.bounds.minY + 0.05, Math.min(-halfH * 0.3, low));
    if (wantHi && this.opts.hdUrl && !this.hdRequested && !this.loading) this.loadHd();
  }

  private loadHd() {
    this.hdRequested = true;
    loadProps(this.opts.hdUrl!).then((models) => {
      if (this.disposed) return;
      const vHalf = (this.camera.fov * Math.PI) / 360;
      for (const s of this.slots) {
        const d = models.get(s.item.model);
        if (!d || s.hi) continue;
        s.hi = true;
        // Nivel alto a distancia 0; el bajo pasa a la distancia en la que el objeto se ve pequeño.
        const lo = s.lod.levels[0]?.object;
        if (lo) s.lod.remove(lo);
        s.lod.levels.length = 0;
        s.lod.addLevel(new Mesh(propGeometry(d), s.mat), 0);
        if (lo) s.lod.addLevel(lo, (s.size * (this.height / 2)) / (Math.tan(vHalf) * HI_PX));
      }
      this.request();
    }).catch(() => { /* sin el nivel alto se queda el bajo */ });
  }

  protected step(dt: number): boolean {
    const t = this.clock;
    const ambient = !this.reduceMotion;
    let busy = false;
    for (const s of this.slots) {
      if (!s.body.held) s.body.ay = s.baseY + (ambient ? Math.sin(t * 1.15 + s.phase) * s.size * 0.12 : 0);
    }
    stepBodies(this.bodies, dt, this.bounds);
    const alpha = this.shadows.geometry.getAttribute('aAlpha') as InstancedBufferAttribute;
    this.slots.forEach((s, i) => {
      const b = s.body;
      if (moving(b)) busy = true;
      s.group.position.set(b.x, b.y, b.z);
      // Giro: la velocidad angular de la física y, suelto, la vuelta suave a su postura (con el
      // giro de ambiente sobre el eje vertical).
      const w = Math.hypot(b.wx, b.wy, b.wz);
      if (w > 1e-4) {
        this.v3.set(b.wx / w, b.wy / w, b.wz / w);
        this.q.setFromAxisAngle(this.v3, w * dt);
        s.group.quaternion.premultiply(this.q);
      }
      if (!b.held) {
        const idle = ambient ? t * (s.item.spin ?? 0.35) + s.phase : s.phase * 0.2;
        this.q2.setFromAxisAngle(this.v3b.set(0, 1, 0), Math.sin(idle) * 0.5).multiply(s.rest);
        s.group.quaternion.slerp(this.q2, 1 - Math.exp(-dt * 1.6));
      }
      const goal = s === this.hovered || b.held ? 1 : 0;
      if (Math.abs(goal - s.hover) > 0.01) { s.hover += (goal - s.hover) * (1 - Math.exp(-dt * 10)); busy = true; } else s.hover = goal;
      s.mat.uniforms.uHover.value = s.hover;
      s.group.scale.setScalar(1 + s.hover * 0.06);
      // Sombra de contacto: se encoge y se aclara al subir.
      const lift = Math.min(1, Math.max(0, (b.y - this.floorY - s.size) / (this.bounds.maxY - this.floorY)));
      this.tmp.position.set(b.x, this.floorY, b.z);
      this.tmp.rotation.set(-Math.PI / 2, 0, 0);
      this.tmp.scale.setScalar(s.size * 2.3 * (1 - lift * 0.35));
      this.tmp.updateMatrix();
      this.shadows.setMatrixAt(i, this.tmp.matrix);
      alpha.setX(i, s.data ? (this.palette.dark ? 0.55 : 0.32) * (1 - lift * 0.7) : 0);
    });
    this.shadows.instanceMatrix.needsUpdate = true;
    alpha.needsUpdate = true;
    this.placeLabel();
    return busy;
  }

  private placeLabel() {
    const label = this.opts.label;
    if (!label) return;
    const s = this.press?.slot ?? this.hovered;
    if (!s || !s.item.label) {
      if (label.style.opacity !== '0') label.style.opacity = '0';
      return;
    }
    if (label.textContent !== s.item.label) label.textContent = s.item.label;
    this.v3.set(s.body.x, s.body.y + s.size * 1.15, s.body.z).project(this.camera);
    const x = Math.min(this.width - 60, Math.max(60, (this.v3.x * 0.5 + 0.5) * this.width));
    const y = Math.max(30, (-this.v3.y * 0.5 + 0.5) * this.height);
    const transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
    if (transform !== this.labelTransform) { label.style.transform = transform; this.labelTransform = transform; }
    if (label.style.opacity !== '1') label.style.opacity = '1';
  }

  private setRay(clientX: number, clientY: number) {
    const { x, y } = this.ndc(clientX, clientY);
    this.ray.origin.setFromMatrixPosition(this.camera.matrixWorld);
    this.ray.direction.set(x, y, 0.5).unproject(this.camera).sub(this.ray.origin).normalize();
  }

  /** El objeto bajo el puntero (esfera de cada uno, algo generosa para el dedo). */
  private pick(clientX: number, clientY: number): Slot | null {
    this.setRay(clientX, clientY);
    let best: Slot | null = null;
    let bestD = Infinity;
    for (const s of this.slots) {
      if (!s.data) continue;
      this.sphere.set(this.v3.set(s.body.x, s.body.y, s.body.z), s.size * 1.05);
      const hit = this.ray.intersectSphere(this.sphere, this.v3b);
      if (!hit) continue;
      const d = hit.distanceToSquared(this.ray.origin);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }

  /** Punto del plano de arrastre (de frente a la cámara, a la profundidad del objeto). */
  private planePoint(clientX: number, clientY: number, out: Vector3) {
    this.setRay(clientX, clientY);
    const denom = this.planeN.dot(this.ray.direction);
    if (Math.abs(denom) < 1e-6) return null;
    const tHit = -(this.planeN.dot(this.ray.origin) + this.planeD) / denom;
    return out.copy(this.ray.direction).multiplyScalar(tHit).add(this.ray.origin);
  }

  private setHover(s: Slot | null) {
    if (this.hovered === s) return;
    this.hovered = s;
    this.canvas.style.cursor = s ? 'grab' : '';
    this.request();
  }

  private onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const slot = this.pick(e.clientX, e.clientY);
    this.press = { id: e.pointerId, slot, x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, off: new Vector3() };
    if (!slot) return;
    this.canvas.setPointerCapture(e.pointerId);
    this.canvas.style.cursor = 'grabbing';
    // Plano de arrastre de frente a la cámara, por el centro del objeto.
    this.camera.getWorldDirection(this.planeN).negate();
    this.planeD = -this.planeN.dot(this.v3.set(slot.body.x, slot.body.y, slot.body.z));
    const hit = this.planePoint(e.clientX, e.clientY, this.v3b);
    if (hit) this.press.off.set(slot.body.x - hit.x, slot.body.y - hit.y, slot.body.z - hit.z);
    slot.body.held = true;
    slot.body.tx = slot.body.x;
    slot.body.ty = slot.body.y;
    slot.body.tz = slot.body.z;
    navigator.vibrate?.(6);
    this.request();
  };

  private onMove = (e: PointerEvent) => {
    const p = this.press;
    if (!p) {
      if (e.pointerType === 'mouse') this.setHover(this.pick(e.clientX, e.clientY));
      return;
    }
    if (p.id !== e.pointerId || !p.slot) return;
    p.moved = Math.max(p.moved, Math.hypot(e.clientX - p.x, e.clientY - p.y));
    const hit = this.planePoint(e.clientX, e.clientY, this.v3b);
    if (!hit) return;
    const b = p.slot.body;
    b.tx = Math.min(this.bounds.maxX - b.r, Math.max(this.bounds.minX + b.r, hit.x + p.off.x));
    b.ty = Math.min(this.bounds.maxY - b.r, Math.max(this.floorY + b.r * 0.6, hit.y + p.off.y));
    b.tz = hit.z + p.off.z;
    this.request();
  };

  private onUp = (e: PointerEvent) => {
    const p = this.press;
    this.press = null;
    if (!p || p.id !== e.pointerId || !p.slot) return;
    const s = p.slot;
    s.body.held = false;
    this.canvas.style.cursor = this.hovered ? 'grab' : '';
    // Un toque sin arrastre: el objeto da un saltito y se abre lo suyo.
    if (p.moved < TAP_PX && performance.now() - p.t < 500) {
      s.body.vy += 2.4;
      s.body.wy += 7;
      this.opts.onTap?.(s.item.id);
    }
    this.request();
  };

  private onCancel = () => {
    if (this.press?.slot) this.press.slot.body.held = false;
    this.press = null;
    this.request();
  };
}

