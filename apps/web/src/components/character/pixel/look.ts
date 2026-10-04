// Catálogo de opciones del personaje pixel, valores por defecto y conversión
// desde/hacia avatarConfig. El aspecto nuevo se guarda en avatarConfig.pixel
// (la API acepta cualquier objeto); los campos antiguos (hairStyle, accessory…)
// se mantienen sincronizados para el contrato compartido.
import type { Accessory, AvatarConfig, Expression, HairStyle } from '@lifequest/shared';
import type { Body, BottomId, BrowsId, EyesId, ExtraId, FacialId, HairId, MouthId, PixelLook, ShoesId, TopId } from './engine';

export interface Option<T extends string> { id: T; label: string }

export const HAIRS: Option<HairId>[] = [
  { id: 'corto', label: 'Corto' }, { id: 'puntas', label: 'De punta' }, { id: 'despeinado', label: 'Despeinado' },
  { id: 'raya', label: 'Raya al lado' }, { id: 'copete', label: 'Copete' }, { id: 'media', label: 'Media melena' },
  { id: 'bob', label: 'Bob' }, { id: 'flequillo', label: 'Flequillo' }, { id: 'pixie', label: 'Pixie' },
  { id: 'largo', label: 'Largo' }, { id: 'ondulado', label: 'Ondulado' }, { id: 'coleta', label: 'Coleta' },
  { id: 'dos_coletas', label: 'Dos coletas' }, { id: 'trenzas', label: 'Trenzas' }, { id: 'mono', label: 'Moño' },
  { id: 'mono_alto', label: 'Moño alto' }, { id: 'afro', label: 'Afro' }, { id: 'mohicano', label: 'Mohicano' },
  { id: 'rapado', label: 'Rapado' }, { id: 'calvo', label: 'Calvo' },
];
export const EYES: Option<EyesId>[] = [
  { id: 'normal', label: 'Normales' }, { id: 'grandes', label: 'Grandes' }, { id: 'felices', label: 'Felices' },
  { id: 'entrecerrados', label: 'Relajados' }, { id: 'guino', label: 'Guiño' },
];
export const BROWS: Option<BrowsId>[] = [
  { id: 'normales', label: 'Normales' }, { id: 'gruesas', label: 'Gruesas' }, { id: 'enfadadas', label: 'Decididas' },
  { id: 'preocupadas', label: 'Tiernas' }, { id: 'ninguna', label: 'Sin cejas' },
];
export const MOUTHS: Option<MouthId>[] = [
  { id: 'sonrisa', label: 'Sonrisa' }, { id: 'sonrisota', label: 'Risa' }, { id: 'abierta', label: 'Sorpresa' },
  { id: 'neutral', label: 'Neutral' }, { id: 'seria', label: 'Seria' }, { id: 'lengua', label: 'Lengua' },
];
export const FACIALS: Option<FacialId>[] = [
  { id: 'ninguno', label: 'Sin vello' }, { id: 'bigote', label: 'Bigote' }, { id: 'perilla', label: 'Perilla' },
  { id: 'barba_corta', label: 'Barba corta' }, { id: 'barba', label: 'Barba' },
];
export const TOPS: Option<TopId>[] = [
  { id: 'camiseta', label: 'Camiseta' }, { id: 'manga_larga', label: 'Manga larga' }, { id: 'camisa', label: 'Camisa' },
  { id: 'uniforme', label: 'Uniforme' }, { id: 'sudadera', label: 'Sudadera' }, { id: 'chaqueta', label: 'Chaqueta' },
  { id: 'sueter', label: 'Suéter' }, { id: 'tirantes', label: 'Tirantes' }, { id: 'vestido', label: 'Vestido' },
  { id: 'sin_camiseta', label: 'Sin camiseta' },
];
export const BOTTOMS: Option<BottomId>[] = [
  { id: 'pantalon', label: 'Pantalón' }, { id: 'rotos', label: 'Rotos' }, { id: 'shorts', label: 'Shorts' }, { id: 'falda', label: 'Falda' },
];
export const SHOES: Option<ShoesId>[] = [
  { id: 'zapatillas', label: 'Zapatillas' }, { id: 'botas', label: 'Botas' }, { id: 'sandalias', label: 'Sandalias' }, { id: 'descalzo', label: 'Descalzo' },
];
export const EXTRAS: Option<ExtraId>[] = [
  { id: 'gafas', label: 'Gafas' }, { id: 'gafas_sol', label: 'Gafas de sol' }, { id: 'cinta', label: 'Cinta' },
  { id: 'gorra', label: 'Gorra' }, { id: 'gorro', label: 'Gorro' }, { id: 'corona', label: 'Corona' },
  { id: 'auriculares', label: 'Auriculares' }, { id: 'pendientes', label: 'Pendientes' }, { id: 'bufanda', label: 'Bufanda' },
  { id: 'collar', label: 'Collar' }, { id: 'flor', label: 'Flor' }, { id: 'parche', label: 'Parche' },
];
/** Solo un sombrero a la vez; gafas y gafas de sol tampoco se combinan. */
export const EXCLUSIVE: ExtraId[][] = [['gorra', 'gorro', 'corona', 'auriculares'], ['gafas', 'gafas_sol', 'parche']];

