// La carta a pantalla completa del móvil ocupa exactamente lo que se ve por
// encima del teclado (visualViewport): el renglón queda pegado al teclado, sin
// saltos, y nada se tapa. iOS no encoge la página al abrir el teclado (solo la
// vista), así que se sigue la vista visible; en Android pasa lo mismo con
// interactive-widget=resizes-content. También da el alto del teclado (para que
// el cajón de stickers ocupe su mismo sitio).
import { useEffect, useState } from 'react';

export interface ViewportBox { top: number; height: number; keyboard: number }

// Algunos Android (PWA instalada, WebView) dejan el teclado encima de la página sin
// encoger la vista; ahí solo la VirtualKeyboard API informa de su alto.
type VirtualKeyboardApi = EventTarget & { overlaysContent: boolean; boundingRect: DOMRect };
const virtualKeyboard = (): VirtualKeyboardApi | null =>
  typeof navigator !== 'undefined' ? ((navigator as unknown as { virtualKeyboard?: VirtualKeyboardApi }).virtualKeyboard ?? null) : null;

const read = (): ViewportBox => {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  if (!vv) return { top: 0, height: typeof window !== 'undefined' ? window.innerHeight : 800, keyboard: 0 };
  const keyboard = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
  if (keyboard > 120) return { top: Math.round(vv.offsetTop), height: Math.round(vv.height), keyboard };
  const overlay = Math.round(virtualKeyboard()?.boundingRect.height ?? 0);
  if (overlay > 120) return { top: Math.round(vv.offsetTop), height: Math.round(vv.height) - overlay, keyboard: overlay };
  return { top: Math.round(vv.offsetTop), height: Math.round(vv.height), keyboard: 0 };
};

let lastKeyboard = 0;
/** Alto del teclado la última vez que se abrió (0 si nunca). */
export const knownKeyboard = () => lastKeyboard;

export function useViewportBox(enabled = true): ViewportBox {
  const [box, setBox] = useState<ViewportBox>(read);
  useEffect(() => {
    if (!enabled) return;
    const vv = window.visualViewport;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const next = read();
        if (next.keyboard) lastKeyboard = next.keyboard;
        setBox((b) => (b.top === next.top && b.height === next.height && b.keyboard === next.keyboard ? b : next));
      });
    };
    const vk = virtualKeyboard();
    const prevOverlay = vk?.overlaysContent ?? false;
    if (vk) vk.overlaysContent = true;
    vk?.addEventListener('geometrychange', on);
    on();
    // iOS anima el teclado y la barra de sugerencias: se sigue leyendo mientras se acomoda.
    let settle = 0;
    const settling = () => {
      window.clearInterval(settle);
      let n = 0;
      settle = window.setInterval(() => { on(); if (++n > 12) window.clearInterval(settle); }, 60);
    };
    window.addEventListener('focusin', settling);
    window.addEventListener('focusout', settling);
    vv?.addEventListener('resize', on);
    vv?.addEventListener('scroll', on);
    window.addEventListener('resize', on);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(settle);
      vk?.removeEventListener('geometrychange', on);
      if (vk) vk.overlaysContent = prevOverlay;
      window.removeEventListener('focusin', settling);
      window.removeEventListener('focusout', settling);
      vv?.removeEventListener('resize', on);
      vv?.removeEventListener('scroll', on);
      window.removeEventListener('resize', on);
    };
  }, [enabled]);
  return box;
}
