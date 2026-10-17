// Pantalla de El Sabio: el consejero con IA a pantalla completa, como en el móvil.
// Arriba, sus atajos reales (SagePanel.tsx); una pregunta y la respuesta, que se
// escribe sola y se levanta de la pantalla para leerse grande. El consejo cruza el
// sueño y el Coliseo, como hace el Sabio de la app («conéctalas cuando ayude: sueño
// y entreno…»). La conversación es de ejemplo.
import type React from 'react';
import { BarChart2, Dumbbell, Send, Sparkles, Sword, Wallet, type LucideIcon } from 'lucide-react';
import { COLORS, FONT, SPRING, ZONE, rgba } from '../theme';
import { clamp, springAt, typed } from '../lib/anim';
import { IconChip } from '../components/ui';
import { SABIO } from '../timeline';
import { CardSlots, ScreenBg, StatusBar, ZoneBar, fadeUp, liftCurve, type PopCard } from './kit';

const ACCENT = ZONE.sabio.glow;
export const ADVICE = 'Dormiste 6 h y llevas dos días de pecho. Hoy, pierna suave y a la cama antes de las 23:00.';
/** Caracteres por fotograma: la respuesta llega como un flujo, igual que en la app. */
const CPS = 4;
const ACTIONS: Array<{ label: string; icon: LucideIcon }> = [
  { label: 'Ideas de misiones', icon: Sword },
  { label: 'Analiza mis hábitos', icon: BarChart2 },
  { label: 'Revisa mis finanzas', icon: Wallet },
  { label: 'Plan de entrenamiento', icon: Dumbbell },
];

const Reply: React.FC<{ frame: number }> = ({ frame }) => {
  const text = typed(ADVICE, frame, SABIO.reply, CPS);
  const done = text.length === ADVICE.length;
  const thinking = frame < SABIO.reply;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 34,
        padding: '24px 28px',
        background: `linear-gradient(160deg, ${rgba(ZONE.sabio.from, 0.2)} 0%, ${rgba(ACCENT, 0.13)} 45%, transparent 100%), #0e0c22`,
        boxShadow: `inset 0 0 0 1.5px ${rgba(ZONE.sabio.from, 0.45)}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <IconChip icon={Sparkles} color={ZONE.sabio.from} size={44} radius={22} />
        <span style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 18, letterSpacing: '0.16em', color: ZONE.sabio.from }}>EL SABIO</span>
        <span style={{ marginLeft: 'auto', fontFamily: FONT.mono, fontSize: 17, color: COLORS.textMuted }}>ahora</span>
      </div>
      {thinking ? (
        <div style={{ marginTop: 26, display: 'flex', gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: 13,
                height: 13,
                borderRadius: '50%',
                background: ZONE.sabio.from,
                opacity: 0.35 + 0.65 * Math.max(0, Math.sin((frame - i * 4) / 3.2)),
              }}
            />
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 16, fontFamily: FONT.serif, fontStyle: 'italic', fontWeight: 500, fontSize: 35, lineHeight: 1.22, color: COLORS.text }}>
          «{text}
          {done ? '»' : ''}
          <span
            style={{
              display: 'inline-block',
              width: 3,
              height: 34,
              marginLeft: 4,
              verticalAlign: '-5px',
              background: ZONE.sabio.from,
              opacity: !done || Math.floor(frame / 8) % 2 === 0 ? 1 : 0,
            }}
          />
        </div>
      )}
    </div>
  );
};

export function sabioCards(frame: number): PopCard[] {
  const appear = springAt(frame, SABIO.ask + 6, SPRING.pop);
  return [
    {
      key: 'reply',
      rect: { x: 20, y: 468, w: 522, h: 330 },
      lift: liftCurve(frame, SABIO.lift, SABIO.drop),
      z: 230,
      shift: { x: 0, y: 70 },
      grow: 0.28,
      node: (
        <div style={{ position: 'absolute', inset: 0, opacity: clamp(appear * 1.5), transform: `scale(${0.85 + 0.15 * appear})`, transformOrigin: 'left top' }}>
          <Reply frame={frame} />
        </div>
      ),
    },
  ];
}

export const SabioScreen: React.FC<{ frame: number; local: number; cards: PopCard[] }> = ({ frame, local, cards }) => (
  <ScreenBg accent={ACCENT}>
    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(90% 50% at 50% 100%, ${rgba(ZONE.sabio.to, 0.18)}, transparent 70%)` }} />
    <StatusBar />
    <ZoneBar icon={Sparkles} accent={ZONE.sabio.from} title="El Sabio" kicker="CONSEJERO CON IA" pro />
    <div style={{ position: 'absolute', left: 20, right: 20, top: 194, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {ACTIONS.map(({ label, icon: Icon }, i) => (
        <div
          key={label}
          style={{
            ...fadeUp(local, 4 + i * 2, 16),
            height: 66,
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 14px',
            background: rgba(ZONE.sabio.from, 0.08),
            boxShadow: `inset 0 0 0 1.5px ${rgba(ZONE.sabio.from, 0.22)}`,
            fontWeight: 600,
            fontSize: 18,
            whiteSpace: 'nowrap',
          }}
        >
          <Icon size={22} color={ZONE.sabio.from} strokeWidth={2.2} />
          {label}
        </div>
      ))}
    </div>
    {/* La pregunta */}
    <div
      style={{
        ...fadeUp(frame, SABIO.ask, 18),
        position: 'absolute',
        right: 20,
        top: 372,
        padding: '18px 24px',
        borderRadius: '28px 28px 8px 28px',
        background: rgba(COLORS.text, 0.1),
        boxShadow: `inset 0 0 0 1.5px ${rgba(COLORS.text, 0.12)}`,
        fontWeight: 600,
        fontSize: 26,
      }}
    >
      ¿Qué entreno hoy?
    </div>
    <CardSlots cards={cards} />
    {/* Campo para escribir */}
    <div
      style={{
        position: 'absolute',
        left: 20,
        right: 20,
        bottom: 46,
        height: 76,
        borderRadius: 38,
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px 0 28px',
        background: rgba('#121a2a', 0.9),
        boxShadow: `inset 0 0 0 1.5px ${rgba(ZONE.sabio.from, 0.25)}`,
        fontSize: 21,
        color: COLORS.textMuted,
      }}
    >
      Pregúntale al Sabio…
      <span
        style={{
          marginLeft: 'auto',
          width: 56,
          height: 56,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(140deg, ${ZONE.sabio.from}, ${ZONE.sabio.to})`,
        }}
      >
        <Send size={26} color="#0d0b22" strokeWidth={2.4} />
      </span>
    </div>
  </ScreenBg>
);
