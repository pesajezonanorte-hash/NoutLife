// Cambiar el fondo de una carta: elegir cualquier foto, encuadrarla
// arrastrándola (o con las flechas), acercarla y decidir cuánto papel se ve
// encima. La vista previa es la carta de verdad con dos mensajes de ejemplo,
// así se comprueba que todo sigue leyéndose. Al guardar, lo ven todos los de
// la conversación.
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ImagePlus, Move, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { compressPhoto, DEFAULT_FIT, type Background, type BackgroundFit } from '@/services/network.service';
import { Button, ResponsiveDialog } from '@/components/ui/lq';
import { LetterBackdrop, frameFor, useBoxSize, useImageSize } from './LetterBackdrop';

const MAX_LEN = 880_000;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

async function backgroundFrom(file: File) {
  let url = await compressPhoto(file, 1280, 0.72);
  if (url.length > MAX_LEN) url = await compressPhoto(file, 1080, 0.6);
  if (url.length > MAX_LEN) throw new Error('Esa foto pesa demasiado. Prueba con otra.');
  return url;
}

export interface BackdropEditorProps {
  open: boolean;
  onClose: () => void;
  /** El fondo actual (para reencuadrarlo sin volver a subirlo). */
  current: Background | null;
  /** Con quién se comparte la carta (para el texto). */
  shareWith: string;
  onSave: (body: { photoUrl?: string | null; fit?: BackgroundFit }) => Promise<void>;
}

