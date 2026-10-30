// Colores de los objetos 3D sacados del tema (tokens --lq-*): Aurora claro y oscuro, los temas
// de la Tienda y la temporada. Las escenas los releen cuando cambia la clase, el tema o la
// temporada de <html> (watchPalette).
import { Color, SRGBColorSpace } from 'three';

export interface PropPalette {
  dark: boolean;
  /** Cuerpo de los objetos: superficie del tema con un toque del acento. */
  body: Color;
  /** Luz (franjas, neón): el tono claro del acento en oscuro, el profundo en claro. */
  glow: Color;
  /** Acento del tema (cristales, detalles). */
  accent: Color;
  /** Metal de las recompensas (oro champán del tema: XP, monedas, trofeos). */
  gold: Color;
  /** Metal neutro (barras, mancuernas). */
  steel: Color;
  /** Goma y partes oscuras. */
  shade: Color;
  /** Pinturas y botones: error, aviso, éxito, info y secundario. */
  paints: [Color, Color, Color, Color, Color];
  surface: Color;
}

/** sRGB «R G B» (tokens --lq-*) → Color lineal de three. */
export function tokenColor(triplet: string, fallback = '128 128 128'): Color {
  const [r, g, b] = (triplet.trim() || fallback).split(/[\s,]+/).map(Number);
  return new Color().setRGB((r || 0) / 255, (g || 0) / 255, (b || 0) / 255, SRGBColorSpace);
}

export function readPalette(): PropPalette {
  const root = document.documentElement;
  const css = getComputedStyle(root);
  const dark = root.classList.contains('dark');
  const v = (name: string, fallback?: string) => tokenColor(css.getPropertyValue(`--lq-${name}`), fallback);
  const surface = v(dark ? 'surface-variant' : 'surface', dark ? '24 38 30' : '255 255 255');
  const accent = v('jade-400', '62 170 140');
  const onBg = v('on-background', dark ? '230 236 232' : '20 30 26');
  return {
    dark,
    body: surface.clone().lerp(accent, dark ? 0.12 : 0.07).lerp(onBg, dark ? 0.05 : 0),
    glow: v(dark ? 'jade-300' : 'jade-500', '80 200 160'),
    accent,
    gold: v('secondary', '176 141 87'),
    steel: surface.clone().lerp(onBg, dark ? 0.55 : 0.42),
    shade: v('background', dark ? '7 13 10' : '249 247 243').lerp(onBg, dark ? 0.1 : 0.78),
    paints: [v('error'), v('warning'), v('success'), v('info'), v('secondary')],
    surface,
  };
}

/** Llama a `onChange` cuando cambian el modo, el tema o la temporada. Devuelve la baja. */
export function watchPalette(onChange: () => void): () => void {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-season'] });
  return () => mo.disconnect();
}
