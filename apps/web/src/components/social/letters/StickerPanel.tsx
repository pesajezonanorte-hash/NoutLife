// El cajón de la carta: tus stickers (y crear uno nuevo con una foto de la
// galería) y los minijuegos. Se abre desde la carita del renglón, en el sitio del
// teclado, como en las apps de mensajería. Mantener pulsado un sticker (o clic
// derecho) lo borra de tu colección; los ya enviados siguen en las cartas.
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Gamepad2, ImagePlus, Plus, Smile, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { useMotionStore } from '@/store/motionStore';
import { useToastStore } from '@/hooks/useToast';
import { primeSticker, useSticker } from '@/lib/media';
import { apiError, compressPhoto, createSticker, deleteSticker, getStickers, type GameType, type StickerRow } from '@/services/network.service';
import { Button, ResponsiveDialog, Skeleton } from '@/components/ui/lq';

const toaster = () => useToastStore.getState();

/** Colección cargada una vez por sesión (se actualiza al crear, guardar o borrar). */
let collection: StickerRow[] | null = null;
const listeners = new Set<(l: StickerRow[]) => void>();
export function setCollection(next: StickerRow[]) { collection = next; listeners.forEach((fn) => fn(next)); }
export function addToCollection(row: StickerRow) { setCollection([row, ...(collection ?? []).filter((s) => s.hash !== row.hash)]); }
function useCollection() {
  const [list, setList] = useState<StickerRow[] | null>(collection);
  useEffect(() => {
    listeners.add(setList);
    if (!collection) getStickers().then(setCollection).catch(() => setCollection([]));
    return () => { listeners.delete(setList); };
  }, []);
  return list;
}

export function StickerImage({ hash, className, alt = 'Sticker' }: { hash: string; className?: string; alt?: string }) {
  const url = useSticker(hash);
  return url
    ? <img src={url} alt={alt} draggable={false} className={cn('select-none object-contain drop-shadow-[0_3px_4px_rgb(0_0_0/.25)]', className)} />
    : <span aria-hidden="true" className={cn('block animate-pulse rounded-full bg-on-surface-light/15', className)} />;
}

// ─── Hacer un sticker ─────────────────────────────────────────────────────────

type Shape = 'circle' | 'rounded';
/** Tamaños de salida: se baja de uno a otro si el archivo se pasa (Safari no sabe WebP y guarda PNG, que pesa mucho más). */
const SIZES = [320, 256, 192];
const MAX_CHARS = 240_000;

/** Dibuja el sticker: la foto recortada con la forma, con su borde blanco de pegatina. */
async function renderSticker(src: string, crop: { x: number; y: number; zoom: number }, shape: Shape, border: boolean) {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
  let url = '';
  for (const size of SIZES) {
    url = drawSticker(img, crop, shape, border, size);
    if (url.length <= MAX_CHARS) break;
  }
  return url;
}

function drawSticker(img: HTMLImageElement, crop: { x: number; y: number; zoom: number }, shape: Shape, border: boolean, OUT: number) {
  const c = document.createElement('canvas');
  c.width = OUT; c.height = OUT;
  const ctx = c.getContext('2d')!;
  const pad = border ? 12 : 2;
  const path = (inset: number) => {
    ctx.beginPath();
    if (shape === 'circle') { ctx.arc(OUT / 2, OUT / 2, OUT / 2 - inset, 0, Math.PI * 2); return; }
    // Cuadrado redondeado (a mano: roundRect no existe en navegadores algo antiguos).
    const r = OUT * 0.175 - inset; const a = inset; const b = OUT - inset;
    ctx.moveTo(a + r, a); ctx.arcTo(b, a, b, b, r); ctx.arcTo(b, b, a, b, r); ctx.arcTo(a, b, a, a, r); ctx.arcTo(a, a, b, a, r); ctx.closePath();
  };
  if (border) { path(2); ctx.fillStyle = '#ffffff'; ctx.fill(); }
  ctx.save();
  path(pad);
  ctx.clip();
  // El recorte: el lado corto de la foto llena el sticker, con zoom y foco.
  const side = Math.min(img.naturalWidth, img.naturalHeight) / crop.zoom;
  const sx = Math.min(Math.max(0, crop.x * img.naturalWidth - side / 2), img.naturalWidth - side);
  const sy = Math.min(Math.max(0, crop.y * img.naturalHeight - side / 2), img.naturalHeight - side);
  ctx.drawImage(img, sx, sy, side, side, pad, pad, OUT - pad * 2, OUT - pad * 2);
  ctx.restore();
  let url = c.toDataURL('image/webp', 0.86);
  if (!url.startsWith('data:image/webp')) url = c.toDataURL('image/png');
  return url;
}

