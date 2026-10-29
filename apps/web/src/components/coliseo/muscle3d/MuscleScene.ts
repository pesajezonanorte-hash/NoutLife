// Escena 3D del mapa muscular (three.js, sin React): cámara orbital, figura
// atlética (masculina o femenina, modelada en Blender), color por fatiga desde el
// shader, selección con brillo y contorno, y pulso en fatiga alta.
// Dibuja bajo demanda: quieta y sin pulso no gasta ni un fotograma, el pulso va
// a 30 fps y todo se detiene fuera de pantalla o con la pestaña oculta.
import {
  AmbientLight, BackSide, BufferAttribute, BufferGeometry, CircleGeometry, Color, DirectionalLight, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, PerspectiveCamera, Raycaster, Scene, ShaderMaterial, Spherical, SRGBColorSpace, Vector2, WebGLRenderer,
  type Texture,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MUSCLE_IDS, type Muscle, type MuscleState } from '@/lib/coliseo';
import maleUrl from '@/assets/models/body-male.nlm?url';
import femaleUrl from '@/assets/models/body-female.nlm?url';
import { buildFigure, type Body, type Figure } from './figure';
import { heatColor, type RGB, type ScenePalette } from './heat';

export type Side = 'front' | 'back';

export interface MuscleSceneOptions {
  /** Cuerpo de la figura (según el perfil). */
  body: Body;
  /** Músculo tocado en la figura. */
  onPick: (m: Muscle) => void;
  /** Lado que mira la cámara (cambia al girar). */
  onSide: (side: Side) => void;
  /** La figura ya está en pantalla (o no se pudo descargar: `ok` false). */
  onReady?: (ok: boolean) => void;
  reduceMotion: boolean;
  /** Espacio que tapa la tarjeta flotante de arriba (móvil), en px: la figura se encuadra debajo. */
  topInset?: number;
}

const FOV = 30;
// El borde cercano del anillo del suelo asoma por debajo de los pies: se encuadra con él.
const FLOOR_DROP = 0.12;
const MARGIN_PX = 8;
const HOME_PHI = 1.43; // un poco por encima del horizonte
const TAP_PX = 8; // un toque se mueve menos; más es girar
const FINGER_PX = 16; // el dedo tapa lo que toca: radio de tolerancia para músculos pequeños
const PULSE_MS = 1600;
const OUTLINE = 0.0042; // m
const N = MUSCLE_IDS.length;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const expoOut = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const paint = (c: Color, [r, g, b]: RGB) => c.setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);

const figures = new Map<Body, Promise<Figure>>();
/** Descarga y decodifica cada figura una sola vez por sesión (remontar el visor no la vuelve a pedir). */
function loadFigure(body: Body): Promise<Figure> {
  let p = figures.get(body);
  if (!p) {
    p = fetch(body === 'female' ? femaleUrl : maleUrl)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`figure ${r.status}`))))
      .then(buildFigure);
    p.catch(() => figures.delete(body));
    figures.set(body, p);
  }
  return p;
}

interface Tween { from: Spherical; to: Spherical; fromY: number; toY: number; start: number; ms: number }

/** Sombra de contacto bajo los pies y el anillo de la arena. */
function floorMaterial() {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uShadow: { value: new Color() }, uRing: { value: new Color() }, uShadowA: { value: 0.3 }, uRingA: { value: 0.5 } },
    vertexShader: /* glsl */ `
      varying vec2 vXY;
      void main() { vXY = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uShadow; uniform vec3 uRing; uniform float uShadowA; uniform float uRingA;
      varying vec2 vXY;
      void main() {
        float shadow = uShadowA * (1.0 - smoothstep(0.0, 0.34, length(vXY * vec2(0.85, 1.45))));
        float ring = uRingA * (1.0 - smoothstep(0.0025, 0.006, abs(length(vXY) - 0.5)));
        gl_FragColor = vec4(ring > shadow ? uRing : uShadow, max(shadow, ring));
        #include <colorspace_fragment>
      }`,
  });
}

