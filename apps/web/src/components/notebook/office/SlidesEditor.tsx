// Presentación: diapositivas 16:9 con cuatro diseños (portada, viñetas, cita y cifra) y tres temas. Se edita
// a la derecha con vista previa en vivo; «Presentar» las pasa a pantalla completa con una transición espacial
// (la diapositiva gira levemente en 3D al entrar). El copiloto arma diapositivas a partir de notas sueltas.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, NotebookText, Play, Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMotionReduced } from '@/lib/motion';
import { Button, ChipGroup, Field, Input, Textarea } from '@/components/ui/lq';
import { useText } from '@/lib/i18n';
import { bulletLines, newId } from '@/lib/office';
import type { CopilotResult, Slide, SlideLayout, SlidesContent, SlideTheme } from '@/services/office.service';
import { OFFICE_COPY } from './copy';
import { Copilot } from './Copilot';

/** Las diapositivas se ven igual con la app en claro u oscuro: sus colores son de la marca, no del tema. */
const THEMES: Record<SlideTheme, { bg: string; fg: string; accent: string; muted: string }> = {
  jade: { bg: 'radial-gradient(120% 120% at 100% 0%, #3d8a76 0%, #2f7565 45%, #1f4f43 100%)', fg: '#f3faf6', accent: '#85c7a1', muted: 'rgba(243,250,246,.72)' },
  ink: { bg: 'radial-gradient(120% 120% at 0% 100%, #1d2b25 0%, #121a17 60%)', fg: '#eef3f0', accent: '#85c7a1', muted: 'rgba(238,243,240,.66)' },
  paper: { bg: 'linear-gradient(160deg, #fbfaf6 0%, #f3f1ea 100%)', fg: '#1d2a24', accent: '#2f7565', muted: 'rgba(29,42,36,.66)' },
};
const LAYOUTS: SlideLayout[] = ['title', 'bullets', 'quote', 'number'];

