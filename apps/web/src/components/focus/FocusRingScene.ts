// Aro de enfoque: una sola figura continua de vidrio esmerilado (scripts/blender/calm.py, juego
// focus). Mientras corre el tiempo no solo se llena: respira con la animación focus_breath del
// .glb (5,5 respiraciones por minuto) y una ola lenta le da la vuelta (flow_a y flow_b en
// cuadratura), así el reflejo fluye sin que nada gire ni distraiga. En pausa el aliento se
// aquieta y deja de dibujar; con «Reducir movimiento» solo avanza la luz del progreso.
import { BackSide, Color, FrontSide, Group, Mesh, RepeatWrapping, ShaderMaterial, Texture, Vector3, type BufferGeometry } from 'three';
import focusUrl from '@/assets/models/calm-focus.glb?url';
import { Stage, type StageOptions } from '@/components/three3d/stage';
import { calmGeometry, calmNormalBitmap, clipLength, loadCalm, sampleClip } from '@/components/three3d/calmModels';
import { KEY_LIGHT, morphVertex, readCalmTones, setWeights, studioChunk, studioUniforms } from '@/components/three3d/calmMaterial';
import type { GlbClip } from '@/components/three3d/glb';
import type { PropPalette } from '@/components/three3d/palette';

export type FocusRingState = 'idle' | 'running' | 'paused' | 'done';

const TILT = (15 * Math.PI) / 180;
/** Radio máximo del aro con el pecho lleno: el encuadre lo deja dentro del lienzo. */
const FRAME = 1.2;
const FOV = 18;
/** Segundos para entrar en la respiración o aquietarse. */
const SETTLE = 1.4;

const frag = /* glsl */ `
  ${studioChunk}
  uniform vec3 uGlass;
  uniform vec3 uCore;
  uniform vec3 uDeep;
  uniform float uProgress;
  uniform float uDone;
  uniform float uBack;

  void main() {
    vec3 v = normalize(vV);
    vec3 n = surfaceNormal();
    float ndv = max(dot(n, v), 0.0);
    float fres = pow(1.0 - ndv, 2.2);

    // La luz del progreso va por dentro del tubo, en sentido horario desde las 12.
    float u = vUv.x;
    float soft = 0.006 + 0.012 * (1.0 - uDone);
    float lit = uProgress <= 0.0005 ? 0.0 : smoothstep(uProgress + soft, uProgress - soft, u) * mix(smoothstep(0.0, 0.012, u), 1.0, uDone);
    // Donde el tubo mira de frente hay más vidrio por el que pasa la luz.
    float depth = pow(ndv, 1.25);
    vec3 inner = mix(uDeep, uCore, depth);
    float head = uProgress <= 0.0005 ? 0.0 : exp(-pow((u - uProgress) / 0.028, 2.0)) * (1.0 - uDone);

    if (uBack > 0.5) {
      // Cara de atrás: lo que se adivina a través del vidrio.
      vec3 col = mix(uGlass * 0.86, inner, lit * 0.8);
      gl_FragColor = vec4(col, (0.2 + 0.25 * fres) + lit * 0.25);
      #include <colorspace_fragment>
      return;
    }

    vec3 col = clayLight(uGlass, n, v, 0.85);
    col = mix(col, inner * (0.9 + 0.22 * depth), lit * (0.5 + 0.42 * depth));
    col += uCore * head * 0.18;
    // El canto del vidrio junta la luz: una línea clara y fina en el contorno.
    col += mix(vec3(1.0), uCore, 0.45 + 0.4 * uDark) * pow(1.0 - ndv, 5.0) * (0.34 + 0.2 * uDark);
    // El vidrio deja ver el fondo en el centro del tubo y se vuelve lechoso en los bordes.
    float alpha = mix(0.58 - 0.16 * uDark, 0.94, fres);
    alpha = mix(alpha, 0.96, lit * 0.7);
    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
  }`;

export interface FocusRingOptions extends StageOptions {
  state: FocusRingState;
  progress: number;
  /** Descanso del Pomodoro: la luz toma el color de éxito del tema. */
  rest?: boolean;
}

export class FocusRingScene extends Stage {
  private group = new Group();
  private front: ShaderMaterial;
  private back: ShaderMaterial;
  private breath: GlbClip | null = null;
  private flowPeriod = 26;
  private map: Texture | null = null;
  private state: FocusRingState;
  private rest: boolean;
  private target: number;
  private progress: number;
  private amount = 0;
  private breathT = 0;
  private flowT = 0;
  private done = 0;
  private w: number[] = [0, 0, 0, 0];

  constructor(host: HTMLElement, opts: FocusRingOptions) {
    super(host, { ...opts, fov: FOV, maxDpr: 3 });
    this.state = opts.state;
    this.rest = Boolean(opts.rest);
    this.target = this.progress = opts.progress;
    this.done = opts.state === 'done' ? 1 : 0;
    const make = (back: boolean) => new ShaderMaterial({
      vertexShader: morphVertex(4),
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      side: back ? BackSide : FrontSide,
      uniforms: {
        ...studioUniforms(),
        uGlass: { value: new Color() },
        uCore: { value: new Color() },
        uDeep: { value: new Color() },
        uProgress: { value: 0 },
        uDone: { value: 0 },
        uBack: { value: back ? 1 : 0 },
      },
    });
    this.back = make(true);
    this.front = make(false);
    this.applyPalette(opts.palette);
    this.scene.add(this.group);
    this.loading = true;
    void this.load();
    this.start();
  }

