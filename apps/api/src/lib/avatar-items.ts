// Prendas, peinados y accesorios del personaje pixel que se compran en la Tienda.
// Viven en avatarConfig.pixel (como lo demás que elige el usuario en el estudio):
// comprar algo lo pone en el personaje y, a partir de ahí, también se puede
// quitar y volver a poner desde el estudio. Solo quien lo compró puede llevarlo.

/** Accesorios de pago (ExtraId del motor pixel) y su grupo: de cada grupo, uno a la vez. */
export const PREMIUM_EXTRAS: Record<string, 'hat' | 'face' | 'back' | 'side'> = {
  sombrero_aventurero: 'hat', sombrero_mago: 'hat', birrete: 'hat', casco_vikingo: 'hat', bandana_ninja: 'hat',
  corona_campeon: 'hat', corona_cristal: 'hat',
  antifaz: 'face', monoculo: 'face',
  capa: 'back', alas: 'back',
  escudo: 'side', dragoncito: 'side',
};
/** Grupos excluyentes completos (los gratuitos del estudio también cuentan). */
const GROUPS: Record<string, string[]> = {
  hat: ['gorra', 'gorro', 'corona', 'auriculares', 'sombrero_aventurero', 'sombrero_mago', 'birrete', 'casco_vikingo', 'bandana_ninja', 'corona_campeon', 'corona_cristal'],
  face: ['gafas', 'gafas_sol', 'parche', 'antifaz', 'monoculo'],
  back: ['capa', 'alas'],
  side: ['escudo', 'dragoncito'],
};
export const PREMIUM_HAIRS = ['samurai', 'rizos'];
export const PREMIUM_TOPS = ['armadura', 'kimono', 'traje'];

const DEFAULT_HAIR: Record<string, string> = { male: 'puntas', female: 'bob' };
const FROM_HAIR: Record<string, string> = {
  short: 'corto', medium: 'media', long: 'largo', shaved: 'rapado', copete: 'copete', afro: 'afro', recogido: 'mono', trenzas: 'trenzas', ondulado: 'ondulado',
};
const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v);

type Config = Record<string, unknown> & { pixel?: Record<string, unknown> };

/**
 * El aspecto pixel guardado de un avatarConfig. Si el avatar es anterior al estilo
 * pixel, se traducen sus colores para no perderlos al ponerle algo comprado.
 */
function pixelOf(cfg: Config): Record<string, unknown> {
  if (cfg.pixel && typeof cfg.pixel === 'object') return { ...cfg.pixel, extras: Array.isArray(cfg.pixel.extras) ? [...cfg.pixel.extras] : [] };
  const body = cfg.bodyType === 'female' ? 'female' : 'male';
  return {
    body,
    ...(typeof cfg.hairStyle === 'string' && FROM_HAIR[cfg.hairStyle] ? { hair: FROM_HAIR[cfg.hairStyle] } : {}),
    ...(isHex(cfg.hairColor) ? { hairColor: cfg.hairColor } : {}),
    ...(isHex(cfg.skinColor) ? { skin: cfg.skinColor } : {}),
    ...(isHex(cfg.shirtColor) ? { topColor: cfg.shirtColor } : {}),
    ...(isHex(cfg.pants) ? { bottomColor: cfg.pants } : {}),
    extras: [],
  };
}

const asConfig = (raw: unknown): Config => (raw && typeof raw === 'object' ? { ...(raw as Config) } : {});

/** Pone (equip = true) o quita una prenda, peinado o accesorio en el personaje. */
export function applyAvatarItem(raw: unknown, slot: string, value: string, equip: boolean): Config {
  const cfg = asConfig(raw);
  const pixel = pixelOf(cfg);
  const body = pixel.body === 'female' ? 'female' : 'male';
  if (slot === 'extra') {
    const group = PREMIUM_EXTRAS[value] ? GROUPS[PREMIUM_EXTRAS[value]] : [];
    const extras = (pixel.extras as string[]).filter((e) => e !== value && (!equip || !group.includes(e)));
    pixel.extras = equip ? [...extras, value] : extras;
  } else if (slot === 'hair') {
    pixel.hair = equip ? value : DEFAULT_HAIR[body];
  } else if (slot === 'top') {
    pixel.top = equip ? value : 'camiseta';
  }
  return { ...cfg, pixel };
}

/** ¿Lleva puesto este artículo? */
export function wearing(raw: unknown, slot: string, value: string): boolean {
  const pixel = pixelOf(asConfig(raw));
  if (slot === 'extra') return (pixel.extras as string[]).includes(value);
  if (slot === 'hair') return pixel.hair === value;
  if (slot === 'top') return pixel.top === value;
  return false;
}

/**
 * Quita del avatar lo de pago que la persona no compró (el estudio no lo deja
 * elegir, pero la API no se fía).
 */
export function stripUnowned(raw: unknown, owned: Set<string>): Config {
  const cfg = asConfig(raw);
  if (!cfg.pixel || typeof cfg.pixel !== 'object') return cfg;
  const pixel = { ...cfg.pixel };
  const body = pixel.body === 'female' ? 'female' : 'male';
  if (Array.isArray(pixel.extras)) pixel.extras = (pixel.extras as string[]).filter((e) => !PREMIUM_EXTRAS[e] || owned.has(`extra:${e}`));
  if (typeof pixel.hair === 'string' && PREMIUM_HAIRS.includes(pixel.hair) && !owned.has(`hair:${pixel.hair}`)) pixel.hair = DEFAULT_HAIR[body];
  if (typeof pixel.top === 'string' && PREMIUM_TOPS.includes(pixel.top) && !owned.has(`top:${pixel.top}`)) pixel.top = 'camiseta';
  return { ...cfg, pixel };
}
