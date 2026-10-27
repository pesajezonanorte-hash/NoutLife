// Temporada de Halloween: paleta, telarañas y la luna del logo (styles/halloween.css,
// components/layout/Brand). Se apaga sola pasado el 31-10-2026 a medianoche (hora local).
export const HALLOWEEN_END = new Date('2026-10-31T23:59:59');

export const isHalloween = (now = new Date()) => now <= HALLOWEEN_END;
