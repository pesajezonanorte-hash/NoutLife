// Ambiente del Coliseo: una sala de pesas de verdad detrás del contenido. Focos de
// techo que caen sobre la zona, suelo de caucho con sus motas, un árbol de discos
// en la pared y polvo de magnesio que flota despacio en la luz. Todo es decorativo
// (ZoneAmbience: aria-hidden, sin eventos, en pausa fuera de pantalla) y quieto con
// «Reducir movimiento».
import type { CSSProperties } from 'react';
import { Particles, useParticleBudget } from '@/components/ambience';

/** Árbol de discos con barra apoyada: silueta tenue en la pared. */
function PlateTree() {
  const plates: Array<[number, number, number]> = [[40, 52, 30], [40, 112, 36], [40, 176, 40], [124, 64, 26], [124, 124, 33], [124, 188, 38]];
  return (
    <svg viewBox="0 0 170 260" className="lq-gym-rack absolute -right-6 top-28 hidden w-56 sm:block md:-right-2 md:w-64" fill="none">
      <path d="M82 18V246M60 246H104M40 20V232M124 30V232" strokeWidth="6" strokeLinecap="round" />
      {plates.map(([cx, cy, r], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r={r} strokeWidth="5" />
          <circle cx={cx} cy={cy} r={r * 0.62} strokeWidth="2" />
          <circle cx={cx} cy={cy} r={4} className="lq-gym-rack-fill" />
        </g>
      ))}
      <path d="M8 240L162 196" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function GymBackdrop() {
  return (
    <>
      <span className="lq-gym-floor" />
      <span className="lq-gym-spot left-[4%]" style={{ '--a': 0.9 } as CSSProperties} />
      <span className="lq-gym-spot left-[52%] [animation-delay:-4s]" style={{ '--a': 0.7 } as CSSProperties} />
      <PlateTree />
    </>
  );
}

/** Magnesio en el aire: motas que derivan dentro del haz de los focos. */
export function ChalkDust() {
  const budget = useParticleBudget();
  return (
    <Particles
      kind="drift" count={budget(16)} seed={41} x={[6, 94]} y={[8, 70]} duration={[14, 24]} alpha={[0.18, 0.45]} size={[1.5, 3.2]}
      sx={[-22, 22]} sy={[-26, 14]}
      render={(s) => <span className="lq-chalk block rounded-full" style={{ width: s, height: s }} />}
    />
  );
}
