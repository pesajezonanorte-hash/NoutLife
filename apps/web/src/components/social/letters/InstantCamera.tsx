// Cámara instantánea de las cartas. Solo fotos tomadas en el momento: no hay
// galería. Se abre una cámara clásica (plástico crema, franja de colores,
// objetivo y disparador rojo) con el visor en vivo; al disparar, destello,
// la cámara zumba y la foto sale por la ranura y se revela despacio. Se puede
// escribir una nota en el borde, repetirla o enviarla: al enviar, quien abrió
// la cámara recibe la posición de la foto para hacerla volar hasta la carta.
//
// Sin acceso a getUserMedia en un móvil se usa la cámara del sistema
// (capture), que tampoco ofrece la galería. Con «Reducir movimiento»: sin
// destello ni vuelo, la foto aparece con un fundido.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { CameraOff, RotateCcw, Send, SwitchCamera, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { useMotionStore } from '@/store/motionStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Lettering } from '@/components/layout/Lettering';
import { Button, Spinner, useDialogBehavior } from '@/components/ui/lq';
import { InstantPhoto } from './InstantPhoto';

type CamState = 'starting' | 'live' | 'shot' | 'denied' | 'unsupported' | 'error';

/** Lado de la foto que viaja (cuadrada, como la película instantánea). */
const OUT = 720;

/** Recorta el centro en cuadrado y lo pasa a JPEG (más comprimido si hace falta). */
function squareShot(src: CanvasImageSource, w: number, h: number, mirror: boolean): string | null {
  const side = Math.min(w, h);
  if (!side) return null;
  const canvas = document.createElement('canvas');
  canvas.width = OUT; canvas.height = OUT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  if (mirror) { ctx.translate(OUT, 0); ctx.scale(-1, 1); }
  ctx.drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, OUT, OUT);
  const url = canvas.toDataURL('image/jpeg', 0.8);
  return url.length > 560_000 ? canvas.toDataURL('image/jpeg', 0.62) : url;
}

export interface InstantCameraProps {
  open: boolean;
  onClose: () => void;
  /** Para quién es la foto (título y botón de enviar). */
  to: string;
  /** La foto (data URL), la nota y dónde está la foto en pantalla para el vuelo. */
  onSend: (photo: string, caption: string, from: DOMRect | null) => void;
}

export function InstantCamera(props: InstantCameraProps) {
  return createPortal(
    <AnimatePresence>{props.open && <CameraOverlay key="camera" {...props} />}</AnimatePresence>,
    document.body,
  );
}

