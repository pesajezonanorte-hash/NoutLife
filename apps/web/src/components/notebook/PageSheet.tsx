// Una hoja de la Libreta: papel (rayado, cuadriculado, punteado o liso) con
// anillas, texto enriquecido, dibujo libre en canvas, imágenes y notas adhesivas
// que se arrastran. Capas, de abajo arriba: papel → texto → imágenes → tinta →
// notas adhesivas (la tinta pasa por encima de una foto pegada y por debajo de un
// post-it, como en papel). Todo se mide en unidades de página (paper.ts) y se
// escala con `--u` (píxeles por unidad).
import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Move, Palette, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { imageUrl, type NotebookPaper, type PageContent, type PageImage, type Sticky, type StickyColor, type Stroke } from '@/services/notebook.service';
import { FONT, LINE, PAGE_H, PAGE_W, STICKY_COLORS, TEXT_LEFT, TEXT_TOP, drawStroke, simplifyPoints } from './paper';

export type Mode = 'write' | 'draw';
export interface Tool { t: Stroke['t']; c: string; w: number }

const STICKY = 320;
const STICKY_ORDER = Object.keys(STICKY_COLORS) as StickyColor[];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Grosor real: el marcador y el borrador van más anchos que la pluma. */
export const strokeWidth = (tool: Tool) => (tool.t === 'pen' ? tool.w : tool.w * 3);

// ─── Papel ─────────────────────────────────────────────────────────────────────
function paperStyle(paper: NotebookPaper, u: number): CSSProperties {
  const ink = 'rgb(var(--lq-info) / .22)';
  if (paper === 'grid') {
    const g = LINE * u;
    return { backgroundImage: `linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`, backgroundSize: `${g}px ${g}px`, backgroundPosition: `0 ${TEXT_TOP * u}px` };
  }
  if (paper === 'dots') {
    const g = LINE * u;
    return { backgroundImage: `radial-gradient(rgb(var(--lq-on-background) / .3) ${Math.max(1, 2.4 * u)}px, transparent ${Math.max(1.3, 3 * u)}px)`, backgroundSize: `${g}px ${g}px`, backgroundPosition: `${-g / 2}px ${TEXT_TOP * u + g / 2}px` };
  }
  return {};
}

/** Anillas metálicas del canto izquierdo. */
function Rings({ u }: { u: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-y-0 flex flex-col justify-around" style={{ left: -26 * u, width: 60 * u, paddingBlock: 40 * u }}>
      {Array.from({ length: 14 }, (_, i) => (
        <span key={i} className="relative block">
          {/* Agujero en el papel */}
          <span className="absolute rounded-full bg-surface-variant shadow-[inset_0_1px_2px_rgb(0_0_0/.35)]" style={{ left: 34 * u, top: -7 * u, width: 15 * u, height: 15 * u }} />
          {/* Anilla */}
          <span className="absolute rounded-full border-on-surface-light/70 bg-transparent shadow-[0_1px_1px_rgb(0_0_0/.25)]" style={{ left: 0, top: -9 * u, width: 46 * u, height: 18 * u, borderWidth: Math.max(1.5, 4.5 * u) }} />
        </span>
      ))}
    </div>
  );
}

// ─── Arrastrar con el dedo o el ratón ──────────────────────────────────────────
/**
 * Mueve un elemento con un puntero a 60 fps: durante el gesto solo cambia su
 * transform; al soltar se guarda la posición nueva (en unidades de página).
 */
function useDrag(u: number, onEnd: (dx: number, dy: number) => void) {
  const start = useRef<{ x: number; y: number; id: number; el: HTMLElement; base: string } | null>(null);
  return {
    onPointerDown(e: ReactPointerEvent<HTMLElement>, el: HTMLElement | null) {
      if (!el || e.button > 0) return;
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, el, base: el.style.transform };
    },
    onPointerMove(e: ReactPointerEvent<HTMLElement>) {
      const s = start.current;
      if (!s || e.pointerId !== s.id) return;
      s.el.style.transform = `translate(${e.clientX - s.x}px, ${e.clientY - s.y}px) ${s.base}`;
    },
    onPointerUp(e: ReactPointerEvent<HTMLElement>) {
      const s = start.current;
      if (!s || e.pointerId !== s.id) return;
      start.current = null;
      s.el.style.transform = s.base;
      const dx = (e.clientX - s.x) / u, dy = (e.clientY - s.y) / u;
      if (Math.abs(dx) + Math.abs(dy) > 0.5) onEnd(dx, dy);
    },
  };
}

