// Flujo de caja del mes en 3D: una barra extruida por día sobre una placa de vidrio; lo que entró
// sube (color de éxito) y lo que salió baja (color de error), con cantos de neón. Encima flota
// la moneda de NoutLife (Blender, scripts/blender/props.py) que gira despacio y da la vuelta al
// tocarla. Se gira arrastrando en horizontal; pasar el cursor o tocar una barra la elige.
// Rendimiento: todas las barras son un InstancedMesh (2 por día, ~62 como mucho); placa,
// moneda y halo: ~5 draw calls. Sin texturas: el canto se dibuja con las UV de cada cara.
import {
  BoxGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh, Mesh, Object3D, ShaderMaterial, Vector3,
} from 'three';
import financeUrl from '@/assets/models/props-finance.glb?url';
import financeHdUrl from '@/assets/models/props-finance-hd.glb?url';
import { Stage, type StageOptions } from '@/components/three3d/stage';
import { loadProps, propGeometry } from '@/components/three3d/models';
import { propMaterial, setPropPalette } from '@/components/three3d/propMaterial';
import type { PropPalette } from '@/components/three3d/palette';
import { barHeights, type CashDay } from '../cashflowMath';

export interface CashflowSceneOptions extends StageOptions {
  days: CashDay[];
  label?: HTMLElement | null;
  onPick?: (index: number | null) => void;
}

const MAX_DAYS = 31;
const STEP = 0.13;
const H = 1.05;
const TAP_PX = 8;

