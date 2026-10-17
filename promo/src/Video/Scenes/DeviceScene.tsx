// Escenas 3 y 4 (8–24 s): el teléfono. Al empezar, su pantalla cubre todo el lienzo
// y muestra el logo de la escena 2: la cámara se aleja y resulta que el logo era la
// pantalla de arranque. El logo vuela a la cabecera, aparece el inicio y el teléfono
// se inclina. Un toque abre el Coliseo; luego el teléfono gira de un lado a otro con
// cada zona (Ciclo, Hábitos) mientras la pantalla pasa de una a otra, y el fondo se
// tiñe del color de cada zona. Con El Sabio gira hacia el otro lado, una onda de
// color lo envuelve, las zonas le mandan su señal y la IA responde. Al final baja al
// centro para la llamada a la acción (el titular y el botón van en CtaScene).
import type React from 'react';
import { CheckCircle2, Flower2, Moon, Sparkles, Swords, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { AbsoluteFill, Easing, useCurrentFrame } from 'remotion';
import { COLORS, FONT, SPRING, ZONE, gradientText, rgba, type ZoneId } from '../theme';
import { EASE, clamp, decay, lerp, ramp, springAt, track } from '../lib/anim';
import { lightAt } from '../palette';
import { IPhone } from '../components/IPhone';
import { BrandLockup, lockupState } from '../components/BrandLockup';
import { MARK_SIZE, NoutLifeMark, Wordmark } from '../components/Brand';
import { IconChip, ProBadge } from '../components/ui';
import { LOCKUP, PHONE, POSE_CTA, POSE_HANDOFF, POSE_HERO, POSE_HOME, POSE_SABIO, TITLE, type PhonePose } from '../layout';
import { BRAND, CTA, DEVICE, SEQUENCES, ZONE_ORDER, ZONE_TIMES } from '../timeline';
import { CardPops, SH, SW, Tap, type PopCard } from '../screens/kit';
import { HEADER_LOGO, HomeScreen, TILE_RECTS, homeCards } from '../screens/HomeScreen';
import { ColiseoScreen, coliseoCards } from '../screens/ColiseoScreen';
import { CicloScreen, cicloCards } from '../screens/CicloScreen';
import { HabitosScreen, habitosCards } from '../screens/HabitosScreen';
import { SabioScreen, sabioCards } from '../screens/SabioScreen';

const PULL_EASE = Easing.bezier(0.62, 0, 0.16, 1);
const OPEN_SPRING = { stiffness: 150, damping: 22, mass: 0.8 };
const SWIPE_SPRING = { stiffness: 130, damping: 21, mass: 0.85 };
const SABIO_TURN = ZONE_TIMES.sabio.from - 4;
/** El logo de arranque aterriza en la cabecera del inicio. */
const LOGO_LANDED = DEVICE.homeIn + 20;

// ─── El teléfono en el espacio ───────────────────────────────────────────────

export function phonePose(frame: number): PhonePose {
  const pb = ramp(frame, DEVICE.pullBack.from, DEVICE.pullBack.to, PULL_EASE);
  const home = POSE_HOME;
  const hero = POSE_HERO;
  // Escala geométrica: el alejamiento se siente uniforme de principio a fin
  const sMove = track(frame, 1, [
    [SABIO_TURN, POSE_SABIO.s / home.s, SPRING.phone],
    [CTA.move, POSE_CTA.s / home.s, SPRING.phone],
  ]);
  const s = POSE_HANDOFF.s * Math.pow(home.s / POSE_HANDOFF.s, pb) * sMove;
  // Del inicio (centrado) baja al abrir el Coliseo, sube con El Sabio y se centra al final
  const moveTo = (key: 'x' | 'y') =>
    track(frame, 0, [
      [DEVICE.tapColiseo, hero[key] - home[key], SPRING.phone],
      [SABIO_TURN, POSE_SABIO[key] - home[key], SPRING.phone],
      [CTA.move, POSE_CTA[key] - home[key], SPRING.phone],
    ]);
  const idle = ramp(frame, DEVICE.tilt, DEVICE.tilt + 40);
  const x = lerp(POSE_HANDOFF.x, home.x, pb) + moveTo('x');
  const y = lerp(POSE_HANDOFF.y, home.y, pb) + moveTo('y') + Math.sin(frame / 27) * 8 * idle;
  // Gira con cada zona: Ciclo hacia un lado, Hábitos hacia el otro, El Sabio de nuevo
  const turn = (key: 'rx' | 'ry' | 'rz', flip: boolean) =>
    track(frame, 0, [
      [DEVICE.tilt, hero[key], SPRING.phone],
      [ZONE_TIMES.ciclo.from - 4, flip ? -hero[key] : hero[key], SPRING.swing],
      [ZONE_TIMES.habitos.from - 4, hero[key], SPRING.swing],
      [SABIO_TURN, POSE_SABIO[key], SPRING.swing],
      [CTA.move, POSE_CTA[key], SPRING.phone],
    ]);
  return {
    x,
    y,
    s,
    rx: turn('rx', false) + Math.sin(frame / 33 + 1) * 1.3 * idle,
    ry: turn('ry', true) + Math.sin(frame / 41) * 2.4 * idle,
    rz: turn('rz', true),
  };
}

// Desenfoque de movimiento sin <CameraMotionBlur>: ese suma copias al 1/n de opacidad
// y, en 8 bits, escalona los degradados oscuros de la pantalla. Aquí cada movimiento
// rápido se desenfoca según su velocidad entre un fotograma y el anterior.

/** Desenfoque del alejamiento: proporcional a lo que cambia la escala por fotograma. */
const zoomBlur = (frame: number) => clamp(Math.abs(Math.log(phonePose(frame).s / phonePose(frame - 1).s)) * 45, 0, 4);

/** Filtro SVG de desenfoque horizontal para las pantallas que se deslizan. */
const SwipeBlur: React.FC<{ id: string; sigma: number }> = ({ id, sigma }) => (
  <svg width={0} height={0} style={{ position: 'absolute' }}>
    <filter id={id} x="-15%" y="0%" width="130%" height="100%" colorInterpolationFilters="sRGB">
      <feGaussianBlur stdDeviation={`${sigma} 0`} />
    </filter>
  </svg>
);

// ─── La pantalla ─────────────────────────────────────────────────────────────

const Layer: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({ style, children }) => (
  <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...style }}>{children}</div>
);