/** Flechas mueven 10 u (con Mayúsculas, 50); Suprimir quita. Para teclado y lectores de pantalla. */
function keyMove(e: KeyboardEvent, move: (dx: number, dy: number) => void, remove: () => void) {
  const step = e.shiftKey ? 50 : 10;
  const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (d[e.key]) { e.preventDefault(); move(...d[e.key]); }
  else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(); }
}

// ─── Imagen pegada ──────────────────────────────────────────────────────────────
function ImageItem({ notebookId, img, u, editable, selected, onSelect, onChange, onRemove }: {
  notebookId: string; img: PageImage; u: number; editable: boolean; selected: boolean;
  onSelect: () => void; onChange: (next: PageImage) => void; onRemove: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const resize = useRef<{ x: number; w: number; id: number } | null>(null);
  useEffect(() => { let on = true; imageUrl(notebookId, img.id).then((url) => on && setSrc(url)).catch(() => undefined); return () => { on = false; }; }, [notebookId, img.id]);
  const drag = useDrag(u, (dx, dy) => onChange({ ...img, x: clamp(img.x + dx, -img.w / 2, PAGE_W - img.w / 2), y: clamp(img.y + dy, 0, PAGE_H - 40) }));
  const h = img.w * img.ratio;
  return (
    <div
      ref={box}
      role="img" aria-label="Imagen pegada" tabIndex={editable ? 0 : -1}
      className={cn('absolute touch-none outline-none', editable ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none', selected && 'ring-2 ring-primary ring-offset-2 ring-offset-surface')}
      style={{ left: img.x * u, top: img.y * u, width: img.w * u, height: h * u, zIndex: 2 }}
      onPointerDown={(e) => { onSelect(); drag.onPointerDown(e, box.current); }}
      onPointerMove={drag.onPointerMove} onPointerUp={drag.onPointerUp} onPointerCancel={drag.onPointerUp}
      onFocus={onSelect}
      onKeyDown={(e) => keyMove(e, (dx, dy) => onChange({ ...img, x: img.x + dx, y: img.y + dy }), onRemove)}
    >
      {src ? <img src={src} alt="" draggable={false} className="size-full rounded-[3px] object-cover shadow-md" /> : <span className="block size-full animate-pulse rounded-[3px] bg-surface-variant" />}
      {/* Cinta adhesiva que la sujeta */}
      <span aria-hidden className="pointer-events-none absolute left-1/2 top-0 block -translate-x-1/2 -translate-y-1/2 rotate-[-4deg] bg-on-background/10 backdrop-blur-[1px]" style={{ width: 90 * u, height: 26 * u }} />
      {editable && selected && (
        <>
          <button
            type="button" aria-label="Quitar imagen" onPointerDown={(e) => e.stopPropagation()} onClick={onRemove}
            className="absolute -right-3 -top-3 flex size-8 items-center justify-center rounded-full bg-on-background text-background shadow-md"
          ><X aria-hidden className="size-4" /></button>
          <span
            role="presentation"
            className="absolute -bottom-3 -right-3 block size-7 cursor-nwse-resize touch-none rounded-full border-2 border-background bg-primary shadow-md"
            onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); resize.current = { x: e.clientX, w: img.w, id: e.pointerId }; }}
            onPointerMove={(e) => { const r = resize.current; if (r && box.current && e.pointerId === r.id) { const w = clamp(r.w + (e.clientX - r.x) / u, 80, PAGE_W); box.current.style.width = `${w * u}px`; box.current.style.height = `${w * img.ratio * u}px`; } }}
            onPointerUp={(e) => { const r = resize.current; if (!r || e.pointerId !== r.id) return; resize.current = null; onChange({ ...img, w: Math.round(clamp(r.w + (e.clientX - r.x) / u, 80, PAGE_W)) }); }}
          />
        </>
      )}
    </div>
  );
}

