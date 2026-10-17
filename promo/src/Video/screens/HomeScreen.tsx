// Inicio de la app: saludo, nivel con barra de XP champán, las cuatro zonas del
// vídeo (cada una con su color), una misión y la barra de pestañas. Sale dos veces:
// al abrir la app (escena 3) y en el cierre, donde sube de nivel. Datos de ejemplo.
import type React from 'react';
import { Bell, CheckCircle2, Flag, Flame, Flower2, Gem, Search, Sparkles, Swords, type LucideIcon } from 'lucide-react';
import { COLORS, FONT, SPRING, ZONE, rgba, type ZoneId } from '../theme';
import { EASE, clamp, decay, lerp, ramp, springAt } from '../lib/anim';
import { IconChip } from '../components/ui';
import { NoutLifeMark, Wordmark } from '../components/Brand';
import { CardSlots, Kicker, ScreenBg, StatusBar, TabBar, fadeUp, liftCurve, type PopCard } from './kit';

/** Logo de la cabecera (px de pantalla): aquí aterriza el logo de la pantalla de arranque. */
export const HEADER_LOGO = { markHeight: 42, markLeft: 28, markTop: 107, wordmarkWidth: 132, wordmarkLeft: 82, wordmarkTop: 116 };

export const TILE_RECTS: Record<ZoneId, { x: number; y: number; w: number; h: number }> = {
  coliseo: { x: 20, y: 486, w: 253, h: 200 },
  ciclo: { x: 289, y: 486, w: 253, h: 200 },
  habitos: { x: 20, y: 702, w: 253, h: 200 },
  sabio: { x: 289, y: 702, w: 253, h: 200 },
};

const TILES: Record<ZoneId, { label: string; stat: string; icon: LucideIcon; pro?: boolean }> = {
  coliseo: { label: 'Coliseo', stat: '1RM 102,5 kg', icon: Swords, pro: true },
  ciclo: { label: 'Ciclo', stat: 'Día 14', icon: Flower2 },
  habitos: { label: 'Hábitos', stat: '4/4 hoy', icon: CheckCircle2 },
  sabio: { label: 'El Sabio', stat: '1 consejo', icon: Sparkles, pro: true },
};

