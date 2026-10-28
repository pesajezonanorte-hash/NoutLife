// El oro champán de lo que es Pro («Pro» del gancho y «PRO.» de la oferta): un degradado
// vertical, más claro arriba y más hondo en la línea base, como metal cepillado.
// `amount` lo mezcla con el blanco del texto (0 = blanco, 1 = oro).
import type React from 'react';
import { interpolateColors } from 'remotion';
import { usePalette } from '../palette';

export const ChampagneGradient: React.FC<{ id: string; capHeight: number; amount?: number }> = ({ id, capHeight, amount = 1 }) => {
  const palette = usePalette();
  const tone = (gold: string) => interpolateColors(amount, [0, 1], [palette.ink, gold]);
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={0} y1={-capHeight} x2={0} y2={capHeight * 0.25}>
      <stop offset="0" stopColor={tone(palette.goldLight)} />
      <stop offset="0.6" stopColor={tone(palette.gold)} />
      <stop offset="1" stopColor={tone(palette.goldDeep)} />
    </linearGradient>
  );
};