export function BackdropEditor({ open, onClose, current, shareWith, onSave }: BackdropEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [fresh, setFresh] = useState(false);
  const [fit, setFit] = useState<BackgroundFit>(DEFAULT_FIT);
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { ref: boxRef, box } = useBoxSize<HTMLDivElement>();
  const img = useImageSize(photo);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const wasOpen = useRef(false);

  // Se rellena solo al abrirse. Antes se rellenaba cada vez que la carta se
  // repintaba (el chat en vivo la repinta a menudo) y la foto nueva elegida
  // volvía a ser la anterior: no dejaba cambiar un fondo que ya existía.
  useEffect(() => {
    if (open && !wasOpen.current) {
      setPhoto(current?.photoUrl ?? null);
      setFit(current?.fit ?? DEFAULT_FIT);
      setFresh(false); setError(null); setBusy(null);
    }
    wasOpen.current = open;
  }, [open, current]);
  // Si la foto del fondo llega con el editor ya abierto (y no elegiste otra), se muestra.
  useEffect(() => {
    if (open && !fresh && !photo && current?.photoUrl) { setPhoto(current.photoUrl); setFit(current.fit); }
  }, [open, fresh, photo, current?.photoUrl, current?.fit]);

  async function pick(file?: File | null) {
    if (!file) return;
    setError(null);
    try {
      setPhoto(await backgroundFrom(file));
      setFresh(true);
      setFit((f) => ({ ...DEFAULT_FIT, paper: f.paper }));
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo leer esa foto'); }
  }

  const frame = photo ? frameFor(fit, box, img) : null;
  function move(dx: number, dy: number) {
    if (!frame) return;
    setFit((f) => ({ ...f, x: clamp(f.x - dx / frame.w, 0, 1), y: clamp(f.y - dy / frame.h, 0, 1) }));
  }
  const onDown = (e: PointerEvent<HTMLDivElement>) => { drag.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    move(e.clientX - drag.current.x, e.clientY - drag.current.y);
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = () => { drag.current = null; };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 40 : 12;
    const d = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
    if (!d) return;
    e.preventDefault();
    move(d[0], d[1]);
  };

  async function save() {
    if (!photo) return;
    setBusy('save'); setError(null);
    try { await onSave(fresh ? { photoUrl: photo, fit } : { fit }); onClose(); }
    catch (e) { setError(e instanceof Error && e.message ? e.message : 'No se pudo guardar el fondo'); }
    finally { setBusy(null); }
  }
  async function remove() {
    setBusy('remove'); setError(null);
    try { await onSave({ photoUrl: null }); onClose(); }
    catch (e) { setError(e instanceof Error && e.message ? e.message : 'No se pudo quitar el fondo'); }
    finally { setBusy(null); }
  }

  return (
    <ResponsiveDialog open={open} onClose={onClose} title="Fondo de la carta" className="md:max-w-[520px]">
      <p className="-mt-2 text-body-sm text-on-surface-light">Lo verá también {shareWith}. La foto queda impresa sobre el papel de la carta.</p>
      <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />

      {photo ? (
        <div className="flex flex-col gap-4">
          <div
            ref={boxRef}
            role="application" tabIndex={0} aria-label="Encuadre del fondo: arrástralo o usa las flechas para moverlo"
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey}
            className="relative mx-auto aspect-[3/4] w-full max-w-[300px] cursor-grab touch-none select-none overflow-hidden rounded-2xl border border-border shadow-md active:cursor-grabbing"
          >
            <LetterBackdrop src={photo} fit={fit} />
            <div className="pointer-events-none relative flex h-full flex-col justify-center gap-3 p-4">
              <p className="lq-slip max-w-[80%] self-start px-3 py-2 text-body-sm text-on-background">¡Hola! ¿Cómo va tu día?</p>
              <p className="lq-slip lq-slip-mine max-w-[80%] self-end px-3 py-2 text-body-sm text-forest-text">Muy bien. ¡Mira el fondo nuevo!</p>
            </div>
            <span className="pointer-events-none absolute bottom-2 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-surface/90 px-2.5 py-1 text-label-md text-on-surface shadow-sm">
              <Move aria-hidden className="size-3.5" />Arrastra para encuadrar
            </span>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between text-label-lg text-on-surface">Zoom <span className="font-mono text-body-sm text-on-surface-light">{fit.zoom.toFixed(1)}×</span></span>
            <input type="range" min={1} max={3} step={0.05} value={fit.zoom} onChange={(e) => setFit((f) => ({ ...f, zoom: Number(e.target.value) }))} className="h-11 w-full accent-[rgb(var(--lq-primary))]" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between text-label-lg text-on-surface">Papel encima <span className="font-mono text-body-sm text-on-surface-light">{Math.round(fit.paper * 100)} %</span></span>
            <input type="range" min={0.2} max={0.9} step={0.01} value={fit.paper} onChange={(e) => setFit((f) => ({ ...f, paper: Number(e.target.value) }))} className="h-11 w-full accent-[rgb(var(--lq-primary))]" />
            <span className="text-body-sm text-on-surface-light">Más papel, más fácil de leer.</span>
          </label>
        </div>
      ) : (
        <button
          type="button" onClick={() => fileRef.current?.click()}
          className="lq-stationery flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border-strong text-on-surface transition-colors hover:border-primary"
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-primary/[var(--lq-soft-alpha)] text-primary-text"><ImagePlus aria-hidden className="size-7" strokeWidth={1.75} /></span>
          <span className="text-label-lg">Elegir una foto</span>
          <span className="text-body-sm text-on-surface-light">Cualquiera de tus fotos</span>
        </button>
      )}

      {error && <p role="alert" className="text-body-sm text-error-text">{error}</p>}

      <div className="flex flex-col gap-3">
        {(photo || current) && (
          <div className="flex flex-wrap gap-1">
            {photo && <Button variant="ghost" size="md" onClick={() => fileRef.current?.click()}><ImagePlus aria-hidden className="size-4" />Otra foto</Button>}
            {current && (
              <Button variant="ghost" size="md" loading={busy === 'remove'} onClick={() => void remove()} className={cn('text-error-text hover:bg-error/[var(--lq-soft-alpha)]')}>
                <Trash2 aria-hidden className="size-4" />Quitar fondo
              </Button>
            )}
          </div>
        )}
        <div className="flex gap-3">
          <Button variant="secondary" size="md" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button size="md" className="flex-1" disabled={!photo} loading={busy === 'save'} onClick={() => void save()}>Guardar fondo</Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
