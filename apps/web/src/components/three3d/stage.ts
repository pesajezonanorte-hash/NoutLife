// Base de las escenas 3D pequeñas de las zonas (tótem, monumento, cofre, objetos, flujo de caja).
// Lo que todas comparten, con las mismas reglas que el mapa 3D de Estadísticas:
// - dibuja solo mientras se ve (IntersectionObserver + pestaña visible) y solo cuando hace falta:
//   cada fotograma pregunta a la escena si sigue animando (`step` → true) o si hay ambiente;
// - resolución adaptativa: si los fotogramas pasan de ~24 ms de forma sostenida, baja el
//   devicePixelRatio de 0,25 en 0,25 hasta 1 (los 60 fps importan más que la nitidez);
// - pierde el contexto a propósito al desmontarse (forceContextLoss) y libera lo que creó;
// - sin luces de three ni sombras ni posproceso: los sombreadores hacen la luz.
import { BufferGeometry, Material, Mesh, PerspectiveCamera, Points, Scene, WebGLRenderer, type Object3D } from 'three';
import type { PropPalette } from './palette';

export interface StageOptions {
  palette: PropPalette;
  reduceMotion: boolean;
  /** Primer fotograma dibujado (con los modelos ya cargados si la escena los espera). */
  onReady?: () => void;
  /** No se pudieron cargar los modelos: la tarjeta puede ocultar el lienzo. */
  onError?: () => void;
  fov?: number;
  /** Tope del devicePixelRatio. */
  maxDpr?: number;
}

const SLOW_MS = 24;

export abstract class Stage {
  protected renderer: WebGLRenderer;
  protected scene = new Scene();
  protected camera: PerspectiveCamera;
  protected readonly canvas: HTMLCanvasElement;
  protected width = 1;
  protected height = 1;
  protected reduceMotion: boolean;
  protected palette: PropPalette;
  /** Segundos de animación acumulados (se congela con «Reducir movimiento»). */
  protected clock = 0;
  /** La escena aún espera sus modelos: no avisa de onReady hasta tenerlos. */
  protected loading = false;
  protected disposed = false;
  private frame = 0;
  private last = 0;
  private visible = typeof IntersectionObserver === 'undefined';
  private lost = false;
  private readied = false;
  private dpr: number;
  private frames = 0;
  private slow = 0;
  private cleanup: Array<() => void> = [];

  constructor(protected host: HTMLElement, protected baseOptions: StageOptions) {
    this.reduceMotion = baseOptions.reduceMotion;
    this.palette = baseOptions.palette;
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.dpr = Math.min(window.devicePixelRatio || 1, baseOptions.maxDpr ?? 2);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement;
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;outline:none;touch-action:pan-y;-webkit-tap-highlight-color:transparent';
    host.appendChild(this.canvas);
    this.camera = new PerspectiveCamera(baseOptions.fov ?? 32, 1, 0.05, 60);

    this.listen(this.canvas, 'webglcontextlost', (e) => { e.preventDefault(); this.lost = true; this.stop(); });
    this.listen(this.canvas, 'webglcontextrestored', () => { this.lost = false; this.request(); });
    this.listen(document, 'visibilitychange', () => (document.hidden ? this.stop() : this.request()));
    const ro = new ResizeObserver(([e]) => this.resize(e.contentRect.width, e.contentRect.height));
    ro.observe(host);
    this.cleanup.push(() => ro.disconnect());
    if (typeof IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; if (this.visible) this.request(); else this.stop(); });
      io.observe(host);
      this.cleanup.push(() => io.disconnect());
    }
  }

  /** La escena hija lo llama al final de su constructor, con todo creado. */
  protected start() {
    const r = this.host.getBoundingClientRect();
    this.resize(r.width, r.height);
  }

  /** Fallo al cargar los modelos (sin red, archivo dañado). */
  protected fail() {
    if (!this.disposed) this.baseOptions.onError?.();
  }

  /** Avanza la animación `dt` segundos. Devuelve true si aún hay algo moviéndose. */
  protected abstract step(dt: number): boolean;

  /** Relee los colores del tema. */
  protected abstract applyPalette(p: PropPalette): void;

  /** Encuadre de la cámara (al cambiar el tamaño o los datos). */
  protected layout(): void {}

  /** Animación de ambiente continua (flotar, girar despacio): sin «Reducir movimiento». */
  protected ambient(): boolean {
    return !this.reduceMotion;
  }

  setPalette(p: PropPalette) {
    this.palette = p;
    this.applyPalette(p);
    this.request();
  }

  setReduceMotion(reduce: boolean) {
    this.reduceMotion = reduce;
    this.request();
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.cleanup.forEach((fn) => fn());
    this.scene.traverse((o: Object3D) => {
      if (o instanceof Mesh || o instanceof Points) {
        (o.geometry as BufferGeometry).dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m: Material) => m.dispose());
      }
      if ('dispose' in o && typeof (o as { dispose?: unknown }).dispose === 'function' && !(o instanceof Scene)) (o as unknown as { dispose(): void }).dispose();
    });
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }

  protected listen<E extends Event>(target: EventTarget, type: string, fn: (e: E) => void, options?: AddEventListenerOptions) {
    target.addEventListener(type, fn as EventListener, options);
    this.cleanup.push(() => target.removeEventListener(type, fn as EventListener, options));
  }

  protected request = () => {
    if (this.frame || !this.visible || this.lost || document.hidden || this.disposed) return;
    this.frame = requestAnimationFrame(this.tick);
  };

  protected stop() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.last = 0;
  }

  /** Punto del lienzo en coordenadas normalizadas (−1…1). */
  protected ndc(clientX: number, clientY: number) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * 2 - 1, y: -((clientY - r.top) / r.height) * 2 + 1 };
  }

  private resize(w: number, h: number) {
    if (!w || !h) return;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.layout();
    this.camera.updateProjectionMatrix();
    this.request();
  }

  private tick = (now: number) => {
    this.frame = 0;
    const ms = this.last ? now - this.last : 1000 / 60;
    this.last = now;
    const dt = Math.min(0.05, ms / 1000);
    if (!this.reduceMotion) this.clock += dt;
    const busy = this.step(dt);
    this.renderer.render(this.scene, this.camera);
    this.adapt(ms);
    if (!this.readied && !this.loading) { this.readied = true; this.baseOptions.onReady?.(); }
    if (busy || this.ambient()) this.request();
  };

  private adapt(ms: number) {
    // Un salto largo es una pestaña que vuelve o el primer fotograma, no lentitud.
    if (ms > 200) return;
    this.frames++;
    if (ms > SLOW_MS) this.slow++;
    if (this.frames < 45) return;
    if (this.slow > 18 && this.dpr > 1) {
      this.dpr = Math.max(1, this.dpr - 0.25);
      this.renderer.setPixelRatio(this.dpr);
      this.renderer.setSize(this.width, this.height, false);
    }
    this.frames = 0;
    this.slow = 0;
  }
}
