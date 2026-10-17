// Pantalla de Hábitos (la libreta): renglones de papel, checks de tinta que se
// trazan en corcheas con «+10 XP» que salta fuera del teléfono, rachas y el ritual
// de mañana, que se completa y se levanta. Como en la app, el check es un círculo
// hecho a mano. Datos de ejemplo.
import type React from 'react';
import { CheckCircle2, Flame, Sun } from 'lucide-react';
import { COLORS, FONT, SPRING, ZONE, rgba } from '../theme';
import { EASE, clamp, ramp, springAt } from '../lib/anim';
import { HABITOS } from '../timeline';
import { CardSlots, ScreenBg, StatusBar, TabBar, ZoneBar, liftCurve, surface, type PopCard } from './kit';

const ACCENT = ZONE.habitos.glow;
const HABITS = [
  { name: 'Meditar 10 min', streak: 12 },
  { name: 'Leer 20 páginas', streak: 8 },
  { name: 'Beber 2 L de agua', streak: 21 },
  { name: 'Entrenar', streak: 5 },
];
const PAPER = { x: 20, y: 188, w: 522, h: 516 };
const ROW_TOP = 34;
const ROW_H = 118;

/** Círculo «a mano»: un radio que ondula un poco y no cierra perfecto. */
const SKETCH_CIRCLE = (() => {
  let d = '';
  for (let k = 0; k <= 64; k++) {
    const a = (k / 64) * Math.PI * 2.06 - 1.9;
    const r = 25 + Math.sin(a * 3 + 0.6) * 1.1 + Math.sin(a * 5) * 0.6;
    d += `${k === 0 ? 'M' : 'L'}${(30 + r * Math.cos(a)).toFixed(2)} ${(30 + r * Math.sin(a)).toFixed(2)}`;
  }
  return d;
})();

const InkCheck: React.FC<{ frame: number; at: number }> = ({ frame, at }) => {
  const press = ramp(frame, at - 3, at, EASE.out);
  const back = springAt(frame, at, SPRING.pop);
  const ink = ramp(frame, at, at + 7, EASE.out);
  const on = frame >= at;
  return (
    <svg width={60} height={60} viewBox="0 0 60 60" style={{ overflow: 'visible', transform: `scale(${1 - 0.14 * press + 0.14 * back})`, flexShrink: 0 }}>
      <path d={SKETCH_CIRCLE} fill={on ? rgba(ACCENT, 0.16 * ink) : 'none'} stroke={on ? ACCENT : rgba(COLORS.text, 0.38)} strokeWidth={3} strokeLinecap="round" />
      <path
        d="M17 31 L26.5 40.5 L44 20"
        fill="none"
        stroke={ZONE.habitos.from}
        strokeWidth={5.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={`${ink} 1`}
        opacity={ink > 0.01 ? 1 : 0}
        style={{ filter: `drop-shadow(0 0 7px ${rgba(ACCENT, 0.8)})` }}
      />
    </svg>
  );
};

/** La hoja de libreta con los cuatro hábitos. */
const Paper: React.FC<{ frame: number; local: number }> = ({ frame, local }) => (
  <div style={{ position: 'absolute', left: PAPER.x, top: PAPER.y, width: PAPER.w, height: PAPER.h, ...surface(ACCENT), overflow: 'hidden' }}>
    {HABITS.map((_, i) => (
      <div key={i} style={{ position: 'absolute', left: 22, right: 22, top: ROW_TOP + (i + 1) * ROW_H - 12, height: 1.5, background: rgba(ACCENT, 0.13) }} />
    ))}
    <div style={{ position: 'absolute', left: 104, top: 0, bottom: 0, width: 1.5, background: rgba(COLORS.error, 0.25) }} />
    {HABITS.map((h, i) => {
      const at = HABITOS.checks[i];
      const p = springAt(local, 2 + i * 2, SPRING.smooth, 12);
      const done = frame >= at;
      return (
        <div
          key={h.name}
          style={{
            position: 'absolute',
            left: 24,
            right: 22,
            top: ROW_TOP + i * ROW_H,
            height: ROW_H - 20,
            display: 'flex',
            alignItems: 'center',
            gap: 40,
            opacity: p,
            transform: `translateX(${(1 - p) * 24}px)`,
          }}
        >
          <InkCheck frame={frame} at={at} />
          <span style={{ fontWeight: 600, fontSize: 27, color: done ? COLORS.text : COLORS.textSoft }}>{h.name}</span>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontFamily: FONT.mono, fontWeight: 700, fontSize: 24, color: COLORS.gold }}>
            <Flame size={24} color={COLORS.gold} strokeWidth={2.2} />
            {h.streak + (done ? 1 : 0)}
          </span>
        </div>
      );
    })}
  </div>
);

