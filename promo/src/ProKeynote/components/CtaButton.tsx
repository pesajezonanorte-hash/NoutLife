// El botón final: píldora jade, plana, con una luz fina en el canto de arriba, el isotipo
// en el color del texto (monocromo, discreto) y «Empieza ahora».
import type React from 'react';
import { rgba } from '../../Video/theme';
import { MARK_SIZE, NoutLifeMark } from '../../Video/components/Brand';
import { usePalette } from '../palette';
import { COPY } from '../copy';
import { OutlineText, measureLine } from '../type/OutlineText';

const TEXT_SIZE = 36;
const MARK_H = 34;
const GAP = 16;

export const CtaButton: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const palette = usePalette();
  const line = COPY.offer.button[0];
  const textW = measureLine(line, TEXT_SIZE);
  const markW = (MARK_H * MARK_SIZE.w) / MARK_SIZE.h;
  const left = (width - (markW + GAP + textW)) / 2;
  const mono = { color: palette.onJade, amount: 1 };
  return (
    <div style={{ position: 'relative', width, height }}>
      {/* Halo muy suave debajo (degradado, no box-shadow) */}
      <div
        style={{
          position: 'absolute',
          left: width * 0.08,
          right: width * 0.08,
          top: height * 0.35,
          bottom: -height * 0.45,
          borderRadius: '50%',
          background: `radial-gradient(closest-side, ${rgba(palette.jade, 0.22)} 0%, transparent 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: height / 2,
          background: `linear-gradient(180deg, ${palette.jadeBright} 0%, ${palette.jade} 55%, ${palette.jade} 100%)`,
          boxShadow: `inset 0 1px 0 ${rgba('#ffffff', 0.35)}, inset 0 -1px 0 ${rgba('#000000', 0.12)}`,
        }}
      />
      <div style={{ position: 'absolute', left, top: (height - MARK_H) / 2 }}>
        <NoutLifeMark height={MARK_H} blades={{ a: { tint: mono }, b: { tint: mono }, c: { tint: mono } }} />
      </div>
      <OutlineText line={line} size={TEXT_SIZE} x={left + markW + GAP} y={height / 2 + (TEXT_SIZE * 0.7) / 2} align="left" color={palette.onJade} />
    </div>
  );
};
