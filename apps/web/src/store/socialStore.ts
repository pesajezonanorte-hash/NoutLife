// Pulso de la red social para la cabecera, el portal del inicio y las pestañas
// de Social: cartas sin leer (de amigos y de gremios), solicitudes, amigos en
// línea y rachas encendidas en las que hoy todavía no escribiste.
import { create } from 'zustand';
import api from '@/lib/api';
import type { PublicUser } from '@/services/network.service';

export interface SocialPulse {
  unreadMessages: number;
  guildUnread: number;
  requests: number;
  friendRequests: number;
  guildInvites: number;
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
