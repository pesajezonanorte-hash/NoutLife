// Inicio de la app (apps/web/src/pages/Dashboard), en un móvil y en modo oscuro: la
// cabecera móvil (isotipo, fecha o el indicador de la prueba, buscar, social,
// notificaciones y menú), la ventana con el cielo de las 9:41, el saludo con la letra de
// la marca, la frase tranquila, la tarjeta de nivel, el resumen y la barra inferior con
// las zonas fijadas. Datos de ejemplo («Ana»). `trial` (0–1) cambia la fecha por
// «Pro · Regalo 1/7»: así ve la cabecera una cuenta Lite que recibe los 7 días.
// La barra de estado y el indicador de inicio van aparte (SystemChrome): los dibuja iOS.
import type React from 'react';
import { Bell, CalendarDays, CheckCircle2, Flag, Flame, Home, Menu, MessageCircle, Notebook, Search, Sparkles, User, Wallet, type LucideIcon } from 'lucide-react';
import { FONT, rgba } from '../../Video/theme';
import { NoutLifeMark, MARK_SIZE } from '../../Video/components/Brand';
import { StatusBar } from '../../Video/screens/kit';
import { HomeWindow } from './HomeWindow';
import { Lettering } from './Lettering';
import { APP, HAIRLINE, HEADER_H, STATUS_H, SW, SH, TABBAR_H, TYPE, pt } from './ui';

const PAD = pt(16);
const CONTENT_TOP = STATUS_H + HEADER_H + pt(8);
const WINDOW_W = SW - 2 * PAD;
/** Alto de la ventana con su barra y el alféizar (HomeWindow). */
const WINDOW_H = pt(16) + WINDOW_W / 1.6 + pt(10);
const GREETING_TOP = CONTENT_TOP + WINDOW_H + pt(24);

/** Zonas fijadas en la barra inferior (en Lite, las primeras que sí se pueden usar). */
const TABS: Array<{ label: string; icon: LucideIcon; active?: boolean }> = [
  { label: 'Inicio', icon: Home, active: true },
  { label: 'Hábitos', icon: CheckCircle2 },
  { label: 'Agenda', icon: CalendarDays },
  { label: 'Libreta', icon: Notebook },
  { label: 'Perfil', icon: User },
];

const text = (t: { size: number; line: number }, weight: number, color: string, extra?: React.CSSProperties): React.CSSProperties => ({
  fontFamily: FONT.sans,
  fontSize: t.size,
  lineHeight: `${t.line}px`,
  fontWeight: weight,
  color,
  whiteSpace: 'nowrap',
  ...extra,
});

const Header: React.FC<{ trial: number }> = ({ trial }) => {
  const markH = pt(28);
  const icons: LucideIcon[] = [Search, MessageCircle, Bell, Menu];
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: STATUS_H, height: HEADER_H, background: APP.background }}>
      <div style={{ position: 'absolute', left: PAD, top: (HEADER_H - markH) / 2 }}>
        <NoutLifeMark height={markH} />
      </div>
      <div style={{ position: 'absolute', left: PAD + (markH * MARK_SIZE.w) / MARK_SIZE.h + pt(10), top: 0, height: HEADER_H, display: 'flex', alignItems: 'center' }}>
        <span style={{ ...text(TYPE.bodySm, 400, APP.onSurfaceLight), position: 'absolute', opacity: 1 - trial }}>Jueves, 22 de octubre</span>
        {/* TrialPill: borde y fondo champán, texto label-sm */}
        <span
          style={{
            ...text(TYPE.labelMd, 600, APP.secondary),
            position: 'absolute',
            padding: `${pt(4)}px ${pt(10)}px`,
            borderRadius: 999,
            background: rgba(APP.secondary, APP.soft),
            boxShadow: `inset 0 0 0 ${HAIRLINE}px ${rgba(APP.secondary, 0.5)}`,
            opacity: trial,
            transform: `scale(${0.92 + 0.08 * trial})`,
            transformOrigin: 'left center',
          }}
        >
          Pro · Regalo 1/7
        </span>
      </div>
      <div style={{ position: 'absolute', right: pt(8), top: 0, height: HEADER_H, display: 'flex' }}>
        {icons.map((Icon, i) => (
          <div key={i} style={{ width: pt(44), height: HEADER_H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={pt(24)} color={APP.onSurface} strokeWidth={1.75} />
          </div>
        ))}
      </div>
      {/* Punto de notificación nueva en la campana */}
      <div style={{ position: 'absolute', right: pt(8) + pt(44) + pt(12), top: pt(15), width: pt(8), height: pt(8), borderRadius: '50%', background: APP.primary }} />
    </div>
  );
};

const Card: React.FC<{ top: number; height: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ top, height, children, style }) => (
  <div
    style={{
      position: 'absolute',
      left: PAD,
      right: PAD,
      top,
      height,
      borderRadius: pt(16),
      background: APP.surface,
      boxShadow: `inset 0 0 0 ${HAIRLINE}px ${APP.border}`,
      ...style,
    }}
  >
    {children}
  </div>
);