/** Velo oscuro y sombra de borde de las transiciones de empuje (como en iOS). */
const Dim: React.FC<{ amount: number }> = ({ amount }) =>
  amount > 0.002 ? <div style={{ position: 'absolute', inset: 0, background: `rgba(0, 0, 0, ${0.5 * amount})` }} /> : null;

const swipe = (frame: number, at: number) => springAt(frame, at, SWIPE_SPRING);

/** Desplazamiento horizontal de cada pantalla de zona (px de pantalla) en el fotograma `f`. */
function swipeOffsets(f: number) {
  const toCiclo = swipe(f, ZONE_TIMES.ciclo.from - 3);
  const toHabitos = swipe(f, ZONE_TIMES.habitos.from - 3);
  return {
    toCiclo,
    toHabitos,
    coliseo: -0.32 * SW * toCiclo,
    ciclo: SW * (1 - toCiclo) - 0.32 * SW * toHabitos,
    habitos: SW * (1 - toHabitos),
  };
}

/** Pantalla que se desliza: su desplazamiento y su desenfoque horizontal (180° de obturador). */
function sliding(frame: number, key: 'coliseo' | 'ciclo' | 'habitos') {
  const dx = swipeOffsets(frame)[key];
  const sigma = Math.min(18, Math.abs(dx - swipeOffsets(frame - 1)[key]) * 0.15);
  const id = `swipe-blur-${key}`;
  return {
    dx,
    filter: <SwipeBlur key={id} id={id} sigma={sigma} />,
    style: { transform: `translateX(${dx}px)`, filter: sigma > 0.4 ? `url(#${id})` : undefined } satisfies React.CSSProperties,
  };
}

