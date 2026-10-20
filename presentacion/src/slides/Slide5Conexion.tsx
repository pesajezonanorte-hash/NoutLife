// 5. Transición y conexión. Empieza en un corte invisible: el primer fotograma es el
// último de la diapositiva 4 (la columna de texto congelada con <Freeze> y el
// teléfono en la misma pose, con el mismo vaivén y la misma pantalla de Hábitos).
// Luego la columna se retira, el teléfono se bloquea (la pantalla se apaga y sale
// la pantalla de bloqueo), va al centro, se endereza y baja a un bolsillo que sube
// desde abajo; el bolsillo se va con él. Entonces llega el mensaje: si un
// estudiante pudo crear NoutLife, tú también. Paso 2: dónde están las
// oportunidades (el salón, la casa, el barrio).
import type React from 'react';
import { Home, MapPin, School, type LucideIcon } from 'lucide-react';
import { AbsoluteFill, Freeze, useCurrentFrame } from 'remotion';
import { NoutLifeMark, Wordmark } from '../components/Brand';
import { GlassCard, IconChip } from '../components/GlassCard';
import { Lettering } from '../components/Lettering';
import { PhoneMockup } from '../components/PhoneMockup';
import { HabitosScreen } from '../screens/AppScreens';
import { COLORS, FONT, rgba } from '../theme';
import { SPRING, lerp, leave, ramp, rise, springAt } from '../lib';
import { HABITS_AT, NOUTLIFE_STOPS, PHONE_POSE, Slide4NoutLife } from './Slide4NoutLife';

export const CONEXION_STOPS = [330, 560];
const [S0] = CONEXION_STOPS;

export const CONEXION_NOTES = [
  [
    'Guarda el teléfono: la app es solo el ejemplo; lo importante es el proceso de crear.',
    'Si un estudiante de grado 11° pudo crear una herramienta así, cualquiera en este salón puede empezar.',
  ],
  [
    'Los problemas para resolver están cerca: en el salón, en la casa, en el barrio.',
    'Crear no exige programar desde el primer día: se puede empezar con una hoja de cálculo, un formulario o un prototipo en papel.',
    'El contexto existe: la Ley 1341 de 2009 promueve las TIC, también en educación, y Computadores para Educar lleva equipos a colegios públicos. Falta dar el paso.',
  ],
];

/** Último fotograma que muestra la diapositiva 4: aquí se continúa sin que se note el corte. */
const FROM = NOUTLIFE_STOPS[NOUTLIFE_STOPS.length - 1] + 1;
const PHONE_H = (872 / 418) * PHONE_POSE.width;
const PHONE_CENTER = { x: PHONE_POSE.left + PHONE_POSE.width / 2, y: PHONE_POSE.top + PHONE_H / 2 };

/** Pantalla de bloqueo: hora, fecha y la marca. */
const LockScreen: React.FC = () => (
  <div style={{ position: 'absolute', inset: 0, background: COLORS.bgDeep, color: COLORS.text, fontFamily: FONT.sans, textAlign: 'center' }}>
    <div style={{ marginTop: 120, fontSize: 19, fontWeight: 600, color: COLORS.onSurface }}>Martes 13</div>
    <div style={{ fontSize: 96, fontWeight: 300, letterSpacing: '-0.03em', lineHeight: 1 }}>9:41</div>
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 70, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, opacity: 0.8 }}>
      <NoutLifeMark height={26} />
      <Wordmark height={18} />
    </div>
  </div>
);

const PLACES: Array<{ icon: LucideIcon; title: string }> = [
  { icon: School, title: 'En el salón' },
  { icon: Home, title: 'En la casa' },
  { icon: MapPin, title: 'En el barrio' },
];

