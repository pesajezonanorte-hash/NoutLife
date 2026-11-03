// Arranque del splash, antes del paquete principal (vite.config, splashBoot: va en su propio chunk).
// La entrada es CSS (index.html): las tres hojas del logo se juntan formando la N y aparece «noutlife»
// letra a letra. Cuando esa entrada termina y la app ya está lista, hero.ts (un Worker) funde la N en
// líquido y la corriente la lleva hasta el logo de la cabecera. Sin WebGL de verdad, con «Ahorro de datos»
// o con 2G, la N de CSS vuela sola hasta el logo.
import heroUrl from '@/assets/models/calm-hero.glb?url';
import type { HeroCommand, HeroEvent, HeroInit, HeroLayout, HeroTarget, HeroTones, Rgb } from './hero';
import { INTRO_MAX_MS, LAND_MAX_MS, LEAVE_HOLD_MS, MIN_INTRO_FPS } from './timing';

declare global {
  interface Window {
    /** App.tsx lo llama (por SplashScreen) con la app ya montada debajo. */
    lqSplash?: { leave(): void };
  }
}

const boot = document.getElementById('lq-boot');
const root = document.documentElement;
const reduce = root.classList.contains('lq-rm');

/** La entrada de CSS acaba con el eslogan, que es la última animación. Si no corre o le faltan fotogramas, no se espera más. */
const intro = new Promise<void>((done) => {
  const last = boot?.querySelector('.tg');
  if (!last) return done();
  last.addEventListener('animationend', () => done(), { once: true });
  window.setTimeout(done, Math.max(0, INTRO_MAX_MS - performance.now()));
});

/** Fotogramas durante la entrada. Hay GPU lentos que no avisan al pedir el contexto: esto los delata. */
const introStart = performance.now();
let introFrames = 0;
let departed = false;
const countFrame = () => {
  introFrames++;
  if (!departed) requestAnimationFrame(countFrame);
};
requestAnimationFrame(countFrame);

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
  const j200 = token('jade-200', '196 226 202');
  const j300 = token('jade-300', '165 210 181');
  const j400 = token('jade-400', '133 199 161');
  const j500 = token('jade-500', '112 180 141');
  const j600 = token('jade-600', '84 143 111');
  const j900 = token('jade-900', '14 29 22');
  const j100 = token('jade-100', '220 243 225');
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
    shadow: dark ? [0, 0, 0] : mix(j900, j600, 0.3),
    logo,
  };
}

/** La N de CSS (.mk): el lienzo del 3D va exactamente encima, con su mismo tamaño y lugar. */
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

/** El logo de la cabecera: la N se funde hasta él. */
function findTarget(): HeroTarget | null {
  const mark = Array.from(document.querySelectorAll('[data-brand-mark]'), (el) => el.getBoundingClientRect()).find(onScreen);
  return mark ? { kind: 'mark', x: mark.left + mark.width / 2, y: mark.top + mark.height / 2, h: mark.height } : null;
}

/** Sin 3D: la N de CSS viaja con transform (compositor) hasta el logo de la cabecera. */
function flyMark(target: HeroTarget | null) {
  const mark = boot?.querySelector<SVGElement>('.mk');
  if (!mark || !target || reduce) return;
  const r = mark.getBoundingClientRect();
  const dx = target.x - (r.left + r.width / 2);
  const dy = target.y - (r.top + r.height / 2);
  const k = target.h / r.height;
  mark.style.animation = 'none';
  mark.animate(
    [{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${k})` }],
    { duration: 820, easing: 'cubic-bezier(.65, 0, .35, 1)', fill: 'forwards' },
  );
}

let send: ((cmd: HeroCommand) => void) | null = null;
let canvas: HTMLCanvasElement | null = null;
let closeHero: (() => void) | null = null;
let land: (() => void) | null = null;
let failed = false;
let themeWatch: MutationObserver | null = null;

function onEvent(e: HeroEvent) {
  if (e.type === 'fail') dropHero();
  else land?.();
}

/** El 3D no sirve: se quita y la N de CSS hace el camino sola. */
function dropHero() {
  failed = true;
  closeHero?.();
  closeHero = null;
  send = null;
  canvas?.remove();
  canvas = null;
  land?.();
}

function startHero() {
  const net = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  // Con «Reducir movimiento», la N quieta y un fundido: nada que descargar.
  if (!boot || reduce || !('WebGL2RenderingContext' in window) || net?.saveData || /2g/.test(net?.effectiveType ?? '')) {
    failed = true;
    return;
  }
  const real = { failIfMajorPerformanceCaveat: true };
  let workerGl = false;
  try {
    workerGl = 'transferControlToOffscreen' in HTMLCanvasElement.prototype && Boolean(new OffscreenCanvas(1, 1).getContext('webgl2', real));
  } catch { /* Safari antiguo: Offscreen sin WebGL */ }
  // Sin GPU de verdad, ni siquiera se descarga: la N de CSS hace el camino.
  if (!workerGl && !document.createElement('canvas').getContext('webgl2', real)) {
    failed = true;
    return;
  }
  canvas = document.createElement('canvas');
  canvas.id = 'lq-boot-3d';
  canvas.setAttribute('aria-hidden', 'true');
  boot.after(canvas);
  const init: HeroInit = { url: new URL(heroUrl, location.href).href, tones: readTones(), layout: readLayout() };
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

/** La app ya está montada debajo: cuando la entrada de CSS acaba, se espera un momento y sale la N. */
function leave() {
  if (left || !boot) return;
  left = true;
  window.removeEventListener('resize', resized);
  intro.then(() => window.setTimeout(depart, reduce ? 0 : LEAVE_HOLD_MS));
}

function depart() {
  if (!boot) return;
  departed = true;
  // Mientras la N sale, esto ya no se mide: el líquido competiría con el montaje de la app en un equipo sin margen.
  if (canvas && introFrames / ((performance.now() - introStart) / 1000) < MIN_INTRO_FPS) dropHero();
  whenTarget((target) => {
    const finish = () => {
      if (!boot.isConnected) return;
      land = null;
      window.clearTimeout(limit);
      // La N ya está en el logo de la cabecera: se muestra, y el splash se va despacio, sin cortes.
      boot.classList.add('landed', 'out');
      const gone = canvas;
      window.setTimeout(() => {
        themeWatch?.disconnect();
        closeHero?.();
        gone?.remove();
        boot.remove();
      }, 900);
    };
    // Si algo se atasca (pestaña oculta, GPU perdida), la app no se queda tapada.
    const limit = window.setTimeout(finish, LAND_MAX_MS);
    if (send && !failed) {
      // La N de CSS cede su sitio a la del 3D, que nace en el mismo lugar y con el mismo tamaño.
      send({ type: 'layout', layout: readLayout() });
      send({ type: 'leave', target: target ?? { kind: 'none', x: 0, y: 0, h: 0 } });
      land = finish;
      boot.classList.add('taken', 'out');
    } else {
      // Sin 3D (o si falló): la N de CSS vuela sola hasta el logo.
      flyMark(target);
      boot.classList.add('out');
      window.setTimeout(finish, reduce ? 500 : 860);
    }
  });
}

window.lqSplash = { leave };
startHero();