/** Una diapositiva a cualquier tamaño: las letras se miden en cqw (ancho del contenedor). */
export function SlideView({ slide, theme, className }: { slide: Slide; theme: SlideTheme; className?: string }) {
  const t = useText(OFFICE_COPY);
  const c = THEMES[theme];
  const box: CSSProperties = { background: c.bg, color: c.fg, containerType: 'inline-size' };
  const empty = !slide.title.trim() && !slide.body.trim();
  return (
    <div className={cn('relative aspect-video w-full overflow-hidden rounded-xl', className)} style={box}>
      <span aria-hidden className="absolute left-[6%] top-[9%] h-[1.2%] w-[7%] rounded-full" style={{ background: c.accent }} />
      {empty ? (
        <p className="absolute inset-0 flex items-center justify-center" style={{ color: c.muted, fontSize: '3cqw' }}>{t.emptySlide}</p>
      ) : slide.layout === 'title' ? (
        <div className="absolute inset-[9%] flex flex-col justify-center gap-[2cqw]">
          <h2 className="font-medium leading-[1.05] [overflow-wrap:anywhere] [text-wrap:balance]" style={{ fontSize: '6.4cqw' }}>{slide.title}</h2>
          {slide.body && <p className="[text-wrap:pretty]" style={{ fontSize: '2.8cqw', color: c.muted }}>{slide.body}</p>}
        </div>
      ) : slide.layout === 'bullets' ? (
        <div className="absolute inset-x-[6%] bottom-[8%] top-[16%] flex flex-col gap-[3cqw]">
          <h2 className="font-medium leading-tight [overflow-wrap:anywhere]" style={{ fontSize: '4.4cqw' }}>{slide.title}</h2>
          <ul className="flex flex-col gap-[1.6cqw]" style={{ fontSize: '2.7cqw' }}>
            {bulletLines(slide.body).slice(0, 7).map((line, i) => (
              <li key={i} className="flex gap-[1.6cqw]">
                <span aria-hidden className="mt-[1.1cqw] size-[1cqw] shrink-0 rounded-full" style={{ background: c.accent }} />
                <span className="[overflow-wrap:anywhere]">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : slide.layout === 'quote' ? (
        <figure className="absolute inset-[10%] flex flex-col justify-center gap-[2.4cqw]">
          <blockquote className="font-medium leading-snug [overflow-wrap:anywhere] [text-wrap:balance]" style={{ fontSize: '4.6cqw' }}>«{slide.body}»</blockquote>
          {slide.title && <figcaption style={{ fontSize: '2.4cqw', color: c.muted }}>{slide.title}</figcaption>}
        </figure>
      ) : (
        <div className="absolute inset-[9%] flex flex-col justify-center gap-[1.6cqw]">
          <p className="font-medium leading-none tabular-nums [overflow-wrap:anywhere]" style={{ fontSize: '14cqw', color: c.accent }}>{slide.title}</p>
          <p className="[text-wrap:balance]" style={{ fontSize: '3cqw' }}>{slide.body}</p>
        </div>
      )}
    </div>
  );
}

/** Pantalla completa: flechas, espacio o tocar a los lados para avanzar; Escape sale. */
function Presenter({ slides, theme, start, onExit }: { slides: Slide[]; theme: SlideTheme; start: number; onExit: (at: number) => void }) {
  const t = useText(OFFICE_COPY);
  const reduce = useMotionReduced();
  const [[index, dir], setPos] = useState<[number, number]>([start, 0]);
  const [notes, setNotes] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const go = useCallback((d: number) => setPos(([i]) => [Math.max(0, Math.min(slides.length - 1, i + d)), d]), [slides.length]);
  const indexRef = useRef(index);
  indexRef.current = index;
  const exitRef = useRef(onExit);
  exitRef.current = onExit;
  // En pantalla completa se sale de ella y su evento cierra la presentación; si no, se cierra ya.
  const exit = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => exitRef.current(indexRef.current));
    else exitRef.current(indexRef.current);
  }, []);

  useEffect(() => {
    root.current?.focus();
    // Pantalla completa de verdad si el navegador la permite (en el móvil basta con la capa).
    void root.current?.requestFullscreen?.().catch(() => undefined);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); go(1); }
      else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); go(-1); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); exit(); }
      else if (e.key.toLowerCase() === 'n') setNotes((v) => !v);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [go, exit]);
  // Salir de la pantalla completa (el navegador se queda con Escape) también cierra la presentación.
  useEffect(() => {
    let wasFull = false;
    const onChange = () => {
      if (document.fullscreenElement) { wasFull = true; return; }
      if (wasFull) exitRef.current(indexRef.current);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const slide = slides[index];
  const variants = reduce
    ? { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        enter: (d: number) => ({ opacity: 0, x: `${d * 18}%`, rotateY: d * -14, scale: 0.96 }),
        center: { opacity: 1, x: '0%', rotateY: 0, scale: 1 },
        exit: (d: number) => ({ opacity: 0, x: `${d * -18}%`, rotateY: d * 14, scale: 0.96 }),
      };

  return createPortal(
    <div
      ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t.present}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black outline-none"
    >
      <div className="relative flex w-full flex-1 items-center justify-center [perspective:1400px]">
        {/* Tocar la mitad derecha avanza; la izquierda, retrocede. */}
        <button type="button" aria-label={t.prev} onClick={() => go(-1)} className="absolute inset-y-0 left-0 z-10 w-1/3 cursor-w-resize" />
        <button type="button" aria-label={t.next} onClick={() => go(1)} className="absolute inset-y-0 right-0 z-10 w-2/3 cursor-e-resize" />
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={slide.id} custom={dir} variants={variants} initial="enter" animate="center" exit="exit"
            transition={{ type: 'spring', stiffness: 170, damping: 24, mass: 1 }}
            className="w-[min(100vw,calc(100dvh*16/9))] px-0"
          >
            <SlideView slide={slide} theme={theme} className="rounded-none sm:rounded-xl" />
          </motion.div>
        </AnimatePresence>
      </div>
      {notes && slide.notes && <p className="max-h-[25dvh] w-full max-w-3xl overflow-y-auto whitespace-pre-wrap px-6 py-3 text-body-md text-white/80">{slide.notes}</p>}
      <div className="z-20 flex w-full items-center justify-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 text-white/80">
        <Button variant="icon" aria-label={t.prev} disabled={index === 0} onClick={() => go(-1)} className="text-white hover:bg-white/10"><ChevronLeft aria-hidden className="size-6" /></Button>
        <span className="min-w-16 text-center font-mono text-label-lg tabular-nums" aria-live="polite">{t.slideOf(index + 1, slides.length)}</span>
        <Button variant="icon" aria-label={t.next} disabled={index === slides.length - 1} onClick={() => go(1)} className="text-white hover:bg-white/10"><ChevronRight aria-hidden className="size-6" /></Button>
        {slides.some((s) => s.notes) && <Button variant="icon" aria-label={t.notes} aria-pressed={notes} onClick={() => setNotes((v) => !v)} className="text-white hover:bg-white/10"><NotebookText aria-hidden className="size-5" /></Button>}
        <Button variant="icon" aria-label={t.exit} onClick={exit} className="text-white hover:bg-white/10"><X aria-hidden className="size-6" /></Button>
      </div>
    </div>,
    document.body,
  );
}

export function SlidesEditor({ content, onChange, copilotOpen, onCloseCopilot }: {
  title: string;
  content: SlidesContent;
  onChange: (content: SlidesContent) => void;
  copilotOpen: boolean;
  onCloseCopilot: () => void;
}) {
  const t = useText(OFFICE_COPY);
  const [deck, setDeck] = useState<SlidesContent>(content);
  const [current, setCurrent] = useState(0);
  const [presenting, setPresenting] = useState(false);
  const slide = deck.slides[Math.min(current, deck.slides.length - 1)];
  const index = deck.slides.indexOf(slide);

  const update = (next: SlidesContent) => { setDeck(next); onChange(next); };
  const patch = (changes: Partial<Slide>) => update({ ...deck, slides: deck.slides.map((s) => (s.id === slide.id ? { ...s, ...changes } : s)) });
  const add = () => {
    const slides = [...deck.slides];
    slides.splice(index + 1, 0, { id: newId(), layout: 'bullets', title: '', body: '' });
    update({ ...deck, slides });
    setCurrent(index + 1);
  };
  const remove = () => {
    if (deck.slides.length === 1) { patch({ title: '', body: '', notes: '' }); return; }
    update({ ...deck, slides: deck.slides.filter((s) => s.id !== slide.id) });
    setCurrent(Math.max(0, index - 1));
  };
  const shift = (d: number) => {
    const to = index + d;
    if (to < 0 || to >= deck.slides.length) return;
    const slides = [...deck.slides];
    [slides[index], slides[to]] = [slides[to], slides[index]];
    update({ ...deck, slides });
    setCurrent(to);
  };

  function applyCopilot(_: unknown, result: CopilotResult) {
    const made: Slide[] = (result.slides ?? []).map((s) => ({ ...s, id: newId() }));
    if (!made.length) return;
    // Una presentación recién creada (una diapositiva vacía) se reemplaza; si no, se añade al final.
    const blank = deck.slides.length === 1 && !deck.slides[0].title.trim() && !deck.slides[0].body.trim();
    const slides = blank ? made : [...deck.slides, ...made];
    update({ ...deck, slides });
    setCurrent(blank ? 0 : deck.slides.length);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      {/* Lista de diapositivas: columna en escritorio, tira horizontal en el móvil. */}
      <nav aria-label={t.slideList} className="flex shrink-0 gap-3 overflow-auto border-b border-border bg-background p-3 md:w-56 md:flex-col md:border-b-0 md:border-r">
        <ol className="flex gap-3 md:flex-col">
          {deck.slides.map((s, i) => (
            <li key={s.id} className="w-32 shrink-0 md:w-auto">
              <button
                type="button" aria-current={i === index ? 'true' : undefined} aria-label={`${t.slideN(i + 1)}: ${s.title || t.emptySlide}`} onClick={() => setCurrent(i)}
                className={cn('flex w-full flex-col gap-1 rounded-xl p-1 text-left transition-shadow focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-primary', i === index ? 'ring-2 ring-primary' : 'hover:ring-1 hover:ring-border-strong')}
              >
                <SlideView slide={s} theme={deck.theme} className="rounded-lg shadow-sm" />
                <span className="px-1 font-mono text-label-md text-on-surface-light">{i + 1}</span>
              </button>
            </li>
          ))}
        </ol>
        <Button variant="secondary" size="sm" className="shrink-0 self-center md:self-stretch" onClick={add}><Plus aria-hidden className="size-4" strokeWidth={2} />{t.addSlide}</Button>
      </nav>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-5">
          <div className="flex flex-wrap items-center gap-3">
            <ChipGroup label={t.theme} value={deck.theme} onChange={(theme) => update({ ...deck, theme })} options={(['jade', 'ink', 'paper'] as SlideTheme[]).map((value) => ({ value, label: t.themes[value] }))} />
            <Button className="ml-auto" onClick={() => setPresenting(true)}><Play aria-hidden className="size-4" strokeWidth={1.75} />{t.present}</Button>
          </div>
          <div className="[perspective:1600px]">
            <motion.div key={slide.id} initial={{ opacity: 0, rotateX: 6, y: 10 }} animate={{ opacity: 1, rotateX: 0, y: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 26 }}>
              <SlideView slide={slide} theme={deck.theme} className="shadow-lg" />
            </motion.div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-auto text-label-lg text-on-surface">{t.slideN(index + 1)}</span>
            <Button variant="icon" aria-label={t.moveUp} disabled={index === 0} onClick={() => shift(-1)}><ArrowUp aria-hidden className="size-5" strokeWidth={1.75} /></Button>
            <Button variant="icon" aria-label={t.moveDown} disabled={index === deck.slides.length - 1} onClick={() => shift(1)}><ArrowDown aria-hidden className="size-5" strokeWidth={1.75} /></Button>
            <Button variant="icon" aria-label={t.deleteSlide} className="hover:text-error-text" onClick={remove}><Trash2 aria-hidden className="size-5" strokeWidth={1.75} /></Button>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-label-lg text-on-surface">{t.layout}</span>
            <ChipGroup label={t.layout} value={slide.layout} onChange={(layout) => patch({ layout })} options={LAYOUTS.map((value) => ({ value, label: t.layouts[value] }))} />
          </div>
          <Field label={t.slideTitle[slide.layout]}>
            <Input value={slide.title} maxLength={160} onChange={(e) => patch({ title: e.target.value })} />
          </Field>
          <Field label={t.slideBody[slide.layout]}>
            <Textarea rows={slide.layout === 'bullets' ? 5 : 3} maxLength={2000} value={slide.body} onChange={(e) => patch({ body: e.target.value })} />
          </Field>
          <Field label={t.notes} help={t.notesHelp}>
            <Textarea rows={2} maxLength={2000} value={slide.notes ?? ''} onChange={(e) => patch({ notes: e.target.value })} />
          </Field>
        </div>
      </div>

      {copilotOpen && <Copilot actions={['slides']} context={() => ''} onApply={applyCopilot} onClose={onCloseCopilot} />}
      {presenting && <Presenter slides={deck.slides} theme={deck.theme} start={index} onExit={(at) => { setPresenting(false); setCurrent(at); }} />}
    </div>
  );
}
