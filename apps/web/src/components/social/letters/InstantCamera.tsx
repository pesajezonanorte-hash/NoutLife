// Cámara instantánea de las cartas. Se abre una cámara clásica (plástico crema,
// franja de colores, objetivo y disparador rojo) con el visor en vivo; al
// disparar, destello, la cámara zumba y la foto sale por la ranura y se revela
// despacio. También se puede elegir una foto de la galería: sale igual, impresa
// en su polaroid. Se puede escribir una nota en el borde, repetirla o enviarla:
// al enviar, quien abrió la cámara recibe la posición de la foto para hacerla
// volar hasta la carta.
//
// En el teléfono el visor pide 720 px a 30 fps (suficiente para una foto
// cuadrada de 720 px) y la foto se procesa sin bloquear la pantalla. Sin
// getUserMedia se usa la cámara del sistema (capture). Con «Reducir movimiento»:
// sin destello ni vuelo, la foto aparece con un fundido.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { CameraOff, Image as ImageIcon, RotateCcw, Send, SwitchCamera, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { useMotionStore } from '@/store/motionStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Lettering } from '@/components/layout/Lettering';
import { Button, Spinner, useDialogBehavior } from '@/components/ui/lq';
import { squarePhoto } from '@/services/network.service';
import { InstantPhoto } from './InstantPhoto';
import { PhotoCropper } from '@/components/character/PhotoCropper';

type CamState = 'starting' | 'live' | 'shot' | 'denied' | 'unsupported' | 'error';

/** Lado de la foto que viaja (cuadrada, como la película instantánea). */
const OUT = 720;
export type PhotoSource = 'camera' | 'gallery';

export interface InstantCameraProps {
  open: boolean;
  onClose: () => void;
  /** Para quién es la foto (título y botón de enviar). */
  to: string;
  /** La foto (data URL), la nota, dónde está la foto en pantalla para el vuelo y de dónde salió. */
  onSend: (photo: string, caption: string, from: DOMRect | null, source: PhotoSource) => void;
  /** Sin galería (el ataque al enemigo del gremio solo vale con la cámara). */
  cameraOnly?: boolean;
}

export function InstantCamera(props: InstantCameraProps) {
  return createPortal(
    <AnimatePresence>{props.open && <CameraOverlay key="camera" {...props} />}</AnimatePresence>,
    document.body,
  );
}

