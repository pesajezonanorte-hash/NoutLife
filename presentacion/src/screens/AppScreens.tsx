// Pantallas de NoutLife para el teléfono (390 × 844, modo oscuro jade de la app).
// Datos de ejemplo de un estudiante. Cada pantalla recibe `t`: fotogramas desde
// que está a la vista, para animar checks, escritura y barras.
import type React from 'react';
import {
  BatteryFull,
  Bell,
  CheckCircle2,
  ChevronLeft,
  Flame,
  Home,
  NotebookPen,
  Signal,
  Sparkles,
  Swords,
  User,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import { NoutLifeMark, Wordmark } from '../components/Brand';
import { APP, FONT, rgba } from '../theme';
import { EASE, SPRING, clamp, ramp, rise, springAt } from '../lib';

const Screen: React.FC<{ accent?: string; children: React.ReactNode }> = ({ accent = APP.jade, children }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      fontFamily: FONT.sans,
      color: APP.text,
      background: `radial-gradient(120% 40% at 30% 0%, ${rgba(accent, 0.18)} 0%, transparent 70%), linear-gradient(180deg, #08100c 0%, ${APP.bg} 45%, #050a08 100%)`,
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
  ['Libreta', NotebookPen],
  ['El Sabio', Sparkles],
  ['Perfil', User],
];

const TabBar: React.FC<{ active: string }> = ({ active }) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 84,
      paddingBottom: 18,
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      background: rgba('#0a120e', 0.94),
      borderTop: `1px solid ${APP.border}`,
    }}
  >
    {TABS.map(([label, Icon]) => {
      const on = label === active;
      return (
        <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: on ? APP.jade : APP.muted }}>
          <Icon size={22} strokeWidth={on ? 2.4 : 1.9} />
          <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 500 }}>{label}</span>
        </div>
      );
    })}
  </div>
);

const Header: React.FC<{ icon: LucideIcon; accent: string; title: string }> = ({ icon: Icon, accent, title }) => (
  <div style={{ position: 'absolute', top: 62, left: 14, right: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
    <ChevronLeft size={24} color={APP.muted} />
    <div style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: rgba(accent, 0.16) }}>
      <Icon size={21} color={accent} strokeWidth={2.2} />
    </div>
    <span style={{ fontWeight: 800, fontSize: 27, letterSpacing: '-0.02em' }}>{title}</span>
  </div>
);

const ZONES: Array<{ label: string; stat: string; icon: LucideIcon; color: string }> = [
  { label: 'Coliseo', stat: '3 entrenos', icon: Swords, color: APP.coliseo },
  { label: 'Hábitos', stat: '3/4 hoy', icon: CheckCircle2, color: APP.habitos },
  { label: 'Libreta', stat: '2 tareas', icon: NotebookPen, color: APP.libreta },
  { label: 'El Sabio', stat: '1 consejo', icon: Sparkles, color: APP.sabio },
];

