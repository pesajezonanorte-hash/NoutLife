// Grabar notas de voz: el micrófono del navegador (MediaRecorder) con un nivel en
// vivo para dibujar la onda mientras hablas. Al terminar devuelve el audio (data
// URL, ~32 kbps: dos minutos caben de sobra), la duración y la forma de onda
// (48 barras) que viaja con el mensaje para dibujarla sin descargar el audio.
import { useCallback, useEffect, useRef, useState } from 'react';

export const VOICE_MAX_MS = 120_000;
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

export function useVoiceRecorder() {
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

  const cleanup = useCallback(() => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void ctx.current?.close().catch(() => undefined);
    ctx.current = null;
    rec.current = null;
    setLevel(0);
  }, []);

  useEffect(() => () => { keep.current = false; rec.current?.stop(); cleanup(); }, [cleanup]);

  const start = useCallback(async () => {
    const mime = pickMime();
    if (mime === null || !navigator.mediaDevices?.getUserMedia) { setState('unsupported'); return false; }
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
        const type = r.mimeType || mime || 'audio/webm';
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
      // Nivel en vivo para la onda.
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) {
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
          if (ms >= VOICE_MAX_MS) { keep.current = true; rec.current?.stop(); return; }
          raf.current = requestAnimationFrame(tick);
        };
        raf.current = requestAnimationFrame(tick);
      }
      startedAt.current = Date.now();
      r.start(250);
      setState('recording');
      return true;
    } catch (e) {
      cleanup();
      const name = (e as DOMException)?.name;
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unsupported');
      return false;
    }
  }, [cleanup]);

  /** Termina: con `send` devuelve el audio; sin él, lo descarta. */
  const stop = useCallback((send: boolean) => new Promise<VoiceClip | null>((resolve) => {
    const r = rec.current;
    if (!r || r.state === 'inactive') { resolve(null); return; }
    keep.current = send;
    done.current = resolve;
    r.stop();
  }), []);

  return { state, elapsed, level, start, stop, reset: () => setState('idle') };
}

export const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
