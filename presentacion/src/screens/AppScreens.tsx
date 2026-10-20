// Pantallas de NoutLife para el teléfono (390 × 844, modo oscuro), con las piezas
// de la PWA: saludo escrito con la letra de la marca, tarjeta de nivel, StatCards
// 2 × 2 (como el Inicio), títulos de zona en letra de marca y la TabBar real
// (Inicio, Hábitos, Misiones, Coliseo, Perfil: el orden por defecto de navStore).
// Datos de ejemplo. Cada pantalla recibe `t`: fotogramas desde que está a la vista.
import type React from 'react';
import {
  BatteryFull,
  Bell,
  CheckCircle2,
  ChevronLeft,
  Flag,
  Flame,
  Home,

  Signal,
  Swords,
  User,
  Wallet,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import { NoutLifeMark, Wordmark } from '../components/Brand';
import { Lettering } from '../components/Lettering';
import { COLORS as C, FONT, rgba } from '../theme';
import { EASE, SPRING, clamp, ramp, rise, springAt } from '../lib';

const Screen: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      fontFamily: FONT.sans,
      color: C.text,
      background: `radial-gradient(110% 36% at 20% 0%, ${rgba(C.jade, 0.08)}, transparent 70%), ${C.bg}`,
    }}
  >
    <div style={{ position: 'absolute', top: 18, left: 44, right: 32, display: 'flex', alignItems: 'center' }}>
      <span style={{ fontWeight: 700, fontSize: 16 }}>9:41</span>
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        <Signal size={15} strokeWidth={2.6} />
        <Wifi size={15} strokeWidth={2.6} />
        <BatteryFull size={19} strokeWidth={2} />
      </span>
    </div>
    {children}
  </div>
);

const TABS: Array<[string, LucideIcon]> = [
  ['Inicio', Home],
  ['Hábitos', CheckCircle2],
  ['Misiones', Flag],
  ['Coliseo', Swords],
  ['Perfil', User],
];

/** TabBar de la app: vidrio, 5 destinos, pastilla suave detrás del activo. */
const TabBar: React.FC<{ active: string }> = ({ active }) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 86,
      paddingBottom: 20,
      boxSizing: 'border-box',
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      alignItems: 'center',
      background: rgba(C.bg, 0.86),
      borderTop: `1px solid ${C.border}`,
    }}
  >
    {TABS.map(([label, Icon]) => {
      const on = label === active;
      return (
        <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: on ? C.jade300 : C.muted }}>
          <span style={{ width: 52, height: 30, borderRadius: 15, display: 'grid', placeItems: 'center', background: on ? rgba(C.jade, 0.16) : 'transparent' }}>
            <Icon size={22} strokeWidth={1.75} />
          </span>
          <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
        </div>
      );
    })}
  </div>
);

/** Cabecera de zona: volver y el título con la letra de la marca, que se escribe. */
const ZoneHeader: React.FC<{ title: string; t: number }> = ({ title, t }) => (
  <div style={{ position: 'absolute', top: 60, left: 12, right: 20, display: 'flex', alignItems: 'center', gap: 6, color: C.text }}>
    <ChevronLeft size={26} color={C.muted} strokeWidth={1.75} />
    <Lettering text={title} at={4} frame={t} style={{ fontSize: 34 }} />
  </div>
);

const Card: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({ style, children }) => (
  <div style={{ borderRadius: 16, background: C.surface, boxShadow: `inset 0 0 0 1px ${C.border}`, ...style }}>{children}</div>
);

const STATS: Array<{ icon: LucideIcon; color: string; value: string; label: string }> = [
  { icon: CheckCircle2, color: C.success, value: '3/4', label: 'Hábitos hoy' },
  { icon: Flag, color: C.jade, value: '2', label: 'Misiones activas' },
  { icon: Wallet, color: C.info, value: '$120 mil', label: 'Saldo del mes' },
  { icon: Flame, color: C.warning, value: '12', label: 'Días de racha' },
];