export const HomeScreen: React.FC<{ t: number }> = ({ t }) => (
  <Screen>
    <div style={{ ...rise(t, 4, 16), position: 'absolute', top: 58, left: 22, right: 22, display: 'flex', alignItems: 'center', gap: 8 }}>
      <NoutLifeMark height={28} />
      <Wordmark width={92} />
      <Bell size={21} color={APP.muted} style={{ marginLeft: 'auto' }} />
    </div>
    <div style={{ ...rise(t, 8, 16), position: 'absolute', top: 112, left: 22 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: APP.muted }}>Buenos días</div>
      <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.025em' }}>Hola, Miguel</div>
    </div>
    <div
      style={{
        ...rise(t, 12, 20),
        position: 'absolute',
        top: 196,
        left: 16,
        right: 16,
        borderRadius: 22,
        padding: '16px 18px',
        background: `linear-gradient(160deg, ${rgba(APP.gold, 0.14)}, transparent 75%), #131f19`,
        boxShadow: `inset 0 0 0 1px ${rgba(APP.gold, 0.32)}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: APP.muted }}>Nivel</div>
          <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }}>12</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 14, color: APP.gold }}>+120 XP hoy</div>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 600, color: APP.muted }}>
            <Flame size={14} color={APP.gold} />
            Racha de 12 días
          </div>
        </div>
      </div>
      <div style={{ marginTop: 14, height: 9, borderRadius: 5, background: rgba(APP.text, 0.08) }}>
        <div
          style={{
            width: `${72 * ramp(t, 20, 60, EASE.out)}%`,
            height: '100%',
            borderRadius: 5,
            background: `linear-gradient(90deg, #b08d57, ${APP.gold} 60%, ${APP.goldLight})`,
          }}
        />
      </div>
    </div>
    {ZONES.map((z, i) => {
      const p = springAt(t, 18 + i * 4, SPRING.pop);
      const Icon = z.icon;
      return (
        <div
          key={z.label}
          style={{
            position: 'absolute',
            left: i % 2 ? 201 : 16,
            top: 330 + Math.floor(i / 2) * 154,
            width: 173,
            height: 140,
            borderRadius: 22,
            padding: 14,
            boxSizing: 'border-box',
            background: `linear-gradient(160deg, ${rgba(z.color, 0.22)} 0%, ${rgba('#0f1813', 0.96)} 72%)`,
            boxShadow: `inset 0 0 0 1px ${rgba(z.color, 0.4)}`,
            transform: `scale(${0.8 + 0.2 * p})`,
            opacity: clamp(p * 1.6),
          }}
        >
          <div style={{ width: 42, height: 42, borderRadius: 13, display: 'grid', placeItems: 'center', background: rgba(z.color, 0.16) }}>
            <Icon size={22} color={z.color} strokeWidth={2.2} />
          </div>
          <div style={{ position: 'absolute', left: 15, bottom: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 19 }}>{z.label}</div>
            <div style={{ fontFamily: FONT.mono, fontWeight: 600, fontSize: 12.5, color: APP.muted }}>{z.stat}</div>
          </div>
        </div>
      );
    })}
    <div
      style={{
        ...rise(t, 34, 16),
        position: 'absolute',
        top: 650,
        left: 16,
        right: 16,
        height: 58,
        borderRadius: 18,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 16px',
        background: APP.surface2,
        boxShadow: `inset 0 0 0 1px ${rgba(APP.jade, 0.2)}`,
      }}
    >
      <NotebookPen size={19} color={APP.jade} />
      <span style={{ fontWeight: 600, fontSize: 14.5 }}>Taller de química para el jueves</span>
    </div>
    <TabBar active="Inicio" />
  </Screen>
);

/** Libreta: una hoja rayada con apuntes, una tarea que se tacha y un post-it. */
export const LibretaScreen: React.FC<{ t: number }> = ({ t }) => {
  const lines = ['Química: estequiometría', 'Taller pág. 54 (jueves)', 'Repasar mol y masa molar', 'Exposición de grado: viernes'];
  const strike = ramp(t, 70, 90, EASE.out);
  return (
    <Screen accent={APP.libreta}>
      <Header icon={NotebookPen} accent={APP.libreta} title="Libreta" />
      <div
        style={{
          ...rise(t, 6, 30),
          position: 'absolute',
          top: 124,
          left: 18,
          right: 18,
          height: 560,
          borderRadius: 18,
          background: `repeating-linear-gradient(180deg, transparent 0 43px, ${rgba('#6b8fb8', 0.35)} 43px 44px), #f6f3ea`,
          backgroundPosition: '0 70px',
          color: '#1f2a37',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', left: 44, top: 0, bottom: 0, width: 1.5, background: rgba('#e26d6d', 0.55) }} />
        <div style={{ position: 'absolute', left: 58, top: 26, fontWeight: 800, fontSize: 22 }}>Martes 13</div>
        {lines.map((line, i) => {
          const shown = ramp(t, 14 + i * 12, 30 + i * 12, EASE.out);
          return (
            <div
              key={line}
              style={{
                position: 'absolute',
                left: 58,
                top: 88 + i * 44,
                fontSize: 17,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                clipPath: `inset(0 ${100 - shown * 100}% 0 0)`,
              }}
            >
              {line}
              {i === 1 && (
                <div style={{ position: 'absolute', left: 0, top: '52%', height: 2.5, width: `${strike * 100}%`, background: '#1f2a37' }} />
              )}
            </div>
          );
        })}
        {/* Trazo a mano: subraya la exposición */}
        <svg style={{ position: 'absolute', left: 52, top: 238 }} width={260} height={20}>
          <path
            d="M4 12 C60 4, 140 18, 254 8"
            fill="none"
            stroke="#5b6ee1"
            strokeWidth={3.5}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - ramp(t, 62, 84, EASE.out)}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            right: 22,
            bottom: 40,
            width: 150,
            padding: '14px 14px 18px',
            background: '#fde68a',
            fontSize: 15,
            fontWeight: 700,
            lineHeight: 1.3,
            transform: `rotate(${-4 + 6 * (1 - springAt(t, 44, SPRING.pop))}deg) scale(${0.6 + 0.4 * springAt(t, 44, SPRING.pop)})`,
            opacity: clamp(springAt(t, 44, SPRING.pop) * 2),
          }}
        >
          Ensayar la charla 2 veces
        </div>
      </div>
      <TabBar active="Libreta" />
    </Screen>
  );
};

