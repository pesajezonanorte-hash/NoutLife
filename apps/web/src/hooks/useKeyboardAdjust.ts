import { useEffect } from 'react';

export function useKeyboardAdjust() {
  useEffect(() => {
    if (!/iPad|iPhone|iPod/.test(navigator.userAgent)) return;

    const handler = (e: FocusEvent) => {
      const t = e.target as HTMLElement;
      if (!['INPUT', 'TEXTAREA'].includes(t.tagName) && t.contentEditable !== 'true') return;
      // La carta del chat ya se acomoda sola al teclado (sin esto, el renglón saltaba).
      if (t.closest('[data-keyboard-managed]')) return;
      setTimeout(() => t.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350);
    };

    document.addEventListener('focusin', handler);
    return () => document.removeEventListener('focusin', handler);
  }, []);
}
