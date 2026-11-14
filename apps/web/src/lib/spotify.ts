// Spotify dentro de la app: se usa su reproductor incrustado (open.spotify.com/embed), sin cuenta de
// desarrollador ni claves. Aquí vive lo puro: reconocer un enlace, armar la URL del reproductor y las listas
// para enfocarse. El control (reproducir, pausar) va por mensajes al iframe en store/musicStore.
//
// Límite conocido del reproductor incrustado: sin sesión de Spotify en este navegador solo suenan avances de
// 30 s. Para control total (cola, volumen, pista) haría falta el Web Playback SDK, con una app registrada en
// Spotify y cuenta Premium.

export type SpotifyKind = 'playlist' | 'album' | 'track' | 'artist' | 'show' | 'episode';
export interface SpotifyRef { kind: SpotifyKind; id: string }

const KINDS = 'playlist|album|track|artist|show|episode';
const URL_RE = new RegExp(`open\\.spotify\\.com/(?:intl-[a-z]{2}/)?(?:embed/)?(${KINDS})/([A-Za-z0-9]{10,40})`);
const URI_RE = new RegExp(`^spotify:(${KINDS}):([A-Za-z0-9]{10,40})$`);

/** Un enlace de Spotify (web, con o sin idioma, o URI spotify:…) como tipo e id; null si no lo es. */
export function parseSpotify(input: string | null | undefined): SpotifyRef | null {
  const text = (input ?? '').trim();
  const match = URL_RE.exec(text) ?? URI_RE.exec(text);
  return match ? { kind: match[1] as SpotifyKind, id: match[2] } : null;
}

export const SPOTIFY_ORIGIN = 'https://open.spotify.com';
export const spotifyEmbedUrl = (ref: SpotifyRef, dark = false) => `${SPOTIFY_ORIGIN}/embed/${ref.kind}/${ref.id}?utm_source=generator${dark ? '&theme=0' : ''}`;
export const spotifyOpenUrl = (ref: SpotifyRef) => `${SPOTIFY_ORIGIN}/${ref.kind}/${ref.id}`;

export type StationMood = 'focus' | 'lofi' | 'calm' | 'nature';
export interface Station { id: string; name: string; mood: StationMood; ref: SpotifyRef }

const playlist = (id: string): SpotifyRef => ({ kind: 'playlist', id });

/**
 * Listas editoriales de Spotify para enfocarse o bajar el ritmo, con su nombre real. Los ids se comprobaron
 * contra open.spotify.com/oembed el 2026-11-14; si Spotify retira alguna, el reproductor lo dice y basta
 * con quitarla de aquí.
 */
export const STATIONS: readonly Station[] = [
  { id: 'deep-focus', name: 'Deep Focus', mood: 'focus', ref: playlist('37i9dQZF1DWZeKCadgRdKQ') },
  { id: 'intense-studying', name: 'Intense Studying', mood: 'focus', ref: playlist('37i9dQZF1DX8NTLI2TtZa6') },
  { id: 'instrumental-study', name: 'Instrumental Study', mood: 'focus', ref: playlist('37i9dQZF1DX9sIqqvKsjG8') },
  { id: 'brain-food', name: 'Brain Food', mood: 'focus', ref: playlist('37i9dQZF1DWXLeA8Omikj7') },
  { id: 'lofi-beats', name: 'lofi beats', mood: 'lofi', ref: playlist('37i9dQZF1DWWQRwui0ExPn') },
  { id: 'chill-lofi', name: 'chill lofi study beats', mood: 'lofi', ref: playlist('37i9dQZF1DX8Uebhn9wzrS') },
  { id: 'peaceful-piano', name: 'Peaceful Piano', mood: 'calm', ref: playlist('37i9dQZF1DX4sWSpwq3LiO') },
  { id: 'ambient-relaxation', name: 'Ambient Relaxation', mood: 'calm', ref: playlist('37i9dQZF1DX3Ogo9pFvBkY') },
  { id: 'coffee-table-jazz', name: 'Coffee Table Jazz', mood: 'calm', ref: playlist('37i9dQZF1DWVqfgj8NZEp1') },
  { id: 'rain-sounds', name: 'Rain Sounds', mood: 'nature', ref: playlist('37i9dQZF1DX8ymr6UES7vc') },
  { id: 'white-noise', name: 'White Noise 10 Hours', mood: 'nature', ref: playlist('37i9dQZF1DWUZ5bk6qqDSy') },
];

export const stationOf = (id: string | null | undefined) => STATIONS.find((s) => s.id === id) ?? null;

/**
 * De dónde suena la música: una lista de STATIONS (su id), «mine» (la playlist de Ajustes) o «custom» (un
 * enlace pegado). Devuelve la referencia de Spotify, o null si esa fuente no es de Spotify o no existe.
 */
export function resolveSource(source: string | null, mine: string | null | undefined, custom: string | null | undefined): SpotifyRef | null {
  if (source === 'mine') return parseSpotify(mine);
  if (source === 'custom') return parseSpotify(custom);
  return stationOf(source)?.ref ?? null;
}