export const Slide5Conexion: React.FC = () => {
  const frame = useCurrentFrame();
  // Bloquear: la pantalla se apaga y aparece la de bloqueo
  const off = ramp(frame, 14, 24);
  const lock = ramp(frame, 26, 44);
  // Al centro y derecho; luego al bolsillo
  const center = springAt(frame, 40, SPRING.phone);
  const drop = springAt(frame, 112, { stiffness: 80, damping: 17, mass: 1 });
  const pocketIn = springAt(frame, 70, SPRING.card);
  const pocketOut = springAt(frame, 165, SPRING.smooth);
  const pocketTop = lerp(1180, 850, pocketIn) + 460 * pocketOut;
  const dx = lerp(0, 960 - PHONE_CENTER.x, center);
  const dy = lerp(0, 540 - PHONE_CENTER.y, center) + 1050 * drop;
  const up = springAt(frame, S0 + 2, SPRING.glide);

  return (
    <AbsoluteFill>
      {/* La columna de texto de la diapositiva 4, quieta, se retira */}
      <div style={{ ...leave(frame, 8, 26), position: 'absolute', inset: 0 }}>
        <Freeze frame={FROM - 1}>
          <Slide4NoutLife phone={false} />
        </Freeze>
      </div>

      {drop < 0.999 && (
        <div
          style={{
            position: 'absolute',
            left: PHONE_POSE.left,
            top: PHONE_POSE.top,
            transform: `translate(${dx}px, ${dy}px) rotate(${4 * drop}deg) scale(${lerp(1, 0.9, center)})`,
          }}
        >
          <PhoneMockup width={PHONE_POSE.width} tilt={lerp(PHONE_POSE.tilt, 0, center)} clock={FROM + frame}>
            <HabitosScreen t={FROM - HABITS_AT + frame} />
            <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: off * (1 - lock) }} />
            {lock > 0 && (
              <div style={{ position: 'absolute', inset: 0, opacity: lock }}>
                <LockScreen />
              </div>
            )}
          </PhoneMockup>
        </div>
      )}

      {/* El bolsillo: sube, recibe el teléfono y se va con él */}
      {pocketIn > 0 && pocketOut < 0.999 && (
        <div
          style={{
            position: 'absolute',
            left: 960 - 330,
            width: 660,
            top: pocketTop,
            height: 520,
            borderRadius: '56px 56px 0 0',
            background: COLORS.surface,
            boxShadow: `inset 0 1px 0 ${rgba('#ffffff', 0.06)}, inset 0 0 0 1px ${COLORS.border}`,
          }}
        >
          <div style={{ position: 'absolute', inset: '18px 18px 0', borderRadius: '42px 42px 0 0', border: `2px dashed ${rgba(COLORS.jade, 0.35)}`, borderBottom: 'none' }} />
        </div>
      )}

      {/* El mensaje */}
      <div
        style={{
          position: 'absolute',
          left: 160,
          right: 160,
          top: 330,
          textAlign: 'center',
          fontSize: 80,
          lineHeight: 1.15,
          transform: `translateY(${lerp(0, -120, up)}px) scale(${lerp(1, 0.86, up)})`,
        }}
      >
        <Lettering text="si un estudiante pudo crear noutlife," at={190} style={{ color: COLORS.faint, display: 'block' }} />
        <Lettering text="tú también puedes crear" at={230} style={{ color: COLORS.jade, display: 'block' }} />
        <div style={{ ...rise(frame, 290, 12), marginTop: 30, fontFamily: FONT.sans, fontSize: 32, fontWeight: 500, lineHeight: 1.4, color: COLORS.muted }}>
          De la experiencia individual al impacto colectivo en el aula.
        </div>
      </div>

      {/* Paso 2: dónde están las oportunidades */}
      <div style={{ position: 'absolute', left: 140, right: 140, top: 600, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 36 }}>
        {PLACES.map((p, i) => (
          <GlassCard key={p.title} at={S0 + 16 + i * 14} padding="40px 44px" style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
            <IconChip icon={p.icon} size={76} />
            <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em' }}>{p.title}</span>
          </GlassCard>
        ))}
      </div>
      <div style={{ ...rise(frame, S0 + 70, 12), position: 'absolute', left: 0, right: 0, top: 800, textAlign: 'center', fontSize: 30, color: COLORS.muted }}>
        Ahí están tus oportunidades para crear.
      </div>
    </AbsoluteFill>
  );
};
