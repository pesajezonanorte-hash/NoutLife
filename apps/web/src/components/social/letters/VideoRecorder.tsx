// Grabar un video para la carta (máximo 15 s). Se abre a pantalla completa por
// encima de la carta: visor en vivo, botón rojo para grabar o parar (se detiene
// solo a los 15 s, con un anillo que marca el tiempo) y, al terminar, el video
// se repite en bucle para revisarlo antes de enviarlo o repetirlo.
//
// Se graba en MP4 cuando el navegador puede (Safari, Chrome reciente) y si no
// en WebM, a 480p y ~600 kbps para que 15 s quepan en unos 2 MB.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CameraOff, RotateCcw, Send, SwitchCamera, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { useMotionStore } from '@/store/motionStore';
import { Button, Spinner, useDialogBehavior } from '@/components/ui/lq';
import { useText, type Copy } from '@/lib/i18n';

const es = {
  tooShort: 'El video es demasiado corto.',
  tooBig: 'El video pesa demasiado. Grábalo un poco más corto.',
  title: (to: string): string => `Grabar un video para ${to}`,
  camView: 'Vista de la cámara',
  yourVideo: 'Tu video',
  opening: 'Abriendo la cámara…',
  denied: 'Sin permiso para usar la cámara y el micrófono',
  unsupported: 'Este navegador no puede grabar video',
  noResponse: 'La cámara no respondió',
  retry: 'Reintentar',
  close: 'Cerrar',
  videoFor: (first: string): string => `Video para ${first}`,
  switchCam: 'Cambiar de cámara',
  stopAria: (s: number): string => `Parar (quedan ${s} s)`,
  recAria: 'Grabar video (máximo 15 segundos)',
  tapStop: 'Toca para parar',
  tapRec: 'Toca para grabar · hasta 15 s',
  redo: 'Repetir',
  sendTo: (first: string): string => `Enviar a ${first}`,
};

const en: typeof es = {
  tooShort: 'The video is too short.',
  tooBig: 'The video is too big. Record it a bit shorter.',
  title: (to: string): string => `Record a video for ${to}`,
  camView: 'Camera view',
  yourVideo: 'Your video',
  opening: 'Opening the camera…',
  denied: 'No permission to use the camera and microphone',
  unsupported: 'This browser cannot record video',
  noResponse: 'The camera did not respond',
  retry: 'Try again',
  close: 'Close',
  videoFor: (first: string): string => `Video for ${first}`,
  switchCam: 'Switch camera',
  stopAria: (s: number): string => `Stop (${s} s left)`,
  recAria: 'Record video (up to 15 seconds)',
  tapStop: 'Tap to stop',
  tapRec: 'Tap to record · up to 15 s',
  redo: 'Retake',
  sendTo: (first: string): string => `Send to ${first}`,
};

const COPY: Copy<typeof es> = { es, en };

export const VIDEO_MAX_MS = 15_000;
/** Tope del data URL que acepta la API. */
const MAX_CHARS = 2_800_000;

export interface VideoClip { videoUrl: string; durationMs: number; thumb: string | null }

const MIME = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm'];
const pickMime = () => (typeof MediaRecorder === 'undefined' ? null : MIME.find((t) => MediaRecorder.isTypeSupported(t)) ?? '');

const toDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

/** Miniatura JPEG pequeña del primer cuadro (para la carta mientras carga el video). */
function grabThumb(v: HTMLVideoElement): string | null {
  try {
    const side = 96;
    const c = document.createElement('canvas');
    c.width = side; c.height = Math.round(side * (v.videoHeight / v.videoWidth || 1));
    c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/jpeg', 0.6);
    return url.length <= 6_000 ? url : null;
  } catch { return null; }
}

type State = 'starting' | 'live' | 'recording' | 'review' | 'denied' | 'unsupported' | 'error';

export function VideoRecorder(props: { open: boolean; to: string; onClose: () => void; onSend: (clip: VideoClip) => void }) {
  return createPortal(
    <AnimatePresence>{props.open && <Recorder key="video" {...props} />}</AnimatePresence>,
    document.body,
  );
}