// ─── Nota adhesiva ──────────────────────────────────────────────────────────────
function StickyItem({ note, u, editable, selected, canColor, onSelect, onChange, onRemove }: {
  note: Sticky; u: number; editable: boolean; selected: boolean; canColor: boolean;
  onSelect: () => void; onChange: (next: Sticky) => void; onRemove: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useDrag(u, (dx, dy) => onChange({ ...note, x: clamp(note.x + dx, -STICKY / 2, PAGE_W - STICKY / 2), y: clamp(note.y + dy, 0, PAGE_H - 60) }));
  const nextColor = STICKY_ORDER[(STICKY_ORDER.indexOf(note.color) + 1) % STICKY_ORDER.length];
  return (
    <div
      ref={box}
      className={cn('absolute flex flex-col text-[#1f2937] shadow-[0_10px_18px_-10px_rgb(0_0_0/.55),0_2px_4px_rgb(0_0_0/.12)]', !editable && 'pointer-events-none', selected && 'ring-2 ring-primary/70')}
      style={{ left: note.x * u, top: note.y * u, width: STICKY * u, height: STICKY * u, background: STICKY_COLORS[note.color], transform: `rotate(${note.rot}deg)`, zIndex: 4 }}
      onPointerDown={onSelect}
    >
      <div className="flex shrink-0 items-center justify-between bg-black/[.06]" style={{ height: 56 * u, paddingInline: 8 * u }}>
        <button
          type="button" aria-label="Mover nota (o usa las flechas)" tabIndex={editable ? 0 : -1}
          className="flex h-full flex-1 cursor-grab touch-none items-center text-black/40 active:cursor-grabbing"
          onPointerDown={(e) => { onSelect(); drag.onPointerDown(e, box.current); }}
          onPointerMove={drag.onPointerMove} onPointerUp={drag.onPointerUp} onPointerCancel={drag.onPointerUp}
          onKeyDown={(e) => keyMove(e, (dx, dy) => onChange({ ...note, x: note.x + dx, y: note.y + dy }), onRemove)}
        ><Move aria-hidden style={{ width: 28 * u, height: 28 * u }} /></button>
        {editable && selected && (
          <span className="flex items-center" style={{ gap: 4 * u }}>
            {canColor && <button type="button" aria-label="Cambiar color de la nota" onClick={() => onChange({ ...note, color: nextColor })} className="flex items-center justify-center rounded-full text-black/55 hover:bg-black/10" style={{ width: 36 * u, height: 36 * u, minWidth: 28, minHeight: 28 }}>
              <Palette aria-hidden className="size-[60%]" />
            </button>}
            <button type="button" aria-label="Quitar nota" onClick={onRemove} className="flex items-center justify-center rounded-full text-black/55 hover:bg-black/10" style={{ width: 36 * u, height: 36 * u, minWidth: 28, minHeight: 28 }}>
              <Trash2 aria-hidden className="size-[60%]" />
            </button>
          </span>
        )}
      </div>
      <textarea
        aria-label="Texto de la nota" value={note.text} readOnly={!editable} maxLength={1000} placeholder="Escribe…"
        onFocus={onSelect}
        onChange={(e) => onChange({ ...note, text: e.target.value })}
        className="min-h-0 flex-1 resize-none bg-transparent outline-none placeholder:text-black/35"
        style={{ fontSize: 34 * u, lineHeight: `${44 * u}px`, padding: 16 * u }}
      />
    </div>
  );
}

// ─── Tinta ──────────────────────────────────────────────────────────────────────
/**
 * Dos canvas: la base guarda la tinta ya hecha y el de arriba pinta el trazo en
 * curso (redibujado en cada fotograma, así el marcador no se oscurece en las
 * uniones). El borrador actúa sobre la base al momento. Con lápiz óptico, los
 * toques de la palma se ignoran.
 */
function InkLayer({ strokes, width, height, active, tool, onCommit }: {
  strokes: Stroke[]; width: number; height: number; active: boolean; tool: Tool; onCommit: (s: Stroke) => void;
}) {
  const base = useRef<HTMLCanvasElement>(null);
  const live = useRef<HTMLCanvasElement>(null);
  const drawn = useRef<{ strokes: Stroke[]; width: number } | null>(null);
  const cur = useRef<{ id: number; s: Stroke } | null>(null);
  const penSeen = useRef(false);
  const frame = useRef(0);
  const scale = width / PAGE_W;
  const dpr = Math.min(2, window.devicePixelRatio || 1);

  useLayoutEffect(() => {
    const c = base.current!;
    const ctx = c.getContext('2d')!;
    const prev = drawn.current;
    const appended = prev && prev.width === width && strokes.length === prev.strokes.length + 1 && prev.strokes.every((s, i) => s === strokes[i]);
    if (appended) drawStroke(ctx, strokes[strokes.length - 1], scale);
    else {
      c.width = Math.round(width * dpr);
      c.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (const s of strokes) drawStroke(ctx, s, scale);
    }
    drawn.current = { strokes, width };
  }, [strokes, width, height, scale, dpr]);

  useLayoutEffect(() => {
    const c = live.current!;
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    c.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [width, height, dpr]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const point = (e: { clientX: number; clientY: number }) => {
    const r = live.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale];
  };
  const paint = () => {
    frame.current = 0;
    const c = cur.current;
    if (!c) return;
    if (c.s.t === 'eraser') drawStroke(base.current!.getContext('2d')!, c.s, scale);
    else {
      const ctx = live.current!.getContext('2d')!;
      ctx.clearRect(0, 0, width, height);
      drawStroke(ctx, c.s, scale);
    }
  };
  const finish = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const c = cur.current;
    if (!c || e.pointerId !== c.id) return;
    cur.current = null;
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    live.current!.getContext('2d')!.clearRect(0, 0, width, height);
    onCommit({ ...c.s, p: simplifyPoints(c.s.p) });
  };

  return (
    <>
      <canvas ref={base} aria-hidden className="pointer-events-none absolute left-0 top-0" style={{ width, height, zIndex: 3 }} />
      <canvas
        ref={live}
        aria-label={active ? 'Lienzo de dibujo' : undefined}
        aria-hidden={!active || undefined}
        className={cn('absolute left-0 top-0', active ? 'cursor-crosshair touch-none' : 'pointer-events-none')}
        style={{ width, height, zIndex: 3 }}
        onPointerDown={(e) => {
          if (!active || cur.current || e.button > 0) return;
          if (e.pointerType === 'pen') penSeen.current = true;
          else if (e.pointerType === 'touch' && penSeen.current) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          const [x, y] = point(e);
          cur.current = { id: e.pointerId, s: { t: tool.t, c: tool.c, w: strokeWidth(tool), p: [x, y] } };
          paint();
        }}
        onPointerMove={(e) => {
          const c = cur.current;
          if (!c || e.pointerId !== c.id) return;
          const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
          for (const ev of events.length ? events : [e.nativeEvent]) c.s.p.push(...point(ev));
          if (!frame.current) frame.current = requestAnimationFrame(paint);
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
      />
    </>
  );
}

// ─── Hoja ───────────────────────────────────────────────────────────────────────
export interface PageSheetProps {
  notebookId: string;
  paper: NotebookPaper;
  content: PageContent;
  /** Número de la página (desde 1). */
  number: number;
  width: number;
  mode: Mode;
  tool: Tool;
  /** false mientras la hoja se va (paso de página): nada se edita. */
  interactive: boolean;
  onHtml: (html: string) => void;
  onChange: (next: PageContent) => void;
  onDropImages: (files: File[], at: { x: number; y: number }) => void;
  /** Ir a la página siguiente (cuando el texto ya no cabe en esta). */
  onNext?: () => void;
  /** Notas de colores (Pro). En Lite todas las notas son amarillas. */
  richStickies?: boolean;
}

export const PageSheet = memo(function PageSheet({
  notebookId, paper, content, number, width, mode, tool, interactive, onHtml, onChange, onDropImages, onNext, richStickies = true,
}: PageSheetProps) {
  const u = width / PAGE_W;
  const height = width * (PAGE_H / PAGE_W);
  const text = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const writing = interactive && mode === 'write';
  /** El texto llegó al final de la hoja: lo que sigue no se vería. */
  const [full, setFull] = useState(false);
  const checkFull = (el: HTMLElement) => setFull(el.scrollHeight > el.clientHeight + 2);

  // El texto es un contentEditable sin controlar: se pinta una vez al abrir la hoja.
  useLayoutEffect(() => { if (text.current) { text.current.innerHTML = content.html; checkFull(text.current); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<PageContent>) => onChange({ ...content, ...patch });
  const toPage = (e: { clientX: number; clientY: number }, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return { x: (e.clientX - r.left) / u, y: (e.clientY - r.top) / u };
  };

  return (
    <div
      className="relative"
      style={{ width, height, ['--u' as string]: u } as CSSProperties}
      onPointerDown={(e) => { if (e.target === e.currentTarget || e.target === text.current) setSelected(null); }}
      onDragOver={(e) => { if (writing && e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
      onDrop={(e) => {
        const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
        if (!writing || !files.length) return;
        e.preventDefault();
        onDropImages(files, toPage(e, e.currentTarget));
      }}
    >
      {/* Papel con su grano, sombra y canto */}
      <div aria-hidden className="lq-tex-paper pointer-events-none absolute inset-0 rounded-r-[10px] rounded-l-[3px] shadow-[0_18px_40px_-18px_rgb(0_0_0/.55),0_2px_6px_rgb(0_0_0/.12)]" style={paperStyle(paper, u)} />
      {paper === 'ruled' && (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-x-0" style={{
            top: TEXT_TOP * u, bottom: 70 * u,
            backgroundImage: `linear-gradient(to bottom, transparent calc(100% - 1px), rgb(var(--lq-info) / .25) calc(100% - 1px))`,
            backgroundSize: `100% ${LINE * u}px`,
          }} />
          <div aria-hidden className="lq-tex-margin pointer-events-none absolute inset-y-0" style={{ left: 110 * u }} />
        </>
      )}
      <Rings u={u} />

      {/* Texto enriquecido */}
      <div
        ref={text}
        // La barra de formato busca el texto de la hoja que está a la vista.
        data-nb-current={interactive ? '' : undefined}
        role="textbox" aria-multiline="true" aria-label={`Texto de la página ${number}`}
        contentEditable={writing}
        suppressContentEditableWarning
        spellCheck
        data-placeholder="Escribe aquí…"
        className="lq-nb-text absolute overflow-hidden text-on-background outline-none"
        style={{ top: TEXT_TOP * u, left: TEXT_LEFT * u, right: 50 * u, bottom: 70 * u, fontSize: FONT * u, lineHeight: `${LINE * u}px`, zIndex: 1 }}
        onInput={(e) => { onHtml(e.currentTarget.innerHTML); checkFull(e.currentTarget); }}
        onPaste={(e) => {
          const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'));
          e.preventDefault();
          if (files.length) { onDropImages(files, { x: 250, y: 400 }); return; }
          // Solo texto: nada de estilos ni etiquetas de otra web.
          document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
        }}
      />

      {content.images.map((img) => (
        <ImageItem
          key={img.id} notebookId={notebookId} img={img} u={u} editable={writing} selected={selected === img.id}
          onSelect={() => setSelected(img.id)}
          onChange={(next) => set({ images: content.images.map((x) => (x.id === img.id ? next : x)) })}
          onRemove={() => { setSelected(null); set({ images: content.images.filter((x) => x.id !== img.id) }); }}
        />
      ))}

      <InkLayer strokes={content.strokes} width={width} height={height} active={interactive && mode === 'draw'} tool={tool} onCommit={(s) => set({ strokes: [...content.strokes, s] })} />

      {content.stickies.map((note) => (
        <StickyItem
          key={note.id} note={note} u={u} editable={writing} selected={selected === note.id} canColor={richStickies}
          onSelect={() => setSelected(note.id)}
          onChange={(next) => set({ stickies: content.stickies.map((x) => (x.id === note.id ? next : x)) })}
          onRemove={() => { setSelected(null); set({ stickies: content.stickies.filter((x) => x.id !== note.id) }); }}
        />
      ))}

      {full && writing && onNext && (
        <button
          type="button" onClick={onNext}
          className="absolute left-1/2 z-[5] -translate-x-1/2 whitespace-nowrap rounded-full bg-on-background px-3 py-1.5 text-label-md text-background shadow-md"
          style={{ bottom: 64 * u }}
        >
          Página llena · sigue en la siguiente
        </button>
      )}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 text-center font-mono text-on-surface-light" style={{ bottom: 26 * u, fontSize: Math.max(9, 18 * u) }}>{number}</span>
    </div>
  );
});
