import { useEffect, useState } from 'react';

const isField = (el: Element | null) =>
  Boolean(el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || (el as HTMLElement).isContentEditable)
    && !['checkbox', 'radio', 'button', 'submit', 'range', 'file', 'color'].includes((el as HTMLInputElement).type));

/**
 * ¿Está abierto el teclado del móvil? Con el teclado, la barra inferior fija
 * sube hasta la mitad de la pantalla (el viewport se encoge): mejor ocultarla.
 * Se detecta por el foco en un campo y por el alto del visualViewport.
 */
export function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    const check = () => {
      const shrunk = vv ? window.innerHeight - vv.height > 140 : false;
      setOpen(isField(document.activeElement) || shrunk);
    };
    // El foco se mueve antes de que el teclado termine de abrirse.
    const later = () => window.setTimeout(check, 60);
    document.addEventListener('focusin', check);
    document.addEventListener('focusout', later);
    vv?.addEventListener('resize', check);
    return () => {
      document.removeEventListener('focusin', check);
      document.removeEventListener('focusout', later);
      vv?.removeEventListener('resize', check);
    };
  }, []);
  return open;
}
