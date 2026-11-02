// Inclinación física de las tarjetas: se levantan en Z y se inclinan hacia el cursor o el dedo, con
// un muelle, y proyectan una sombra difusa que se corre con ellas. Un solo oyente en el documento,
// no uno por tarjeta (hay decenas), y un solo bucle que corre mientras algo se mueve.
//
// - Ratón: toda .lq-card, .lq-lift y .lq-tilt, salvo las que tienen campos (mover lo que se escribe
//   molesta), lienzos 3D propios o las de los diálogos. Las muy altas no: inclinar más que la pantalla
//   marea. Un cursor de paso no levanta nada: la tarjeta responde cuando se queda un momento encima.
// - Dedo: solo las que se tocan para algo (.lq-lift) y las hojas (.lq-tilt), tras un instante quieto.
//   Un dedo que empieza a desplazar la página nunca mueve la tarjeta, y al scroll le llega pointercancel.
// - Solo se escriben transform y box-shadow en la tarjeta, y solo si cambió su valor redondeado:
//   ninguna variable heredada, que recalcularía el estilo de todo lo que tiene dentro.
// - «Reducir movimiento»: sin inclinación.
import { castShadow, settled, springStep, tiltTarget, type TiltTarget } from './tiltMath';

const CARDS = '.lq-card, .lq-lift, .lq-tilt';
/** Las que además responden al dedo: las que se tocan para algo y las hojas del diario. */
const TOUCH_CARDS = '.lq-lift, .lq-tilt';
/** Los campos y lienzos no se mueven; los materiales con sombra propia conservan la suya. */
const NO_TILT = 'input, textarea, select, canvas, [contenteditable="true"]';
const OWN_SHADOW = '.lq-zen-tray, .lq-tray, .lq-stone, .lq-marble, .lq-leaf, [class*="lq-tex-"]';
const TOUCH_DELAY = 90;
const HOVER_DELAY = 70;

interface Body {
  el: HTMLElement;
  rx: number;
  ry: number;
  z: number;
  vrx: number;
  vry: number;
  vz: number;
  target: TiltTarget;
  rect: DOMRect;
  shadow: boolean;
  lastTransform: string;
  lastShadow: string;
}

const REST: TiltTarget = { rx: 0, ry: 0, z: 0 };
const bodies = new Map<HTMLElement, Body>();
let frame = 0;
let last = 0;
let hovered: Body | null = null;
/** Tarjeta bajo el cursor que aún espera a ver si el cursor se queda. */
let hoverEl: HTMLElement | null = null;
let hoverTimer = 0;
let pointerX = 0;
let pointerY = 0;
let touchTimer = 0;
let touched: Body | null = null;

const reduced = () => document.documentElement.classList.contains('reduce-motion');

/** Se pregunta al entrar en la tarjeta, no en cada movimiento: su contenido puede haber cambiado. */
function canTilt(el: HTMLElement) {
  const h = el.offsetHeight;
  return !el.closest('[role="dialog"], [role="alertdialog"]') && !el.querySelector(NO_TILT) && h > 0 && h < window.innerHeight * 1.1;
}

function bodyOf(el: HTMLElement): Body {
  let b = bodies.get(el);
  if (!b) {
    b = {
      el, rx: 0, ry: 0, z: 0, vrx: 0, vry: 0, vz: 0, target: REST, rect: el.getBoundingClientRect(),
      shadow: !el.matches(OWN_SHADOW), lastTransform: '', lastShadow: '',
    };
    bodies.set(el, b);
    el.setAttribute('data-tilting', '');
  }
  return b;
}

function request() {
  if (!frame) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}

function write(b: Body) {
  const transform = `perspective(1100px) translateZ(${b.z.toFixed(1)}px) rotateX(${b.rx.toFixed(2)}deg) rotateY(${b.ry.toFixed(2)}deg)`;
  if (transform !== b.lastTransform) {
    b.lastTransform = transform;
    b.el.style.transform = transform;
  }
  if (!b.shadow) return;
  const shadow = castShadow(b.rx, b.ry, b.z);
  if (shadow !== b.lastShadow) {
    b.lastShadow = shadow;
    b.el.style.boxShadow = shadow;
  }
}

