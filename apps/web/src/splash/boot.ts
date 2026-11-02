// Arranque del splash, antes del paquete principal (vite.config, splashBoot: va en su propio chunk):
// lee el tema, lanza el héroe 3D en un Worker y saca el splash cuando la app ya está pintada debajo. La
// gota de CSS de index.html se ve desde el primer pintado; el 3D la releva sin que se note. Sin WebGL
// de verdad, con «Ahorro de datos» o con 2G, la gota hace todo el camino ella sola.
import heroUrl from '@/assets/models/calm-hero.glb?url';
import type { HeroCommand, HeroEvent, HeroInit, HeroLayout, HeroTarget, HeroTones, Rgb } from './hero';
import { leaveDelay } from './timing';

declare global {
  interface Window {
    /** App.tsx lo llama (por SplashScreen) con la app ya montada debajo. */
    lqSplash?: { leave(): void };
  }
}

const boot = document.getElementById('lq-boot');
const root = document.documentElement;
const reduce = root.classList.contains('lq-rm');

const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Los mismos tonos de three3d/calmMaterial (readCalmTones): el canto rodado llega con su color. */
function readTones(): HeroTones {
  const css = getComputedStyle(root);
  const dark = root.classList.contains('dark');
  const token = (name: string, fallback: string): Rgb => {
    const [r, g, b] = (css.getPropertyValue(`--lq-${name}`).trim() || fallback).split(/[\s,]+/).map(Number);
    return [linear(r / 255), linear(g / 255), linear(b / 255)];
  };
  const surface = dark ? token('surface-variant', '21 34 27') : token('surface', '255 255 255');
  const paper = token('background', '249 247 243');
  const j100 = token('jade-100', '220 243 225');
  const j200 = token('jade-200', '196 226 202');
  const j300 = token('jade-300', '165 210 181');
  const j400 = token('jade-400', '133 199 161');
  const j500 = token('jade-500', '112 180 141');
  const j600 = token('jade-600', '84 143 111');
  const j900 = token('jade-900', '14 29 22');
  const mint = dark ? mix(j600, j400, 0.5) : mix(j200, j300, 0.55);
  return {
    dark,
    clay: dark ? mix(j500, j300, 0.35) : mix(paper, j100, 0.62),
    mint,
    deep: dark ? mix(j600, j500, 0.35) : mix(j200, j400, 0.55),
    glass: dark ? mix(j500, j300, 0.5) : mix(paper, j100, 0.55),
    light: dark ? j300 : mix(j300, j200, 0.35),
    shade: dark ? mix(j600, surface, 0.6) : mix(j500, j600, 0.25),
    shadow: dark ? [0, 0, 0] : mix(j900, j600, 0.3),
  };
}

function readLayout(): HeroLayout {
  const mark = boot!.querySelector('.mk')!.getBoundingClientRect();
  const word = boot!.querySelector('.wm')!.getBoundingClientRect();
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    // El lienzo cubre la pantalla, con antialias: en teléfonos con poca memoria, un poco menos nítido.
    dpr: Math.min(window.devicePixelRatio || 1, ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) < 4 ? 2 : 2.5),
    x: mark.left + mark.width / 2,
    y: mark.top + mark.height / 2,
    size: mark.width,
    text: { x: word.left, y: word.top, w: word.width, h: word.height },
  };
}

const onScreen = (r: DOMRect) => r.width > 0 && r.height > 0 && r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight;

/**
 * El canto rodado de la pestaña activa. En las pantallas sin navbar, la marca de la cabecera. Con el
 * navbar a la vista y aún sin medir, espera: `last` da la búsqueda por terminada.
 */
function findTarget(last: boolean): HeroTarget | null {
  const rects = (selector: string) => Array.from(document.querySelectorAll(selector), (el) => el.getBoundingClientRect()).filter(onScreen);
  const box = (kind: HeroTarget['kind'], r: DOMRect): HeroTarget => ({ kind, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height });
  const [pebble] = rects('.lq-nav-pebble[data-placed]');
  if (pebble) return box('pebble', pebble);
  if (!last && rects('.lq-nav-pebble').length) return null;
  const [mark] = rects('[data-brand-mark]');
  return mark ? box('mark', mark) : null;
}

