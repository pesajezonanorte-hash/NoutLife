import { useEffect } from 'react';

const isField = (t: HTMLElement | null) =>
  !!t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable);

export function useKeyboardAdjust() {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    let timer: number | undefined;

    const reveal = (t: HTMLElement) => {
      if (t.closest('[data-keyboard-managed]')) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (document.activeElement === t) t.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    };

    const syncHeight = () => {
      if (vv) root.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
    };

    const onFocus = (e: FocusEvent) => {
      const t = e.target as HTMLElement;
      if (isField(t)) reveal(t);
    };

    const onResize = () => {
      syncHeight();
      const a = document.activeElement as HTMLElement | null;
      if (a && isField(a)) reveal(a);
    };

    syncHeight();
    document.addEventListener('focusin', onFocus);
    vv?.addEventListener('resize', onResize);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('focusin', onFocus);
      vv?.removeEventListener('resize', onResize);
      root.style.removeProperty('--vvh');
    };
  }, []);
}