function Recorder({ to, onClose, onSend }: { to: string; onClose: () => void; onSend: (clip: VideoClip) => void }) {
  const panelRef = useDialogBehavior(true, onClose);
  const t = useText(COPY);
  const reduce = useMotionStore((s) => s.reduce);
  const liveRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const startedAt = useRef(0);
  const gen = useRef(0);
  const [state, setState] = useState<State>('starting');
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [elapsed, setElapsed] = useState(0);
  const [clip, setClip] = useState<VideoClip | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const first = to.split(' ')[0];

  const stopStream = useCallback(() => {
    gen.current += 1;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async (face: 'user' | 'environment') => {
    stopStream();
    const mine = gen.current;
    if (!navigator.mediaDevices?.getUserMedia || pickMime() === null) { setState('unsupported'); return; }
    setState('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: face }, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (mine !== gen.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;
      const v = liveRef.current;
      if (v) { v.srcObject = stream; await v.play().catch(() => undefined); }
      setState('live');
    } catch (e) {
      if (mine !== gen.current) return;
      const name = (e as DOMException)?.name;
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' ? 'unsupported' : 'error');
    }
  }, [stopStream]);

  useEffect(() => { void start(facing); return stopStream; }, [facing, start, stopStream]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  // Contador y corte automático a los 15 s.
  useEffect(() => {
    if (state !== 'recording') return;
    const t = window.setInterval(() => {
      const ms = Date.now() - startedAt.current;
      setElapsed(ms);
      if (ms >= VIDEO_MAX_MS && recRef.current?.state === 'recording') recRef.current.stop();
    }, 100);
    return () => window.clearInterval(t);
  }, [state]);

  function record() {
    const stream = streamRef.current;
    const mime = pickMime();
    if (!stream || mime === null) return;
    setError('');
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 600_000, audioBitsPerSecond: 48_000 });
    recRef.current = rec;
    const thumb = liveRef.current ? grabThumb(liveRef.current) : null;
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = async () => {
      const durationMs = Math.min(VIDEO_MAX_MS, Date.now() - startedAt.current);
      const blob = new Blob(chunks, { type: (rec.mimeType || mime || 'video/webm').split(';')[0] });
      stopStream();
      if (durationMs < 500 || !blob.size) { setError(t.tooShort); void start(facing); return; }
      const videoUrl = await toDataUrl(blob);
      if (videoUrl.length > MAX_CHARS) { setError(t.tooBig); void start(facing); return; }
      setClip({ videoUrl, durationMs, thumb });
      setPreview(URL.createObjectURL(blob));
      setState('review');
    };
    startedAt.current = Date.now();
    setElapsed(0);
    rec.start(250);
    setState('recording');
  }

  function stop() { if (recRef.current?.state === 'recording') recRef.current.stop(); }

  function retake() {
    setClip(null);
    setPreview(null);
    void start(facing);
  }

  const live = state === 'live' || state === 'recording';
  const progress = Math.min(1, elapsed / VIDEO_MAX_MS);
  const secs = Math.ceil((VIDEO_MAX_MS - elapsed) / 1000);

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex flex-col bg-black text-white"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.18 } }}
    >
      <div
        ref={panelRef} role="dialog" aria-modal="true" aria-label={t.title(to)} tabIndex={-1}
        className="relative flex min-h-0 flex-1 flex-col outline-none"
      >
        <motion.div
          className="relative min-h-0 flex-1 overflow-hidden"
          initial={reduce ? false : { scale: 0.96 }} animate={{ scale: 1 }} transition={springs.natural}
        >
          <video ref={liveRef} playsInline muted autoPlay aria-label={t.camView}
            className={cn('absolute inset-0 size-full object-cover', (!live || preview) && 'opacity-0')} />
          {preview && <video src={preview} playsInline autoPlay loop controls={false} aria-label={t.yourVideo} className="absolute inset-0 size-full bg-black object-contain" />}

          {!live && !preview && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              {state === 'starting' ? (
                <><Spinner className="text-white" /><p className="text-body-sm" role="status">{t.opening}</p></>
              ) : (
                <>
                  <CameraOff aria-hidden className="size-8" strokeWidth={1.5} />
                  <p className="text-label-lg" role="alert">
                    {state === 'denied' ? t.denied : state === 'unsupported' ? t.unsupported : t.noResponse}
                  </p>
                  {state !== 'unsupported' && <Button size="sm" variant="secondary" onClick={() => void start(facing)}>{t.retry}</Button>}
                </>
              )}
            </div>
          )}

          {/* Barra superior: cerrar, para quién y cambiar de cámara. */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-3 pb-6 pt-[max(.75rem,env(safe-area-inset-top))]">
            <Button variant="icon" aria-label={t.close} onClick={onClose} className="text-white hover:bg-white/10"><X aria-hidden className="size-6" /></Button>
            <p className="min-w-0 truncate text-label-lg">{state === 'recording' ? <span className="font-mono tabular-nums">0:{String(Math.floor(elapsed / 1000)).padStart(2, '0')} / 0:15</span> : t.videoFor(first)}</p>
            {state === 'live' ? (
              <Button variant="icon" aria-label={t.switchCam} onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} className="text-white hover:bg-white/10">
                <SwitchCamera aria-hidden className="size-6" />
              </Button>
            ) : <span className="size-11" aria-hidden="true" />}
          </div>
        </motion.div>

        <div className="flex flex-col items-center gap-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          {error && <p role="alert" className="text-body-sm text-error">{error}</p>}
          {clip ? (
            <div className="flex w-full max-w-[22rem] gap-3">
              <Button variant="secondary" className="flex-1" onClick={retake}><RotateCcw aria-hidden className="size-4" />{t.redo}</Button>
              <Button className="flex-1 bg-white text-black hover:bg-white/90" onClick={() => { onSend(clip); onClose(); }} data-autofocus>
                <Send aria-hidden className="size-4" />{t.sendTo(first)}
              </Button>
            </div>
          ) : (
            <>
              <button
                type="button" disabled={!live} onClick={state === 'recording' ? stop : record}
                aria-label={state === 'recording' ? t.stopAria(secs) : t.recAria}
                className="relative flex size-20 items-center justify-center rounded-full disabled:opacity-40 select-none"
              >
                <svg aria-hidden viewBox="0 0 80 80" className="absolute inset-0 -rotate-90">
                  <circle cx="40" cy="40" r="36" fill="none" stroke="rgb(255 255 255 / .35)" strokeWidth="4" />
                  <circle cx="40" cy="40" r="36" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 36} strokeDashoffset={2 * Math.PI * 36 * (1 - progress)} />
                </svg>
                <motion.span
                  animate={state === 'recording' ? { borderRadius: 8, width: 28, height: 28 } : { borderRadius: 999, width: 60, height: 60 }}
                  transition={springs.snappy} className="block bg-error"
                />
              </button>
              <p className="text-body-sm text-white/75">{state === 'recording' ? t.tapStop : t.tapRec}</p>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