/** La pantalla de arranque: el logo de la escena 2 que vuela a la cabecera del inicio. */
const Splash: React.FC<{ frame: number }> = ({ frame }) => {
  const bg = 1 - ramp(frame, DEVICE.homeIn, DEVICE.homeIn + 10);
  const cx = SW / 2;
  const cy = SH / 2;
  const settled = lockupState(BRAND.handoff.to);
  // Escala del logo de arranque en px de pantalla (el de la escena 2 visto a través del teléfono)
  const e0 = settled.push / POSE_HANDOFF.s;
  const t = springAt(frame, DEVICE.homeIn, SPRING.smooth, 20);
  const markH = lerp(LOCKUP.markHeight * e0, HEADER_LOGO.markHeight, t);
  const markW = (markH * MARK_SIZE.w) / MARK_SIZE.h;
  const markCx = lerp(cx, HEADER_LOGO.markLeft + (HEADER_LOGO.markHeight * MARK_SIZE.w) / MARK_SIZE.h / 2, t);
  const markCy = lerp(cy + (LOCKUP.mark.y - LOCKUP.cy) * e0, HEADER_LOGO.markTop + HEADER_LOGO.markHeight / 2, t);
  const wordW = lerp(LOCKUP.wordmarkWidth * e0, HEADER_LOGO.wordmarkWidth, t);
  const wordLeft = lerp(cx - (LOCKUP.wordmarkWidth * e0) / 2, HEADER_LOGO.wordmarkLeft, t);
  const wordTop = lerp(cy + (LOCKUP.wordmarkTop - LOCKUP.cy) * e0, HEADER_LOGO.wordmarkTop, t);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(70% 45% at 50% 47%, ${rgba(COLORS.jade, 0.05)}, transparent 70%), #050907`,
          opacity: bg,
        }}
      />
      {frame < DEVICE.homeIn ? (
        <BrandLockup state={lockupState(frame)} cx={cx} cy={cy} k={1 / POSE_HANDOFF.s} />
      ) : (
        <>
          <div
            style={{
              position: 'absolute',
              left: markCx - 560 * e0,
              top: markCy - 560 * e0,
              width: 1120 * e0,
              height: 1120 * e0,
              borderRadius: '50%',
              background: `radial-gradient(circle closest-side, ${rgba(COLORS.jade, 0.24)} 0%, ${rgba('#2a7262', 0.13)} 38%, ${rgba('#1a5547', 0.05)} 66%, transparent 100%)`,
              opacity: 1 - t,
            }}
          />
          <div style={{ position: 'absolute', left: markCx - markW / 2, top: markCy - markH / 2, filter: `drop-shadow(0 0 ${26 * e0 * (1 - t)}px ${rgba(COLORS.jade, 0.3)})` }}>
            <NoutLifeMark height={markH} />
          </div>
          <div style={{ position: 'absolute', left: wordLeft, top: wordTop }}>
            <Wordmark width={wordW} />
          </div>
        </>
      )}
    </>
  );
};

