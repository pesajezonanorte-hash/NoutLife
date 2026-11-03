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
  /** Panel del reproductor (no modal; el iframe sigue montado al cerrarlo). */
  musicOpen: boolean;
  /** La invitación a los avisos está abierta. */
  inviteOpen: boolean;
  /** Ya se sabe si hay invitación y, si la hubo, ya se cerró: hasta entonces, el tutorial y los demás avisos esperan. */
  inviteSettled: boolean;
  setCrumb: (crumb: string | null) => void;
  setMenuOpen: (open: boolean) => void;
  setQuickOpen: (open: boolean) => void;
  openQuickAction: (action: QuickAction | null) => void;
  setFocusOpen: (open: boolean) => void;
  setFeedbackOpen: (open: boolean) => void;
  setMusicOpen: (open: boolean) => void;
}

export const useShellStore = create<ShellState>()((set) => ({
  crumb: null,
  menuOpen: false,
  quickOpen: false,
  quickAction: null,
  inviteOpen: false,
  inviteSettled: false,
  focusOpen: false,
  feedbackOpen: false,
  musicOpen: false,
  setCrumb: (crumb) => set({ crumb }),
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  setQuickOpen: (quickOpen) => set({ quickOpen }),
  // Abrir un formulario cierra la hoja de acciones (nunca dos diálogos a la vez).
  openQuickAction: (quickAction) => set({ quickAction, quickOpen: false }),
  setFocusOpen: (focusOpen) => set({ focusOpen }),
  setFeedbackOpen: (feedbackOpen) => set({ feedbackOpen }),
  setMusicOpen: (musicOpen) => set({ musicOpen }),
}));

/** Fija el último tramo del breadcrumb mientras la página está montada. */
export function usePageCrumb(label: string | null | undefined) {
  const setCrumb = useShellStore((s) => s.setCrumb);
  useEffect(() => {
    setCrumb(label ?? null);
    return () => setCrumb(null);
  }, [label, setCrumb]);
}