/** Lo que se ve de Inicio; `wire` 0→1 lo muestra como plano (diseño y estructura). */
export const HomeScreen: React.FC<{ t: number; wire?: number }> = ({ t, wire = 0 }) => {
  const content = (
    <>
      <div style={{ ...rise(t, 4, 14), position: 'absolute', top: 56, left: 20, right: 20, display: 'flex', alignItems: 'center', gap: 9 }}>
        <NoutLifeMark height={26} />
        <Wordmark height={18} />
        <Bell size={21} color={C.muted} strokeWidth={1.75} style={{ marginLeft: 'auto' }} />
      </div>
      <div style={{ position: 'absolute', top: 100, left: 20, right: 20 }}>
        <div style={{ fontSize: 30, color: C.text }}>
          <Lettering text="Buenas tardes, Miguel" at={10} frame={t} />
        </div>
        <div style={{ ...rise(t, 40, 10), marginTop: 6, fontSize: 14, color: C.onSurface }}>Un paso a la vez también cuenta.</div>
      </div>
      <Card style={{ ...rise(t, 30, 18), position: 'absolute', top: 214, left: 16, right: 16, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, display: 'grid', placeItems: 'center', background: rgba(C.gold, 0.16), color: C.gold, fontFamily: FONT.mono, fontWeight: 700, fontSize: 18 }}>
            12
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Nivel 12</div>
            <div style={{ fontSize: 12.5, color: C.muted }}>Constante</div>
          </div>
          <div style={{ marginLeft: 'auto', fontFamily: FONT.mono, fontSize: 12.5, fontWeight: 600, color: C.gold }}>840/1000 XP</div>
        </div>
        <div style={{ marginTop: 12, height: 6, borderRadius: 3, background: rgba(C.text, 0.08) }}>
          <div style={{ width: `${84 * ramp(t, 40, 80, EASE.out)}%`, height: '100%', borderRadius: 3, background: C.gold }} />
        </div>
      </Card>
      {STATS.map((s, i) => {
        const p = springAt(t, 40 + i * 5, SPRING.pop);
        const Icon = s.icon;
        return (
          <Card
            key={s.label}
            style={{
              position: 'absolute',
              left: i % 2 ? 201 : 16,
              top: 330 + Math.floor(i / 2) * 124,
              width: 173,
              height: 112,
              padding: 12,
              boxSizing: 'border-box',
              opacity: clamp(p * 1.6),
              transform: `scale(${0.85 + 0.15 * p})`,
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', background: rgba(s.color, 0.16), color: s.color }}>
              <Icon size={19} strokeWidth={1.75} />
            </div>
            <div style={{ marginTop: 10, fontFamily: FONT.mono, fontWeight: 700, fontSize: 20 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{s.label}</div>
          </Card>
        );
      })}
      <div style={{ ...rise(t, 64, 14), position: 'absolute', top: 590, left: 20, fontSize: 17, fontWeight: 700 }}>Pendiente hoy</div>
      {['Leer 20 minutos', 'Dormir antes de las 11'].map((h, i) => (
        <Card key={h} style={{ ...rise(t, 70 + i * 6, 14), position: 'absolute', top: 624 + i * 62, left: 16, right: 16, height: 52, display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px' }}>
          <span style={{ width: 22, height: 22, borderRadius: 11, boxShadow: `inset 0 0 0 2px ${C.borderStrong}` }} />
          <span style={{ fontSize: 14.5, fontWeight: 600 }}>{h}</span>
          <span style={{ marginLeft: 'auto', fontFamily: FONT.mono, fontSize: 12, color: C.gold }}>+10 XP</span>
        </Card>
      ))}
    </>
  );
  return (
    <Screen>
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - 0.75 * wire }}>{content}</div>
      {wire > 0 && <Wireframe p={wire} />}
      <TabBar active="Inicio" />
    </Screen>
  );
};

/** Plano de la pantalla: cada bloque, recuadrado y con el nombre de su componente. */
const BLOCKS: Array<[string, number, number, number, number]> = [
  ['<Saludo />', 16, 96, 358, 106],
  ['<TarjetaNivel />', 16, 214, 358, 104],
  ['<StatCard />', 16, 330, 173, 112],
  ['<StatCard />', 201, 330, 173, 112],
  ['<StatCard />', 16, 454, 173, 112],
  ['<StatCard />', 201, 454, 173, 112],
  ['<ListaHábitos />', 16, 586, 358, 152],
];

const Wireframe: React.FC<{ p: number }> = ({ p }) => (
  <svg width={390} height={844} style={{ position: 'absolute', inset: 0 }}>
    {BLOCKS.map(([label, x, y, w, h], i) => {
      const d = clamp(p * 1.6 - i * 0.08);
      return (
        <g key={i} opacity={clamp(d * 3)}>
          <rect x={x} y={y} width={w} height={h} rx={14} fill={rgba(C.jade, 0.05)} stroke={C.jade} strokeWidth={1.5} strokeDasharray="6 5" pathLength={1000} strokeDashoffset={1000 * (1 - d)} />
          {/* Etiqueta sobre el borde superior, con fondo para no chocar con el contenido */}
          <rect x={x + 10} y={y - 9} width={label.length * 7.6 + 12} height={18} rx={5} fill={C.bg} stroke={C.jade} strokeWidth={1} />
          <text x={x + 16} y={y + 4} fill={C.jade300} fontFamily={FONT.mono} fontSize={12.5} fontWeight={600}>
            {label}
          </text>
        </g>
      );
    })}
  </svg>
);

/** Libreta: una hoja con apuntes, una tarea que se tacha y un subrayado a mano. */
export const LibretaScreen: React.FC<{ t: number }> = ({ t }) => {
  const lines = ['Química: estequiometría', 'Taller pág. 54 (jueves)', 'Repasar mol y masa molar', 'Exposición de grado: viernes'];
  const strike = ramp(t, 70, 90, EASE.out);
  return (
    <Screen>
      <ZoneHeader title="libreta" t={t} />
      <div
        style={{
          ...rise(t, 6, 30),
          position: 'absolute',
          top: 130,
          left: 18,
          right: 18,
          height: 560,
          borderRadius: 18,
          background: `repeating-linear-gradient(180deg, transparent 0 43px, ${rgba('#6b8fb8', 0.3)} 43px 44px), #f6f3ea`,
          backgroundPosition: '0 70px',
          color: '#1f2a37',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', left: 44, top: 0, bottom: 0, width: 1.5, background: rgba('#e26d6d', 0.5) }} />
        <div style={{ position: 'absolute', left: 58, top: 26, fontWeight: 800, fontSize: 22 }}>Martes 13</div>
        {lines.map((line, i) => {
          const shown = ramp(t, 14 + i * 12, 30 + i * 12, EASE.out);
          return (
            <div key={line} style={{ position: 'absolute', left: 58, top: 88 + i * 44, fontSize: 17, fontWeight: 600, whiteSpace: 'nowrap', clipPath: `inset(0 ${100 - shown * 100}% 0 0)` }}>
              {line}
              {i === 1 && <div style={{ position: 'absolute', left: 0, top: '52%', height: 2.5, width: `${strike * 100}%`, background: '#1f2a37' }} />}
            </div>
          );
        })}
        <svg style={{ position: 'absolute', left: 52, top: 238 }} width={260} height={20}>
          <path d="M4 12 C60 4, 140 18, 254 8" fill="none" stroke="#2f7565" strokeWidth={3.5} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ramp(t, 62, 84, EASE.out)} />
        </svg>
      </div>
      <TabBar active="Inicio" />
    </Screen>
  );
};

const HABITS = ['Estudiar 1 hora', 'Leer 20 minutos', 'Tomar 2 L de agua', 'Dormir antes de las 11'];

/** Hábitos: se van marcando uno a uno y el anillo se llena. */
export const HabitosScreen: React.FC<{ t: number }> = ({ t }) => {
  const done = HABITS.map((_, i) => springAt(t, 30 + i * 18, SPRING.pop));
  const progress = done.reduce((a, b) => a + clamp(b), 0) / HABITS.length;
  const R = 52;
  const CIRC = 2 * Math.PI * R;
  return (
    <Screen>
      <ZoneHeader title="hábitos" t={t} />
      <div style={{ ...rise(t, 6, 20), position: 'absolute', top: 136, left: 18, right: 18, display: 'flex', alignItems: 'center', gap: 20 }}>
        <svg width={128} height={128} viewBox="0 0 128 128">
          <circle cx={64} cy={64} r={R} fill="none" stroke={rgba(C.text, 0.08)} strokeWidth={10} />
          <circle cx={64} cy={64} r={R} fill="none" stroke={C.success} strokeWidth={10} strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - progress)} transform="rotate(-90 64 64)" />
          <text x={64} y={72} textAnchor="middle" fill={C.text} fontFamily={FONT.mono} fontWeight={700} fontSize={24}>
            {Math.round(progress * HABITS.length)}/{HABITS.length}
          </text>
        </svg>
        <div>
          <div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Hoy</div>
          <div style={{ fontSize: 23, fontWeight: 700, lineHeight: 1.15 }}>Vas muy bien</div>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, fontWeight: 600, color: C.warning }}>
            <Flame size={16} strokeWidth={1.75} />
            Racha de 12 días
          </div>
        </div>
      </div>
      {HABITS.map((h, i) => {
        const d = clamp(done[i]);
        return (
          <Card
            key={h}
            style={{
              ...rise(t, 10 + i * 5, 24),
              position: 'absolute',
              top: 296 + i * 74,
              left: 16,
              right: 16,
              height: 62,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '0 16px',
              boxShadow: `inset 0 0 0 1px ${d > 0.5 ? rgba(C.success, 0.35) : C.border}`,
            }}
          >
            <div style={{ width: 26, height: 26, borderRadius: 13, display: 'grid', placeItems: 'center', boxShadow: `inset 0 0 0 2px ${rgba(C.success, 0.6)}`, background: rgba(C.success, d) }}>
              <svg width={15} height={15} viewBox="0 0 16 16" style={{ transform: `scale(${done[i]})` }}>
                <path d="M3 8.5 L6.5 12 L13 4.5" fill="none" stroke={C.bg} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span style={{ fontWeight: 600, fontSize: 15.5, opacity: 1 - 0.35 * d }}>{h}</span>
            <span style={{ marginLeft: 'auto', fontFamily: FONT.mono, fontWeight: 600, fontSize: 12.5, color: C.gold, opacity: d }}>+10 XP</span>
          </Card>
        );
      })}
      <TabBar active="Hábitos" />
    </Screen>
  );
};