export const SKINS = [
  '#ffe4d1', '#fcd5b8', '#f5c6a0', '#eab48a', '#e0a779', '#d29468', '#c68642', '#a96b3d',
  '#8d5524', '#6f4122', '#55311a', '#3b2214',
];
export const HAIR_COLORS = [
  '#1f1a24', '#3b2a22', '#5a3825', '#8a5a2b', '#b07a3e', '#d8a85a', '#f0d68c', '#e9e4dc',
  '#9a9aa3', '#b5382f', '#e0773a', '#d96b9f', '#8c5bd6', '#3f7fd9', '#3aa58b', '#5b8c3a',
];
export const EYE_COLORS = ['#3b2a22', '#6b4a2b', '#2f6fb3', '#3a8f6a', '#7a8b99', '#8c5bd6', '#c0392b', '#d4a017'];
export const CLOTH_COLORS = [
  '#e8e4dc', '#2a2633', '#4a4f63', '#2f5fb3', '#4d96ff', '#3aa58b', '#5b8c3a', '#f2c14e',
  '#e0773a', '#d9434b', '#d96b9f', '#8c5bd6', '#7a4a2a', '#c9b48a',
];

export const DEFAULT_LOOK: Record<Body, PixelLook> = {
  male: {
    body: 'male', skin: '#e0a779', hair: 'puntas', hairColor: '#3b2a22', eyes: 'normal', eyeColor: '#3b2a22',
    brows: 'normales', mouth: 'sonrisa', facial: 'ninguno', blush: false, top: 'camiseta', topColor: '#4d96ff',
    bottom: 'pantalon', bottomColor: '#2a2633', shoes: 'zapatillas', shoesColor: '#d9434b', extras: [], extraColor: '#e8e4dc',
  },
  female: {
    body: 'female', skin: '#f5c6a0', hair: 'bob', hairColor: '#5a3825', eyes: 'grandes', eyeColor: '#6b4a2b',
    brows: 'normales', mouth: 'sonrisa', facial: 'ninguno', blush: true, top: 'camiseta', topColor: '#d96b9f',
    bottom: 'falda', bottomColor: '#2a2633', shoes: 'zapatillas', shoesColor: '#e8e4dc', extras: [], extraColor: '#d9434b',
  },
};

// ── Conversión con el avatarConfig antiguo ──────────────────────────────────
const FROM_HAIR: Record<HairStyle, HairId> = {
  short: 'corto', medium: 'media', long: 'largo', shaved: 'rapado', copete: 'copete', afro: 'afro',
  recogido: 'mono', trenzas: 'trenzas', ondulado: 'ondulado',
};
const TO_HAIR: Partial<Record<HairId, HairStyle>> = {
  corto: 'short', puntas: 'short', despeinado: 'short', raya: 'short', pixie: 'short', media: 'medium', bob: 'medium',
  largo: 'long', flequillo: 'long', coleta: 'recogido', dos_coletas: 'recogido', mono: 'recogido', mono_alto: 'recogido',
  rapado: 'shaved', calvo: 'shaved', mohicano: 'shaved', copete: 'copete', afro: 'afro', trenzas: 'trenzas', ondulado: 'ondulado',
};
const FROM_ACC: Partial<Record<Accessory, ExtraId>> = { glasses: 'gafas', cap: 'gorra', headband: 'cinta', earrings: 'pendientes', scarf: 'bufanda' };
const TO_ACC: Partial<Record<ExtraId, Accessory>> = { gafas: 'glasses', gorra: 'cap', cinta: 'headband', pendientes: 'earrings', bufanda: 'scarf' };
const FROM_EXPR: Record<Expression, MouthId> = { normal: 'neutral', smile: 'sonrisa', serious: 'seria', determined: 'neutral' };

