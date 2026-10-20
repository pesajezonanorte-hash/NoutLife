// 3. La brecha cognitiva. Paso 1: «consumir» (apagado) a la izquierda y «crear»
// (jade) a la derecha, unidos por una línea con un hueco en medio. Un punto sale
// de consumir, se detiene en el borde del hueco, duda y salta al otro lado: pasar
// de un lado al otro exige un esfuerzo. Debajo, la idea de Prensky. Paso 2: el cuadro
// comparativo, consumidor (apagado) frente a creador (jade), con sus rasgos como fichas.
import type React from 'react';
import { Smartphone, Workflow, type LucideIcon } from 'lucide-react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { GlassCard, IconChip } from '../components/GlassCard';
import { Lettering } from '../components/Lettering';
import { COLORS, rgba } from '../theme';
import { EASE, SPRING, clamp, lerp, ramp, rise, springAt } from '../lib';

export const BRECHA_STOPS = [300, 520];
const [S1] = BRECHA_STOPS;

export const BRECHA_NOTES = [
  [
    'Esta es la idea central del trabajo de grado: casi todos sabemos usar la tecnología, pero muy pocos sabemos crearla.',
    'Prensky nos llama «nativos digitales», pero haber nacido con la tecnología no enseña a construirla.',
    'En otros países los colegios enseñan programación desde temprano; en Colombia todavía es poco común.',
  ],
  [
    'El consumidor recibe y reacciona: el contenido llega solo y la recompensa es inmediata.',
    'Pensamiento crítico: crear obliga a evaluar qué funciona y qué no, en vez de aceptar lo que el algoritmo muestra.',
    'Lógica: dividir un problema grande en pasos pequeños y ordenarlos.',
    'Autonomía: decidir qué hacer con la tecnología, en vez de que ella decida por nosotros.',
    'Esto responde al objetivo específico 3: el impacto de crear en las habilidades cognitivas, creativas y de pensamiento crítico.',
  ],
];

/** La línea con el hueco: la izquierda (consumir) y la derecha (crear), en px del lienzo. */
const TRACK = { y: 520, from: 640, gapFrom: 880, gapTo: 1040, to: 1280 };

const Track: React.FC<{ frame: number }> = ({ frame }) => {
  const draw = ramp(frame, 70, 120, EASE.out);
  // El punto: avanza hasta el hueco, duda y salta
  const walk = ramp(frame, 130, 190, EASE.inOut);
  const hop = springAt(frame, 215, SPRING.pop);
  const x = hop > 0 ? lerp(TRACK.gapFrom - 14, TRACK.to, hop) : lerp(TRACK.from, TRACK.gapFrom - 14, walk);
  const arc = hop > 0 && hop < 1 ? Math.sin(Math.min(1, hop) * Math.PI) * 70 : 0;
  const wobble = walk >= 1 && hop === 0 ? Math.sin((frame - 190) / 2.2) * 4 * Math.max(0, 1 - (frame - 190) / 25) : 0;
  const arrived = clamp(hop);
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      <line x1={TRACK.from} y1={TRACK.y} x2={lerp(TRACK.from, TRACK.gapFrom, draw)} y2={TRACK.y} stroke={COLORS.faint} strokeWidth={6} strokeLinecap="round" />
      <line x1={TRACK.gapTo} y1={TRACK.y} x2={lerp(TRACK.gapTo, TRACK.to, draw)} y2={TRACK.y} stroke={COLORS.jade} strokeWidth={6} strokeLinecap="round" />
      {/* El borde del hueco: dos marcas cortas */}
      {[TRACK.gapFrom, TRACK.gapTo].map((gx) => (
        <line key={gx} x1={gx} y1={TRACK.y - 22} x2={gx} y2={TRACK.y + 22} stroke={rgba(COLORS.text, 0.25 * draw)} strokeWidth={3} strokeLinecap="round" />
      ))}
      {walk > 0 && (
        <circle
          cx={x + wobble}
          cy={TRACK.y - arc}
          r={18}
          fill={arrived > 0.5 ? COLORS.jade : COLORS.muted}
          style={{ filter: arrived > 0.5 ? `drop-shadow(0 0 ${14 * arrived}px ${rgba(COLORS.jade, 0.7)})` : undefined }}
        />
      )}
    </svg>
  );
};

const SIDES: Array<{ icon: LucideIcon; title: string; active: boolean; traits: string[] }> = [
  { icon: Smartphone, title: 'Consumidor', active: false, traits: ['Pasivo', 'Receptivo', 'Distracción', 'Recompensa inmediata'] },
  { icon: Workflow, title: 'Creador', active: true, traits: ['Activo', 'Lógico', 'Pensamiento crítico', 'Resolución de problemas'] },
];

export const Slide3Brecha: React.FC = () => {
  const frame = useCurrentFrame();
  const up = springAt(frame, S1 + 2, SPRING.glide);
  return (
    <AbsoluteFill>
      <h2 style={{ position: 'absolute', left: 140, top: 150, margin: 0, fontSize: 92, fontWeight: 400, color: COLORS.text }}>
        <Lettering text="la brecha" at={10} />
      </h2>

      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${lerp(0, -110, up)}px)` }}>
        <Track frame={frame} />
        <div style={{ position: 'absolute', right: 1920 - TRACK.from + 50, top: TRACK.y - 56, fontSize: 76, color: COLORS.faint }}>
          <Lettering text="consumir" at={30} />
        </div>
        <div style={{ position: 'absolute', left: TRACK.to + 50, top: TRACK.y - 56, fontSize: 76, color: COLORS.jade }}>
          <Lettering text="crear" at={50} />
        </div>
        <div style={{ ...rise(frame, 240, 12), position: 'absolute', left: 0, right: 0, top: TRACK.y + 70, textAlign: 'center' }}>
          <div style={{ fontSize: 36, fontWeight: 600, color: COLORS.text }}>«Usar tecnología no garantiza entenderla ni aprovecharla críticamente».</div>
          <div style={{ marginTop: 10, fontSize: 22, color: COLORS.muted }}>Marc Prensky, sobre los nativos digitales (idea resumida)</div>
        </div>
      </div>

      {/* Paso 2: el cuadro comparativo */}
      <div style={{ position: 'absolute', left: 140, right: 140, top: 640, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 36 }}>
        {SIDES.map((side, i) => (
          <GlassCard key={side.title} at={S1 + 14 + i * 16} glow={side.active ? 0.6 : 0} padding="36px 40px">
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <IconChip icon={side.icon} color={side.active ? COLORS.jade : COLORS.muted} size={64} />
              <span style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.02em', color: side.active ? COLORS.text : COLORS.onSurface }}>{side.title}</span>
            </div>
            <div style={{ marginTop: 26, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {side.traits.map((t, k) => {
                const p = springAt(frame, S1 + 30 + i * 16 + k * 7, SPRING.pop);
                return (
                  <span
                    key={t}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 99,
                      fontSize: 24,
                      fontWeight: 600,
                      color: side.active ? COLORS.jade300 : COLORS.muted,
                      background: side.active ? rgba(COLORS.jade, 0.14) : rgba(COLORS.text, 0.06),
                      opacity: clamp(p * 2),
                      transform: `scale(${0.7 + 0.3 * p})`,
                    }}
                  >
                    {t}
                  </span>
                );
              })}
            </div>
          </GlassCard>
        ))}
      </div>
    </AbsoluteFill>
  );
};
