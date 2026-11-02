// Arranque del splash, antes del paquete principal (vite.config, splashBoot: va en su propio chunk):
// lee el tema, lanza la secuencia 3D en un Worker y saca el splash cuando la app ya está pintada debajo.
// Si tarda, index.html muestra la N de CSS (.n) y el 3D la releva sin que se note. Sin WebGL de verdad,
// con «Ahorro de datos» o con 2G, esa N hace todo el camino ella sola hasta el logo.
import heroUrl from '@/assets/models/calm-hero.glb?url';
import type { HeroCommand, HeroEvent, HeroInit, HeroLayout, HeroTarget, HeroTones, Rgb } from './hero';
import { leaveDelay } from './timing';

declare global {
  interface Window {
    /** App.tsx lo llama (por SplashScreen) con la app ya montada debajo. `seen`: recarga en la misma pestaña. */
    lqSplash?: { leave(): void; seen: boolean };
  }
}

const boot = document.getElementById('lq-boot');
const root = document.documentElement;
const reduce = root.classList.contains('lq-rm');

const SEEN_KEY = 'lq-splash-seen';
/** La app ya está lista pero el 3D aún no ha dado su primer fotograma: se le espera este tiempo. */
const HERO_WAIT_MS = 1200;

let seen = false;
try {
  seen = sessionStorage.getItem(SEEN_KEY) === '1';
  sessionStorage.setItem(SEEN_KEY, '1');
} catch { /* sin storage: siempre la historia entera */ }

const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Lo que resuelve el navegador para un color: «#rrggbb», «rgb(r g b)», «rgb(r, g, b)». En sRGB de 0 a 1. */
function parseColor(value: string, fallback: Rgb): Rgb {
  const v = value.trim();
  const hex = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(v);
  if (hex) return [parseInt(hex[1], 16) / 255, parseInt(hex[2], 16) / 255, parseInt(hex[3], 16) / 255];
  const rgb = /rgb\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(v);
  return rgb ? [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255] : fallback;
}

function readTones(): HeroTones {
  const css = getComputedStyle(root);
  const dark = root.classList.contains('dark');
  const token = (name: string, fallback: string): Rgb => {
    const [r, g, b] = (css.getPropertyValue(`--lq-${name}`).trim() || fallback).split(/[\s,]+/).map(Number);
    return [linear(r / 255), linear(g / 255), linear(b / 255)];
  };
  const j100 = token('jade-100', '220 243 225');
  const j200 = token('jade-200', '196 226 202');
  const j300 = token('jade-300', '165 210 181');
  const j400 = token('jade-400', '133 199 161');
  const j500 = token('jade-500', '112 180 141');
  const j600 = token('jade-600', '84 143 111');
  const j900 = token('jade-900', '14 29 22');
  // --lq-brand-* pueden depender de otras variables: se resuelven con el propio navegador.
  const probe = document.createElement('i');
  probe.style.display = 'none';
  document.documentElement.appendChild(probe);
  const stop = (name: string, fallback: string): Rgb => {
    probe.style.color = `var(--lq-brand-${name}, ${fallback})`;
    return parseColor(getComputedStyle(probe).color, parseColor(fallback, [0.3, 0.6, 0.5]));
  };
  const logo = [
    [stop('c0', '#4f9c84'), stop('c1', '#2a6f60'), stop('c2', '#06302b')],
    [stop('a0', '#5fae97'), stop('a1', '#2f7565'), stop('a2', '#0a3a33'), stop('a3', '#05302b')],
    [stop('b0', '#8ec7ad'), stop('b1', '#2c7362')],
  ];
  probe.remove();
  return {
    dark,
    mint: dark ? mix(j400, j300, 0.5) : mix(j200, j100, 0.5),
    deep: dark ? mix(j500, j400, 0.4) : mix(j400, j500, 0.45),
    light: dark ? j300 : mix(j200, j300, 0.4),
    leaf: dark ? mix(j300, j200, 0.5) : mix(j200, j300, 0.45),
    shadow: dark ? [0, 0, 0] : mix(j900, j600, 0.3),
    logo,
  };
}

function readLayout(): HeroLayout {
  const mark = boot!.querySelector('.mk')!.getBoundingClientRect();
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    // El lienzo cubre la pantalla: en teléfonos con poca memoria, un poco menos nítido.
    dpr: Math.min(window.devicePixelRatio || 1, ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) < 4 ? 2 : 2.5),
    x: mark.left + mark.width / 2,
    y: mark.top + mark.height / 2,
    size: mark.height,
  };
}

const onScreen = (r: DOMRect) => r.width > 0 && r.height > 0 && r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight;

