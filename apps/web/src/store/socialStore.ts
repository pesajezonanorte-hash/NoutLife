// Pulso de la red social para la cabecera y el portal del inicio: mensajes sin
// leer, solicitudes, amigos en línea y rachas que esperan tu foto de hoy.
import { create } from 'zustand';
import api from '@/lib/api';
import type { PublicUser } from '@/services/network.service';

export interface SocialPulse {
  unreadMessages: number;
  requests: number;
  friends: number;
  onlineCount: number;
  online: Array<PublicUser & { zone: string | null }>;
  streaksWaiting: number;
}

interface SocialState {
  pulse: SocialPulse | null;
  refresh: () => Promise<void>;
}

let inflight: Promise<void> | null = null;

export const useSocialStore = create<SocialState>((set) => ({
  pulse: null,
  refresh: () => {
    inflight ??= api.get<SocialPulse>('/social/pulse')
      .then(({ data }) => set({ pulse: data }))
      .catch(() => undefined)
      .finally(() => { inflight = null; });
    return inflight;
  },
}));
