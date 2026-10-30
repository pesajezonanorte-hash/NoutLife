// Cuentas del medidor de energía (EnergyMeter), sin React para poder probarlas con tsx.

/** Valor bajo el puntero: cada barra ocupa una franja igual del ancho de la fila. */
export function energyAt(x: number, width: number, min: number, max: number): number {
  if (!(width > 0)) return min;
  const steps = max - min + 1;
  const i = Math.floor((x / width) * steps);
  return Math.min(max, Math.max(min, min + i));
}

/** Altura relativa de cada barra (0–1): suben como una señal, de un tercio al total. */
export function energyBarHeight(i: number, count: number): number {
  if (count <= 1) return 1;
  return 0.34 + 0.66 * Math.pow(i / (count - 1), 0.9);
}

/** Nivel con nombre (0 agotada … 4 a tope) para una escala de 1 a 10. */
export function energyLevel(value: number): 0 | 1 | 2 | 3 | 4 {
  return Math.min(4, Math.max(0, Math.floor((value - 1) / 2))) as 0 | 1 | 2 | 3 | 4;
}

/** Teclas del slider: flechas ±1, RePág/AvPág ±2, Inicio/Fin a los extremos. `null` = tecla ajena. */
export function energyKey(key: string, value: number, min: number, max: number): number | null {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  switch (key) {
    case 'ArrowRight': case 'ArrowUp': return clamp(value + 1);
    case 'ArrowLeft': case 'ArrowDown': return clamp(value - 1);
    case 'PageUp': return clamp(value + 2);
    case 'PageDown': return clamp(value - 2);
    case 'Home': return min;
    case 'End': return max;
    default: return null;
  }
}