/** La gota, sin 3D: viaja con transform (compositor) y se apaga al llegar. */
function flyDrop(target: HeroTarget | null) {
  const drop = boot?.querySelector<HTMLElement>('.drop');
  if (!drop || !target || reduce) return;
  boot!.classList.add('fly');
  const r = drop.getBoundingClientRect();
  const dx = target.x - (r.left + r.width / 2);
  const dy = target.y - (r.top + r.height / 2);
  const k = Math.max(target.w, target.h) / r.width;
  drop.style.animation = 'none';
  drop.animate(
    [{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(${k})`, opacity: 1, offset: 0.86 }, { transform: `translate(${dx}px, ${dy}px) scale(${k})`, opacity: 0 }],
    { duration: 820, easing: 'cubic-bezier(.65, 0, .35, 1)', fill: 'forwards' },
  );
}

let send: ((cmd: HeroCommand) => void) | null = null;
let canvas: HTMLCanvasElement | null = null;
let closeHero: (() => void) | null = null;

function onEvent(e: HeroEvent) {
  if (e.type === 'ready') {
    bornAt = performance.now();
    boot?.classList.add('born');
  } else if (e.type === 'fail') dropHero();
  else if (e.type === 'landed') land?.();
}

function dropHero() {
  closeHero?.();
  closeHero = null;
  send = null;
  canvas?.remove();
  canvas = null;
  boot?.classList.remove('born');
  // Si ya iba de salida, la gota no llega a ningún sitio: que no espere más.
  land?.();
}

let land: (() => void) | null = null;
let bornAt = 0;
let themeWatch: MutationObserver | null = null;

function startHero() {
  const net = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  // Con «Reducir movimiento», la gota quieta y un fundido: nada que descargar.
  if (!boot || reduce || !('WebGL2RenderingContext' in window) || net?.saveData || /2g/.test(net?.effectiveType ?? '')) return;
  const real = { failIfMajorPerformanceCaveat: true };
  let workerGl = false;
  try {
    workerGl = 'transferControlToOffscreen' in HTMLCanvasElement.prototype && Boolean(new OffscreenCanvas(1, 1).getContext('webgl2', real));
  } catch { /* Safari antiguo: Offscreen sin WebGL */ }
  // Sin GPU de verdad, ni siquiera se descarga: la gota hace el camino.
  if (!workerGl && !document.createElement('canvas').getContext('webgl2', real)) return;
  canvas = document.createElement('canvas');
  canvas.id = 'lq-boot-3d';
  canvas.setAttribute('aria-hidden', 'true');
  boot.after(canvas);
  const init: HeroInit = { url: heroUrl, tones: readTones(), layout: readLayout() };
  if (workerGl) {
    const worker = new Worker(new URL('./hero.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => onEvent(data as HeroEvent);
    worker.onerror = () => dropHero();
    const off = canvas.transferControlToOffscreen();
    worker.postMessage({ canvas: off, init }, [off]);
    send = (cmd) => worker.postMessage(cmd);
    closeHero = () => worker.terminate();
  } else {
    // Sin Offscreen va en el hilo principal: se traba un poco mientras React monta, pero se ve.
    const local = canvas;
    void import('./hero').then(({ startHero: start }) => {
      if (canvas !== local) return;
      const hero = start(local, init, onEvent);
      send = (cmd) => hero.handle(cmd);
      closeHero = () => hero.handle({ type: 'stop' });
    }).catch(dropHero);
  }
  // Si cambian la medida o el tema (la cuenta trae su tema de la Tienda), el 3D los sigue.
  window.addEventListener('resize', resized);
  themeWatch = new MutationObserver(() => send?.({ type: 'tones', tones: readTones() }));
  themeWatch.observe(root, { attributes: true, attributeFilter: ['class', 'data-theme'] });
}

const resized = () => {
  if (boot?.isConnected && !left) send?.({ type: 'layout', layout: readLayout() });
};

let left = false;

/** Busca el destino unos fotogramas: la app acaba de montarse y el navbar se mide después. */
function whenTarget(done: (t: HeroTarget | null) => void) {
  let frames = 0;
  const started = performance.now();
  const look = () => {
    frames++;
    const last = frames > 12 || performance.now() - started > 700;
    const t = frames > 1 ? findTarget(last) : null;
    if (t || last) done(t);
    else requestAnimationFrame(look);
  };
  requestAnimationFrame(look);
}

function leave() {
  if (left || !boot) return;
  left = true;
  window.removeEventListener('resize', resized);
  whenTarget((target) => {
    const outAt = performance.now();
    const finish = () => {
      if (!boot.isConnected) return;
      land = null;
      window.clearTimeout(limit);
      const gone = canvas;
      if (gone) gone.style.opacity = '0';
      // El relevo con el navbar y, si llegó antes, lo que falte del fundido del fondo (.5 s).
      window.setTimeout(() => {
        themeWatch?.disconnect();
        closeHero?.();
        gone?.remove();
        boot.remove();
      }, Math.max(180, 520 - (performance.now() - outAt)));
    };
    // Si algo se atasca (pestaña oculta, GPU perdida), la app no se queda tapada.
    const limit = window.setTimeout(finish, 4000);
    if (send && boot.classList.contains('born')) {
      land = finish;
      send({ type: 'leave', target: target ?? { kind: 'none', x: 0, y: 0, w: 0, h: 0 } });
      boot.style.setProperty('--wait', `${leaveDelay(performance.now() - bornAt)}ms`);
    } else {
      // El modelo no ha llegado (red lenta) o no hay 3D: no se le espera.
      dropHero();
      flyDrop(target);
      window.setTimeout(finish, reduce ? 500 : 860);
    }
    boot.classList.add('out');
  });
}

window.lqSplash = { leave };
startHero();