const RitualCard: React.FC<{ frame: number }> = ({ frame }) => {
  const steps = [0, 1, 2, 3].map((i) => HABITOS.checks[0] + 4 + i * 7);
  const ring = steps.reduce((sum, s) => sum + springAt(frame, s, SPRING.pop), 0) / steps.length;
  const count = steps.filter((s) => frame >= s).length;
  const done = springAt(frame, HABITOS.ritual, SPRING.pop);
  const C = 2 * Math.PI * 50;
  return (
    <div style={{ position: 'absolute', inset: 0, ...surface(COLORS.warning, 1.2), display: 'flex', alignItems: 'center', gap: 26, padding: '0 26px' }}>
      <div style={{ position: 'relative', width: 124, height: 124, flexShrink: 0 }}>
        <svg width={124} height={124} viewBox="0 0 124 124">
          <circle cx={62} cy={62} r={50} fill="none" stroke={rgba(COLORS.text, 0.08)} strokeWidth={11} />
          <circle
            cx={62}
            cy={62}
            r={50}
            fill="none"
            stroke={COLORS.warning}
            strokeWidth={11}
            strokeLinecap="round"
            strokeDasharray={`${C * clamp(ring, 0, 1)} ${C}`}
            transform="rotate(-90 62 62)"
            style={{ filter: `drop-shadow(0 0 8px ${rgba(COLORS.warning, 0.7)})` }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.mono, fontWeight: 700, fontSize: 30 }}>
          {count}/4
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sun size={30} color={COLORS.warning} strokeWidth={2.2} />
          <span style={{ fontWeight: 800, fontSize: 29 }}>Ritual de mañana</span>
        </div>
        <span style={{ fontWeight: 500, fontSize: 20, color: COLORS.textMuted }}>Agua · Estirar · Diario · Plan</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, opacity: clamp(done * 1.5), transform: `scale(${0.7 + 0.3 * done})`, transformOrigin: 'left center' }}>
          <span
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              background: rgba(ACCENT, 0.15),
              boxShadow: `inset 0 0 0 1.5px ${rgba(ACCENT, 0.5)}`,
              fontWeight: 700,
              fontSize: 19,
              color: ZONE.habitos.from,
            }}
          >
            Completado
          </span>
          <span style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 21, color: COLORS.gold }}>+40 XP</span>
        </div>
      </div>
    </div>
  );
};

/** «+10 XP»: salta del check hacia la cámara y se apaga. */
const XpChip: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      background: `linear-gradient(180deg, ${rgba(COLORS.gold, 0.3)}, ${rgba(COLORS.gold, 0.14)}), #14130d`,
      boxShadow: `inset 0 0 0 1.5px ${rgba(COLORS.goldLight, 0.7)}`,
      fontFamily: FONT.mono,
      fontWeight: 700,
      fontSize: 24,
      color: COLORS.goldLight,
    }}
  >
    +10 XP
  </div>
);

export function habitosCards(frame: number): PopCard[] {
  const xp = HABITOS.checks.map((at, i): PopCard => {
    const t = ramp(frame, at, at + 22, EASE.out);
    const live = frame >= at && t < 1;
    return {
      key: `xp${i}`,
      rect: { x: PAPER.x + 330, y: PAPER.y + ROW_TOP + i * ROW_H + 20, w: 128, h: 50 },
      lift: live ? Math.max(0.003, t) : 0,
      z: 340,
      shift: { x: 120, y: -90 },
      grow: 0.25,
      float: true,
      node: (
        <div style={{ position: 'absolute', inset: 0, opacity: clamp(t * 6) * (1 - ramp(frame, at + 12, at + 22)) }}>
          <XpChip />
        </div>
      ),
    };
  });
  return [
    {
      key: 'ritual',
      rect: { x: 20, y: 726, w: 522, h: 236 },
      // Se queda arriba hasta que la luz de El Sabio lo desvanece (DeviceScene)
      lift: liftCurve(frame, HABITOS.ritual - 2, 500),
      z: 150,
      shift: { x: 0, y: -24 },
      grow: 0.08,
      node: <RitualCard frame={frame} />,
    },
    ...xp,
  ];
}

export const HabitosScreen: React.FC<{ frame: number; local: number; cards: PopCard[] }> = ({ frame, local, cards }) => (
  <ScreenBg accent={ACCENT}>
    <StatusBar />
    <ZoneBar icon={CheckCircle2} accent={ACCENT} title="Hábitos" kicker="LIBRETA" />
    <Paper frame={frame} local={local} />
    <CardSlots cards={cards} />
    <TabBar active="habitos" accent={ACCENT} />
  </ScreenBg>
);
