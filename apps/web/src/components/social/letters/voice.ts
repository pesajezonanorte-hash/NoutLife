// Grabar notas de voz: el micrófono del navegador (MediaRecorder) con un nivel en
// vivo para dibujar la onda mientras hablas. Al terminar devuelve el audio (data
// URL, ~32 kbps: dos minutos caben de sobra), la duración y la forma de onda
// (48 barras) que viaja con el mensaje para dibujarla sin descargar el audio.
import { useCallback, useEffect, useRef, useState } from 'react';

export const VOICE_MAX_MS = 120_000;
const IOS = typeof navigator !== 'undefined' && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const BARS = 48;

export type RecorderState = 'idle' | 'starting' | 'recording' | 'denied' | 'unsupported';
export interface VoiceClip { audioUrl: string; durationMs: number; peaks: number[] }

/** Formato que entiende este navegador (Safari graba mp4; Chrome y Firefox, webm/ogg). */
function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  const options = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];
  return options.find((m) => MediaRecorder.isTypeSupported?.(m)) ?? '';
}

/** Reduce los niveles grabados a N barras (máximo de cada tramo), de 0 a 1. */
export function toPeaks(levels: number[], bars = BARS) {
  if (!levels.length) return Array(bars).fill(0.1);
  const out: number[] = [];
  const step = levels.length / bars;
  for (let i = 0; i < bars; i++) {
    const slice = levels.slice(Math.floor(i * step), Math.max(Math.floor(i * step) + 1, Math.floor((i + 1) * step)));
    out.push(Math.max(...slice, 0));
  }
  const max = Math.max(...out, 0.05);
  return out.map((v) => Math.round(Math.max(0.08, v / max) * 100) / 100);
}

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(new Error('No se pudo leer el audio'));
  r.readAsDataURL(blob);
});

/**
 * `onLimit` avisa de que se llegó al máximo (2 min): quien lo usa debe llamar a `stop(true)`
 * para no perder la nota.
 */
export function useVoiceRecorder(onLimit?: () => void) {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const levels = useRef<number[]>([]);
  const startedAt = useRef(0);
  const raf = useRef(0);
  const ctx = useRef<AudioContext | null>(null);
  const done = useRef<((clip: VoiceClip | null) => void) | null>(null);
  const keep = useRef(false);
  const limit = useRef(onLimit);
  limit.current = onLimit;

  const cleanup = useCallback(() => {
    cancelAnimationFrame(raf.current);
    window.clearTimeout(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void ctx.current?.close().catch(() => undefined);
    ctx.current = null;
    rec.current = null;
    setLevel(0);
  }, []);

  useEffect(() => () => { keep.current = false; rec.current?.stop(); cleanup(); }, [cleanup]);

  /** Empieza a grabar; devuelve cómo quedó (el estado de React aún no se ha actualizado al volver). */
  const start = useCallback(async (): Promise<'recording' | 'denied' | 'unsupported'> => {
    const mime = pickMime();
    if (mime === null || !navigator.mediaDevices?.getUserMedia) { setState('unsupported'); return 'unsupported'; }
    setState('starting');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = s;
      const r = new MediaRecorder(s, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32_000 });
      rec.current = r;
      chunks.current = [];
      levels.current = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = async () => {
        const durationMs = Math.min(VOICE_MAX_MS, Date.now() - startedAt.current);
        // Firefox escribe «audio/ogg; codecs=opus» (con espacio): el servidor espera el formato sin él.
        const type = (r.mimeType || mime || 'audio/webm').replace(/s+/g, '');
        const finish = done.current;
        done.current = null;
        cleanup();
        setState('idle');
        setElapsed(0);
        if (!keep.current || durationMs < 600) { finish?.(null); return; }
        try {
          const audioUrl = await blobToDataUrl(new Blob(chunks.current, { type }));
          finish?.({ audioUrl, durationMs, peaks: toPeaks(levels.current) });
        } catch { finish?.(null); }
      };
      // Nivel en vivo para la onda. En iPhone se omite: abrir un AudioContext sobre el mismo micrófono
      // deja la grabación vacía o la corta.
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC && !IOS) {
        const ac = new AC();
        ctx.current = ac;
        const analyser = ac.createAnalyser();
        analyser.fftSize = 512;
        ac.createMediaStreamSource(s).connect(analyser);
        const buf = new Uint8Array(analyser.fftSize);
        let last = 0;
        const tick = (t: number) => {
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (const v of buf) sum += ((v - 128) / 128) ** 2;
          const rms = Math.sqrt(sum / buf.length);
          if (t - last > 90) { levels.current.push(rms); last = t; setLevel(Math.min(1, rms * 4)); }
          const ms = Date.now() - startedAt.current;
          setElapsed(ms);
          if (ms >= VOICE_MAX_MS) { limit.current?.(); return; }
          raf.current = requestAnimationFrame(tick);
        };
        raf.current = requestAnimationFrame(tick);
      }
      startedAt.current = Date.now();
      if (IOS) {
        // Sin onda real: se anima un nivel suave y el tiempo corre aparte.
        const t0 = Date.now();
        const tick = () => {
          const ms = Date.now() - t0;
          setElapsed(ms);
          const v = 0.25 + 0.2 * Math.abs(Math.sin(ms / 160));
          levels.current.push(v);
          setLevel(v);
          if (ms >= VOICE_MAX_MS) { limit.current?.(); return; }
          raf.current = window.setTimeout(tick, 100) as unknown as number;
        };
        raf.current = window.setTimeout(tick, 100) as unknown as number;
      }
      r.start(IOS ? undefined : 250);
      setState('recording');
      return 'recording';
    } catch (e) {
      cleanup();
      const name = (e as DOMException)?.name;
      const failed = name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unsupported';
      setState(failed);
      return failed;
    }
  }, [cleanup]);

  /** Termina: con `send` devuelve el audio; sin él, lo descarta. */
  const stop = useCallback((send: boolean) => new Promise<VoiceClip | null>((resolve) => {
    const r = rec.current;
    if (!r || r.state === 'inactive') { resolve(null); return; }
    keep.current = send;
    done.current = resolve;
    try { r.requestData(); } catch { /* ya no hay datos pendientes */ }
    r.stop();
  }), []);

  return { state, elapsed, level, start, stop, reset: () => setState('idle') };
}

export const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