const LevelCard: React.FC<{ top: number }> = ({ top }) => {
  const p = pt(24);
  const chip = pt(56);
  return (
    <Card top={top} height={p * 2 + chip + pt(16) * 2 + pt(12) + TYPE.bodySm.line}>
      <div style={{ position: 'absolute', left: p, top: p, display: 'flex', alignItems: 'center', gap: pt(16) }}>
        <div
          style={{
            width: chip,
            height: chip,
            borderRadius: pt(16),
            background: rgba(APP.primary, APP.soft),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...text({ size: pt(20), line: pt(28) }, 600, APP.primaryText, { fontFamily: FONT.mono }),
          }}
        >
          2
        </div>
        <div>
          <div style={text(TYPE.headingSm, 600, APP.onBackground, { letterSpacing: '-0.01em' })}>Nivel 2 · Explorador</div>
          <div style={text(TYPE.bodySm, 400, APP.onSurfaceLight, { fontFamily: FONT.mono })}>860 / 1.200 XP</div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: p, right: p, top: p + chip + pt(16), height: pt(12), borderRadius: 999, background: APP.surfaceVariant, overflow: 'hidden' }}>
        <div style={{ width: '72%', height: '100%', borderRadius: 999, background: APP.primary }} />
      </div>
      <div style={{ position: 'absolute', left: p, top: p + chip + pt(16) + pt(12) + pt(16), display: 'flex', alignItems: 'center', gap: pt(6), ...text(TYPE.bodySm, 400, APP.onSurface) }}>
        <Sparkles size={pt(16)} color={APP.primaryText} strokeWidth={1.75} />
        340 XP para el nivel 3
      </div>
    </Card>
  );
};

const STATS: Array<{ icon: LucideIcon; tone: string; value: string; label: string }> = [
  { icon: CheckCircle2, tone: APP.success, value: '1/3', label: 'Hábitos hoy' },
  { icon: Flag, tone: APP.primary, value: '2', label: 'Misiones activas' },
  { icon: Wallet, tone: APP.info, value: '$1,2 M', label: 'Saldo del mes' },
  { icon: Flame, tone: APP.warning, value: '12', label: 'Días de racha' },
];

const StatCards: React.FC<{ top: number }> = ({ top }) => {
  const gap = pt(16);
  const w = (WINDOW_W - gap) / 2;
  const h = pt(12) * 2 + pt(40) + pt(12) + TYPE.headingLg.line + TYPE.bodySm.line;
  return (
    <>
      {STATS.map((s, i) => (
        <div
          key={s.label}
          style={{
            position: 'absolute',
            left: PAD + (i % 2) * (w + gap),
            top: top + Math.floor(i / 2) * (h + gap),
            width: w,
            height: h,
            borderRadius: pt(16),
            background: APP.surface,
            boxShadow: `inset 0 0 0 ${HAIRLINE}px ${APP.border}`,
            padding: pt(12),
            boxSizing: 'border-box',
          }}
        >
          <div style={{ width: pt(40), height: pt(40), borderRadius: pt(12), background: rgba(s.tone, APP.soft), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <s.icon size={pt(20)} color={s.tone} strokeWidth={1.75} />
          </div>
          <div style={{ marginTop: pt(12), ...text(TYPE.headingLg, 700, APP.onBackground, { fontFamily: FONT.mono }) }}>{s.value}</div>
          <div style={text(TYPE.bodySm, 400, APP.onSurfaceLight)}>{s.label}</div>
        </div>
      ))}
    </>
  );
};

export const TabBar: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: TABBAR_H,
      paddingTop: pt(4),
      boxSizing: 'border-box',
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      alignItems: 'start',
      background: APP.background,
      borderTop: `${HAIRLINE}px solid ${APP.border}`,
    }}
  >
    {TABS.map(({ label, icon: Icon, active }) => (
      <div key={label} style={{ height: pt(56), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: pt(2) }}>
        <div style={{ width: pt(56), height: pt(32), borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? rgba(APP.primary, APP.soft) : 'transparent' }}>
          <Icon size={pt(24)} color={active ? APP.primaryText : APP.onSurfaceLight} strokeWidth={1.75} />
        </div>
        <span style={text(TYPE.labelMd, 600, active ? APP.primaryText : APP.onSurfaceLight, { letterSpacing: '0.01em' })}>{label}</span>
      </div>
    ))}
  </div>
);

/** El indicador de inicio de iOS. */
export const HomeIndicator: React.FC = () => (
  <div style={{ position: 'absolute', left: (SW - pt(134)) / 2, bottom: pt(8), width: pt(134), height: pt(5), borderRadius: 999, background: rgba(APP.onBackground, 0.9) }} />
);

export const HomeScreen: React.FC<{ frame: number; trial: number }> = ({ frame, trial }) => {
  const levelTop = GREETING_TOP + TYPE.displaySm.line + pt(6) + TYPE.bodyLg.line + pt(20);
  const levelH = pt(24) * 2 + pt(56) + pt(16) * 2 + pt(12) + TYPE.bodySm.line;
  return (
    // zIndex 0: contexto de apilamiento propio, para que las capas de la ventana no pasen por encima del menú
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, width: SW, height: SH, background: APP.background, fontFamily: FONT.sans }}>
      <div style={{ position: 'absolute', left: PAD, top: CONTENT_TOP }}>
        <HomeWindow frame={frame} width={WINDOW_W} />
      </div>
      <div style={{ position: 'absolute', left: PAD, top: GREETING_TOP + (TYPE.displaySm.line - TYPE.displaySm.size * 1.35) / 2 }}>
        <Lettering text="Buenos días, Ana" size={TYPE.displaySm.size} color={APP.onBackground} />
      </div>
      <div style={{ position: 'absolute', left: PAD, top: GREETING_TOP + TYPE.displaySm.line + pt(6), ...text(TYPE.bodyLg, 400, APP.onSurface) }}>
        Te esperan 2 hábitos hoy, sin prisa.
      </div>
      <LevelCard top={levelTop} />
      <StatCards top={levelTop + levelH + pt(24)} />
      <TabBar />
      <Header trial={trial} />
    </div>
  );
};

/** Lo que dibuja iOS por encima de la app (ni el velo del menú lo oscurece). */
export const SystemChrome: React.FC = () => (
  <>
    <StatusBar />
    <HomeIndicator />
  </>
);