/** Qué hay en la pantalla en cada fotograma, y lo que se levanta de ella. */
function screenStack(frame: number): { screen: React.ReactNode; pops: React.ReactNode } {
  const layers: React.ReactNode[] = [];
  const pops: React.ReactNode[] = [];
  const addPops = (cards: PopCard[], dx: number, opacity = 1) => pops.push(<CardPops key={pops.length} cards={cards} dx={dx} opacity={opacity} />);
  const T = ZONE_TIMES;

  // Inicio: entra en cascada bajo el logo; el toque abre el Coliseo
  const open = springAt(frame, DEVICE.tapColiseo + 1, OPEN_SPRING);
  if (frame < T.coliseo.from + 20) {
    const tile = TILE_RECTS.coliseo;
    layers.push(
      <Layer key="home" style={{ transform: `scale(${1 - 0.06 * clamp(open)})`, transformOrigin: `${tile.x + tile.w / 2}px ${tile.y + tile.h / 2}px` }}>
        <HomeScreen frame={frame} at={DEVICE.homeIn + 2} logo={frame >= LOGO_LANDED} cards={homeCards(frame, DEVICE.homeIn + 2)} />
        <Tap frame={frame} at={DEVICE.tapColiseo} x={tile.x + tile.w / 2} y={tile.y + tile.h / 2 + 10} />
        <Dim amount={clamp(open)} />
      </Layer>,
    );
  }

  // Coliseo: crece desde su baldosa (con un desenfoque mientras crece deprisa)
  const { toCiclo, toHabitos } = swipeOffsets(frame);
  if (frame > DEVICE.tapColiseo && frame < T.ciclo.from + 22) {
    const tile = TILE_RECTS.coliseo;
    const o = clamp(open);
    const inset = `inset(${lerp(tile.y, 0, o)}px ${lerp(SW - tile.x - tile.w, 0, o)}px ${lerp(SH - tile.y - tile.h, 0, o)}px ${lerp(tile.x, 0, o)}px round ${lerp(30, 0, o)}px)`;
    const growBlur = clamp(Math.abs(open - springAt(frame - 1, DEVICE.tapColiseo + 1, OPEN_SPRING)) * 40, 0, 4);
    const s = sliding(frame, 'coliseo');
    const cards = coliseoCards(frame, frame - T.coliseo.from);
    layers.push(s.filter);
    layers.push(
      <Layer key="coliseo" style={{ clipPath: inset, opacity: clamp(open * 3), ...s.style }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `scale(${lerp(0.55, 1, open)})`,
            transformOrigin: `${tile.x + tile.w / 2}px ${tile.y + tile.h / 2}px`,
            filter: growBlur > 0.3 ? `blur(${growBlur}px)` : undefined,
          }}
        >
          <ColiseoScreen cards={cards} />
        </div>
        <Dim amount={toCiclo} />
      </Layer>,
    );
    addPops(cards, s.dx);
  }

  // Ciclo y Hábitos: entran empujando desde la derecha
  if (frame > T.ciclo.from - 3 && frame < T.habitos.from + 22) {
    const s = sliding(frame, 'ciclo');
    const cards = cicloCards(frame, frame - T.ciclo.from);
    layers.push(s.filter);
    layers.push(
      <Layer key="ciclo" style={s.style}>
        <CicloScreen cards={cards} />
        <Dim amount={toHabitos} />
      </Layer>,
    );
    addPops(cards, s.dx);
  }
  const reveal = ramp(frame, T.sabio.from - 2, T.sabio.from + 16, EASE.inOut);
  if (frame > T.habitos.from - 3 && frame < T.sabio.from + 18) {
    const s = sliding(frame, 'habitos');
    const cards = habitosCards(frame);
    layers.push(s.filter);
    layers.push(
      <Layer key="habitos" style={s.style}>
        <HabitosScreen frame={frame} local={frame - T.habitos.from} cards={cards} />
        <Dim amount={reveal} />
      </Layer>,
    );
    // La luz de El Sabio sube por la pantalla y las piezas de Hábitos se desvanecen con ella
    addPops(cards, s.dx, 1 - reveal);
  }

  // Inicio otra vez, para el cierre (debajo de El Sabio, que se desvanece encima)
  const leave = ramp(frame, CTA.move + 2, CTA.move + 16);
  if (frame > CTA.move) {
    const cards = homeCards(frame, CTA.move + 6, CTA.levelUp);
    layers.push(
      <Layer key="home-cta" style={{ opacity: leave, transform: `scale(${lerp(1.05, 1, leave)})` }}>
        <HomeScreen frame={frame} at={CTA.move + 6} logo cards={cards} />
      </Layer>,
    );
    addPops(cards, 0);
  }

  // El Sabio: un círculo de luz lo abre desde abajo
  if (frame > T.sabio.from - 2 && frame < CTA.move + 16) {
    const r = lerp(0, 1320, reveal);
    const cards = sabioCards(frame);
    layers.push(
      <Layer key="sabio" style={{ clipPath: `circle(${r}px at 50% 100%)`, opacity: 1 - leave, transform: `scale(${1 - 0.05 * leave})` }}>
        <SabioScreen frame={frame} local={frame - T.sabio.from} cards={cards} />
      </Layer>,
    );
    if (reveal < 1) {
      layers.push(
        <div
          key="sabio-front"
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at 50% 100%, transparent ${Math.max(0, r - 90)}px, ${rgba(ZONE.sabio.to, 0.55)} ${Math.max(0, r - 24)}px, ${rgba('#ffffff', 0.85)} ${r}px, ${rgba(ZONE.sabio.from, 0.4)} ${r + 14}px, transparent ${r + 60}px)`,
          }}
        />,
      );
    }
    addPops(
      cards.map((c) => ({ ...c, lift: c.lift * (1 - leave) })),
      0,
    );
  }

  if (frame < LOGO_LANDED) layers.push(<Splash key="splash" frame={frame} />);
  return { screen: layers, pops };
}

/** El halo de la IA en el borde de la pantalla: entra con El Sabio y se va con el cierre. */
const edgeGlow = (frame: number) => ramp(frame, ZONE_TIMES.sabio.from - 2, ZONE_TIMES.sabio.from + 12) * (1 - ramp(frame, CTA.move, CTA.move + 16));

/** El teléfono, con su desenfoque mientras la cámara se aleja. */
const PhoneStage: React.FC<{ frame: number; pose: PhonePose }> = ({ frame, pose }) => {
  const { screen, pops } = screenStack(frame);
  const blur = zoomBlur(frame);
  return (
    <AbsoluteFill style={{ opacity: ramp(frame, BRAND.handoff.from, BRAND.handoff.to, EASE.linear), filter: blur > 0.3 ? `blur(${blur}px)` : undefined }}>
      <IPhone
        pose={pose}
        frame={frame}
        screen={screen}
        pops={pops}
        edgeGlow={edgeGlow(frame)}
        glowColors={[ZONE.sabio.to, ZONE.sabio.from, ZONE.ciclo.glow, ZONE.coliseo.from, ZONE.habitos.glow]}
      />
    </AbsoluteFill>
  );
};

// ─── Alrededor del teléfono ──────────────────────────────────────────────────

/** La luz de la pantalla derramada sobre el fondo, del color de la zona. */
const PhoneAura: React.FC<{ frame: number; pose: PhonePose }> = ({ frame, pose }) => {
  const light = lightAt(frame);
  const show = ramp(frame, DEVICE.pullBack.from + 10, DEVICE.pullBack.to + 10);
  const beatPulse = frame >= ZONE_TIMES.coliseo.from && frame < ZONE_TIMES.sabio.from ? decay(frame % 15, 0, 5) * 0.12 : 0;
  const w = PHONE.w * 2.3 * pose.s;
  const h = PHONE.h * 1.45 * pose.s;
  return (
    <div
      style={{
        position: 'absolute',
        left: pose.x - w / 2,
        top: pose.y - h / 2,
        width: w,
        height: h,
        borderRadius: '50%',
        background: `radial-gradient(closest-side, ${rgba(light.a, 0.5 * light.k)} 0%, ${rgba(light.b, 0.22 * light.k)} 45%, transparent 100%)`,
        opacity: show * (0.85 + beatPulse),
      }}
    />
  );
};

/** Cierre: los colores de las cuatro zonas giran despacio detrás del teléfono. */
const CtaAura: React.FC<{ frame: number; pose: PhonePose }> = ({ frame, pose }) => {
  const show = ramp(frame, CTA.move + 6, CTA.move + 40);
  if (show <= 0) return null;
  return (
    <AbsoluteFill style={{ opacity: show, mixBlendMode: 'screen' }}>
      {ZONE_ORDER.map((id, i) => {
        const a = (i / ZONE_ORDER.length) * Math.PI * 2 + frame * 0.012;
        const x = pose.x + Math.cos(a) * 300;
        const y = pose.y + Math.sin(a) * 390;
        return (
          <div
            key={id}
            style={{
              position: 'absolute',
              left: x - 380,
              top: y - 380,
              width: 760,
              height: 760,
              borderRadius: '50%',
              background: `radial-gradient(closest-side, ${rgba(ZONE[id].glow, 0.3)}, transparent)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const TITLES: Record<ZoneId, { icon: LucideIcon; n: string; title: string; sub: string; pro?: boolean }> = {
  coliseo: { icon: Swords, n: '01', title: 'Coliseo', sub: 'Fuerza, 1RM y mapa de calor muscular', pro: true },
  ciclo: { icon: Flower2, n: '02', title: 'Ciclo Menstrual', sub: 'Fases, síntomas y predicciones' },
  habitos: { icon: CheckCircle2, n: '03', title: 'Hábitos y Rituales', sub: 'Rachas, XP y progreso diario' },
  sabio: { icon: Sparkles, n: '04', title: 'El Sabio', sub: 'Tu consejero con IA holística', pro: true },
};

/** Los títulos de cada zona, arriba: suben línea a línea y se van hacia arriba. */
const ZoneTitles: React.FC<{ frame: number }> = ({ frame }) => (
  <>
    {ZONE_ORDER.map((id, zi) => {
      const enter = id === 'coliseo' ? DEVICE.tapColiseo + 5 : ZONE_TIMES[id].from;
      const exit = zi + 1 < ZONE_ORDER.length ? ZONE_TIMES[ZONE_ORDER[zi + 1]].from - 5 : CTA.move - 4;
      if (frame < enter || frame > exit + 12) return null;
      const t = TITLES[id];
      const z = ZONE[id];
      const line = (i: number): React.CSSProperties => {
        const p = springAt(frame, enter + i * 2.5, SPRING.smooth, 16);
        const q = ramp(frame, exit + i, exit + 8 + i, EASE.in);
        return {
          transform: `translateY(${(1 - p) * 56 - q * 36}px)`,
          opacity: p * (1 - q),
          filter: p < 0.99 || q > 0.01 ? `blur(${(1 - p) * 10 + q * 8}px)` : undefined,
        };
      };
      return (
        <div key={id} style={{ position: 'absolute', left: 0, right: 0, top: TITLE.kickerTop, fontFamily: FONT.sans, textAlign: 'center' }}>
          <div style={{ ...line(0), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, height: 52 }}>
            <IconChip icon={t.icon} color={z.glow} size={52} />
            <span style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 24, letterSpacing: '0.22em', color: z.from }}>ZONA {t.n}</span>
            {t.pro && <ProBadge scale={0.95} />}
          </div>
          <div style={{ ...line(1), position: 'relative', marginTop: TITLE.titleTop - TITLE.kickerTop - 52 - 6 }}>
            <div
              aria-hidden
              style={{ position: 'absolute', inset: 0, fontWeight: 800, fontSize: TITLE.titleSize, lineHeight: 1.08, letterSpacing: '-0.035em', color: z.glow, filter: 'blur(28px)', opacity: 0.5, whiteSpace: 'nowrap' }}
            >
              {t.title}
            </div>
            <div
              style={{
                position: 'relative',
                fontWeight: 800,
                fontSize: TITLE.titleSize,
                lineHeight: 1.08,
                letterSpacing: '-0.035em',
                whiteSpace: 'nowrap',
                ...gradientText(z.from, z.to, 100),
              }}
            >
              {t.title}
            </div>
          </div>
          <div style={{ ...line(2), marginTop: 10, fontWeight: 500, fontSize: 34, letterSpacing: '-0.005em', color: rgba(COLORS.text, 0.82) }}>{t.sub}</div>
        </div>
      );
    })}
  </>
);

