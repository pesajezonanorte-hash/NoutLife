// Pantalla del Ciclo Menstrual: la rueda de fases de la app (hoy, día 14, en
// ovulación), lo que se anotó hoy y la predicción del próximo periodo. La rueda y
// los síntomas se levantan de la pantalla. Datos de ejemplo.
import type React from 'react';
import { CalendarHeart, Cookie, Flower2, Wind, Zap, type LucideIcon } from 'lucide-react';
import { COLORS, CYCLE, FONT, SPRING, ZONE, rgba } from '../theme';
import { clamp, springAt } from '../lib/anim';
import { CycleRing } from '../components/CycleRing';
import { CICLO } from '../timeline';
import { CardSlots, Kicker, ScreenBg, StatusBar, TabBar, ZoneBar, liftCurve, surface, type PopCard } from './kit';

const ACCENT = ZONE.ciclo.glow;
const LOGGED: Array<{ label: string; icon: LucideIcon; color: string; w: number }> = [
  { label: 'Energía alta', icon: Zap, color: CYCLE.follicular, w: 236 },
  { label: 'Hinchazón', icon: Wind, color: CYCLE.luteal, w: 214 },
  { label: 'Antojos', icon: Cookie, color: CYCLE.menstrual, w: 186 },
];

const RingCard: React.FC<{ local: number; frame: number }> = ({ local, frame }) => (
  <div style={{ position: 'absolute', inset: 0, ...surface(ACCENT, 1.2) }}>
    <div style={{ position: 'absolute', inset: 0, borderRadius: 30, background: `radial-gradient(55% 45% at 50% 50%, ${rgba(ACCENT, 0.12)}, transparent 75%)` }} />
    <div style={{ position: 'absolute', left: (522 - 470) / 2, top: 26 }}>
      <CycleRing local={local} frame={frame} size={470} />
    </div>
  </div>
);

const Chip: React.FC<{ item: (typeof LOGGED)[number]; p: number }> = ({ item, p }) => {
  const Icon = item.icon;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        borderRadius: 999,
        background: `linear-gradient(180deg, ${rgba(item.color, 0.2)}, ${rgba(item.color, 0.1)}), #101a15`,
        boxShadow: `inset 0 0 0 1.5px ${rgba(item.color, 0.55)}`,
        fontWeight: 600,
        fontSize: 23,
        color: COLORS.text,
        whiteSpace: 'nowrap',
        transform: `scale(${0.6 + 0.4 * p})`,
        opacity: clamp(p * 1.6),
      }}
    >
      <Icon size={24} color={item.color} strokeWidth={2.2} />
      {item.label}
    </div>
  );
};

/** `local` = fotogramas desde que entra la pantalla. */
export function cicloCards(frame: number, local: number): PopCard[] {
  let x = 20;
  const chips = LOGGED.map((item, i): PopCard => {
    const rect = { x: i < 2 ? x : 20, y: i < 2 ? 812 : 886, w: item.w, h: 60 };
    if (i < 2) x += item.w + 12;
    return {
      key: item.label,
      rect,
      lift: liftCurve(frame, CICLO.lift + 6 + i * 3, CICLO.drop),
      z: 200 + i * 30,
      shift: { x: -30 + i * 40, y: 30 + i * 12 },
      grow: 0.18,
      node: <Chip item={item} p={springAt(local, 18 + i * 4, SPRING.pop)} />,
    };
  });
  return [
    {
      key: 'ring',
      rect: { x: 20, y: 188, w: 522, h: 524 },
      lift: liftCurve(frame, CICLO.lift, CICLO.drop),
      z: 110,
      shift: { x: 0, y: -36 },
      grow: 0.05,
      node: <RingCard local={local - 2} frame={frame} />,
    },
    ...chips,
  ];
}

export const CicloScreen: React.FC<{ cards: PopCard[] }> = ({ cards }) => (
  <ScreenBg accent={ACCENT}>
    <StatusBar />
    <ZoneBar icon={Flower2} accent={ACCENT} title="Ciclo Menstrual" size={36} />
    <Kicker style={{ position: 'absolute', left: 24, top: 770 }}>HOY ANOTASTE</Kicker>
    <CardSlots cards={cards} />
    <div style={{ position: 'absolute', left: 20, right: 20, top: 966, height: 78, ...surface(ACCENT), display: 'flex', alignItems: 'center', gap: 14, padding: '0 22px' }}>
      <CalendarHeart size={30} color={ACCENT} strokeWidth={2} />
      <span style={{ fontWeight: 600, fontSize: 22 }}>Próximo periodo</span>
      <span style={{ marginLeft: 'auto', fontFamily: FONT.mono, fontWeight: 700, fontSize: 21, color: ACCENT }}>en 15 días</span>
    </div>
    <TabBar active="ciclo" accent={ACCENT} />
  </ScreenBg>
);
