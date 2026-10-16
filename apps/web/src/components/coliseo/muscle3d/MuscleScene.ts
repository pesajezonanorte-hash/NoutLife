// Escena 3D del mapa muscular (three.js, sin React): cámara orbital, figura,
// color por fatiga, selección con brillo y contorno, y pulso en fatiga alta.
// Dibuja bajo demanda: quieta y sin pulso no gasta ni un fotograma, el pulso va
// a 30 fps y todo se detiene fuera de pantalla o con la pestaña oculta.
import {
  AmbientLight, BackSide, CircleGeometry, Color, DirectionalLight, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  PerspectiveCamera, Raycaster, Scene, ShaderMaterial, Spherical, SRGBColorSpace, Vector2, WebGLRenderer, type BufferGeometry, type Texture,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MUSCLE_IDS, type Muscle, type MuscleState } from '@/lib/coliseo';
import { buildFigure, type Figure } from './figure';
import { heatColor, type RGB, type ScenePalette } from './heat';

export type Side = 'front' | 'back';

export interface MuscleSceneOptions {
  /** Músculo tocado en la figura. */
  onPick: (m: Muscle) => void;
  /** Lado que mira la cámara (cambia al girar). */
  onSide: (side: Side) => void;
  reduceMotion: boolean;
  /** Espacio que tapa la tarjeta flotante de arriba (móvil), en px: la figura se encuadra debajo. */
  topInset?: number;
}

const FOV = 30;
const FIGURE_H = 1.78; // de los pies a la coronilla
// El borde cercano del anillo del suelo asoma por debajo de los pies: se encuadra con él.
const FLOOR_DROP = 0.12;
const MARGIN_PX = 8;
const HOME_PHI = 1.43; // un poco por encima del horizonte
const TAP_PX = 8; // un toque se mueve menos; más es girar
const FINGER_PX = 16; // el dedo tapa lo que toca: radio de tolerancia para músculos pequeños
const PULSE_MS = 1600;
const OUTLINE = 0.0045; // m

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const expoOut = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const paint = (c: Color, [r, g, b]: RGB) => c.setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);

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

export class MuscleScene {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(FOV, 1, 0.1, 40);
  private controls: OrbitControls;
  private figure: Figure;
  private body: Mesh<BufferGeometry, MeshStandardMaterial>;
  private muscles = new Map<Muscle, Mesh<BufferGeometry, MeshStandardMaterial>>();
  private outline: Mesh<BufferGeometry, MeshBasicMaterial>;
  private floor: Mesh<CircleGeometry, ShaderMaterial>;
  private pickables: Mesh[];
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

  private frame = 0;
  private hoverFrame = 0;
  private lastFrame = 0;
  private visible = typeof IntersectionObserver === 'undefined';
  private lost = false;
  private tween: Tween | null = null;
  private home = { radius: 3.5, y: 0.89 };
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
    // Sin WebGL 2 esto lanza: quien crea la escena muestra el mapa plano.
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setClearColor(0x000000, 0);
    const canvas = this.renderer.domElement;
    canvas.style.cssText = 'display:block;width:100%;height:100%;outline:none;-webkit-tap-highlight-color:transparent';
    host.appendChild(canvas);

    this.figure = buildFigure();
    this.body = new Mesh(this.figure.body, new MeshStandardMaterial({ roughness: 0.85, metalness: 0 }));
    this.scene.add(this.body);
    for (const m of MUSCLE_IDS) {
      const mesh = new Mesh(this.figure.muscles[m], new MeshStandardMaterial({ roughness: 0.5, metalness: 0 }));
      mesh.userData.muscle = m;
      this.muscles.set(m, mesh);
      this.scene.add(mesh);
    }
    this.pickables = [this.body, ...this.muscles.values()];