/** El Sabio: las zonas le mandan su señal como cintas de luz que entran en el teléfono. */
const SOURCES: Array<{ label: string; icon: LucideIcon; color: string; x: number; y: number }> = [
  { label: 'Sueño', icon: Moon, color: '#8fd0ff', x: 150, y: 640 },
  { label: 'Hábitos', icon: CheckCircle2, color: ZONE.habitos.glow, x: 900, y: 640 },
  { label: 'Coliseo', icon: Swords, color: ZONE.coliseo.glow, x: 150, y: 1330 },
  { label: 'Comida', icon: UtensilsCrossed, color: COLORS.warning, x: 900, y: 1330 },
];

const ribbonPath = (s: (typeof SOURCES)[number], target: { x: number; y: number }, wave: number) => {
  const mx = lerp(s.x, target.x, 0.5);
  const c1 = { x: mx, y: s.y + wave };
  const c2 = { x: lerp(s.x, target.x, 0.8), y: lerp(s.y, target.y, 0.9) - wave };
  return `M ${s.x} ${s.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${target.x} ${target.y}`;
};

const SabioSignals: React.FC<{ frame: number; pose: PhonePose }> = ({ frame, pose }) => {
  const from = ZONE_TIMES.sabio.from;
  const out = 1 - ramp(frame, CTA.move - 8, CTA.move + 6);
  if (frame < from || out <= 0) return null;
  const target = { x: pose.x, y: pose.y - 60 };
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <defs>
          {SOURCES.map((s, i) => (
            <linearGradient key={i} id={`signal-${i}`} gradientUnits="userSpaceOnUse" x1={s.x} y1={s.y} x2={target.x} y2={target.y}>
              <stop offset="0" stopColor={s.color} />
              <stop offset="1" stopColor={ZONE.sabio.from} />
            </linearGradient>
          ))}
        </defs>
        {SOURCES.map((s, i) => {
          const draw = ramp(frame, from + 6 + i * 3, from + 22 + i * 3, EASE.out);
          const d = ribbonPath(s, target, Math.sin(frame / 14 + i) * 60);
          return (
            <g key={i}>
              <path d={d} fill="none" stroke={`url(#signal-${i})`} strokeOpacity={0.18} strokeWidth={22} strokeLinecap="round" pathLength={1} strokeDasharray={`${draw} 1`} />
              <path d={d} fill="none" stroke={`url(#signal-${i})`} strokeWidth={3.5} strokeLinecap="round" pathLength={1} strokeDasharray={`${draw} 1`} />
              {/* Pulsos que viajan hacia el teléfono */}
              {draw >= 1 &&
                [0, 0.5].map((off) => (
                  <path
                    key={off}
                    d={d}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth={6}
                    strokeLinecap="round"
                    pathLength={1}
                    strokeDasharray="0.05 1"
                    strokeDashoffset={-((((frame - from) * 0.03 + off + i * 0.21) % 1) + 1) % 1}
                    style={{ filter: `drop-shadow(0 0 8px ${s.color})` }}
                  />
                ))}
            </g>
          );
        })}
      </svg>
      {SOURCES.map((s, i) => {
        const p = springAt(frame, from + 2 + i * 3, SPRING.pop);
        return (
          <div
            key={s.label}
            style={{
              position: 'absolute',
              left: s.x - 60,
              top: s.y - 46,
              width: 120,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              transform: `scale(${p})`,
              opacity: clamp(p * 1.5),
              fontFamily: FONT.sans,
            }}
          >
            <IconChip icon={s.icon} color={s.color} size={64} radius={32} />
            <span style={{ fontWeight: 600, fontSize: 24, color: COLORS.text }}>{s.label}</span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** La onda de color que envuelve al teléfono cuando entra El Sabio. */
const SabioWave: React.FC<{ frame: number; pose: PhonePose; front?: boolean }> = ({ frame, pose, front }) => {
  const at = ZONE_TIMES.sabio.from - 2;
  const w = ramp(frame, at, at + 30, EASE.out);
  if (w <= 0 || w >= 1) return null;
  const r = lerp(220, 1500, w);
  return (
    <div
      style={{
        position: 'absolute',
        left: pose.x - r,
        top: pose.y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: '50%',
        background: `radial-gradient(closest-side, transparent 72%, ${rgba(ZONE.sabio.to, 0.5 * (1 - w))} 86%, ${rgba(ZONE.sabio.from, 0.7 * (1 - w))} 94%, transparent 100%)`,
        opacity: front ? 0.45 : 1,
        mixBlendMode: front ? 'screen' : undefined,
      }}
    />
  );
};

export const DeviceScene: React.FC = () => {
  const frame = useCurrentFrame() + SEQUENCES.device.from;
  const pose = phonePose(frame);
  return (
    <AbsoluteFill>
      <PhoneAura frame={frame} pose={pose} />
      <CtaAura frame={frame} pose={pose} />
      <SabioWave frame={frame} pose={pose} />
      <SabioSignals frame={frame} pose={pose} />
      <PhoneStage frame={frame} pose={pose} />
      <SabioWave frame={frame} pose={pose} front />
      <ZoneTitles frame={frame} />
    </AbsoluteFill>
  );
};