function retire(b: Body) {
  b.el.style.removeProperty('transform');
  b.el.style.removeProperty('box-shadow');
  b.el.removeAttribute('data-tilting');
  bodies.delete(b.el);
}

function tick(now: number) {
  frame = 0;
  const dt = last ? Math.min(0.034, (now - last) / 1000) : 1 / 60;
  last = now;
  let moving = false;
  for (const b of bodies.values()) {
    const rx = springStep(b.rx, b.vrx, b.target.rx, dt);
    const ry = springStep(b.ry, b.vry, b.target.ry, dt);
    const z = springStep(b.z, b.vz, b.target.z, dt);
    b.rx = rx.x; b.vrx = rx.v;
    b.ry = ry.x; b.vry = ry.v;
    b.z = z.x; b.vz = z.v;
    if (settled(b.rx, b.vrx, b.target.rx) && settled(b.ry, b.vry, b.target.ry) && settled(b.z, b.vz, b.target.z)) {
      if (b.target === REST) retire(b);
      else write(b);
    } else {
      write(b);
      moving = true;
    }
  }
  if (moving) {
    last = now;
    frame = requestAnimationFrame(tick);
  }
}

function aim(b: Body, x: number, y: number, touch: boolean) {
  const { rect } = b;
  b.target = tiltTarget(x - rect.left, y - rect.top, rect.width, rect.height, touch);
  request();
}

function letGo(b: Body | null) {
  if (!b) return;
  b.target = REST;
  request();
}

function clearHover() {
  window.clearTimeout(hoverTimer);
  hoverEl = null;
  letGo(hovered);
  hovered = null;
}

function onPointerMove(e: PointerEvent) {
  if (e.pointerType === 'touch' || reduced()) return;
  pointerX = e.clientX;
  pointerY = e.clientY;
  const el = (e.target as Element | null)?.closest?.<HTMLElement>(CARDS) ?? null;
  if (el !== hoverEl) {
    clearHover();
    hoverEl = el;
    if (el && canTilt(el)) {
      const next = el;
      hoverTimer = window.setTimeout(() => {
        hovered = bodyOf(next);
        // Una que aún volvía a su sitio sigue desde donde iba, con la medida que ya tiene.
        if (!hovered.lastTransform) hovered.rect = next.getBoundingClientRect();
        aim(hovered, pointerX, pointerY, false);
      }, HOVER_DELAY);
    }
    return;
  }
  if (hovered) aim(hovered, e.clientX, e.clientY, false);
}

function clearTouch() {
  window.clearTimeout(touchTimer);
  touchTimer = 0;
  letGo(touched);
  touched = null;
}

function onPointerDown(e: PointerEvent) {
  if (e.pointerType !== 'touch' || reduced()) return;
  clearTouch();
  const target = e.target as Element | null;
  const el = target?.closest?.<HTMLElement>(TOUCH_CARDS);
  if (!el || !canTilt(el)) return;
  // Un botón o enlace dentro de la tarjeta tiene su propia respuesta.
  const control = target?.closest?.('button, a, label, [role="button"]');
  if (control && control !== el && el.contains(control)) return;
  const { clientX: x, clientY: y } = e;
  touchTimer = window.setTimeout(() => {
    touched = bodyOf(el);
    touched.rect = el.getBoundingClientRect();
    aim(touched, x, y, true);
  }, TOUCH_DELAY);
}

function onLeave() {
  clearHover();
  clearTouch();
}

let started = false;

/** Una vez, al arrancar la app. */
export function startCardTilt() {
  if (started || typeof document === 'undefined') return;
  started = true;
  const passive = { passive: true } as const;
  document.addEventListener('pointermove', onPointerMove, passive);
  document.addEventListener('pointerdown', onPointerDown, passive);
  document.addEventListener('pointerup', clearTouch, passive);
  document.addEventListener('pointercancel', clearTouch, passive);
  document.documentElement.addEventListener('pointerleave', onLeave, passive);
  window.addEventListener('blur', onLeave);
  // El contenido se movió bajo el cursor: la medida guardada ya no sirve.
  window.addEventListener('scroll', clearHover, { passive: true, capture: true });
}
