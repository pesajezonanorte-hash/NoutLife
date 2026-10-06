// Fotos, notas de voz y stickers de las cartas: no viajan con los mensajes (pesan),
// se piden cuando hacen falta y se guardan para siempre en esta pestaña (no
// cambian nunca). Lo que acabas de enviar ya está aquí, así que no se vuelve a pedir.
import { useEffect, useRef, useState } from 'react';
import { getMedia, getStickerImage, saveThumb, thumbOf } from '@/services/network.service';

type Side = 'dm' | 'guild';
interface Media { photoUrl: string | null; audioUrl: string | null }

const media = new Map<string, Media>();
const inflight = new Map<string, Promise<Media>>();
const stickers = new Map<string, string>();
const stickerInflight = new Map<string, Promise<string>>();
const thumbed = new Set<string>();

const keyOf = (side: Side, id: string) => `${side}:${id}`;

/** Lo que tienes en este dispositivo (lo que acabas de enviar) para un mensaje ya confirmado. */
export function primeMedia(side: Side, id: string, m: Partial<Media>) {
  const k = keyOf(side, id);
  media.set(k, { photoUrl: m.photoUrl ?? media.get(k)?.photoUrl ?? null, audioUrl: m.audioUrl ?? media.get(k)?.audioUrl ?? null });
}

export function cachedMedia(side: Side, id: string) { return media.get(keyOf(side, id)) ?? null; }

export function loadMedia(side: Side, id: string): Promise<Media> {
  const k = keyOf(side, id);
  const hit = media.get(k);
  if (hit) return Promise.resolve(hit);
  let p = inflight.get(k);
  if (!p) {
    p = getMedia(side, id)
      .then((r) => { const m = { photoUrl: r.photoUrl, audioUrl: r.audioUrl }; media.set(k, m); return m; })
      .finally(() => inflight.delete(k));
    inflight.set(k, p);
  }
  return p;
}

/**
 * La foto o el audio de un mensaje. Con `enabled` en false todavía no se pide
 * (p. ej. hasta que el mensaje entra en pantalla). Si la foto no tenía miniatura,
 * se calcula aquí y se guarda para los demás.
 */
export function useMedia(side: Side, id: string, opts: { enabled?: boolean; local?: Partial<Media>; hasThumb?: boolean } = {}) {
  const { enabled = true, local, hasThumb = true } = opts;
  const k = keyOf(side, id);
  const [state, setState] = useState<Media | null>(() => (local?.photoUrl || local?.audioUrl ? { photoUrl: local.photoUrl ?? null, audioUrl: local.audioUrl ?? null } : media.get(k) ?? null));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (state || !enabled || id.startsWith('tmp-')) return;
    let alive = true;
    loadMedia(side, id)
      .then((m) => {
        if (!alive) return;
        setState(m);
        if (m.photoUrl && !hasThumb && !thumbed.has(k)) {
          thumbed.add(k);
          void thumbOf(m.photoUrl).then((t) => { if (t) void saveThumb(side, id, t); });
        }
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [enabled, hasThumb, id, k, side, state]);
  return { photoUrl: state?.photoUrl ?? null, audioUrl: state?.audioUrl ?? null, failed };
}

export function primeSticker(hash: string, imageUrl: string) { stickers.set(hash, imageUrl); }

export function loadSticker(hash: string): Promise<string> {
  const hit = stickers.get(hash);
  if (hit) return Promise.resolve(hit);
  let p = stickerInflight.get(hash);
  if (!p) {
    p = getStickerImage(hash).then((r) => { stickers.set(hash, r.imageUrl); return r.imageUrl; }).finally(() => stickerInflight.delete(hash));
    stickerInflight.set(hash, p);
  }
  return p;
}

export function useSticker(hash: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(() => (hash ? stickers.get(hash) ?? null : null));
  useEffect(() => {
    if (!hash) { setUrl(null); return; }
    const hit = stickers.get(hash);
    if (hit) { setUrl(hit); return; }
    let alive = true;
    loadSticker(hash).then((u) => { if (alive) setUrl(u); }).catch(() => undefined);
    return () => { alive = false; };
  }, [hash]);
  return url;
}

/** ¿Está (o va a estar pronto) en pantalla? Para pedir la foto solo entonces. */
export function useNearScreen<T extends Element>(margin = '600px') {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return; }
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setNear(true); io.disconnect(); } }, { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [margin, near]);
  return { ref, near };
}