function CameraOverlay({ onClose, to, onSend }: InstantCameraProps) {
  const panelRef = useDialogBehavior(true, onClose);
  const reduce = useMotionStore((s) => s.reduce);
  const coarse = useMediaQuery('(pointer: coarse)');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const gen = useRef(0);
  const printRef = useRef<HTMLElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const fallbackRef = useRef<HTMLInputElement>(null);
  const body = useAnimationControls();
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [state, setState] = useState<CamState>('starting');
  const [photo, setPhoto] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [flash, setFlash] = useState(0);
  const [cams, setCams] = useState(1);
  const first = to.split(' ')[0];

  const stop = useCallback(() => {
    gen.current += 1;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async (face: 'environment' | 'user') => {
    stop();
    const mine = gen.current;
    if (!navigator.mediaDevices?.getUserMedia) { setState('unsupported'); return; }
    setState('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: face }, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      // Se cerró o se cambió de cámara mientras pedía permiso: se apaga enseguida.
      if (mine !== gen.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) { v.srcObject = stream; await v.play().catch(() => undefined); }
      setState('live');
      navigator.mediaDevices.enumerateDevices?.()
        .then((list) => setCams(list.filter((d) => d.kind === 'videoinput').length))
        .catch(() => undefined);
    } catch (e) {
      if (mine !== gen.current) return;
      const name = (e as DOMException)?.name;
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'unsupported' : 'error');
    }
  }, [stop]);

  useEffect(() => {
    void start(facing);
    return stop;
  }, [facing, start, stop]);

  function printed(url: string) {
    setPhoto(url);
    setState('shot');
    stop();
    if (!reduce) {
      setFlash((n) => n + 1);
      void body.start({ x: [0, -2, 2, -1.5, 1, 0], transition: { duration: 0.42, delay: 0.12 } });
    }
    // La foto sale por la ranura: la vista la acompaña hasta los botones.
    window.setTimeout(() => actionsRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'end' }), reduce ? 0 : 520);
  }

  function shoot() {
    const v = videoRef.current;
    if (!v || state !== 'live') return;
    const url = squareShot(v, v.videoWidth, v.videoHeight, facing === 'user');
    if (url) printed(url);
  }

  /** Cámara del sistema (móvil sin getUserMedia): también sin galería. */
  function fromSystemCamera(file?: File | null) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const shot = squareShot(img, img.naturalWidth, img.naturalHeight, false);
      URL.revokeObjectURL(url);
      if (shot) printed(shot);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }

  function retake() {
    setPhoto(null);
    setCaption('');
    void start(facing);
  }

  function send() {
    if (!photo) return;
    onSend(photo, caption.trim(), printRef.current?.getBoundingClientRect() ?? null);
    onClose();
  }

  const live = state === 'live';
  const camSize = { ['--cam' as string]: 'min(92vw, 360px, 50svh)' };

  return (
    <motion.div
      className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-[rgb(var(--lq-jade-900)/.92)] backdrop-blur-md"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2, delay: 0.05 } }}
    >
      <div
        ref={panelRef}
        role="dialog" aria-modal="true" aria-label={`Cámara instantánea: foto para ${to}`} tabIndex={-1}
        className="mx-auto flex min-h-full w-full max-w-md flex-col items-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(.75rem,env(safe-area-inset-top))] outline-none"
        style={camSize}
      >
        <div className="mb-4 flex w-full items-center justify-between text-jade-50">
          <Button variant="icon" aria-label="Cerrar la cámara" onClick={onClose} className="text-jade-50 hover:bg-white/10">
            <X aria-hidden className="size-6" strokeWidth={1.75} />
          </Button>
          <p className="min-w-0 truncate text-label-lg">Foto para {first}</p>
          {cams > 1 && !photo ? (
            <Button variant="icon" aria-label="Cambiar de cámara" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} className="text-jade-50 hover:bg-white/10">
              <SwitchCamera aria-hidden className="size-6" strokeWidth={1.75} />
            </Button>
          ) : <span className="size-11" aria-hidden="true" />}
        </div>

        {/* La cámara */}
        <motion.div
          animate={body}
          className="relative z-10"
        >
          <motion.div
            className="lq-cam relative rounded-[30px]"
            style={{ width: 'var(--cam)', padding: '0 calc(var(--cam) * .06) 14px' }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 70, scale: 0.88, rotate: -3 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 50, scale: 0.94, transition: { duration: 0.2 } }}
            transition={reduce ? { duration: 0.2 } : springs.heavy}
          >
            <div className="lq-cam-top flex h-11 items-center justify-between rounded-t-[30px] px-5" style={{ margin: '0 calc(var(--cam) * -.06) calc(var(--cam) * .05)' }}>
              <span aria-hidden="true" className="lq-cam-flash block h-4 w-11 rounded-[3px]" />
              <span aria-hidden="true" className="text-body-md text-jade-200/80"><Lettering text="noutlife" draw={false} /></span>
              <span aria-hidden="true" className="block size-5 rounded-full bg-jade-800 ring-2 ring-jade-200/40" />
            </div>

            {/* Visor en vivo (cuadrado: lo que ves es la foto) */}
            <div className="lq-cam-screen relative aspect-square overflow-hidden rounded-[14px]">
              <video
                ref={videoRef} playsInline muted autoPlay aria-label="Vista de la cámara"
                className={cn('size-full object-cover transition-opacity duration-300', facing === 'user' && '-scale-x-100', !live && 'opacity-0')}
              />
              {photo && <img src={photo} alt="" className="absolute inset-0 size-full object-cover" />}
              {live && (
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 [background:linear-gradient(to_right,transparent_33%,rgb(255_255_255/.14)_33%,rgb(255_255_255/.14)_calc(33%+1px),transparent_calc(33%+1px),transparent_66%,rgb(255_255_255/.14)_66%,rgb(255_255_255/.14)_calc(66%+1px),transparent_calc(66%+1px)),linear-gradient(to_bottom,transparent_33%,rgb(255_255_255/.14)_33%,rgb(255_255_255/.14)_calc(33%+1px),transparent_calc(33%+1px),transparent_66%,rgb(255_255_255/.14)_66%,rgb(255_255_255/.14)_calc(66%+1px),transparent_calc(66%+1px))]" />
              )}
              <AnimatePresence>
                {!live && !photo && (
                  <motion.div key={state} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center text-jade-50">
                    {state === 'starting' ? (
                      <><Spinner className="text-jade-200" /><p className="text-body-sm text-jade-100" role="status">Abriendo la cámara…</p></>
                    ) : (
                      <>
                        <CameraOff aria-hidden className="size-8 text-jade-200" strokeWidth={1.5} />
                        <p className="text-label-lg" role="alert">
                          {state === 'denied' ? 'Sin permiso para usar la cámara' : state === 'unsupported' ? (coarse ? 'Abre la cámara del teléfono' : 'No encontramos una cámara') : 'La cámara no respondió'}
                        </p>
                        <p className="text-body-sm text-jade-100/85">
                          {state === 'denied' ? 'Actívalo en los permisos del navegador y vuelve a intentarlo.' : state === 'unsupported' ? (coarse ? 'La foto se toma en el momento, sin galería.' : 'Conecta una cámara o usa la app en tu teléfono.') : 'Ciérrala y vuelve a abrirla.'}
                        </p>
                        {state === 'unsupported' && coarse ? (
                          <Button size="sm" onClick={() => fallbackRef.current?.click()}>Abrir cámara</Button>
                        ) : state !== 'unsupported' ? (
                          <Button size="sm" variant="secondary" onClick={() => void start(facing)}>Reintentar</Button>
                        ) : null}
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {flash > 0 && state === 'shot' && (
                  <motion.span key={flash} aria-hidden="true" className="lq-cam-flashburst pointer-events-none absolute -inset-1/4" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.38, times: [0, 0.15, 1] }} />
                )}
              </AnimatePresence>
            </div>

            {/* Frente: franja, objetivo y disparador */}
            <div className="flex items-center justify-between gap-3" style={{ marginTop: 'calc(var(--cam) * .055)' }}>
              <span aria-hidden="true" className="lq-cam-stripe block h-12 w-4 rounded-full" />
              <span aria-hidden="true" className="lq-cam-lens relative block overflow-hidden rounded-full" style={{ width: 'calc(var(--cam) * .22)', height: 'calc(var(--cam) * .22)' }}>
                <span className="lq-cam-glint absolute left-[20%] top-[16%] block size-[34%] rounded-full" />
              </span>
              <span className="flex flex-col items-center gap-1">
                <button
                  type="button" onClick={shoot} disabled={!live} aria-label="Tomar foto"
                  className="lq-cam-shutter size-16 rounded-full focus-visible:outline-offset-4"
                />
                <span aria-hidden="true" className="text-label-md text-jade-700">foto</span>
              </span>
            </div>
            <span aria-hidden="true" className="lq-cam-slot mx-auto block h-2 w-[80%] rounded-full" style={{ marginTop: 'calc(var(--cam) * .045)' }} />
          </motion.div>
        </motion.div>

        {/* La foto sale por la ranura y se revela */}
        <div className="relative z-20 -mt-[18px] overflow-hidden pt-px" style={{ width: 'calc(var(--cam) * .74)' }}>
          <AnimatePresence>
            {photo && (
              <motion.div
                key={photo.length}
                initial={reduce ? { opacity: 0 } : { y: '-101%' }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={reduce ? { duration: 0.2 } : { duration: 1.3, ease: [0.5, 0.05, 0.25, 1], delay: 0.25 }}
                className="pb-6"
              >
                <InstantPhoto ref={printRef} src={photo} alt={`Tu foto para ${first}`} develop tape={false} className="w-full">
                  <label className="sr-only" htmlFor="instant-caption">Nota en la foto (opcional)</label>
                  <input
                    id="instant-caption" value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 40))}
                    placeholder="Escribe una nota…" autoComplete="off"
                    className="absolute inset-x-[6%] bottom-[3%] h-[13%] border-b border-dashed border-transparent bg-transparent text-center text-body-md font-medium text-jade-900 placeholder:text-jade-600/70 focus:border-jade-600 focus:outline-none"
                  />
                </InstantPhoto>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div ref={actionsRef} className="mt-auto flex w-full flex-col items-center gap-3 pt-5">
          {photo ? (
            <div className="flex w-full max-w-[22rem] gap-3">
              <Button variant="secondary" className="flex-1" onClick={retake}><RotateCcw aria-hidden className="size-4" />Repetir</Button>
              <Button className="flex-1 bg-jade-50 text-jade-900 hover:bg-white" onClick={send} data-autofocus><Send aria-hidden className="size-4" />Enviar a {first}</Button>
            </div>
          ) : (
            <p className="max-w-[22rem] text-center text-body-sm text-jade-100/80">La foto se toma ahora mismo y sale impresa al momento.</p>
          )}
        </div>

        <input ref={fallbackRef} type="file" accept="image/*" capture={facing === 'user' ? 'user' : 'environment'} className="sr-only" tabIndex={-1} aria-hidden="true"
          onChange={(e) => { fromSystemCamera(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
    </motion.div>
  );
}
