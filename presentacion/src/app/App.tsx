// Modo presentación: el Player avanza de parada en parada. Cada «siguiente» reproduce
// la animación del paso y se detiene sola al terminarla; si se pulsa otra vez
// mientras anima, salta al final del paso. Teclado (y control remoto de diapositivas,
// que envía las mismas teclas):
//   → ↓ Espacio Enter AvPág / clic: siguiente     ← ↑ RePág Retroceso: anterior
//   1–7: ir a una diapositiva     Inicio/Fin     F: pantalla completa
//   N: abrir las notas del expositor en otra ventana (llévala a la pantalla del portátil)
//   T: cronómetro de 2 minutos (para la actividad del aula)     P: reproducir/pausar libre
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { ChevronLeft, ChevronRight, Maximize, NotebookPen, Pause, Play, Timer } from 'lucide-react';
import { Presentacion } from '../Presentacion';
import { FPS, HEIGHT, WIDTH } from '../lib';
import { COLORS, FONT, rgba } from '../theme';
import { DURATION, SLIDES, SLIDE_STARTS, STOPS, slideAt, stepAt } from '../timeline';
import { openChannel, type DeckMessage } from './channel';

const TIMER_MS = 2 * 60 * 1000;
/** Última parada de cada diapositiva (para saltar con 1–7 o los puntos). */
const SLIDE_END = SLIDES.map((s, i) => SLIDE_STARTS[i] + s.stops[s.stops.length - 1]);

const openNotes = () => window.open('?notas', 'noutlife-notas', 'popup,width=980,height=760');
const toggleFullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());

const button: React.CSSProperties = {
  width: 48,
  height: 48,
  display: 'grid',
  placeItems: 'center',
  border: 0,
  borderRadius: 14,
  background: 'transparent',
  color: COLORS.text,
  cursor: 'pointer',
};