function StickerMaker({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (row: StickerRow) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0.5, y: 0.5, zoom: 1 });
  const [shape, setShape] = useState<Shape>('circle');
  const [border, setBorder] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => { if (open) { setPhoto(null); setPreview(null); setCrop({ x: 0.5, y: 0.5, zoom: 1 }); } }, [open]);
  useEffect(() => {
    if (!photo) return;
    let alive = true;
    const t = window.setTimeout(() => { void renderSticker(photo, crop, shape, border).then((u) => { if (alive) setPreview(u); }); }, 60);
    return () => { alive = false; window.clearTimeout(t); };
  }, [photo, crop, shape, border]);

  async function pick(file?: File | null) {
    if (!file) return;
    try { setPhoto(await compressPhoto(file, 900, 0.85)); }
    catch { toaster().error('No se pudo leer esa foto'); }
  }
  const onDown = (e: PointerEvent<HTMLDivElement>) => { drag.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const w = e.currentTarget.clientWidth * crop.zoom;
    const dx = (e.clientX - drag.current.x) / w; const dy = (e.clientY - drag.current.y) / w;
    drag.current = { x: e.clientX, y: e.clientY };
    setCrop((c) => ({ ...c, x: Math.min(1, Math.max(0, c.x - dx)), y: Math.min(1, Math.max(0, c.y - dy)) }));
  };

  async function save() {
    if (!preview) return;
    setBusy(true);
    try {
      const row = await createSticker(preview);
      primeSticker(row.hash, preview);
      onCreated(row);
      toaster().success('Sticker creado', 'Ya está en tu colección.');
      onClose();
    } catch (e) { toaster().error(apiError(e, 'No se pudo crear el sticker')); }
    finally { setBusy(false); }
  }

  return (
    <ResponsiveDialog open={open} onClose={onClose} title="Nuevo sticker" className="md:max-w-[460px]">
      <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
      {!photo ? (
        <button type="button" onClick={() => fileRef.current?.click()}
          className="lq-stationery flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border-strong text-on-surface transition-colors hover:border-primary">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary/[var(--lq-soft-alpha)] text-primary-text"><ImagePlus aria-hidden className="size-7" strokeWidth={1.75} /></span>
          <span className="text-label-lg">Elegir una foto de la galería</span>
          <span className="text-body-sm text-on-surface-light">Luego la encuadras y le das forma</span>
        </button>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-center gap-5">
            <div
              role="application" aria-label="Encuadre del sticker: arrástralo para moverlo"
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
              className="lq-sticker-stage relative size-44 cursor-grab touch-none select-none rounded-2xl active:cursor-grabbing"
            >
              {preview
                ? <motion.img key="pv" src={preview} alt="Vista previa del sticker" initial={{ rotate: -6, scale: 0.9 }} animate={{ rotate: -3, scale: 1 }} transition={springs.natural} className="pointer-events-none absolute inset-2 size-[calc(100%-1rem)] drop-shadow-[0_6px_8px_rgb(0_0_0/.3)]" />
                : <Skeleton className="absolute inset-4 rounded-full" />}
            </div>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between text-label-lg text-on-surface">Zoom <span className="font-mono text-body-sm text-on-surface-light">{crop.zoom.toFixed(1)}×</span></span>
            <input type="range" min={1} max={3} step={0.05} value={crop.zoom} onChange={(e) => setCrop((c) => ({ ...c, zoom: Number(e.target.value) }))} className="h-11 w-full accent-[rgb(var(--lq-primary))]" />
          </label>
          <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Forma">
            {([['circle', 'Redondo'], ['rounded', 'Cuadrado']] as const).map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={shape === id} onClick={() => setShape(id)}
                className={cn('min-h-11 rounded-full border px-4 text-label-lg transition-colors', shape === id ? 'border-primary bg-primary/10 text-primary-text' : 'border-border text-on-surface')}>
                {label}
              </button>
            ))}
            <label className="ml-auto flex min-h-11 items-center gap-2 text-label-lg text-on-surface">
              <input type="checkbox" checked={border} onChange={(e) => setBorder(e.target.checked)} className="size-5 accent-[rgb(var(--lq-primary))]" />Borde blanco
            </label>
          </div>
          <Button variant="ghost" size="md" className="self-start" onClick={() => fileRef.current?.click()}><ImagePlus aria-hidden className="size-4" />Otra foto</Button>
        </div>
      )}
      <div className="flex gap-3">
        <Button variant="secondary" size="md" className="flex-1" onClick={onClose}>Cancelar</Button>
        <Button size="md" className="flex-1" disabled={!preview} loading={busy} onClick={() => void save()}>Guardar sticker</Button>
      </div>
    </ResponsiveDialog>
  );
}

// ─── El cajón ─────────────────────────────────────────────────────────────────

