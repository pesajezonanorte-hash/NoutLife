// Motor de las almohadillas de silicona (SoftPad). Una lista puede tener decenas y cada lienzo
// WebGL cuesta un contexto, así que hay uno solo para todas:
// - en reposo, cada almohadilla es una imagen: el mismo modelo renderizado una vez por estado y por
//   tema (variables --lq-pad-off y --lq-pad-on). Listas largas: cero GPU y scroll como con una foto;
// - al tocar una, el único lienzo entra en ese botón, la dibuja en vivo con los shape keys de Blender
//   y, cuando se asienta, sale y vuelve la imagen (idéntica a su último fotograma);
// - un segundo toque mientras otra se anima termina la primera de golpe y se lleva el lienzo.
import { Color, DoubleSide, Mesh, PerspectiveCamera, Scene, ShaderMaterial, Texture, Vector3, WebGLRenderer } from 'three';
import padUrl from '@/assets/models/calm-pad.glb?url';
import { useMotionStore } from '@/store/motionStore';
import { calmGeometry, calmNormalBitmap, clipLength, loadCalm, sampleClip, type CalmSet } from './calmModels';
import { KEY_LIGHT, morphVertex, readCalmTones, setWeights, studioChunk, studioUniforms, type CalmTones } from './calmMaterial';
import { readPalette, watchPalette } from './palette';

const CANVAS = 64; // px CSS; el botón de 48 px deja 8 px por lado al abultarse al presionar
const TILT = (20 * Math.PI) / 180; // la almohadilla se ve algo desde arriba: se nota su grosor
/** La presión mínima que se ve aunque el toque sea muy corto. */
const MIN_PRESS = 0.075;