const barVert = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSel;
  varying vec3 vN;
  varying vec3 vV;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vSel;
  varying float vY;
  void main() {
    vUv = uv;
    vColor = aColor;
    vSel = aSel;
    vY = position.y;
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

// Vidrio de color: cuerpo con luz principal, canto de neón (por las UV de cada cara), brillo en la
// punta de la barra y fresnel; la elegida late y las demás se apagan un poco.
const barFrag = /* glsl */ `
  uniform float uDark;
  uniform float uAnySel;
  uniform float uTime;
  varying vec3 vN;
  varying vec3 vV;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vSel;
  varying float vY;
  void main() {
    vec3 n = normalize(vN);
    vec3 v = normalize(vV);
    float key = max(dot(n, normalize(vec3(-0.4, 0.8, 0.6))), 0.0);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 2.2);
    float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    float edge = smoothstep(0.09, 0.0, e);
    vec3 col = vColor * (0.42 + 0.5 * key) * mix(1.0, 0.8, uDark);
    col += mix(vColor, vec3(1.0), 0.35) * edge * mix(0.35, 0.8, uDark);
    col += vColor * fres * mix(0.25, 0.7, uDark);
    col += vColor * smoothstep(0.35, 0.5, abs(vY)) * 0.25;
    col *= mix(1.0, 0.5, uAnySel * (1.0 - vSel));
    col += mix(vColor, vec3(1.0), 0.4) * vSel * (0.2 + 0.12 * sin(uTime * 5.0));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

const plateVert = /* glsl */ `
  varying vec3 vP;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vP = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const plateFrag = /* glsl */ `
  uniform vec3 uBody;
  uniform vec3 uGlow;
  uniform float uDark;
  uniform float uHalfW;
  uniform float uStep;
  varying vec3 vP;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
    float gx = abs(fract(vP.x / uStep + 0.5) - 0.5) * uStep;
    float grid = smoothstep(0.006, 0.0, gx) * 0.35;
    float rim = smoothstep(uHalfW - 0.06, uHalfW, abs(vP.x)) + smoothstep(0.22, 0.3, abs(vP.z));
    vec3 col = mix(uBody, uGlow, clamp(grid + rim * 0.5 + fres * 0.4, 0.0, 1.0));
    gl_FragColor = vec4(col, mix(0.55, 0.42, uDark) + grid * 0.3 + rim * 0.2);
    #include <colorspace_fragment>
  }`;

export class CashflowScene extends Stage {
  private world = new Group();
  private bars: InstancedMesh<BoxGeometry, ShaderMaterial>;
  private plate: Mesh<BoxGeometry, ShaderMaterial>;
  private coinGroup = new Group();
  private coinMat: ShaderMaterial;
  private tmp = new Object3D();
  private v3 = new Vector3();
  private camGoal = new Vector3();
  private days: CashDay[] = [];
  private heights: Array<{ up: number; down: number }> = [];
  private grow = 0;
  private selected = -1;
  private yaw = -0.28;
  private yawVel = 0;
  private flip = 0;
  private flipVel = 0;
  private flipGoal = 0;
  private press: { id: number; x: number; y: number; dragging: boolean; lastX: number } | null = null;
  private labelTransform = '';
  private success: Color;
  private error: Color;

  constructor(host: HTMLElement, private opts: CashflowSceneOptions) {
    super(host, { ...opts, fov: 28 });
    const p = opts.palette;
    this.success = p.paints[2].clone();
    this.error = p.paints[0].clone();
    const box = new BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    box.setAttribute('aColor', new InstancedBufferAttribute(new Float32Array(MAX_DAYS * 2 * 3), 3));
    box.setAttribute('aSel', new InstancedBufferAttribute(new Float32Array(MAX_DAYS * 2), 1));
    this.bars = new InstancedMesh(box, new ShaderMaterial({
      vertexShader: barVert, fragmentShader: barFrag,
      uniforms: { uDark: { value: p.dark ? 1 : 0 }, uAnySel: { value: 0 }, uTime: { value: 0 } },
    }), MAX_DAYS * 2);
    this.bars.count = 0;
    this.bars.frustumCulled = false;

    this.plate = new Mesh(new BoxGeometry(1, 0.025, 0.6), new ShaderMaterial({
      vertexShader: plateVert, fragmentShader: plateFrag, transparent: true, depthWrite: false,
      uniforms: { uBody: { value: p.body.clone() }, uGlow: { value: p.glow.clone() }, uDark: { value: p.dark ? 1 : 0 }, uHalfW: { value: 1 }, uStep: { value: STEP } },
    }));
    this.plate.renderOrder = 1;
    this.coinMat = propMaterial(p);
    this.world.add(this.bars, this.plate, this.coinGroup);
    this.scene.add(this.world);
    if (opts.reduceMotion) this.grow = 1;

    this.listen(this.canvas, 'pointerdown', this.onDown);
    this.listen(this.canvas, 'pointermove', this.onMove);
    this.listen(this.canvas, 'pointerup', this.onUp);
    this.listen(this.canvas, 'pointercancel', () => { this.press = null; });
    this.listen(this.canvas, 'pointerleave', () => { if (!this.press) this.pickDay(null); });

    this.loading = true;
    // La moneda es grande en pantalla: LOD alto si el lienzo pasa de ~260 px de alto.
    const url = (host.getBoundingClientRect().height || 300) > 260 ? financeHdUrl : financeUrl;
    loadProps(url).then((models) => {
      if (this.disposed) return;
      const coin = models.get('coin');
      if (coin) {
        const mesh = new Mesh(propGeometry(coin), this.coinMat);
        const k = 0.34 / coin.radius;
        mesh.scale.setScalar(k);
        mesh.position.set(-coin.center[0] * k, -coin.center[1] * k, -coin.center[2] * k);
        this.coinGroup.add(mesh);
      }
      this.loading = false;
      this.request();
    }).catch(() => this.fail());

    this.setDays(opts.days);
    this.start();
  }

  /* ───────── API ───────── */

  setDays(days: CashDay[]) {
    this.days = days.slice(-MAX_DAYS);
    this.heights = barHeights(this.days);
    if (!this.reduceMotion) this.grow = 0;
    if (this.selected >= this.days.length) this.selected = -1;
    const n = this.days.length;
    const halfW = (n * STEP) / 2 + 0.12;
    this.plate.scale.x = halfW * 2;
    this.plate.material.uniforms.uHalfW.value = halfW;
    this.layout();
    this.camera.updateProjectionMatrix();
    this.paintColors();
    this.request();
  }

  /* ───────── Interno ───────── */

  protected applyPalette(p: PropPalette) {
    this.success.copy(p.paints[2]);
    this.error.copy(p.paints[0]);
    this.bars.material.uniforms.uDark.value = p.dark ? 1 : 0;
    const pu = this.plate.material.uniforms;
    (pu.uBody.value as Color).copy(p.body);
    (pu.uGlow.value as Color).copy(p.glow);
    pu.uDark.value = p.dark ? 1 : 0;
    setPropPalette(this.coinMat, p);
    this.paintColors();
  }

  protected layout() {
    const n = Math.max(7, this.days.length);
    const halfW = (n * STEP) / 2 + 0.35;
    const vHalf = (this.camera.fov * Math.PI) / 360;
    const aspect = this.width / Math.max(1, this.height);
    // Alto: de la barra más baja (−0,63) a la moneda (~1,6); ancho: todos los días.
    const dist = Math.max(1.05 / Math.tan(vHalf), halfW / (Math.tan(vHalf) * aspect)) + 0.3;
    this.camGoal.set(0, 0.45 + dist * 0.26, dist);
  }

  private paintColors() {
    const col = this.bars.geometry.getAttribute('aColor') as InstancedBufferAttribute;
    for (let i = 0; i < this.days.length; i++) {
      col.setXYZ(i * 2, this.success.r, this.success.g, this.success.b);
      col.setXYZ(i * 2 + 1, this.error.r, this.error.g, this.error.b);
    }
    col.needsUpdate = true;
  }

  protected step(dt: number): boolean {
    const t = this.clock;
    const ambient = !this.reduceMotion;
    let busy = false;
    if (this.grow < 1) { this.grow = Math.min(1, this.grow + dt * 1.4); busy = true; }
    const n = this.days.length;
    const sel = this.bars.geometry.getAttribute('aSel') as InstancedBufferAttribute;
    let count = 0;
    for (let i = 0; i < n; i++) {
      // Las barras crecen de izquierda a derecha al montar.
      const g = Math.min(1, Math.max(0, this.grow * 1.6 - (i / Math.max(1, n)) * 0.6));
      const e = 1 - Math.pow(1 - g, 3);
      const x = (i - (n - 1) / 2) * STEP;
      const z = -Math.pow(x * 0.32, 2);
      const { up, down } = this.heights[i];
      this.tmp.rotation.set(0, 0, 0);
      this.tmp.position.set(x, 0.013, z);
      this.tmp.scale.set(STEP * 0.62, Math.max(0.004, up * H * e), 0.16);
      this.tmp.updateMatrix();
      this.bars.setMatrixAt(count, this.tmp.matrix);
      sel.setX(count++, i === this.selected ? 1 : 0);
      this.tmp.position.set(x, -0.013 - Math.max(0.004, down * H * 0.6 * e), z);
      this.tmp.scale.set(STEP * 0.62, Math.max(0.004, down * H * 0.6 * e), 0.16);
      this.tmp.updateMatrix();
      this.bars.setMatrixAt(count, this.tmp.matrix);
      sel.setX(count++, i === this.selected ? 1 : 0);
    }
    this.bars.count = count;
    this.bars.instanceMatrix.needsUpdate = true;
    sel.needsUpdate = true;
    this.bars.material.uniforms.uAnySel.value = this.selected >= 0 ? 1 : 0;
    this.bars.material.uniforms.uTime.value = ambient ? t : 0;

    // Moneda: flota sobre el último día, gira despacio y da una vuelta entera al tocarla.
    const halfW = (n * STEP) / 2;
    this.coinGroup.position.set(Math.min(halfW + 0.05, 1.6), 1.25 + (ambient ? Math.sin(t * 1.4) * 0.05 : 0), 0.15);
    this.flipVel += ((this.flipGoal - this.flip) * 60 - this.flipVel * 9) * dt;
    this.flip += this.flipVel * dt;
    if (Math.abs(this.flipGoal - this.flip) > 0.002 || Math.abs(this.flipVel) > 0.01) busy = true;
    this.coinGroup.rotation.set(this.flip, ambient ? t * 0.7 : 0.5, 0.12);

    if (!this.press?.dragging) {
      this.yaw += this.yawVel;
      this.yawVel *= Math.pow(0.9, dt * 60);
      // Vuelve despacio a su ángulo de reposo.
      this.yaw += (-0.28 - this.yaw) * (1 - Math.exp(-dt * 0.8));
      if (Math.abs(this.yawVel) > 0.0004 || Math.abs(this.yaw + 0.28) > 0.002) busy = true;
    }
    this.world.rotation.y = this.yaw + (ambient ? Math.sin(t * 0.35) * 0.06 : 0);

    const cam = this.camera.position;
    if (cam.distanceToSquared(this.camGoal) > 1e-6) { cam.lerp(this.camGoal, cam.lengthSq() === 0 || this.reduceMotion ? 1 : 1 - Math.exp(-dt * 5)); busy = true; }
    this.camera.lookAt(0, 0.22, 0);
    this.placeLabel();
    return busy;
  }

  private placeLabel() {
    const label = this.opts.label;
    if (!label) return;
    if (this.selected < 0) {
      if (label.style.opacity !== '0') label.style.opacity = '0';
      return;
    }
    const n = this.days.length;
    const x = (this.selected - (n - 1) / 2) * STEP;
    this.world.updateMatrixWorld();
    this.v3.set(x, this.heights[this.selected].up * H + 0.12, -Math.pow(x * 0.32, 2)).applyMatrix4(this.world.matrixWorld).project(this.camera);
    const sx = Math.min(this.width - 80, Math.max(80, (this.v3.x * 0.5 + 0.5) * this.width));
    const sy = Math.max(34, (-this.v3.y * 0.5 + 0.5) * this.height);
    const transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
    if (transform !== this.labelTransform) { label.style.transform = transform; this.labelTransform = transform; }
    if (label.style.opacity !== '1') label.style.opacity = '1';
  }

  /** Día bajo el puntero: la columna más cercana en pantalla (las barras son finas para el dedo). */
  private dayAt(clientX: number, clientY: number): number {
    const r = this.canvas.getBoundingClientRect();
    const n = this.days.length;
    this.world.updateMatrixWorld();
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * STEP;
      this.v3.set(x, 0, -Math.pow(x * 0.32, 2)).applyMatrix4(this.world.matrixWorld).project(this.camera);
      const d = Math.abs((this.v3.x * 0.5 + 0.5) * r.width - (clientX - r.left));
      if (d < bestD) { bestD = d; best = i; }
    }
    const coinHit = this.coinHit(clientX, clientY);
    if (coinHit) return -2;
    return bestD < Math.max(14, (r.width / Math.max(1, n)) * 0.6) ? best : -1;
  }

  private coinHit(clientX: number, clientY: number) {
    const r = this.canvas.getBoundingClientRect();
    this.world.updateMatrixWorld();
    this.v3.copy(this.coinGroup.position).applyMatrix4(this.world.matrixWorld).project(this.camera);
    return Math.hypot((this.v3.x * 0.5 + 0.5) * r.width - (clientX - r.left), (-this.v3.y * 0.5 + 0.5) * r.height - (clientY - r.top)) < 46;
  }

  private pickDay(i: number | null) {
    const next = i ?? -1;
    if (next === this.selected) return;
    this.selected = next;
    this.opts.onPick?.(next >= 0 ? next : null);
    this.request();
  }

  private onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.press = { id: e.pointerId, x: e.clientX, y: e.clientY, dragging: false, lastX: e.clientX };
  };

  private onMove = (e: PointerEvent) => {
    const p = this.press;
    if (!p) {
      if (e.pointerType === 'mouse') {
        const i = this.dayAt(e.clientX, e.clientY);
        this.canvas.style.cursor = i === -2 || i >= 0 ? 'pointer' : 'grab';
        if (i >= 0) this.pickDay(i);
      }
      return;
    }
    if (p.id !== e.pointerId) return;
    const dx = e.clientX - p.x;
    if (!p.dragging && Math.abs(dx) > TAP_PX && Math.abs(dx) > Math.abs(e.clientY - p.y)) {
      p.dragging = true;
      this.canvas.setPointerCapture(e.pointerId);
    }
    if (!p.dragging) return;
    const s = (e.clientX - p.lastX) * 0.008;
    this.yaw = Math.max(-1, Math.min(1, this.yaw + s));
    this.yawVel = s * 0.5;
    p.lastX = e.clientX;
    this.request();
  };

  private onUp = (e: PointerEvent) => {
    const p = this.press;
    this.press = null;
    if (!p || p.id !== e.pointerId || p.dragging) { this.request(); return; }
    const i = this.dayAt(e.clientX, e.clientY);
    if (i === -2) { this.flipGoal += Math.PI * 2; navigator.vibrate?.(8); this.request(); return; }
    this.pickDay(i >= 0 && i !== this.selected ? i : null);
  };
}
