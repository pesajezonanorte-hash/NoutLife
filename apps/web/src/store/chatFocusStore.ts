// Qué carta tiene abierta la persona ahora ("dm:<amigo>" | "guild:<gremio>"). Los
// avisos de mensajes nuevos no se muestran para esa misma carta: ya la está viendo.
import { create } from 'zustand';

interface ChatFocusState {
  key: string | null;
  open: (key: string) => void;
  close: (key: string) => void;
}

export const useChatFocus = create<ChatFocusState>((set) => ({
  key: null,
  open: (key) => set({ key }),
  close: (key) => set((s) => (s.key === key ? { key: null } : s)),
}));
