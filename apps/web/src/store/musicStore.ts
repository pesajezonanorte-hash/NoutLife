// Música de la app: qué suena y el control del reproductor incrustado de Spotify. El iframe vive en
// components/ui/MusicPlayer (montado una sola vez, sigue sonando al navegar); aquí se le habla con los mismos
// mensajes que usa la API de iframe de Spotify (play, pause, resume), sin cargar su script en la app.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SPOTIFY_ORIGIN } from '@/lib/spotify';

interface MusicState {
  /** Fuente elegida: id de una lista de lib/spotify, «mine» (playlist de Ajustes) o «custom» (enlace pegado). null: la de por defecto. */
  source: string | null;
  /** Enlace pegado por la persona. */
  custom: string;
  /** El reproductor ya se montó (al abrir el panel o al pedir música desde el Modo enfoque). */
  active: boolean;
  /** El reproductor avisó que acepta órdenes. */
  ready: boolean;
  playing: boolean;
  setSource: (source: string) => void;
  setCustom: (custom: string) => void;
  activate: () => void;
  play: () => void;
  pause: () => void;
}

type Command = 'play' | 'resume' | 'pause';

let frame: HTMLIFrameElement | null = null;
/** Orden pedida antes de que el reproductor esté listo: se envía al recibir «ready». */
let pending: Command | null = null;
/** Ya sonó algo de la lista cargada: lo siguiente es reanudar, no empezar de cero. */
let started = false;

// ponytail: protocolo de mensajes del reproductor incrustado (el mismo que envuelve la API de iframe oficial).
// Si Spotify lo cambia, la música deja de obedecer al temporizador pero el reproductor sigue usable a mano;
// la alternativa es cargar https://open.spotify.com/embed/iframe-api/v1 y abrirle script-src en la CSP.
const post = (command: string) => frame?.contentWindow?.postMessage({ command }, SPOTIFY_ORIGIN);

export const useMusicStore = create<MusicState>()(
  persist(
    (set, get) => ({
      source: null,
      custom: '',
      active: false,
      ready: false,
      playing: false,
      setSource: (source) => set({ source }),
      setCustom: (custom) => set({ custom }),
      activate: () => set({ active: true }),
      play: () => {
        set({ active: true });
        if (get().playing) return;
        const command: Command = started ? 'resume' : 'play';
        if (get().ready) post(command); else pending = command;
      },
      pause: () => {
        pending = null;
        if (get().ready && get().playing) post('pause');
      },
    }),
    { name: 'lq-music', partialize: ({ source, custom }) => ({ source, custom }) },
  ),
);

/** El iframe del reproductor de Spotify (null al desmontarlo o al cambiar de lista: el nuevo avisa «ready» otra vez). */
export function attachPlayer(el: HTMLIFrameElement | null) {
  frame = el;
  started = false;
  useMusicStore.setState({ ready: false, playing: false });
}

if (typeof window !== 'undefined') {
  window.addEventListener('message', (e: MessageEvent) => {
    if (e.origin !== SPOTIFY_ORIGIN || !frame || e.source !== frame.contentWindow) return;
    const data = e.data as { type?: string; payload?: { isPaused?: boolean } } | null;
    if (data?.type === 'ready') {
      useMusicStore.setState({ ready: true });
      post('load_complete_ack');
      if (pending) { post(pending); pending = null; }
    } else if (data?.type === 'playback_started' || data?.type === 'playback_update') {
      const playing = data.payload?.isPaused === undefined ? true : !data.payload.isPaused;
      if (playing) started = true;
      if (useMusicStore.getState().playing !== playing) useMusicStore.setState({ playing });
    }
  });
}