  private async load() {
    try {
      const set = await loadCalm(focusUrl);
      const model = set.models.get('focus_ring');
      this.breath = set.clips.get('focus_breath') ?? null;
      const flow = set.clips.get('focus_flow');
      if (flow) this.flowPeriod = clipLength(flow);
      if (!model || this.disposed) { if (!model) this.fail(); return; }
      const geometry: BufferGeometry = calmGeometry(model, ['inhale', 'exhale', 'flow_a', 'flow_b']);
      const bitmap = await calmNormalBitmap(set);
      if (this.disposed) { geometry.dispose(); return; }
      if (bitmap) {
        const tex = (this.map = new Texture(bitmap));
        tex.flipY = false; // UV de glTF
        tex.wrapS = tex.wrapT = RepeatWrapping;
        tex.needsUpdate = true;
        for (const m of [this.front, this.back]) {
          m.uniforms.uMap.value = tex;
          m.uniforms.uHasMap.value = 1;
          m.uniforms.uMapStrength.value = 0.3;
          m.uniforms.uMapRepeat.value = [14, 3];
        }
      }
      const backMesh = new Mesh(geometry, this.back);
      const frontMesh = new Mesh(geometry, this.front);
      backMesh.renderOrder = 0;
      frontMesh.renderOrder = 1;
      backMesh.rotation.x = frontMesh.rotation.x = Math.PI / 2;
      this.group.add(backMesh, frontMesh);
      this.loading = false;
      this.request();
    } catch {
      this.fail();
    }
  }

  setState(state: FocusRingState) {
    if (state === this.state) return;
    this.state = state;
    this.request();
  }

  setProgress(p: number) {
    if (p === this.target) return;
    this.target = p;
    this.request();
  }

  setRest(rest: boolean) {
    if (rest === this.rest) return;
    this.rest = rest;
    this.applyPalette(this.palette);
    this.request();
  }

  protected applyPalette(p: PropPalette) {
    const tones = readCalmTones(p);
    // El vidrio: un poco de la superficie y del acento, nunca blanco puro ni negro puro.
    const glass = p.dark ? tones.clay.clone().multiplyScalar(0.72) : tones.clay.clone().lerp(p.accent, 0.1);
    const core = this.rest ? tones.lightCore.clone().lerp(p.paints[2], 0.6) : tones.lightCore;
    const deep = this.rest ? tones.lightDeep.clone().lerp(p.paints[2], 0.75) : tones.lightDeep;
    for (const m of [this.front, this.back]) {
      (m.uniforms.uGlass.value as Color).copy(glass);
      (m.uniforms.uCore.value as Color).copy(core);
      (m.uniforms.uDeep.value as Color).copy(deep);
      m.uniforms.uDark.value = p.dark ? 1 : 0;
    }
  }

  protected layout() {
    const d = FRAME / Math.tan(((this.camera.fov / 2) * Math.PI) / 180);
    this.camera.position.set(0, 0, d);
    this.camera.lookAt(0, 0, 0);
  }

  protected ambient() {
    return !this.reduceMotion && this.state === 'running';
  }

  protected step(dt: number): boolean {
    const running = this.state === 'running' && !this.reduceMotion;
    const towards = (from: number, to: number, tau: number) => to + (from - to) * Math.exp(-dt / tau);

    this.amount = towards(this.amount, running ? 1 : 0, SETTLE / 3);
    if (Math.abs(this.amount - (running ? 1 : 0)) < 0.002) this.amount = running ? 1 : 0;
    if (running) {
      this.breathT += dt;
      this.flowT += dt;
    }
    this.progress = this.reduceMotion ? this.target : towards(this.progress, this.target, 0.28);
    if (Math.abs(this.progress - this.target) < 0.0004) this.progress = this.target;
    const doneTo = this.state === 'done' ? 1 : 0;
    this.done = towards(this.done, doneTo, 0.3);
    if (Math.abs(this.done - doneTo) < 0.002) this.done = doneTo;

    let inhale = 0;
    let exhale = 0;
    if (this.breath && this.amount > 0) {
      sampleClip(this.breath, this.breathT % clipLength(this.breath), this.w);
      inhale = this.w[0] * this.amount;
      exhale = this.w[1] * this.amount;
    }
    const phase = (this.flowT / this.flowPeriod) * Math.PI * 2;
    // La ola sigue un poco visible en reposo: es la forma del aro, no solo su movimiento.
    const flow = 0.35 + 0.65 * this.amount;
    const a = Math.cos(phase) * flow;
    const b = Math.sin(phase) * flow;
    // Con el aliento, el aro se inclina apenas y la luz acompaña.
    const chest = inhale - exhale;
    this.group.rotation.x = TILT + chest * 0.016;
    this.group.rotation.y = Math.sin(phase * 0.5) * 0.028 * this.amount;

    for (const m of [this.front, this.back]) {
      setWeights(m, inhale, exhale, a, b);
      m.uniforms.uProgress.value = this.progress;
      m.uniforms.uDone.value = this.done;
      (m.uniforms.uKey.value as Vector3).copy(KEY_LIGHT).setX(KEY_LIGHT.x + Math.sin(phase) * 0.06 * this.amount).setY(KEY_LIGHT.y + chest * 0.05).normalize();
    }
    return this.progress !== this.target || this.done !== doneTo || (this.amount !== 0 && this.amount !== 1) || (running && this.amount < 1);
  }

  dispose() {
    this.map?.dispose();
    super.dispose();
  }
}
