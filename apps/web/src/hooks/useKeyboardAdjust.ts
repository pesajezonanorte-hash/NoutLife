import { useEffect } from 'react';

const TEXT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number', 'date', 'time', 'datetime-local', 'month', 'week']);

const isTextField = (el: Element | null): el is HTMLElement => {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement || (el as HTMLElement).isContentEditable) return true;
  return el instanceof HTMLInputElement && TEXT_TYPES.has(el.type || 'text');
};

/**
 * Teclado virtual en Android e iOS. El viewport visual (visualViewport) se encoge
 * cuando aparece el teclado; aquí se publica su alto real en CSS
 * (`--vvh` y `--keyboard-inset`) y se desplaza el campo enfocado hasta que quede
 * por encima del teclado. En Android el evento `resize` llega después del foco,
 * por eso se vuelve a comprobar cuando el viewport cambia.
 */
export function useKeyboardAdjust() {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    let timer = 0;

    const publish = () => {
      const height = vv?.height ?? window.innerHeight;
      const inset = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
      root.style.setProperty('--vvh', `${height}px`);
      root.style.setProperty('--keyboard-inset', `${inset > 80 ? inset : 0}px`);
      root.classList.toggle('keyboard-open', inset > 80);
    };

    const reveal = () => {
      const el = document.activeElement;
      if (!isTextField(el)) return;
      // La carta del chat ya se acomoda sola al teclado (sin esto, el renglón saltaba).
      if (el.closest('[data-keyboard-managed]')) return;
      const rect = el.getBoundingClientRect();
      const visibleTop = vv?.offsetTop ?? 0;
      const visibleBottom = visibleTop + (vv?.height ?? window.innerHeight);
      const margin = 24;
      if (rect.top >= visibleTop + margin && rect.bottom <= visibleBottom - margin) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    };

    const schedule = (delay: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(reveal, delay);
    };

    const onFocus = (e: FocusEvent) => { if (isTextField(e.target as Element)) schedule(320); };
    const onViewport = () => { publish(); schedule(60); };

    publish();
    document.addEventListener('focusin', onFocus);
    vv?.addEventListener('resize', onViewport);
    vv?.addEventListener('scroll', publish);
    window.addEventListener('resize', onViewport);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('focusin', onFocus);
      vv?.removeEventListener('resize', onViewport);
      vv?.removeEventListener('scroll', publish);
      window.removeEventListener('resize', onViewport);
    };
  }, []);
}