/** El logo de la cabecera. El .glb y el SVG miden lo mismo: su alto es el de la caja. */
function findTarget(): HeroTarget | null {
  const mark = Array.from(document.querySelectorAll('[data-brand-mark]'), (el) => el.getBoundingClientRect()).find(onScreen);
  return mark ? { kind: 'mark', x: mark.left + mark.width / 2, y: mark.top + mark.height / 2, h: mark.height } : null;
}

/** La N de CSS, sin 3D: viaja con transform (compositor) hasta el logo y lo releva. */
function flyMark(target: HeroTarget | null) {
  const mark = boot?.querySelector<SVGElement>('.n');
  if (!mark || !target || reduce) return;
  boot!.classList.add('fly');
  const r = mark.getBoundingClientRect();
  const dx = target.x - (r.left + r.width / 2);
  const dy = target.y - (r.top + r.height / 2);
  const k = target.h / r.height;
  mark.style.animation = 'none';
  mark.style.opacity = '1';
  mark.animate(
    [{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${k})` }],
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
    waiting?.();
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
  boot?.classList.add('flat');
  // Si ya iba de salida, no llega a ningún sitio: que no espere más.
  land?.();
  waiting?.();
}

let land: (() => void) | null = null;
let waiting: (() => void) | null = null;
let bornAt = 0;
let themeWatch: MutationObserver | null = null;

function startHero() {
  const net = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  // Con «Reducir movimiento», la N quieta y un fundido: nada que descargar.
  if (!boot || reduce || !('WebGL2RenderingContext' in window) || net?.saveData || /2g/.test(net?.effectiveType ?? '')) {
    boot?.classList.add('flat');
    return;
  }
  const real = { failIfMajorPerformanceCaveat: true };
  let workerGl = false;
  try {
    workerGl = 'transferControlToOffscreen' in HTMLCanvasElement.prototype && Boolean(new OffscreenCanvas(1, 1).getContext('webgl2', real));
  } catch { /* Safari antiguo: Offscreen sin WebGL */ }
  // Sin GPU de verdad, ni siquiera se descarga: la N de CSS hace el camino.
  if (!workerGl && !document.createElement('canvas').getContext('webgl2', real)) {
    boot.classList.add('flat');
    return;
  }
  canvas = document.createElement('canvas');
  canvas.id = 'lq-boot-3d';
  canvas.setAttribute('aria-hidden', 'true');
  boot.after(canvas);
  const init: HeroInit = { url: new URL(heroUrl, location.href).href, tones: readTones(), layout: readLayout(), openedAt: performance.timeOrigin, seen };
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

/** Busca el destino unos fotogramas: la app acaba de montarse. */
function whenTarget(done: (t: HeroTarget | null) => void) {
  let frames = 0;
  const started = performance.now();
  const look = () => {
    frames++;
    const last = frames > 12 || performance.now() - started > 700;
    const t = frames > 1 ? findTarget() : null;
    if (t || last) done(t);
    else requestAnimationFrame(look);
  };
  requestAnimationFrame(look);
}

function leave() {
  if (left || !boot) return;
  left = true;
  window.removeEventListener('resize', resized);
  if (!canvas || boot.classList.contains('born')) {
    depart();
    return;
  }
  const limit = window.setTimeout(() => waiting?.(), HERO_WAIT_MS);
  waiting = () => {
    waiting = null;
    window.clearTimeout(limit);
    depart();
  };
}

function depart() {
  if (!boot) return;
  whenTarget((target) => {
    const outAt = performance.now();
    const finish = () => {
      if (!boot.isConnected) return;
      land = null;
      window.clearTimeout(limit);
      // El logo de verdad releva a la N del lienzo, que ya es igual que él (calm.css).
      boot.classList.add('landed');
      const gone = canvas;
      if (gone) gone.style.opacity = '0';
      // El relevo y, si llegó antes, lo que falte del fundido del fondo.
      window.setTimeout(() => {
        themeWatch?.disconnect();
        closeHero?.();
        gone?.remove();
        boot.remove();
      }, Math.max(200, 820 - (performance.now() - outAt)));
    };
    // Si algo se atasca (pestaña oculta, GPU perdida), la app no se queda tapada.
    const limit = window.setTimeout(finish, 4600);
    if (send && boot.classList.contains('born')) {
      land = finish;
      send({ type: 'leave', target: target ?? { kind: 'none', x: 0, y: 0, h: 0 } });
      boot.style.setProperty('--wait', `${leaveDelay(performance.now() - bornAt)}ms`);
    } else {
      // El modelo no ha llegado (red lenta) o no hay 3D: no se le espera.
      dropHero();
      flyMark(target);
      window.setTimeout(finish, reduce ? 500 : 860);
    }
    boot.classList.add('out');
  });
}

window.lqSplash = { leave, seen };
startHero();
