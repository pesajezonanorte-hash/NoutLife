// Registro pendiente: los datos del formulario esperan aquí mientras se hace el
// onboarding y la cuenta solo se crea al terminarlo. Vive solo en memoria (sin
// persist) para que la contraseña nunca toque el almacenamiento del navegador;
// si se recarga la página hay que volver a escribirla.
import { create } from 'zustand';
import type { RegisterPayload } from '@lifequest/shared';

export type SignupDraft = RegisterPayload & { displayName: string; gender: 'male' | 'female' };

interface SignupState {
  draft: SignupDraft | null;
  setDraft: (draft: SignupDraft) => void;
  clear: () => void;
}

export const useSignupStore = create<SignupState>((set) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
  clear: () => set({ draft: null }),
}));
