// Estado efímero del AppShell: hojas/menús abiertos y el último tramo del
// breadcrumb que aporta la página (p. ej. el nombre de un hábito).
import { useEffect } from 'react';
import { create } from 'zustand';

export type QuickAction = 'quest' | 'expense' | 'habit' | 'note' | 'checkin';

interface ShellState {
  crumb: string | null;
  menuOpen: boolean;
  quickOpen: boolean;
  quickAction: QuickAction | null;
  focusOpen: boolean;
  feedbackOpen: boolean;
  setCrumb: (crumb: string | null) => void;
  setMenuOpen: (open: boolean) => void;
  setQuickOpen: (open: boolean) => void;
  openQuickAction: (action: QuickAction | null) => void;
  setFocusOpen: (open: boolean) => void;
  setFeedbackOpen: (open: boolean) => void;
}

export const useShellStore = create<ShellState>()((set) => ({
  crumb: null,
  menuOpen: false,
  quickOpen: false,
  quickAction: null,
  focusOpen: false,
  feedbackOpen: false,
  setCrumb: (crumb) => set({ crumb }),
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  setQuickOpen: (quickOpen) => set({ quickOpen }),
  // Abrir un formulario cierra la hoja de acciones (nunca dos diálogos a la vez).
  openQuickAction: (quickAction) => set({ quickAction, quickOpen: false }),
  setFocusOpen: (focusOpen) => set({ focusOpen }),
  setFeedbackOpen: (feedbackOpen) => set({ feedbackOpen }),
}));

/** Fija el último tramo del breadcrumb mientras la página está montada. */
export function usePageCrumb(label: string | null | undefined) {
  const setCrumb = useShellStore((s) => s.setCrumb);
  useEffect(() => {
    setCrumb(label ?? null);
    return () => setCrumb(null);
  }, [label, setCrumb]);
}