/**
 * Piel y músculos en un solo material: cada vértice trae su músculo (`muscle`, 255 = piel),
 * su peso (0 en el surco) y su oclusión horneada en Blender (`ao`), que oscurece surcos y
 * axilas para que la definición se lea con cualquier luz. El color del músculo y su brillo
 * llegan como uniformes: repintar o latir no sube geometría. El índice es `flat`.
 */
function bodyMaterial() {
  const mat = new MeshStandardMaterial({ roughness: 0.62, metalness: 0 });
  const uniforms = {
    uHeat: { value: Array.from({ length: N }, () => new Color()) },
    uGlow: { value: new Float32Array(N) },
    uSkin: { value: new Color() },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float muscle;
        attribute float mweight;
        attribute float ao;
        flat varying int vMuscle;
        varying float vWeight;
        varying float vAO;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vMuscle = int(muscle + 0.5);
        vWeight = mweight;
        vAO = ao;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uHeat[${N}];
        uniform float uGlow[${N}];
        uniform vec3 uSkin;
        flat varying int vMuscle;
        varying float vWeight;
        varying float vAO;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float mw = 0.0;
        vec3 heat = uSkin;
        float glow = 0.0;
        if (vMuscle < ${N}) {
          mw = smoothstep(0.0, 0.85, vWeight);
          heat = uHeat[vMuscle];
          glow = uGlow[vMuscle] * mw;
        }
        diffuseColor.rgb = mix(uSkin, heat, mw) * vAO;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += heat * glow;`);
  };
  // Mismo programa para todas las figuras: three no debe recompilar por instancia.
  mat.customProgramCacheKey = () => 'lq-body-heat';
  return { mat, uniforms };
}

export class MuscleScene {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(FOV, 1, 0.1, 40);
  private controls: OrbitControls;
  private figure: Figure | null = null;
  private skin = bodyMaterial();
  private body: Mesh<BufferGeometry, MeshStandardMaterial> | null = null;
  private outline: Mesh<BufferGeometry, MeshBasicMaterial>;
  private floor: Mesh<CircleGeometry, ShaderMaterial>;
  private raycaster = new Raycaster();
  private ndc = new Vector2();

  private palette: ScenePalette | null = null;
  private states: Record<Muscle, MuscleState> | null = null;
  private high: Muscle[] = [];
  private selected: Muscle | null = null;
  private hovered: Muscle | null = null;
  /** Último músculo tocado en la figura: esa selección no gira la cámara. */
  private picked: Muscle | null = null;
  private side: Side = 'front';
  private reduceMotion: boolean;
  private disposed = false;

  private frame = 0;
  private hoverFrame = 0;
  private lastFrame = 0;
  private visible = typeof IntersectionObserver === 'undefined';
  private lost = false;
  private tween: Tween | null = null;
  private home = { radius: 3.5, y: 0.89 };
  private figureH = 1.78;
  private topInset = 0;
  private size = { w: 1, h: 1 };
  private dpr: number;
  private frameTimes: number[] = [];
  private press: { x: number; y: number; id: number; multi: boolean } | null = null;
  private hoverAt: { x: number; y: number } | null = null;
  private cleanup: Array<() => void> = [];

  constructor(host: HTMLElement, private opts: MuscleSceneOptions) {
    this.reduceMotion = opts.reduceMotion;
    this.topInset = opts.topInset ?? 0;
    this.figureH = opts.body === 'female' ? 1.69 : 1.773;
    // Sin WebGL 2 esto lanza: quien crea la escena muestra el mapa plano.
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setClearColor(0x000000, 0);
    const canvas = this.renderer.domElement;
    canvas.style.cssText = 'display:block;width:100%;height:100%;outline:none;-webkit-tap-highlight-color:transparent';
    host.appendChild(canvas);

    // Contorno: la malla del músculo elegido por dentro (BackSide), inflada a lo largo de las normales.
    const outline = new MeshBasicMaterial({ side: BackSide });
    outline.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n\ttransformed += normal * ${OUTLINE.toFixed(4)};`);
    };
    this.outline = new Mesh(new BufferGeometry(), outline);
    this.outline.visible = false;
    this.scene.add(this.outline);

    this.floor = new Mesh(new CircleGeometry(0.56, 64), floorMaterial());
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = 0.001;
    this.scene.add(this.floor);

    // Luces pegadas a la cámara: el lado que miras siempre está iluminado, también la espalda.
    // La principal viene de arriba y de lado, como en una sala de pesas: marca el relieve.
    this.scene.add(this.camera);
    this.camera.add(new AmbientLight(0xffffff, 0.6));
    const key = new DirectionalLight(0xffffff, 2.9);
    key.position.set(-1.6, 2.6, 1.2);
    key.target.position.set(0, 0, -3.5);
    const fill = new DirectionalLight(0xffffff, 0.7);
    fill.position.set(1.6, 0.2, 1.4);
    fill.target.position.set(0, 0, -3.5);
    const rim = new DirectionalLight(0xffffff, 1.8);
    rim.position.set(1.8, 1.4, -7);
    rim.target.position.set(0, 0, -3.5);
    this.camera.add(key, key.target, fill, fill.target, rim, rim.target);

    const c = (this.controls = new OrbitControls(this.camera, canvas));
    c.enableDamping = true;
    c.dampingFactor = 0.09;
    c.rotateSpeed = 0.85;
    c.zoomSpeed = 0.9;
    c.panSpeed = 0.7;
    c.screenSpacePanning = true;
    c.minPolarAngle = Math.PI * 0.3;
    c.maxPolarAngle = Math.PI * 0.62;
    c.cursorStyle = 'grab';
    // El modelo se gira con un dedo en cualquier dirección y la página no se mueve mientras
    // se toca el visor. Con «pan-y» un arrastre vertical desplazaba la página (y el giro
    // vertical nunca llegaba a OrbitControls).
    canvas.style.touchAction = 'none';
    c.addEventListener('change', this.onChange);
    c.addEventListener('start', this.onStart);

    this.listen(canvas, 'pointerdown', this.onDown);
    this.listen(canvas, 'pointerup', this.onUp);
    this.listen(canvas, 'pointercancel', () => (this.press = null));
    this.listen(canvas, 'pointermove', this.onMove);
    this.listen(canvas, 'pointerleave', () => this.setHovered(null));
    // La rueda sola desplaza la página; con Ctrl/⌘ (o pellizco en trackpad) hace zoom.
    this.listen<WheelEvent>(canvas, 'wheel', (e) => { if (!e.ctrlKey && !e.metaKey) e.stopImmediatePropagation(); }, { capture: true });
    this.listen(canvas, 'webglcontextlost', (e) => { e.preventDefault(); this.lost = true; this.stop(); });
    this.listen(canvas, 'webglcontextrestored', () => { this.lost = false; this.requestRender(); });
    this.listen(document, 'visibilitychange', () => (document.hidden ? this.stop() : this.requestRender()));

    const ro = new ResizeObserver(([entry]) => this.resize(entry.contentRect.width, entry.contentRect.height));
    ro.observe(host);
    this.cleanup.push(() => ro.disconnect());
    if (typeof IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver(([entry]) => {
        this.visible = entry.isIntersecting;
        if (this.visible) this.requestRender(); else this.stop();
      });
      io.observe(host);
      this.cleanup.push(() => io.disconnect());
    }

    const rect = host.getBoundingClientRect();
    this.resize(rect.width, rect.height);
    // Entrada: la figura llega girando un poco para que se note que se puede girar.
    this.controls.target.set(0, this.home.y, 0);
    this.camera.position.setFromSpherical(new Spherical(this.home.radius, HOME_PHI, this.reduceMotion ? 0 : -0.62)).add(this.controls.target);
    this.controls.update();

    loadFigure(opts.body).then((fig) => {
      if (this.disposed) return;
      this.figure = fig;
      this.body = new Mesh(fig.geometry, this.skin.mat);
      this.scene.add(this.body);
      this.outline.geometry.setAttribute('position', fig.geometry.getAttribute('position'));
      this.outline.geometry.setAttribute('normal', fig.geometry.getAttribute('normal'));
      if (this.selected) this.setSelected(this.selected);
      this.repaint();
      this.goTo('front', 1100);
      this.opts.onReady?.(true);
    }, () => { if (!this.disposed) this.opts.onReady?.(false); });
  }

  /* ───────── API ───────── */

  setPalette(p: ScenePalette) {
    this.palette = p;
    this.repaint();
  }

  setStates(states: Record<Muscle, MuscleState>) {
    this.states = states;
    this.high = MUSCLE_IDS.filter((m) => states[m].status === 'high');
    this.repaint();
  }

  setSelected(m: Muscle | null) {
    const fromFigure = m !== null && m === this.picked;
    this.picked = null;
    this.selected = m;
    if (m && this.figure) this.outline.geometry.setIndex(new BufferAttribute(this.figure.trianglesOf(m), 1));
    this.outline.visible = m !== null && this.figure !== null;
    this.repaint();
    // Elegido en la lista o por defecto: si mira hacia el otro lado, la cámara da la vuelta.
    if (m && !fromFigure && this.figure) {
      const facing = this.figure.facing[m];
      const want: Side = facing > 0 ? 'front' : 'back';
      const heading = this.tween ? this.sideOf(this.tween.to.theta) : this.side;
      if (facing !== 0 && heading !== want) this.goTo(want);
    }
  }

  /** Vista de frente o de espaldas, con el encuadre inicial. */
  goTo(side: Side, ms = 750) {
    this.animate({ theta: side === 'front' ? 0 : Math.PI, phi: HOME_PHI, radius: this.home.radius, y: this.home.y }, ms);
  }

  zoom(direction: 1 | -1) {
    // Si la cámara aún está girando hacia un lado, el zoom llega a ese mismo destino.
    const to = this.tween?.to ?? new Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
    const y = this.tween?.toY ?? this.controls.target.y;
    const radius = Math.min(this.controls.maxDistance, Math.max(this.controls.minDistance, to.radius * (direction > 0 ? 0.78 : 1.28)));
    this.animate({ theta: to.theta, phi: to.phi, radius, y }, this.tween ? 600 : 320);
  }

  /** Espacio que tapa la tarjeta flotante de arriba (móvil): la figura se encuadra debajo. */
  setTopInset(px: number) {
    if (px === this.topInset) return;
    this.topInset = px;
    this.frameHome();
    this.goTo(this.side, 400);
  }

  setReduceMotion(reduce: boolean) {
    this.reduceMotion = reduce;
    this.repaint();
  }

  dispose() {
    this.disposed = true;
    this.stop();
    cancelAnimationFrame(this.hoverFrame);
    this.cleanup.forEach((fn) => fn());
    this.cleanup = [];
    this.controls.removeEventListener('change', this.onChange);
    this.controls.removeEventListener('start', this.onStart);
    // OrbitControls quita su escucha de teclado del nodo raíz *actual* del lienzo, pero React ya
    // sacó el DOM cuando corre la limpieza de useEffect: la escucha seguía en document y retenía
    // controles, lienzo y contexto WebGL. El lienzo vuelve un instante al documento, oculto.
    const canvas = this.renderer.domElement;
    if (!canvas.isConnected) {
      canvas.style.display = 'none';
      document.body.appendChild(canvas);
    }
    this.controls.dispose();
    // three r186 comparte entre renderers una LUT DFG de módulo (MeshStandardMaterial) y cada uno
    // le deja una escucha 'dispose' que retiene su contexto y su lienzo: renderer.dispose() no la
    // suelta. Liberarla quita esas escuchas; three la vuelve a subir si otro renderer la usa.
    // Se lee antes de liberar los materiales, que borran sus propiedades en el renderer.
    const props = this.renderer.properties.get(this.skin.mat) as { uniforms?: { dfgLUT?: { value: Texture | null } } };
    props.uniforms?.dfgLUT?.value?.dispose();
    this.skin.mat.dispose();
    // La geometría de la figura queda en memoria para el próximo montaje; aquí solo se sueltan sus búferes de GPU.
    this.figure?.geometry.dispose();
    this.outline.geometry.dispose();
    this.outline.material.dispose();
    this.floor.geometry.dispose();
    this.floor.material.dispose();
    this.scene.clear();
    this.renderer.dispose();
    // Suelta el contexto WebGL ya, sin esperar al recolector: el navegador limita los contextos vivos.
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  /* ───────── Dibujo ───────── */

  private requestRender = () => {
    if (this.frame || !this.visible || this.lost || document.hidden) return;
    this.frame = requestAnimationFrame(this.tick);
  };

  private stop() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private tick = (now: number) => {
    this.frame = 0;
    const tweening = this.tween ? this.stepTween(now) : false;
    const moved = this.controls.update(); // inercia del giro
    const moving = tweening || moved;
    const pulsing = this.high.length > 0 && !this.reduceMotion && this.figure !== null;
    // Solo late el pulso: basta con 30 fps.
    if (!moving && pulsing && now - this.lastFrame < 30) {
      this.requestRender();
      return;
    }
    if (pulsing) {
      const pulse = 0.06 + 0.24 * (0.5 - 0.5 * Math.cos((2 * Math.PI * now) / PULSE_MS));
      const glow = this.skin.uniforms.uGlow.value;
      for (const m of this.high) glow[MUSCLE_IDS.indexOf(m)] = this.glow(m) + pulse;
    }
    this.renderer.render(this.scene, this.camera);
    if (moving) this.adaptResolution(now);
    this.lastFrame = now;
    if (moving || pulsing) this.requestRender();
  };

  /** Si al girar no llega a ~45 fps, baja la resolución (2 → 1,5 → 1). */
  private adaptResolution(now: number) {
    const dt = now - this.lastFrame;
    if (dt > 100) return; // hubo una pausa, no cuenta
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 45) return;
    const mean = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = [];
    if (mean > 22 && this.dpr > 1) {
      this.dpr = Math.max(1, this.dpr - 0.5);
      this.renderer.setPixelRatio(this.dpr); // también redimensiona el búfer de dibujo
    }
  }

  private glow(m: Muscle) {
    return (m === this.selected ? 0.3 : 0) + (m === this.hovered ? 0.14 : 0);
  }

  private repaint() {
    const p = this.palette;
    if (!p) return;
    const u = this.skin.uniforms;
    paint(u.uSkin.value, p.body);
    MUSCLE_IDS.forEach((m, i) => {
      const s = this.states?.[m];
      paint(u.uHeat.value[i], !s || s.status === 'idle' ? p.idle : heatColor(s.fatiguePct, p));
      u.uGlow.value[i] = this.glow(m) + (this.reduceMotion && this.high.includes(m) ? 0.16 : 0);
    });
    paint(this.outline.material.color, p.outline);
    const f = this.floor.material.uniforms;
    paint(f.uShadow.value, p.shadow);
    paint(f.uRing.value, p.ring);
    f.uShadowA.value = p.dark ? 0.45 : 0.22;
    f.uRingA.value = p.dark ? 0.55 : 0.45;
    this.requestRender();
  }

  /* ───────── Cámara ───────── */

  private animate(to: { theta: number; phi: number; radius: number; y: number }, ms: number) {
    // Sin la inercia del último giro, que si no se suma a la animación.
    this.controls.enableDamping = false;
    this.controls.update();
    this.tween = {
      from: new Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target)),
      to: new Spherical(to.radius, to.phi, to.theta),
      fromY: this.controls.target.y,
      toY: to.y,
      start: 0, // empieza en el primer fotograma visible (la entrada puede montarse fuera de pantalla)
      ms: this.reduceMotion ? 0 : ms,
    };
    this.requestRender();
  }

  private stepTween(now: number) {
    const tw = this.tween!;
    if (!tw.start) tw.start = now;
    const k = tw.ms > 0 ? expoOut(Math.min(1, (now - tw.start) / tw.ms)) : 1;
    const s = new Spherical(
      lerp(tw.from.radius, tw.to.radius, k),
      lerp(tw.from.phi, tw.to.phi, k),
      tw.from.theta + wrap(tw.to.theta - tw.from.theta) * k,
    );
    this.controls.target.set(0, lerp(tw.fromY, tw.toY, k), 0);
    this.camera.position.setFromSpherical(s).add(this.controls.target);
    if (k < 1) return true;
    this.tween = null;
    this.controls.enableDamping = true;
    return false;
  }

  private sideOf(theta: number): Side {
    return Math.cos(theta) >= 0 ? 'front' : 'back';
  }

  private onStart = () => {
    // La persona toma el control: se cancela cualquier animación de cámara.
    this.tween = null;
    this.controls.enableDamping = true;
  };

  private onChange = () => {
    const { target } = this.controls;
    // El paneo solo sube y baja por el cuerpo: cámara y objetivo se corrigen juntos.
    const dy = Math.min(this.figureH - 0.2, Math.max(0.25, target.y)) - target.y;
    if (target.x || target.z || dy) {
      this.camera.position.x -= target.x;
      this.camera.position.y += dy;
      this.camera.position.z -= target.z;
      target.set(0, target.y + dy, 0);
    }
    const p = this.camera.position;
    const side = this.sideOf(Math.atan2(p.x - target.x, p.z - target.z));
    if (side !== this.side) {
      this.side = side;
      this.opts.onSide(side);
    }
    this.requestRender();
  };

  private resize(w: number, h: number) {
    if (w < 1 || h < 1) return;
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.frameHome();
    this.requestRender();
  }

  /** Encuadre de inicio: la figura entera entre el margen de arriba (más la tarjeta) y el de abajo. */
  private frameHome() {
    const { w, h } = this.size;
    const usable = Math.max(120, h - this.topInset - 2 * MARGIN_PX);
    const tan = Math.tan((FOV * Math.PI) / 360);
    let perPx = (this.figureH + FLOOR_DROP) / usable;
    // En un lienzo muy apaisado no manda la altura sino el ancho (brazos abiertos ≈ 0,8 m).
    perPx = Math.max(perPx, 0.86 / Math.max(120, w - 2 * MARGIN_PX));
    const radius = (h * perPx) / 2 / tan;
    this.home = { radius, y: perPx * (h / 2 - MARGIN_PX) - FLOOR_DROP };
    this.controls.minDistance = radius * 0.38;
    this.controls.maxDistance = radius * 1.35;
  }

  /* ───────── Toques y puntero ───────── */

  private onDown = (e: PointerEvent) => {
    if (this.press) { this.press.multi = true; return; }
    this.press = { x: e.clientX, y: e.clientY, id: e.pointerId, multi: false };
  };

  private onUp = (e: PointerEvent) => {
    const p = this.press;
    if (!p || p.id !== e.pointerId) return;
    this.press = null;
    if (p.multi || Math.hypot(e.clientX - p.x, e.clientY - p.y) > TAP_PX) return;
    let m = this.muscleAt(e.clientX, e.clientY);
    if (!m && e.pointerType !== 'mouse') {
      // Tolerancia del dedo: prueba dos anillos alrededor del toque y se queda con el primer músculo.
      for (const r of [FINGER_PX / 2, FINGER_PX]) {
        for (let k = 0; k < 8 && !m; k++) m = this.muscleAt(e.clientX + Math.cos((k * Math.PI) / 4) * r, e.clientY + Math.sin((k * Math.PI) / 4) * r);
        if (m) break;
      }
    }
    if (!m) return;
    this.picked = m;
    this.opts.onPick(m);
  };

  private onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.buttons) return;
    this.hoverAt = { x: e.clientX, y: e.clientY };
    if (this.hoverFrame) return;
    this.hoverFrame = requestAnimationFrame(() => {
      this.hoverFrame = 0;
      if (this.hoverAt) this.setHovered(this.muscleAt(this.hoverAt.x, this.hoverAt.y));
    });
  };

  private setHovered(m: Muscle | null) {
    if (m === this.hovered) return;
    this.hovered = m;
    this.renderer.domElement.style.cursor = m ? 'pointer' : 'grab';
    this.repaint();
  }

  private muscleAt(clientX: number, clientY: number): Muscle | null {
    if (!this.body || !this.figure) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const face = this.raycaster.intersectObject(this.body, false)[0]?.face;
    return face ? this.figure.muscleOfFace(face.a, face.b, face.c) : null;
  }

  private listen<E extends Event>(target: EventTarget, type: string, fn: (e: E) => void, options?: AddEventListenerOptions) {
    target.addEventListener(type, fn as EventListener, options);
    this.cleanup.push(() => target.removeEventListener(type, fn as EventListener, options));
  }
}