const LevelCard: React.FC<{ frame: number; levelUpAt?: number }> = ({ frame, levelUpAt }) => {
  const up = levelUpAt !== undefined && frame >= levelUpAt;
  const fill =
    levelUpAt === undefined
      ? 0.72
      : up
        ? lerp(0, 0.12, ramp(frame, levelUpAt + 2, levelUpAt + 18, EASE.out))
        : lerp(0.72, 1, ramp(frame, levelUpAt - 16, levelUpAt, EASE.inOut));
  const pop = levelUpAt === undefined ? 0 : springAt(frame, levelUpAt, SPRING.pop);
  const flash = levelUpAt === undefined ? 0 : decay(frame, levelUpAt, 10);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 30,
        padding: '22px 26px',
        background: `linear-gradient(160deg, ${rgba(COLORS.gold, 0.12 + 0.25 * flash)}, transparent 75%), #131f19`,
        boxShadow: `inset 0 0 0 1.5px ${rgba(COLORS.gold, 0.3 + 0.6 * flash)}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
        <div>
          <Kicker>NIVEL</Kicker>
          <div
            style={{
              fontWeight: 800,
              fontSize: 58,
              lineHeight: 1,
              color: up ? COLORS.goldLight : COLORS.text,
              transform: `scale(${up ? 0.7 + 0.3 * pop : 1})`,
              transformOrigin: 'left bottom',
            }}
          >
            {up ? 13 : 12}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 21, color: COLORS.gold }}>+120 XP hoy</div>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, fontWeight: 600, fontSize: 19, color: COLORS.textMuted }}>
            {up ? (
              <span style={{ color: COLORS.goldLight }}>¡Subiste de nivel!</span>
            ) : (
              <>
                <Flame size={20} color={COLORS.gold} strokeWidth={2.2} />
                Racha de 12 días
              </>
            )}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 20, height: 15, borderRadius: 8, background: rgba(COLORS.text, 0.08), overflow: 'hidden' }}>
        <div
          style={{
            width: `${fill * 100}%`,
            height: '100%',
            borderRadius: 8,
            background: `linear-gradient(90deg, ${COLORS.goldDeep}, ${COLORS.gold} 60%, ${COLORS.goldLight})`,
            boxShadow: `0 0 14px ${rgba(COLORS.gold, 0.7)}`,
          }}
        />
      </div>
    </div>
  );
};

const Tile: React.FC<{ id: ZoneId }> = ({ id }) => {
  const t = TILES[id];
  const accent = ZONE[id].glow;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 30,
        background: `linear-gradient(160deg, ${rgba(accent, 0.22)} 0%, ${rgba('#0f1813', 0.96)} 72%)`,
        boxShadow: `inset 0 0 0 1.5px ${rgba(accent, 0.42)}`,
      }}
    >
      <div style={{ position: 'absolute', left: 20, top: 20 }}>
        <IconChip icon={t.icon} color={accent} size={60} />
      </div>
      {t.pro && (
        <div style={{ position: 'absolute', right: 18, top: 22, display: 'flex', alignItems: 'center', gap: 5, fontFamily: FONT.mono, fontWeight: 700, fontSize: 15, letterSpacing: '0.12em', color: COLORS.gold }}>
          <Gem size={16} strokeWidth={2.4} />
          PRO
        </div>
      )}
      <div style={{ position: 'absolute', left: 22, bottom: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 28, letterSpacing: '-0.01em' }}>{t.label}</div>
        <div style={{ marginTop: 4, fontFamily: FONT.mono, fontWeight: 600, fontSize: 18, color: COLORS.textMuted }}>{t.stat}</div>
      </div>
    </div>
  );
};

/**
 * La tarjeta de nivel. `at`: cuándo entra el inicio; con `levelUpAt` se levanta de la
 * pantalla justo antes de subir de nivel y se queda arriba, grande, hasta el final.
 */
export function homeCards(frame: number, at: number, levelUpAt?: number): PopCard[] {
  return [
    {
      key: 'level',
      rect: { x: 20, y: 296, w: 522, h: 168 },
      lift: levelUpAt === undefined ? 0 : liftCurve(frame, levelUpAt - 8, Number.POSITIVE_INFINITY),
      z: 260,
      shift: { x: 0, y: -24 },
      grow: 0.42,
      node: (
        <div style={{ ...fadeUp(frame, at + 5), position: 'absolute', inset: 0 }}>
          <LevelCard frame={frame} levelUpAt={levelUpAt} />
        </div>
      ),
    },
  ];
}

/**
 * `at`: cuándo entra el contenido (en cascada). `logo`: si la cabecera dibuja su logo
 * (al abrir la app lo trae la pantalla de arranque). `cards`: la tarjeta de nivel.
 */
export const HomeScreen: React.FC<{ frame: number; at: number; logo: boolean; cards: PopCard[] }> = ({ frame, at, logo, cards }) => (
  <ScreenBg>
    <StatusBar />
    <div style={{ ...fadeUp(frame, at, 10), position: 'absolute', inset: 0 }}>
      {logo && (
        <>
          <div style={{ position: 'absolute', left: HEADER_LOGO.markLeft, top: HEADER_LOGO.markTop }}>
            <NoutLifeMark height={HEADER_LOGO.markHeight} />
          </div>
          <div style={{ position: 'absolute', left: HEADER_LOGO.wordmarkLeft, top: HEADER_LOGO.wordmarkTop }}>
            <Wordmark width={HEADER_LOGO.wordmarkWidth} />
          </div>
        </>
      )}
      <div style={{ position: 'absolute', right: 26, top: 110, display: 'flex', gap: 22 }}>
        <Search size={32} color={COLORS.textSoft} strokeWidth={1.9} />
        <Bell size={32} color={COLORS.textSoft} strokeWidth={1.9} />
      </div>
    </div>
    <div style={{ ...fadeUp(frame, at + 3), position: 'absolute', left: 26, top: 188 }}>
      <Kicker>BUENOS DÍAS</Kicker>
      <div style={{ marginTop: 4, fontWeight: 800, fontSize: 54, letterSpacing: '-0.025em' }}>Hola, Ana</div>
    </div>
    <CardSlots cards={cards} />
    {(Object.keys(TILE_RECTS) as ZoneId[]).map((id, i) => {
      const r = TILE_RECTS[id];
      const p = springAt(frame, at + 7 + i * 2, SPRING.pop);
      return (
        <div
          key={id}
          style={{
            position: 'absolute',
            left: r.x,
            top: r.y,
            width: r.w,
            height: r.h,
            transform: `scale(${0.82 + 0.18 * p})`,
            opacity: clamp(p * 1.6),
          }}
        >
          <Tile id={id} />
        </div>
      );
    })}
    <div
      style={{
        ...fadeUp(frame, at + 14),
        position: 'absolute',
        left: 20,
        right: 20,
        top: 918,
        height: 84,
        borderRadius: 26,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '0 22px',
        background: rgba('#15221b', 0.92),
        boxShadow: `inset 0 0 0 1.5px ${rgba(COLORS.jade, 0.2)}`,
      }}
    >
      <Flag size={28} color={COLORS.jade} strokeWidth={2.2} />
      <span style={{ fontWeight: 600, fontSize: 23 }}>Camina 8.000 pasos</span>
      <span style={{ marginLeft: 'auto', fontFamily: FONT.mono, fontWeight: 700, fontSize: 21, color: COLORS.gold }}>+50 XP</span>
    </div>
    <div style={{ ...fadeUp(frame, at + 16), position: 'absolute', inset: 0 }}>
      <TabBar active="home" />
    </div>
  </ScreenBg>
);