function CameraOverlay({ onClose, to, onSend, cameraOnly = false }: InstantCameraProps) {
  const panelRef = useDialogBehavior(true, onClose);
  const reduce = useMotionStore((s) => s.reduce);
  const coarse = useMediaQuery('(pointer: coarse)');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const gen = useRef(0);
  const printRef = useRef<HTMLElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const fallbackRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<PhotoSource>('camera');
  const [busy, setBusy] = useState(false);
  const body = useAnimationControls();
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [state, setState] = useState<CamState>('starting');
  const [photo, setPhoto] = useState<string | null>(null);
  /** Foto de la galería esperando encuadre (zoom y posición) antes de imprimirse. */
  const [cropSrc, setCropSrc] = useState<string | null>(null);
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
        video: { facingMode: { ideal: face }, width: { ideal: 960 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
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

  function printed(url: string, from: PhotoSource = 'camera') {
    setSource(from);
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

  async function shoot() {
    const v = videoRef.current;
    if (!v || state !== 'live' || busy) return;
    setBusy(true);
    // Se congela el cuadro al momento (el destello tapa el procesado).
    v.pause();
    try { printed(await squarePhoto(v, OUT, facing === 'user'), 'camera'); }
    catch { void v.play(); }
    finally { setBusy(false); }
  }

  /** Foto de la cámara del sistema (sin getUserMedia) o de la galería. */
  async function fromFile(file: File | null | undefined, from: PhotoSource) {
    if (!file) return;
    if (from === 'gallery') {
      // Se deja ajustar zoom y posición antes de imprimirla.
      const url = await new Promise<string | null>((resolve) => {
        const fr = new FileReader();
        fr.onload = () => resolve(typeof fr.result === 'string' ? fr.result : null);
        fr.onerror = () => resolve(null);
        fr.readAsDataURL(file);
      });
      if (url) { stop(); setCropSrc(url); }
      return;
    }
    setBusy(true);
    try { printed(await squarePhoto(file, OUT), from); }
    catch { /* foto ilegible: no pasa nada */ }
    finally { setBusy(false); }
  }

  async function applyCrop(url: string) {
    setBusy(true);
    try { printed(await squarePhoto(url, OUT), 'gallery'); setCropSrc(null); }
    catch { /* foto ilegible: no pasa nada */ }
    finally { setBusy(false); }
  }

  function cancelCrop() {
    setCropSrc(null);
    void start(facing);
  }

  function retake() {
    setPhoto(null);
    setCaption('');
    void start(facing);
  }

  function send() {
    if (!photo) return;
    onSend(photo, caption.trim(), printRef.current?.getBoundingClientRect() ?? null, source);
    onClose();
  }

  const live = state === 'live';
  const camSize = { ['--cam' as string]: 'min(92vw, 360px, 50svh)' };

  return (
    <motion.div
      className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-[rgb(var(--lq-jade-900)/.96)]"
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

        {cropSrc && (
          <div className="w-full rounded-[28px] bg-surface p-5 text-on-background">
            <PhotoCropper src={cropSrc} shape="square" size={OUT} quality={0.9} title="Ajusta la foto" onCancel={cancelCrop} onApply={(u) => void applyCrop(u)} />
          </div>
        )}

        {/* La cámara */}
        <motion.div
          animate={body}
          className={cn('relative z-10', cropSrc && 'hidden')}
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
                className={cn('size-full object-cover transition-opacity duration-300 [transform:translateZ(0)]', !live && 'opacity-0')}
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
                          {state === 'denied' ? 'Actívalo en los permisos del navegador o elige una foto de la galería.' : state === 'unsupported' ? (coarse ? 'Usa la cámara del teléfono o elige una foto.' : 'Conecta una cámara o elige una foto de la galería.') : 'Ciérrala y vuelve a abrirla.'}
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
                  type="button" onClick={() => void shoot()} disabled={!live || busy} aria-label="Tomar foto"
                  className="lq-cam-shutter size-16 rounded-full focus-visible:outline-offset-4 select-none"
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

        <div ref={actionsRef} className={cn('mt-auto flex w-full flex-col items-center gap-3 pt-5', cropSrc && 'hidden')}>
          {photo ? (
            <div className="flex w-full max-w-[22rem] gap-3">
              <Button variant="secondary" className="flex-1" onClick={retake}><RotateCcw aria-hidden className="size-4" />Repetir</Button>
              <Button className="flex-1 bg-jade-50 text-jade-900 hover:bg-white" onClick={send} data-autofocus><Send aria-hidden className="size-4" />Enviar a {first}</Button>
            </div>
          ) : (
            <div className="flex w-full max-w-[22rem] flex-col items-center gap-3">
              {!cameraOnly && (
                <Button variant="secondary" onClick={() => galleryRef.current?.click()} disabled={busy}>
                  <ImageIcon aria-hidden className="size-4" />Elegir de la galería
                </Button>
              )}
              <p className="text-center text-body-sm text-jade-100/80">
                {cameraOnly ? 'Para atacar al enemigo, la foto se toma ahora mismo con la cámara.' : 'Toma la foto ahora o elige una: sale impresa al momento.'}
              </p>
            </div>
          )}
        </div>

        <input ref={fallbackRef} type="file" accept="image/*" capture={facing === 'user' ? 'user' : 'environment'} className="sr-only" tabIndex={-1} aria-hidden="true"
          onChange={(e) => { void fromFile(e.target.files?.[0], 'camera'); e.target.value = ''; }} />
        {!cameraOnly && (
          <input ref={galleryRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true"
            onChange={(e) => { void fromFile(e.target.files?.[0], 'gallery'); e.target.value = ''; }} />
        )}
      </div>
    </motion.div>
  );
}