const HABITS = ['Estudiar 1 hora', 'Leer 20 minutos', 'Tomar 2 L de agua', 'Dormir antes de las 11'];

/** Hábitos: se van marcando uno a uno y el anillo se llena. */
export const HabitosScreen: React.FC<{ t: number }> = ({ t }) => {
  const done = HABITS.map((_, i) => springAt(t, 30 + i * 18, SPRING.pop));
  const progress = done.reduce((a, b) => a + clamp(b), 0) / HABITS.length;
  const R = 52;
  const C = 2 * Math.PI * R;
  return (
    <Screen accent={APP.habitos}>
      <Header icon={CheckCircle2} accent={APP.habitos} title="Hábitos" />
      <div style={{ ...rise(t, 6, 20), position: 'absolute', top: 130, left: 18, right: 18, display: 'flex', alignItems: 'center', gap: 20 }}>
        <svg width={128} height={128} viewBox="0 0 128 128">
          <circle cx={64} cy={64} r={R} fill="none" stroke={rgba(APP.text, 0.08)} strokeWidth={12} />
          <circle
            cx={64}
            cy={64}
            r={R}
            fill="none"
            stroke={APP.habitos}
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
            transform="rotate(-90 64 64)"
          />
          <text x={64} y={72} textAnchor="middle" fill={APP.text} fontFamily={FONT.mono} fontWeight={700} fontSize={24}>
            {Math.round(progress * HABITS.length)}/{HABITS.length}
          </text>
        </svg>
        <div>
          <div style={{ fontSize: 13, color: APP.muted, fontWeight: 600 }}>Hoy</div>
          <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.15 }}>Vas muy bien</div>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, fontWeight: 700, color: APP.gold }}>
            <Flame size={16} />
            Racha de 12 días
          </div>
        </div>
      </div>
      {HABITS.map((h, i) => {
        const d = done[i];
        return (
          <div
            key={h}
            style={{
              ...rise(t, 10 + i * 5, 24),
              position: 'absolute',
              top: 290 + i * 76,
              left: 16,
              right: 16,
              height: 64,
              borderRadius: 18,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '0 16px',
              background: `linear-gradient(90deg, ${rgba(APP.habitos, 0.14 * clamp(d))}, transparent), ${APP.surface}`,
              boxShadow: `inset 0 0 0 1px ${rgba(APP.habitos, 0.12 + 0.3 * clamp(d))}`,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                display: 'grid',
                placeItems: 'center',
                boxShadow: `inset 0 0 0 2px ${rgba(APP.habitos, 0.6)}`,
                background: rgba(APP.habitos, clamp(d)),
              }}
            >
              <svg width={16} height={16} viewBox="0 0 16 16" style={{ transform: `scale(${d})` }}>
                <path d="M3 8.5 L6.5 12 L13 4.5" fill="none" stroke="#06301f" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span style={{ fontWeight: 600, fontSize: 16, opacity: 1 - 0.35 * clamp(d) }}>{h}</span>
            <span style={{ marginLeft: 'auto', fontFamily: FONT.mono, fontWeight: 700, fontSize: 13, color: APP.gold, opacity: clamp(d) }}>+10 XP</span>
          </div>
        );
      })}
      <TabBar active="Hábitos" />
    </Screen>
  );
};
