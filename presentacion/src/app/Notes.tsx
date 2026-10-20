// Ventana de notas del expositor (se abre con N desde la proyección). Muestra los
// puntos de discurso del paso en curso, un adelanto del siguiente y el tiempo de
// charla, y puede avanzar o retroceder la proyección. Pensada para la pantalla del
// portátil mientras el proyector muestra el deck.
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Timer } from 'lucide-react';
import { COLORS, FONT, rgba } from '../theme';
import { STEPS } from '../timeline';
import { openChannel, type DeckMessage } from './channel';

const btn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 48,
  padding: '0 18px',
  border: 0,
  borderRadius: 14,
  fontFamily: FONT.sans,
  fontSize: 16,
  fontWeight: 600,
  color: COLORS.text,
  background: COLORS.surfaceVariant,
  cursor: 'pointer',
};

export const Notes: React.FC = () => {
  const channel = useMemo(openChannel, []);
  const [step, setStep] = useState<number | null>(null);
  const [start] = useState(Date.now());
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    channel.onmessage = (e: MessageEvent<DeckMessage>) => {
      if (e.data.type === 'step') setStep(e.data.step);
    };
    channel.postMessage({ type: 'hello' } satisfies DeckMessage);
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(id);
      channel.close();
    };
  }, [channel]);

  const send = (cmd: 'next' | 'prev' | 'timer') => channel.postMessage({ type: 'cmd', cmd } satisfies DeckMessage);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', ' ', 'PageDown'].includes(e.key)) send('next');
      else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) send('prev');
      else if (e.key === 't' || e.key === 'T') send('timer');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const s = step === null ? null : STEPS[step];
  const next = step === null ? null : STEPS[step + 1];
  const mins = Math.floor((now - start) / 60000);
  const secs = Math.floor(((now - start) / 1000) % 60);

  return (
    <div style={{ height: '100%', overflowY: 'auto', boxSizing: 'border-box', padding: '28px 36px', fontFamily: FONT.sans, color: COLORS.text, background: COLORS.bg }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 15, color: COLORS.muted }}>Notas del expositor</div>
        <div style={{ marginLeft: 'auto', fontFamily: FONT.mono, fontSize: 22, fontWeight: 600, color: COLORS.jade }} title="Tiempo desde que abriste esta ventana">
          {mins}:{String(secs).padStart(2, '0')}
        </div>
      </header>
      {s === null ? (
        <p style={{ marginTop: 48, fontSize: 20, color: COLORS.muted }}>
          Esperando la proyección. Abre esta ventana desde la presentación con la tecla N.
        </p>
      ) : (
        <>
          <h1 style={{ margin: '24px 0 4px', fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em' }}>{s.title}</h1>
          <div style={{ fontSize: 16, color: COLORS.muted }}>
            Paso {s.step + 1} de {s.steps}
          </div>
          <ul style={{ margin: '28px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 18 }}>
            {s.notes.map((n) => (
              <li key={n} style={{ display: 'flex', gap: 14, fontSize: 24, lineHeight: 1.45 }}>
                <span style={{ flex: 'none', width: 8, height: 8, marginTop: 14, borderRadius: 4, background: COLORS.jade }} />
                {n}
              </li>
            ))}
          </ul>
          {next && (
            <div style={{ marginTop: 36, padding: '18px 22px', borderRadius: 16, background: rgba(COLORS.surface, 0.9), boxShadow: `inset 0 0 0 1px ${COLORS.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.muted }}>
                Después: {next.title}
                {next.slide === s.slide ? `, paso ${next.step + 1}` : ''}
              </div>
              <div style={{ marginTop: 6, fontSize: 18, color: COLORS.onSurface }}>{next.notes[0]}</div>
            </div>
          )}
        </>
      )}
      <nav aria-label="Controlar la proyección" style={{ display: 'flex', gap: 10, marginTop: 32 }}>
        <button type="button" style={btn} onClick={() => send('prev')}>
          <ChevronLeft size={20} />
          Anterior
        </button>
        <button type="button" style={{ ...btn, background: COLORS.jade, color: COLORS.bg }} onClick={() => send('next')}>
          Siguiente
          <ChevronRight size={20} />
        </button>
        <button type="button" style={{ ...btn, marginLeft: 'auto' }} onClick={() => send('timer')}>
          <Timer size={20} />
          Cronómetro 2 min
        </button>
      </nav>
    </div>
  );
};
