// Nota de voz antigua en la carta (ya no se graban; solo se reproducen las que hay): botón de reproducir, la onda (dibujada con la forma
// que viaja en el mensaje, sin descargar el audio) que se va entintando al sonar,
// el tiempo y la velocidad (1×, 1,5×, 2×). El audio se pide al darle a reproducir.
import { useEffect, useRef, useState } from 'react';
import { Loader2, Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { loadMedia, cachedMedia } from '@/lib/media';
const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

const SPEEDS = [1, 1.5, 2];

export function VoiceNote({ side, id, mine, durationMs, peaks, localUrl }: {
  side: 'dm' | 'guild'; id: string; mine: boolean; durationMs: number; peaks: number[]; localUrl?: string;
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'paused' | 'error'>('idle');
  const [pos, setPos] = useState(0);
  const [speed, setSpeed] = useState(1);
  const total = durationMs || 1;
  const bars = peaks.length ? peaks : Array(36).fill(0.3);

  useEffect(() => () => { audio.current?.pause(); }, []);

  async function toggle() {
    if (state === 'playing') { audio.current?.pause(); return; }
    if (!audio.current) {
      setState('loading');
      try {
        const src = localUrl ?? cachedMedia(side, id)?.audioUrl ?? (await loadMedia(side, id)).audioUrl;
        if (!src) throw new Error('sin audio');
        const a = new Audio(src);
        a.playbackRate = speed;
        a.ontimeupdate = () => setPos(a.currentTime * 1000);
        a.onplay = () => setState('playing');
        a.onpause = () => setState('paused');
        a.onended = () => { setState('idle'); setPos(0); };
        audio.current = a;
      } catch { setState('error'); return; }
    }
    // Solo una nota a la vez en toda la app.
    document.dispatchEvent(new CustomEvent('lq:voice-play', { detail: id }));
    await audio.current.play().catch(() => setState('error'));
  }
  useEffect(() => {
    const other = (e: Event) => { if ((e as CustomEvent).detail !== id) audio.current?.pause(); };
    document.addEventListener('lq:voice-play', other);
    return () => document.removeEventListener('lq:voice-play', other);
  }, [id]);

  function cycleSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audio.current) audio.current.playbackRate = next;
  }
  function seek(fraction: number) {
    if (!audio.current) return;
    audio.current.currentTime = (fraction * total) / 1000;
    setPos(fraction * total);
  }

  const progress = Math.min(1, pos / total);
  const playing = state === 'playing';
  return (
    <div className="flex min-w-[220px] max-w-[300px] items-center gap-2.5">
      <button
        type="button" onClick={() => void toggle()} aria-label={playing ? 'Pausar la nota de voz' : 'Escuchar la nota de voz'}
        className={cn('flex size-11 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90', mine ? 'bg-forest-text text-surface' : 'bg-primary text-on-primary')}
      >
        {state === 'loading' ? <Loader2 aria-hidden className="size-5 animate-spin" /> : playing ? <Pause aria-hidden className="size-5" fill="currentColor" /> : <Play aria-hidden className="ml-0.5 size-5" fill="currentColor" />}
      </button>
      <div className="min-w-0 flex-1">
        <div
          role="slider" aria-label="Avance de la nota de voz" aria-valuemin={0} aria-valuemax={Math.round(total / 1000)} aria-valuenow={Math.round(pos / 1000)} tabIndex={0}
          onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek((e.clientX - r.left) / r.width); }}
          onKeyDown={(e) => { if (e.key === 'ArrowRight') seek(Math.min(1, progress + 0.1)); if (e.key === 'ArrowLeft') seek(Math.max(0, progress - 0.1)); }}
          className="flex h-8 cursor-pointer items-center gap-[2px]"
        >
          {bars.map((p, i) => (
            <span
              key={i} aria-hidden="true"
              className={cn('block w-[3px] flex-1 rounded-full transition-colors duration-150', i / bars.length < progress ? (mine ? 'bg-forest-text' : 'bg-primary') : 'bg-on-surface-light/35')}
              style={{ height: `${Math.max(14, p * 100)}%` }}
            />
          ))}
        </div>
        <div className="mt-0.5 flex items-center justify-between font-mono text-[0.72rem] text-on-surface-light">
          <span>{state === 'error' ? 'No se pudo cargar' : clock(pos > 0 ? pos : total)}</span>
          <button type="button" onClick={cycleSpeed} aria-label={`Velocidad ${speed}x`} className="rounded-full px-1.5 py-0.5 hover:bg-on-background/10">{speed}×</button>
        </div>
      </div>
    </div>
  );
}
