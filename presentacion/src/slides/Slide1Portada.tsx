// 1. Portada y marco de investigación. Paso 1: el título formal del trabajo de grado
// y el de la charla («De consumidores» apagado, «a creadores» encendido letra por
// letra). A la derecha, la tesis en imagen: un feed que no se acaba nunca y, encima,
// un editor donde se escribe código; el feed se apaga cuando aparece el código.
// Paso 2: la pregunta de investigación con sus tres dimensiones; la columna sube
// para hacerle sitio.
import type React from 'react';
import { Brain, Check, GraduationCap, Heart, Infinity as InfinityIcon, MessageCircle, Rocket, Users, type LucideIcon } from 'lucide-react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { AnimatedText } from '../components/AnimatedText';
import { GlassCard } from '../components/GlassCard';
import { COLORS, FONT, rgba } from '../theme';
import { SPRING, clamp, lerp, ramp, springAt, thousands } from '../lib';

export const PORTADA_STOPS = [320, 500];

const FEED_AT = 40;
const EDITOR_AT = 120;
const TYPE_FROM = 150;
const CPS = 1.5;

// ---------- Feed infinito ----------

const POST_H = 250;
const HUES = [
  ['#f472b6', '#7c3aed'],
  ['#38bdf8', '#1e3a8a'],
  ['#fb923c', '#be123c'],
  ['#a3e635', '#0f766e'],
];