type AnyConfig = Partial<AvatarConfig> & { pixel?: Partial<PixelLook> };

const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v);

/** Aspecto pixel de cualquier avatarConfig (nuevo, antiguo o vacío). */
export function lookFrom(cfg: unknown, fallbackBody: Body = 'male'): PixelLook {
  const c = (cfg && typeof cfg === 'object' ? cfg : {}) as AnyConfig;
  const body: Body = c.pixel?.body ?? c.bodyType ?? fallbackBody;
  const base = DEFAULT_LOOK[body];
  if (c.pixel) return { ...base, ...c.pixel, body, extras: Array.isArray(c.pixel.extras) ? c.pixel.extras : [] };
  // Avatar anterior al estilo nuevo: se traduce lo que exista.
  const extra = c.accessory ? FROM_ACC[c.accessory] : undefined;
  return {
    ...base,
    hair: c.hairStyle ? FROM_HAIR[c.hairStyle] ?? base.hair : base.hair,
    hairColor: isHex(c.hairColor) ? c.hairColor : base.hairColor,
    skin: isHex(c.skinColor) ? c.skinColor : base.skin,
    topColor: isHex(c.shirtColor) ? c.shirtColor : base.topColor,
    bottomColor: isHex(c.pants) ? c.pants : base.bottomColor,
    mouth: c.expression ? FROM_EXPR[c.expression] : base.mouth,
    brows: c.expression === 'determined' ? 'enfadadas' : base.brows,
    extras: extra ? [extra] : [],
  };
}

/** avatarConfig completo a partir del aspecto pixel, conservando el resto de campos. */
export function toConfig(look: PixelLook, prev?: unknown): AvatarConfig & { pixel: PixelLook } {
  const p = (prev && typeof prev === 'object' ? prev : {}) as AnyConfig;
  const acc = look.extras.map((e) => TO_ACC[e]).find(Boolean) ?? 'none';
  const expression: Expression = look.mouth === 'sonrisa' || look.mouth === 'sonrisota' ? 'smile' : look.mouth === 'seria' ? 'serious' : look.brows === 'enfadadas' ? 'determined' : 'normal';
  return {
    ...p,
    pet: p.pet ?? null,
    bodyType: look.body,
    hairStyle: TO_HAIR[look.hair] ?? 'short',
    hairColor: look.hairColor,
    skinColor: look.skin,
    shirtColor: look.topColor,
    pants: look.bottomColor,
    accessory: acc,
    expression,
    pixel: look,
  };
}

/** Cambia de cuerpo: conserva colores y elecciones; quita lo que no aplica. */
export function switchBody(look: PixelLook, body: Body): PixelLook {
  const next = { ...look, body };
  if (body === 'female' && next.top === 'sin_camiseta') next.top = 'tirantes';
  return next;
}

/** Activa o desactiva un accesorio respetando los grupos excluyentes. */
export function toggleExtra(look: PixelLook, id: ExtraId): PixelLook {
  if (look.extras.includes(id)) return { ...look, extras: look.extras.filter((e) => e !== id) };
  const group = EXCLUSIVE.find((g) => g.includes(id)) ?? [];
  return { ...look, extras: [...look.extras.filter((e) => !group.includes(e)), id] };
}

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

/** Personaje aleatorio del mismo cuerpo. */
export function randomLook(body: Body): PixelLook {
  const extras: ExtraId[] = [];
  if (Math.random() < 0.5) extras.push(pick(EXTRAS).id);
  if (Math.random() < 0.25) extras.push(pick(EXTRAS).id);
  let look: PixelLook = {
    body,
    skin: pick(SKINS), hair: pick(HAIRS).id, hairColor: pick(HAIR_COLORS),
    eyes: pick(EYES).id, eyeColor: pick(EYE_COLORS), brows: pick(BROWS.slice(0, 4)).id, mouth: pick(MOUTHS).id,
    facial: body === 'male' && Math.random() < 0.3 ? pick(FACIALS.slice(1)).id : 'ninguno', blush: Math.random() < 0.5,
    top: pick(TOPS.slice(0, 9)).id, topColor: pick(CLOTH_COLORS), bottom: pick(BOTTOMS).id, bottomColor: pick(CLOTH_COLORS),
    shoes: pick(SHOES.slice(0, 3)).id, shoesColor: pick(CLOTH_COLORS), extras: [], extraColor: pick(CLOTH_COLORS),
  };
  for (const e of extras) look = toggleExtra(look, e);
  return look;
}
