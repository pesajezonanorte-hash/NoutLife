import api from '../lib/api';

export type AlbumZone = 'gym' | 'espejo' | 'cartas';
export interface AlbumItem {
  id: string;
  source: 'progress' | 'clothing' | 'outfit' | 'dm' | 'guild';
  zone: AlbumZone;
  at: string;
  title: string;
  photoUrl: string | null;
  thumb: string | null;
}

/** Fotos propias de todas las zonas, de la más reciente a la más antigua. */
export async function fetchAlbum(params: { zone?: AlbumZone; before?: string } = {}): Promise<{ items: AlbumItem[]; next: string | null }> {
  const q = new URLSearchParams();
  if (params.zone) q.set('zone', params.zone);
  if (params.before) q.set('before', params.before);
  const { data } = await api.get<{ items: AlbumItem[]; next: string | null }>(`/album?${q.toString()}`);
  return data;
}

const cache = new Map<string, Promise<string | null>>();

/** La foto en tamaño completo (se pide al acercarse a la pantalla y se recuerda). */
export function fetchAlbumPhoto(item: Pick<AlbumItem, 'source' | 'id'>): Promise<string | null> {
  const key = `${item.source}:${item.id}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = api.get<{ photoUrl: string }>(`/album/photo/${item.source}/${item.id}`).then((r) => r.data.photoUrl).catch(() => {
      cache.delete(key);
      return null;
    });
    cache.set(key, pending);
  }
  return pending;
}