export const App: React.FC = () => {
  const player = useRef<PlayerRef>(null);
  /** Parada en la que debe detenerse la reproducción en curso. */
  const target = useRef<number | null>(null);
  const channel = useMemo(openChannel, []);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [idle, setIdle] = useState(false);
  const [timerEnd, setTimerEnd] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const jump = useCallback((to: number) => {
    const p = player.current;
    if (!p) return;
    target.current = null;
    p.pause();
    p.seekTo(to);
  }, []);

  const next = useCallback(() => {
    const p = player.current;
    if (!p) return;
    if (p.isPlaying() && target.current !== null) return jump(target.current);
    const stop = STOPS.find((s) => s > p.getCurrentFrame());
    if (stop === undefined) return;
    target.current = stop;
    p.play();
  }, [jump]);

  const prev = useCallback(() => {
    const p = player.current;
    if (!p) return;
    const f = p.getCurrentFrame();
    jump([...STOPS].reverse().find((s) => s < f) ?? 0);
  }, [jump]);

  const toggleTimer = useCallback(() => setTimerEnd((t) => (t ? null : Date.now() + TIMER_MS)), []);

  // Detenerse en la parada
  useEffect(() => {
    const p = player.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => {
      setFrame(e.detail.frame);
      if (target.current !== null && e.detail.frame >= target.current) jump(target.current);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    p.addEventListener('frameupdate', onFrame);
    p.addEventListener('seeked', onFrame);
    p.addEventListener('play', onPlay);
    p.addEventListener('pause', onPause);
    return () => {
      p.removeEventListener('frameupdate', onFrame);
      p.removeEventListener('seeked', onFrame);
      p.removeEventListener('play', onPlay);
      p.removeEventListener('pause', onPause);
    };
  }, [jump]);

  // Ventana de notas: se le anuncia el paso; ella puede avanzar, retroceder y cronometrar
  const step = stepAt(frame);
  useEffect(() => {
    channel.postMessage({ type: 'step', step } satisfies DeckMessage);
  }, [channel, step]);
  useEffect(() => {
    channel.onmessage = (e: MessageEvent<DeckMessage>) => {
      const m = e.data;
      if (m.type === 'hello') channel.postMessage({ type: 'step', step } satisfies DeckMessage);
      else if (m.type === 'cmd') ({ next, prev, timer: toggleTimer })[m.cmd]();
    };
  }, [channel, step, next, prev, toggleTimer]);
  useEffect(() => () => channel.close(), [channel]);

  // Teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (['ArrowRight', 'ArrowDown', ' ', 'Enter', 'PageDown'].includes(k)) next();
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) prev();
      else if (k === 'Home') jump(0);
      else if (k === 'End') jump(STOPS[STOPS.length - 1]);
      else if (k >= '1' && k <= String(SLIDES.length)) jump(SLIDE_END[Number(k) - 1]);
      else if (k === 'f' || k === 'F') toggleFullscreen();
      else if (k === 'n' || k === 'N') openNotes();
      else if (k === 't' || k === 'T') toggleTimer();
      else if (k === 'p' || k === 'P') {
        target.current = null;
        player.current?.toggle();
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, jump, toggleTimer]);

  // Barra de controles y cursor: se esconden tras 2,5 s sin mover el ratón
  useEffect(() => {
    let t = window.setTimeout(() => setIdle(true), 2500);
    const wake = () => {
      setIdle(false);
      window.clearTimeout(t);
      t = window.setTimeout(() => setIdle(true), 2500);
    };
    window.addEventListener('mousemove', wake);
    return () => {
      window.removeEventListener('mousemove', wake);
      window.clearTimeout(t);
    };
  }, []);

  // Reloj del cronómetro
  useEffect(() => {
    if (!timerEnd) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [timerEnd]);

  const current = slideAt(frame);
  const left = timerEnd ? Math.max(0, timerEnd - now) : 0;
  const secs = Math.ceil(left / 1000);

  return (
    <div style={{ position: 'fixed', inset: 0, background: COLORS.bgDeep, cursor: idle ? 'none' : 'default', fontFamily: FONT.sans }}>
      <div onClick={next} style={{ position: 'absolute', inset: 0 }}>
        <Player
          ref={player}
          component={Presentacion}
          durationInFrames={DURATION}
          fps={FPS}
          compositionWidth={WIDTH}
          compositionHeight={HEIGHT}
          style={{ width: '100%', height: '100%' }}
          controls={false}
          clickToPlay={false}
          doubleClickToFullscreen={false}
          spaceKeyToPlayOrPause={false}
          moveToBeginningWhenEnded={false}
          acknowledgeRemotionLicense
        />
      </div>

      {frame === 0 && !playing && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: '12%', textAlign: 'center', color: COLORS.muted, fontSize: 18, pointerEvents: 'none' }}>
          Pulsa → o haz clic para empezar. F: pantalla completa. N: notas del expositor.
        </div>
      )}

      {timerEnd && (
        <div
          role="timer"
          aria-live="off"
          style={{
            position: 'absolute',
            top: 24,
            right: 24,
            padding: '10px 18px',
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontFamily: FONT.mono,
            fontSize: 30,
            fontWeight: 700,
            color: secs === 0 ? COLORS.bg : COLORS.jade,
            background: secs === 0 ? COLORS.jade : rgba(COLORS.surface, 0.8),
            boxShadow: `inset 0 0 0 1px ${COLORS.border}`,
            backdropFilter: 'blur(16px)',
          }}
        >
          <Timer size={26} strokeWidth={1.75} />
          {secs === 0 ? '¡Tiempo!' : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}
        </div>
      )}

      <nav
        aria-label="Controles de la presentación"
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 20,
          transform: `translateX(-50%) translateY(${idle ? 90 : 0}px)`,
          transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms',
          opacity: idle ? 0 : 1,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: 6,
          borderRadius: 20,
          background: rgba(COLORS.surface, 0.8),
          boxShadow: `inset 0 0 0 1px ${COLORS.border}`,
          backdropFilter: 'blur(20px)',
          color: COLORS.text,
        }}
      >
        <button type="button" aria-label="Anterior" title="Anterior (←)" style={button} onClick={prev}>
          <ChevronLeft size={26} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          aria-label={playing ? 'Pausar' : 'Reproducir'}
          title="Reproducir o pausar (P)"
          style={button}
          onClick={() => {
            target.current = null;
            player.current?.toggle();
          }}
        >
          {playing ? <Pause size={22} strokeWidth={1.75} /> : <Play size={22} strokeWidth={1.75} />}
        </button>
        <button type="button" aria-label="Siguiente" title="Siguiente (→)" style={button} onClick={next}>
          <ChevronRight size={26} strokeWidth={1.75} />
        </button>
        <span style={{ display: 'flex', gap: 4, padding: '0 10px' }}>
          {SLIDES.map((s, i) => (
            <button
              key={s.title}
              type="button"
              aria-label={`Ir a ${s.title}`}
              title={`${i + 1}. ${s.title}`}
              onClick={() => jump(SLIDE_END[i])}
              style={{ ...button, width: 30, height: 44, borderRadius: 8 }}
            >
              <span style={{ width: 22, height: 4, borderRadius: 2, background: i <= current ? COLORS.jade : rgba(COLORS.text, 0.2) }} />
            </button>
          ))}
        </span>
        <button type="button" aria-label="Notas del expositor" title="Notas del expositor (N)" style={button} onClick={openNotes}>
          <NotebookPen size={21} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          aria-label="Cronómetro de 2 minutos"
          title="Cronómetro de 2 minutos (T)"
          style={{ ...button, color: timerEnd ? COLORS.jade : COLORS.text }}
          onClick={toggleTimer}
        >
          <Timer size={22} strokeWidth={1.75} />
        </button>
        <button type="button" aria-label="Pantalla completa" title="Pantalla completa (F)" style={button} onClick={toggleFullscreen}>
          <Maximize size={20} strokeWidth={1.75} />
        </button>
      </nav>
    </div>
  );
};