const Post: React.FC<{ i: number }> = ({ i }) => {
  const [c1, c2] = HUES[i % HUES.length];
  return (
    <div style={{ height: POST_H, padding: '14px 18px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 14, background: `linear-gradient(135deg, ${c1}, ${c2})` }} />
        <div style={{ width: 110, height: 9, borderRadius: 5, background: rgba(COLORS.soft, 0.25) }} />
      </div>
      <div style={{ height: 150, borderRadius: 16, background: `linear-gradient(140deg, ${c1}, ${c2})`, opacity: 0.75 }} />
      <div style={{ display: 'flex', gap: 14, marginTop: 12, color: COLORS.soft }}>
        <Heart size={20} fill={i % 3 === 0 ? COLORS.rose : 'none'} color={i % 3 === 0 ? COLORS.rose : COLORS.soft} />
        <MessageCircle size={20} />
        <div style={{ marginLeft: 'auto', width: 60, height: 9, marginTop: 6, borderRadius: 5, background: rgba(COLORS.soft, 0.2) }} />
      </div>
    </div>
  );
};

const Feed: React.FC<{ frame: number }> = ({ frame }) => {
  // El scroll acelera al principio y luego no para: 9 px por fotograma
  const scrolled = Math.max(0, frame - FEED_AT) * 9;
  const offset = scrolled % (POST_H * 4);
  const dim = ramp(frame, EDITOR_AT, EDITOR_AT + 50);
  return (
    <GlassCard
      at={FEED_AT}
      tint={COLORS.rose}
      radius={34}
      padding={0}
      style={{
        position: 'absolute',
        left: 1160,
        top: 150,
        width: 310,
        height: 640,
        overflow: 'hidden',
        filter: `saturate(${1 - 0.7 * dim}) brightness(${1 - 0.35 * dim})`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '64px 0 0 0',
          overflow: 'hidden',
          maskImage: 'linear-gradient(180deg, transparent, #000 12%, #000 80%, transparent)',
        }}
      >
        <div style={{ transform: `translateY(${-offset}px)` }}>
          {Array.from({ length: 8 }, (_, i) => (
            <Post key={i} i={i} />
          ))}
        </div>
      </div>
      <div style={{ position: 'absolute', top: 18, left: 20, right: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
        <InfinityIcon size={26} color={COLORS.rose} />
        <span style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>Scroll infinito</span>
        <span style={{ marginLeft: 'auto', fontFamily: FONT.mono, fontSize: 15, color: COLORS.muted }}>{thousands(scrolled / POST_H)} videos</span>
      </div>
    </GlassCard>
  );
};

// ---------- Editor ----------

type Seg = [string, string];
const KW = '#C4B5FD';
const FN = '#93C5FD';
const ID = COLORS.text;
const PUNCT = COLORS.muted;
const TAG = COLORS.jade;
const ATTR = '#F9A8D4';
const BOOL = COLORS.amber;

const CODE: Seg[][] = [
  [['export function ', KW], ['Habito', FN], ['({ ', PUNCT], ['nombre', ID], [' }) {', PUNCT]],
  [['  const ', KW], ['[hecho, setHecho]', ID], [' = ', PUNCT], ['useState', FN], ['(', PUNCT], ['false', BOOL], [');', PUNCT]],
  [['  return ', KW], ['(', PUNCT]],
  [['    <', PUNCT], ['Check', TAG], [' activo', ATTR], ['={', PUNCT], ['hecho', ID], ['}', PUNCT]],
  [['      onClick', ATTR], ['={() => ', PUNCT], ['setHecho', FN], ['(', PUNCT], ['true', BOOL], [')} />', PUNCT]],
  [['  );', PUNCT]],
  [['}', PUNCT]],
];
const TOTAL = CODE.flat().reduce((n, [s]) => n + s.length, 0);

const Editor: React.FC<{ frame: number }> = ({ frame }) => {
  let budget = Math.floor(Math.max(0, frame - TYPE_FROM) * CPS);
  const typedAll = budget >= TOTAL;
  const doneAt = TYPE_FROM + TOTAL / CPS;
  const built = springAt(frame, doneAt + 6, SPRING.pop);
  const shipped = springAt(frame, doneAt + 34, SPRING.pop);
  return (
    <GlassCard
      at={EDITOR_AT}
      tint={COLORS.violet}
      glow={clamp(built)}
      radius={26}
      padding={0}
      style={{ position: 'absolute', left: 1300, top: 430, width: 500, background: rgba('#0b1222', 0.72) }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px', borderBottom: `1px solid ${rgba('#ffffff', 0.08)}` }}>
        {['#f87171', '#fbbf24', '#4ade80'].map((c) => (
          <span key={c} style={{ width: 11, height: 11, borderRadius: 6, background: c, opacity: 0.8 }} />
        ))}
        <span style={{ marginLeft: 12, fontFamily: FONT.mono, fontSize: 15, color: COLORS.soft }}>Habito.jsx</span>
      </div>
      <div style={{ padding: '18px 22px 8px', fontFamily: FONT.mono, fontSize: 16.5, lineHeight: 1.75, whiteSpace: 'pre', minHeight: 7 * 30 }}>
        {CODE.map((line, l) => {
          if (budget <= 0 && l > 0) return null;
          const out = line.map(([s, color], k) => {
            const shown = s.slice(0, Math.max(0, budget));
            budget -= s.length;
            return shown ? (
              <span key={k} style={{ color }}>
                {shown}
              </span>
            ) : null;
          });
          const cursorHere = !typedAll && budget <= 0;
          return (
            <div key={l}>
              {out}
              {cursorHere && <span style={{ color: COLORS.violet, opacity: Math.floor(frame / 18) % 2 ? 0.2 : 1 }}>▍</span>}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, padding: '6px 20px 18px', height: 34 }}>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 99,
            fontSize: 15,
            fontWeight: 600,
            color: COLORS.jade,
            background: rgba(COLORS.jade, 0.12),
            opacity: clamp(built * 2),
            transform: `scale(${0.7 + 0.3 * built})`,
          }}
        >
          <Check size={16} strokeWidth={2.6} />
          Compilado
        </span>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 99,
            fontSize: 15,
            fontWeight: 600,
            color: COLORS.text,
            background: rgba(COLORS.violet, 0.2),
            opacity: clamp(shipped * 2),
            transform: `scale(${0.7 + 0.3 * shipped})`,
          }}
        >
          <Rocket size={16} />
          Publicado en noutlife.vercel.app
        </span>
      </div>
    </GlassCard>
  );
};


// ---------- Diapositiva ----------

const TITLE =
  'Influencia del Uso y la Creación de Herramientas Digitales en el Desarrollo Académico y Cognitivo de los Estudiantes del Colegio Jorge Isaacs';
const QUESTION =
  '¿De qué manera influye el uso y la creación de herramientas digitales en el desarrollo académico, cognitivo y social de los estudiantes?';
const DIMENSIONS: Array<[LucideIcon, string, string]> = [
  [GraduationCap, 'Académico', COLORS.amber],
  [Brain, 'Cognitivo', COLORS.violet],
  [Users, 'Social', COLORS.rose],
];
/** Alto de la tarjeta de la pregunta (con su margen): la columna sube la mitad al entrar. */
const QUESTION_H = 250;

export const Slide1Portada: React.FC = () => {
  const frame = useCurrentFrame();
  const card = springAt(frame, 150, SPRING.card);
  const ask = springAt(frame, PORTADA_STOPS[0] + 1, SPRING.glide);
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 120,
          top: 0,
          bottom: 0,
          width: 980,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          transform: `translateY(${((1 - ask) * QUESTION_H) / 2}px)`,
        }}
      >
        <GlassCard
          at={150}
          radius={22}
          padding="14px 22px"
          style={{ display: 'flex', alignItems: 'center', gap: 16, alignSelf: 'flex-start', marginBottom: 40 }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              display: 'grid',
              placeItems: 'center',
              fontWeight: 800,
              fontSize: 17,
              background: `linear-gradient(135deg, ${COLORS.indigoDeep}, ${COLORS.violetDeep})`,
              transform: `rotate(${lerp(-90, 0, card)}deg)`,
            }}
          >
            MR
          </div>
          <div>
            <div style={{ fontSize: 21, fontWeight: 700 }}>Miguel Ángel Romero Torres</div>
            <div style={{ display: 'flex', gap: 16, fontSize: 16, color: COLORS.muted }}>
              <span style={{ color: COLORS.indigo, fontWeight: 600 }}>Investigación de grado 11°</span>
              <span>Asesor: Rubén Darío Ospino Mestra</span>
            </div>
          </div>
        </GlassCard>
        <h1 style={{ margin: 0, fontSize: 50, fontWeight: 800, lineHeight: 1.14, letterSpacing: '-0.025em', textWrap: 'balance' }}>
          <AnimatedText text={TITLE} at={10} stagger={3} />
        </h1>
        <div style={{ marginTop: 26, fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em' }}>
          <AnimatedText text="De consumidores" at={80} stagger={6} style={{ color: COLORS.faint }} />{' '}
          <AnimatedText text="a creadores" at={100} by="letter" stagger={2.4} style={{ color: COLORS.indigo }} />
        </div>
        <div style={{ height: QUESTION_H, paddingTop: 36, boxSizing: 'border-box' }}>
          <GlassCard at={PORTADA_STOPS[0] + 6} tint={COLORS.indigo} glow={0.55} padding="24px 30px">
            <div style={{ fontSize: 19, fontWeight: 600, color: COLORS.indigo }}>Pregunta de investigación</div>
            <div style={{ marginTop: 8, fontSize: 26, fontWeight: 600, lineHeight: 1.4, textWrap: 'pretty' }}>{QUESTION}</div>
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              {DIMENSIONS.map(([Icon, label, color], i) => {
                const p = springAt(frame, PORTADA_STOPS[0] + 40 + i * 9, SPRING.pop);
                return (
                  <span
                    key={label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 16px',
                      borderRadius: 99,
                      fontSize: 19,
                      fontWeight: 600,
                      color,
                      background: rgba(color, 0.12),
                      boxShadow: `inset 0 0 0 1px ${rgba(color, 0.4)}`,
                      opacity: clamp(p * 2),
                      transform: `scale(${0.6 + 0.4 * p})`,
                    }}
                  >
                    <Icon size={18} />
                    {label}
                  </span>
                );
              })}
            </div>
          </GlassCard>
        </div>
      </div>
      <Feed frame={frame} />
      <Editor frame={frame} />
    </AbsoluteFill>
  );
};