    // Contorno: la misma malla por dentro (BackSide), inflada a lo largo de las normales.
    const outline = new MeshBasicMaterial({ side: BackSide });
    outline.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n\ttransformed += normal * ${OUTLINE.toFixed(4)};`);
    };
    this.outline = new Mesh(this.figure.muscles.chest, outline);
    this.outline.visible = false;
    this.scene.add(this.outline);

    this.floor = new Mesh(new CircleGeometry(0.56, 64), floorMaterial());
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = 0.001;
    this.scene.add(this.floor);

    // Luces pegadas a la cámara: el lado que miras siempre está iluminado, también la espalda.
    this.scene.add(this.camera);
    this.camera.add(new AmbientLight(0xffffff, 1.1));
    const key = new DirectionalLight(0xffffff, 2.1);
    key.position.set(-1.4, 1.8, 1.5);
    key.target.position.set(0, 0, -3.5);
    const rim = new DirectionalLight(0xffffff, 1.6);
    rim.position.set(1.8, 1.4, -7);
    rim.target.position.set(0, 0, -3.5);
    this.camera.add(key, key.target, rim, rim.target);

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
    // OrbitControls pone touch-action: none; así un dedo en vertical sigue desplazando la página.
    canvas.style.touchAction = 'pan-y';
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
    this.goTo('front', 1100);
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
    if (m) this.outline.geometry = this.muscles.get(m)!.geometry;
    this.outline.visible = m !== null;
    this.repaint();
    // Elegido en la lista o por defecto: si mira hacia el otro lado, la cámara da la vuelta.
    if (m && !fromFigure) {
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
    const props = this.renderer.properties.get(this.body.material) as { uniforms?: { dfgLUT?: { value: Texture | null } } };
    props.uniforms?.dfgLUT?.value?.dispose();
    this.body.material.dispose();
    this.figure.body.dispose();
    for (const mesh of this.muscles.values()) mesh.material.dispose();
    for (const m of MUSCLE_IDS) this.figure.muscles[m].dispose();
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
    const pulsing = this.high.length > 0 && !this.reduceMotion;
    // Solo late el pulso: basta con 30 fps.
    if (!moving && pulsing && now - this.lastFrame < 30) {
      this.requestRender();
      return;
    }
    if (pulsing) {
      const pulse = 0.06 + 0.24 * (0.5 - 0.5 * Math.cos((2 * Math.PI * now) / PULSE_MS));
      for (const m of this.high) this.muscles.get(m)!.material.emissiveIntensity = this.glow(m) + pulse;
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
    paint(this.body.material.color, p.body);
    for (const [m, mesh] of this.muscles) {
      const s = this.states?.[m];
      const mat = mesh.material;
      paint(mat.color, !s || s.status === 'idle' ? p.idle : heatColor(s.fatiguePct, p));
      mat.emissive.copy(mat.color);
      mat.emissiveIntensity = this.glow(m) + (this.reduceMotion && this.high.includes(m) ? 0.16 : 0);
    }
    paint(this.outline.material.color, p.outline);
    const u = this.floor.material.uniforms;
    paint(u.uShadow.value, p.shadow);
    paint(u.uRing.value, p.ring);
    u.uShadowA.value = p.dark ? 0.45 : 0.22;
    u.uRingA.value = p.dark ? 0.55 : 0.45;
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
    const dy = Math.min(1.55, Math.max(0.25, target.y)) - target.y;
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
    let perPx = (FIGURE_H + FLOOR_DROP) / usable;
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
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    // El maniquí también cuenta: tapa lo que queda detrás.
    const hit = this.raycaster.intersectObjects(this.pickables, false)[0];
    return (hit?.object.userData.muscle as Muscle | undefined) ?? null;
  }

  private listen<E extends Event>(target: EventTarget, type: string, fn: (e: E) => void, options?: AddEventListenerOptions) {
    target.addEventListener(type, fn as EventListener, options);
    this.cleanup.push(() => target.removeEventListener(type, fn as EventListener, options));
  }
}