function StickerTile({ row, onSend, onDelete }: { row: StickerRow; onSend: () => void; onDelete: () => void }) {
  const timer = useRef(0);
  const [ask, setAsk] = useState(false);
  return (
    <li className="relative">
      <button
        type="button" onClick={() => { if (!ask) onSend(); }} aria-label="Enviar este sticker"
        onPointerDown={() => { timer.current = window.setTimeout(() => setAsk(true), 500); }}
        onPointerUp={() => window.clearTimeout(timer.current)} onPointerLeave={() => window.clearTimeout(timer.current)}
        onContextMenu={(e) => { e.preventDefault(); setAsk(true); }}
        className="flex aspect-square w-full items-center justify-center rounded-2xl p-1.5 transition-transform hover:scale-105 active:scale-95 [-webkit-touch-callout:none]"
      >
        <StickerImage hash={row.hash} className="size-full" />
      </button>
      <AnimatePresence>
        {ask && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={springs.snappy}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-2xl bg-surface/95 shadow-md">
            <button type="button" onClick={() => { setAsk(false); onDelete(); }} className="flex min-h-9 items-center gap-1 rounded-full px-2 text-label-md text-error-text hover:bg-error/10">
              <Trash2 aria-hidden className="size-4" />Borrar
            </button>
            <button type="button" onClick={() => setAsk(false)} className="min-h-9 rounded-full px-2 text-label-md text-on-surface-light">Cancelar</button>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export function StickerPanel({ open, height, onSticker, onGame }: {
  open: boolean;
  /** Alto del cajón (el del teclado si ya se conoce). */
  height: number;
  onSticker: (hash: string) => void;
  onGame: (type: GameType) => void;
}) {
  const reduce = useMotionStore((s) => s.reduce);
  const list = useCollection();
  const [tab, setTab] = useState<'stickers' | 'games'>('stickers');
  const [maker, setMaker] = useState(false);

  async function remove(row: StickerRow) {
    setCollection((collection ?? []).filter((s) => s.id !== row.id));
    try { await deleteSticker(row.id); toaster().info('Sticker borrado de tu colección'); }
    catch (e) { addToCollection(row); toaster().error(apiError(e, 'No se pudo borrar')); }
  }

  return (
    <>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="drawer"
            initial={{ height: 0 }} animate={{ height }} exit={{ height: 0, transition: { duration: reduce ? 0 : 0.18 } }}
            transition={reduce ? { duration: 0 } : springs.natural}
            className="relative overflow-hidden border-t border-border/80 bg-surface"
          >
            <div className="flex h-full flex-col" style={{ height }}>
              <div role="tablist" aria-label="Cajón de la carta" className="flex shrink-0 gap-1 px-3 pt-2">
                {([['stickers', 'Stickers', Smile], ['games', 'Juegos', Gamepad2]] as const).map(([id, label, Icon]) => (
                  <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                    className={cn('flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-label-lg transition-colors', tab === id ? 'bg-primary/12 text-primary-text' : 'text-on-surface-light hover:text-on-surface')}>
                    <Icon aria-hidden className="size-4" strokeWidth={1.8} />{label}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-2">
                {tab === 'stickers' ? (
                  <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    <li>
                      <button type="button" onClick={() => setMaker(true)} aria-label="Crear un sticker con una foto"
                        className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-border-strong/60 text-label-md text-on-surface-light transition-colors hover:border-primary hover:text-primary-text">
                        <Plus aria-hidden className="size-6" />Crear
                      </button>
                    </li>
                    {list === null
                      ? [0, 1, 2].map((i) => <li key={i}><Skeleton className="aspect-square rounded-2xl" /></li>)
                      : list.map((row) => <StickerTile key={row.id} row={row} onSend={() => onSticker(row.hash)} onDelete={() => void remove(row)} />)}
                    {list?.length === 0 && (
                      <li className="col-span-3 flex items-center text-body-sm text-on-surface-light sm:col-span-5">Haz tu primer sticker con cualquier foto de tu galería.</li>
                    )}
                  </ul>
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {([
                      ['ttt', 'Tres en raya', 'Por turnos. Gana quien hace tres en línea.', '✕◯'],
                      ['rps', 'Piedra, papel o tijera', 'Un duelo a ciegas: eligen los dos y se revela.', '✊✋✌️'],
                    ] as const).map(([id, title, desc, art]) => (
                      <li key={id}>
                        <button type="button" onClick={() => onGame(id)}
                          className="lq-game-card flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-transform hover:-translate-y-0.5 active:scale-[.98]">
                          <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-mono text-lg text-primary-text">{art}</span>
                          <span className="min-w-0">
                            <span className="block text-label-lg text-on-background">{title}</span>
                            <span className="block text-body-sm text-on-surface-light">{desc}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <StickerMaker open={maker} onClose={() => setMaker(false)} onCreated={(row) => addToCollection(row)} />
    </>
  );
}