const frag = /* glsl */ `
  ${studioChunk}
  uniform float uFill;
  uniform vec3 uClay;
  uniform vec3 uCore;
  uniform vec3 uDeep;
  uniform vec3 uMark;

  // Largo del rayo dentro de un elipsoide de luz que crece con el llenado: luz en el volumen.
  float lightPath(vec3 o, vec3 d) {
    vec3 c = vec3(0.0, 0.09, 0.0);
    float grow = 0.06 + 1.02 * uFill;
    vec3 scale = 1.0 / (vec3(0.62, 0.3, 0.62) * grow);
    vec3 oo = (o - c) * scale;
    vec3 dd = d * scale;
    float a = dot(dd, dd);
    float b = dot(oo, dd);
    float disc = b * b - a * (dot(oo, oo) - 1.0);
    if (disc <= 0.0) return 0.0;
    float root = sqrt(disc);
    return max(0.0, (-b + root) / a) - max(0.0, (-b - root) / a);
  }

  void main() {
    vec3 v = normalize(vV);
    vec3 n = surfaceNormal();
    if (vPart > 0.5) {
      // La palomita: limpia, con una sombra mínima para que se lea sobre la luz.
      float shade = 0.92 + 0.08 * dot(n, uKey);
      gl_FragColor = vec4(uMark * shade, 1.0);
      #include <colorspace_fragment>
      return;
    }
    float glow = 1.0 - exp(-1.05 * lightPath(vO, normalize(vRay)));
    float lit = smoothstep(0.0, 1.0, uFill);
    vec3 albedo = mix(uClay, uDeep, lit * 0.9);
    vec3 col = clayLight(albedo, n, v, 1.0);
    // La luz sale de dentro: la silicona toma su color donde hay más camino dentro del volumen.
    vec3 inner = mix(uDeep, uCore, smoothstep(0.25, 0.85, glow)) * (1.0 + 0.08 * glow);
    col = mix(col, inner, min(1.0, glow * 1.25) * 0.82 * smoothstep(0.0, 0.12, uFill));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

/** Lo que no está presionando: el clip de rebote ya terminó. */
const SETTLED = 1e3;

interface Live {
  el: HTMLElement;
  /** Pesos de los shape keys. */
  press: number;
  bounce: number;
  /** Tiempo desde que empezó a presionar. */
  holdT: number;
  held: boolean;
  /** Tiempo del clip de rebote; < 0 aún no se suelta. */
  releaseT: number;
  releaseFrom: number;
  fill: number;
  fillFrom: number;
  fillTo: number;
  fillT: number;
}

export class SoftPadEngine {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(22, 1, 0.1, 20);
  private material: ShaderMaterial;
  private mesh: Mesh | null = null;
  private set: CalmSet | null = null;
  private map: Texture | null = null;
  private canvas: HTMLCanvasElement;
  private tones: CalmTones;
  private live: Live | null = null;
  private frame = 0;
  private last = 0;
  private unwatch: () => void;
  private urls: string[] = [];
  private decoded: HTMLImageElement[] = [];
  private shots = 0;
  private w: number[] = [0, 0, 0];
  private lost = false;
  readonly ready: Promise<boolean>;

  constructor() {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    this.renderer.setSize(CANVAS, CANVAS, false);
    this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement;
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.className = 'lq-pad-live';
    this.camera.position.set(0, 0, 0.8 / Math.tan((11 * Math.PI) / 180) * (CANVAS / 64) * 1.0);
    this.camera.lookAt(0, 0, 0);
    this.tones = readCalmTones(readPalette());
    this.material = new ShaderMaterial({
      vertexShader: morphVertex(3),
      fragmentShader: frag,
      side: DoubleSide,
      uniforms: {
        ...studioUniforms(),
        uFill: { value: 0 },
        uClay: { value: new Color() },
        uCore: { value: new Color() },
        uDeep: { value: new Color() },
        uMark: { value: new Color() },
      },
    });
    this.applyTones();
    this.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; this.finish(); });
    this.canvas.addEventListener('webglcontextrestored', () => { this.lost = false; void this.snapshots(); });
    this.unwatch = watchPalette(() => {
      this.tones = readCalmTones(readPalette());
      this.applyTones();
      void this.snapshots();
    });
    this.ready = this.load();
  }

  private async load() {
    try {
      const set = await loadCalm(padUrl);
      this.set = set;
      const model = set.models.get('pad');
      if (!model) return false;
      this.mesh = new Mesh(calmGeometry(model, ['press', 'release', 'fill']), this.material);
      this.mesh.rotation.x = Math.PI / 2 - TILT;
      // Centra la almohadilla (su centro está a media altura) en el lienzo.
      this.mesh.position.copy(new Vector3(0, -0.1, 0).applyEuler(this.mesh.rotation));
      this.scene.add(this.mesh);
      const bitmap = await calmNormalBitmap(set);
      if (bitmap) {
        const tex = (this.map = new Texture(bitmap));
        tex.flipY = false; // UV de glTF
        tex.needsUpdate = true;
        this.material.uniforms.uMap.value = tex;
        this.material.uniforms.uHasMap.value = 1;
      }
      await this.snapshots();
      return true;
    } catch {
      return false;
    }
  }

  private applyTones() {
    const u = this.material.uniforms;
    (u.uClay.value as Color).copy(this.tones.clay);
    (u.uCore.value as Color).copy(this.tones.lightCore);
    (u.uDeep.value as Color).copy(this.tones.lightDeep);
    (u.uMark.value as Color).copy(this.tones.mark);
    u.uDark.value = this.tones.dark ? 1 : 0;
  }

  /** Renderiza los dos estados de reposo y los publica como imágenes del tema actual. */
  private async snapshots() {
    if (!this.mesh || this.lost) return;
    this.finish();
    const run = ++this.shots;
    const shot = (fill: number) => {
      setWeights(this.material, 0, 0, fill);
      this.material.uniforms.uFill.value = fill;
      this.material.uniforms.uKey.value.copy(KEY_LIGHT);
      this.renderer.render(this.scene, this.camera);
      // toBlob copia el lienzo aquí mismo, antes de que el navegador lo presente.
      return new Promise<Blob | null>((resolve) => this.canvas.toBlob(resolve, 'image/png'));
    };
    const [off, on] = await Promise.all([shot(0), shot(1)]);
    if (!off || !on || run !== this.shots) return;
    const root = document.documentElement;
    const next = [URL.createObjectURL(off), URL.createObjectURL(on)];
    // Decodificadas de antemano: al soltar el lienzo, la imagen ya está lista (sin parpadeo).
    this.decoded = next.map((src) => Object.assign(new Image(), { src }));
    await Promise.all(this.decoded.map((img) => img.decode().catch(() => null)));
    if (run !== this.shots) {
      next.forEach((u) => URL.revokeObjectURL(u));
      return;
    }
    root.style.setProperty('--lq-pad-off', `url(${next[0]})`);
    root.style.setProperty('--lq-pad-on', `url(${next[1]})`);
    root.setAttribute('data-pad3d', '');
    this.urls.forEach((u) => URL.revokeObjectURL(u));
    this.urls = next;
  }

  private attach(el: HTMLElement, on: boolean): Live {
    if (this.live?.el === el) return this.live;
    this.finish();
    const live: Live = {
      el, press: 0, bounce: 0, holdT: 0, held: false, releaseT: SETTLED, releaseFrom: 0,
      fill: on ? 1 : 0, fillFrom: on ? 1 : 0, fillTo: on ? 1 : 0, fillT: SETTLED,
    };
    this.live = live;
    el.appendChild(this.canvas);
    this.draw(live);
    // En el mismo instante: el lienzo tapa a la imagen sin que se vea el cambio.
    el.setAttribute('data-live', '');
    this.request();
    return live;
  }

  /** El dedo o el cursor baja sobre la almohadilla. */
  press(el: HTMLElement, on: boolean) {
    if (!this.usable()) return;
    const live = this.attach(el, on);
    live.held = true;
    live.holdT = 0;
    live.releaseT = -1;
  }

  /** Se suelta: rebote elástico. */
  release(el: HTMLElement) {
    if (this.live?.el !== el || !this.live.held) return;
    this.live.held = false;
    this.request();
  }

  /** Cambia el estado: la luz llena el volumen, o se apaga. `tap` = sin presión previa (teclado). */
  setOn(el: HTMLElement, on: boolean, tap = false) {
    if (!this.usable()) return;
    const live = this.attach(el, !on);
    if (tap) {
      live.held = false;
      live.holdT = 0;
      live.releaseT = -1;
    }
    live.fillFrom = live.fill;
    live.fillTo = on ? 1 : 0;
    live.fillT = 0;
    this.request();
  }

  private usable() {
    return Boolean(this.mesh && this.set) && !this.lost && !useMotionStore.getState().reduce;
  }

  private request() {
    if (!this.frame) {
      this.last = 0;
      this.frame = requestAnimationFrame(this.tick);
    }
  }

  private tick = (now: number) => {
    this.frame = 0;
    const live = this.live;
    if (!live || !this.set) return;
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    if (document.hidden) { this.finish(); return; }
    const moving = this.advance(live, dt);
    this.draw(live);
    if (moving) {
      this.last = now;
      this.frame = requestAnimationFrame(this.tick);
    } else {
      this.finish();
    }
  };

  private advance(live: Live, dt: number) {
    const clips = this.set!.clips;
    const pressClip = clips.get('pad_press')!;
    const releaseClip = clips.get('pad_release')!;
    const fillClip = clips.get('pad_fill')!;
    const w = this.w;
    live.holdT += dt;
    if (live.releaseT >= 0) {
      live.releaseT += dt;
      sampleClip(releaseClip, live.releaseT, w);
      live.press = w[0] * live.releaseFrom;
      live.bounce = w[1] * live.releaseFrom;
    } else {
      live.press = sampleClip(pressClip, live.holdT, w)[0];
      live.bounce = 0;
      // Suelta cuando deja de sostener y la presión ya se llegó a ver.
      if (!live.held && live.holdT >= MIN_PRESS) {
        live.releaseFrom = live.press;
        live.releaseT = 0;
      }
    }

    const fillLen = clipLength(fillClip);
    if (live.fillT < fillLen) {
      // Al apagar, el mismo clip del revés y más rápido: apagarse no celebra nada.
      const rising = live.fillTo > live.fillFrom;
      live.fillT += rising ? dt : dt * 1.6;
      const t = Math.min(live.fillT, fillLen);
      const f = sampleClip(fillClip, rising ? t : fillLen - t, w)[2];
      live.fill = rising ? live.fillFrom + (1 - live.fillFrom) * f : live.fillFrom * f;
    }
    const releasing = live.releaseT >= 0 && live.releaseT < clipLength(releaseClip);
    const filling = live.fillT < fillLen;
    return live.held || live.releaseT < 0 || releasing || filling;
  }

  private draw(live: Live) {
    const u = this.material.uniforms;
    setWeights(this.material, live.press, live.bounce, live.fill);
    u.uFill.value = Math.min(1, Math.max(0, live.fill));
    // Al hundirse, la luz principal se corre un poco: el reflejo se mueve con la presión.
    (u.uKey.value as Vector3).copy(KEY_LIGHT).setY(KEY_LIGHT.y - live.press * 0.1 + live.bounce * 0.06).normalize();
    this.renderer.render(this.scene, this.camera);
  }

  /** Termina la animación en curso: quita el lienzo y vuelve a la imagen del estado. */
  private finish() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    const live = this.live;
    if (!live) return;
    this.live = null;
    live.el.removeAttribute('data-live');
    this.canvas.remove();
  }
}

let engine: SoftPadEngine | null = null;

export function softPadEngine() {
  return (engine ??= new SoftPadEngine());
}
