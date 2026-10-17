// Teléfono de la escena 4 con el inicio de NoutLife: nivel con barra de XP champán,
// las cuatro zonas del vídeo, una misión y la barra de pestañas. La pantalla se
// enciende con el nodo de la escena 3 y cada baldosa aparece cuando su tarjeta
// llega volando. A los ~19 s sube de nivel.
import type React from 'react';
import {
  BatteryFull,
  CheckCircle2,
  Dumbbell,
  Flag,
  Flower2,
  Home,
  Signal,
  Sparkles,
  Swords,
  User,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import { COLORS, CYCLE, FONT, SPRING, rgba } from '../theme';
import { EASE, clamp, lerp, ramp, springAt } from '../lib/anim';
import { NoutLifeMark, Wordmark } from './Brand';
import { IconChip } from './ui';
import { PHONE, PHONE_TILES, SCREEN } from '../layout';
import { CTA, ECOSYSTEM, type CardId } from '../timeline';

const TILES: Record<CardId, { label: string; stat: string; icon: LucideIcon; color: string; at: number }> = {
  coliseo: { label: 'Coliseo', stat: 'Pecho 82 %', icon: Dumbbell, color: COLORS.jade, at: ECOSYSTEM.gather + 18 },
  ciclo: { label: 'Ciclo', stat: 'Día 14', icon: Flower2, color: CYCLE.menstrual, at: ECOSYSTEM.gather + 20 },
  habitos: { label: 'Hábitos', stat: '4/4 hoy', icon: CheckCircle2, color: COLORS.success, at: ECOSYSTEM.gather + 22 },
  sabio: { label: 'El Sabio', stat: '1 consejo', icon: Sparkles, color: COLORS.gold, at: ECOSYSTEM.gather + 24 },
};

/** Aparición suave de un bloque de la pantalla. */
const fadeUp = (frame: number, at: number) => {
  const p = springAt(frame, at, SPRING.smooth, 14);
  return { opacity: p, transform: `translateY(${(1 - p) * 18}px)` } satisfies React.CSSProperties;
};

export const PhoneMockup: React.FC<{ frame: number }> = ({ frame }) => {
  const power = ramp(frame, CTA.phoneIn, CTA.phoneIn + 16, EASE.out);
  const xpFill = frame < CTA.levelUp ? lerp(0.62, 1, ramp(frame, CTA.levelUp - 16, CTA.levelUp, EASE.inOut)) : lerp(0, 0.1, ramp(frame, CTA.levelUp + 2, CTA.levelUp + 18, EASE.out));
  const levelPop = springAt(frame, CTA.levelUp, SPRING.snappy);
  const levelFlash = ramp(frame, CTA.levelUp, CTA.levelUp + 4) * (1 - ramp(frame, CTA.levelUp + 6, CTA.levelUp + 26));
  const level = frame < CTA.levelUp ? 12 : 13;
  return (
    <div
      style={{
        position: 'relative',
        width: PHONE.w,
        height: PHONE.h,
        borderRadius: PHONE.radius,
        background: 'linear-gradient(150deg, #22332a 0%, #0c1510 38%, #050907 100%)',
        boxShadow: [
          `inset 0 0 0 2px ${rgba(COLORS.jade, 0.28)}`,
          'inset 0 0 0 5px rgba(0, 0, 0, 0.55)',
          `0 0 90px ${rgba(COLORS.jade, 0.2)}`,
          '0 50px 120px rgba(0, 0, 0, 0.65)',
        ].join(', '),
      }}
    >
      {/* Botones laterales */}
      <div style={{ position: 'absolute', left: -4, top: 210, width: 5, height: 70, borderRadius: 3, background: '#1b2a22' }} />
      <div style={{ position: 'absolute', left: -4, top: 300, width: 5, height: 110, borderRadius: 3, background: '#1b2a22' }} />
      <div style={{ position: 'absolute', right: -4, top: 260, width: 5, height: 150, borderRadius: 3, background: '#1b2a22' }} />

      <div
        style={{
          position: 'absolute',
          left: PHONE.bezel,
          top: PHONE.bezel,
          width: SCREEN.w,
          height: SCREEN.h,
          borderRadius: PHONE.radius - PHONE.bezel,
          overflow: 'hidden',
          background: `radial-gradient(120% 60% at 20% 0%, ${rgba(COLORS.jade700, 0.4)} 0%, transparent 60%), ${COLORS.bg}`,
        }}
      >
        {/* Se enciende */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at 50% 50%, ${rgba(COLORS.jade300, 0.55)} 0%, ${rgba(COLORS.jade, 0.15)} 45%, transparent 75%)`,
            opacity: (1 - power) * clamp(power * 6),
          }}
        />

        <div style={{ position: 'absolute', left: (SCREEN.w - 126) / 2, top: 14, width: 126, height: 36, borderRadius: 18, background: '#000' }} />
        <div style={{ ...fadeUp(frame, 546), position: 'absolute', left: 34, right: 30, top: 18, height: 36, display: 'flex', alignItems: 'center' }}>
          <span style={{ fontFamily: FONT.mono, fontWeight: 600, fontSize: 21, color: COLORS.text }}>9:41</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <Signal size={20} color={COLORS.text} strokeWidth={2.4} />
            <Wifi size={20} color={COLORS.text} strokeWidth={2.4} />
            <BatteryFull size={24} color={COLORS.text} strokeWidth={2} />
          </span>
        </div>

        {/* Cabecera */}
        <div style={{ ...fadeUp(frame, 547), position: 'absolute', left: 24, right: 22, top: 72, height: 50, display: 'flex', alignItems: 'center', gap: 12 }}>
          <NoutLifeMark height={40} />
          <Wordmark width={124} style={{ marginTop: 6 }} />
          <div
            style={{
              marginLeft: 'auto',
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: `linear-gradient(150deg, ${COLORS.jade300}, ${COLORS.jade600})`,
              boxShadow: `0 0 0 3px ${COLORS.bg}, 0 0 0 5.5px ${COLORS.gold}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: FONT.sans,
              fontWeight: 800,
              fontSize: 22,
              color: COLORS.jade900,
            }}
          >
            A
          </div>
        </div>

        <div style={{ ...fadeUp(frame, 549), position: 'absolute', left: 26, top: 140 }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 15, fontWeight: 600, letterSpacing: '0.2em', color: COLORS.textMuted }}>BUENOS DÍAS</div>
          <div style={{ marginTop: 4, fontFamily: FONT.sans, fontWeight: 800, fontSize: 42, letterSpacing: '-0.02em', color: COLORS.text }}>Hola, Ana</div>
        </div>

        {/* Nivel y XP */}
        <div
          style={{
            ...fadeUp(frame, 551),
            position: 'absolute',
            left: 18,
            right: 18,
            top: 238,
            height: 148,
            borderRadius: 28,
            padding: '20px 24px',
            background: `linear-gradient(160deg, ${rgba(COLORS.gold, 0.1 + 0.2 * levelFlash)}, ${rgba('#15221b', 0.95)})`,
            boxShadow: `inset 0 0 0 1.5px ${rgba(COLORS.gold, 0.25 + 0.5 * levelFlash)}, 0 0 ${40 * levelFlash}px ${rgba(COLORS.gold, 0.5 * levelFlash)}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontFamily: FONT.mono, fontSize: 15, fontWeight: 600, letterSpacing: '0.2em', color: COLORS.textMuted }}>NIVEL</div>
              <div
                style={{
                  fontFamily: FONT.sans,
                  fontWeight: 800,
                  fontSize: 50,
                  lineHeight: 1,
                  color: frame >= CTA.levelUp ? COLORS.goldLight : COLORS.text,
                  transform: `scale(${frame >= CTA.levelUp ? 0.7 + 0.3 * levelPop : 1})`,
                  transformOrigin: 'left bottom',
                }}
              >
                {level}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 19, color: COLORS.gold }}>+120 XP hoy</div>
              <div style={{ marginTop: 4, fontFamily: FONT.sans, fontWeight: 600, fontSize: 17, color: COLORS.textMuted }}>
                {frame >= CTA.levelUp ? '¡Subiste de nivel!' : 'Racha de 12 días'}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 18, height: 14, borderRadius: 7, background: rgba(COLORS.text, 0.08), overflow: 'hidden' }}>
            <div
              style={{
                width: `${xpFill * 100}%`,
                height: '100%',
                borderRadius: 7,
                background: `linear-gradient(90deg, ${COLORS.goldDeep}, ${COLORS.gold} 60%, ${COLORS.goldLight})`,
                boxShadow: `0 0 12px ${rgba(COLORS.gold, 0.7)}`,
              }}
            />
          </div>
        </div>

        {/* Zonas */}
        {(Object.keys(PHONE_TILES) as CardId[]).map((id) => {
          const t = PHONE_TILES[id];
          const tile = TILES[id];
          const p = springAt(frame, tile.at, SPRING.snappy);
          return (
            <div
              key={id}
              style={{
                position: 'absolute',
                left: t.x,
                top: t.y,
                width: t.w,
                height: t.h,
                borderRadius: 28,
                background: `linear-gradient(160deg, ${rgba(tile.color, 0.16)}, ${rgba('#0d1611', 0.95)} 70%)`,
                boxShadow: `inset 0 0 0 1.5px ${rgba(tile.color, 0.32)}`,
                transform: `scale(${0.8 + 0.2 * p})`,
                opacity: clamp(p * 1.5),
              }}
            >
              <div style={{ position: 'absolute', left: 18, top: 18 }}>
                <IconChip icon={tile.icon} color={tile.color} size={52} />
              </div>
              <div style={{ position: 'absolute', left: 20, bottom: 18 }}>
                <div style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 25, color: COLORS.text }}>{tile.label}</div>
                <div style={{ marginTop: 3, fontFamily: FONT.mono, fontWeight: 600, fontSize: 17, color: COLORS.textMuted }}>{tile.stat}</div>
              </div>
            </div>
          );
        })}

        {/* Misión */}
        <div
          style={{
            ...fadeUp(frame, 560),
            position: 'absolute',
            left: 18,
            right: 18,
            top: 768,
            height: 80,
            borderRadius: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '0 20px',
            background: rgba('#15221b', 0.9),
            boxShadow: `inset 0 0 0 1.5px ${rgba(COLORS.jade, 0.18)}`,
          }}
        >
          <Flag size={26} color={COLORS.jade} strokeWidth={2.2} />
          <span style={{ fontFamily: FONT.sans, fontWeight: 600, fontSize: 22, color: COLORS.text }}>Camina 8.000 pasos</span>
          <span style={{ marginLeft: 'auto', fontFamily: FONT.mono, fontWeight: 700, fontSize: 19, color: COLORS.gold }}>+50 XP</span>
        </div>

        {/* Pestañas */}
        <div
          style={{
            ...fadeUp(frame, 562),
            position: 'absolute',
            left: 14,
            right: 14,
            top: 868,
            height: 88,
            borderRadius: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            background: rgba('#0f1a14', 0.95),
            boxShadow: `inset 0 0 0 1.5px ${rgba(COLORS.jade, 0.14)}`,
          }}
        >
          {[Home, Swords, CheckCircle2, Sparkles, User].map((Icon, i) => (
            <div
              key={i}
              style={{
                width: 64,
                height: 52,
                borderRadius: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: i === 0 ? rgba(COLORS.jade, 0.18) : 'transparent',
              }}
            >
              <Icon size={28} color={i === 0 ? COLORS.jade300 : COLORS.textMuted} strokeWidth={2.2} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
