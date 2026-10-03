// Opciones del avatar pixel (compartidas por el onboarding y AvatarCustomizer).
// Los colores son DATOS del avatar (se guardan en avatarConfig), no tokens de UI.
import type { Accessory, AvatarConfig, Expression, HairStyle } from '@lifequest/shared';

export const HAIR_COLORS = ['#2c1810', '#4a3728', '#8b4513', '#d4a017', '#c8a2c8', '#708090', '#1a1a1a', '#ff6b6b', '#e8c090', '#ffffff', '#3d5a80', '#c0392b'];
export const SKIN_COLORS = [
  '#fdf0e8', '#fde8d0', '#fcd9c0', '#f8d5b0', '#f5c89f', '#f0b98e', '#e8a876', '#d4956a', '#c68642', '#b87340',
  '#a86035', '#a0522d', '#8b4513', '#7b3f2c', '#6b3422', '#5c2e1a', '#4a2010', '#3d1a0c', '#2d1009', '#1c0806',
];
export const SHIRT_COLORS = ['#4d96ff', '#ff6b9d', '#4ecdc4', '#6bcf7f', '#ffd23f', '#ff6347', '#9b59b6', '#2c3e50', '#e74c3c', '#1abc9c', '#f97316', '#64748b', '#ffffff', '#000000'];
export const PANTS_COLORS = ['#37474f', '#1a237e', '#4e342e', '#1b5e20', '#880e4f', '#263238', '#000000', '#5d4037', '#b71c1c', '#1565c0'];

export const HAIR_STYLES: Record<'male' | 'female', HairStyle[]> = {
  male: ['short', 'medium', 'long', 'shaved', 'copete', 'afro'],
  female: ['long', 'short', 'recogido', 'trenzas', 'ondulado', 'afro'],
};
export const ACCESSORIES: Accessory[] = ['none', 'glasses', 'cap', 'headband', 'earrings', 'scarf'];
export const EXPRESSIONS: Expression[] = ['normal', 'smile', 'serious', 'determined'];

export const HAIR_STYLE_LABELS: Record<HairStyle, string> = {
  short: 'Corto', medium: 'Medio', long: 'Largo', shaved: 'Rapado', copete: 'Copete', afro: 'Afro',
  recogido: 'Recogido', trenzas: 'Trenzas', ondulado: 'Ondulado',
};
export const ACCESSORY_LABELS: Record<Accessory, string> = {
  none: 'Ninguno', glasses: 'Gafas', cap: 'Gorra', headband: 'Diadema', earrings: 'Aretes', scarf: 'Bufanda',
};
export const EXPRESSION_LABELS: Record<Expression, string> = {
  normal: 'Normal', smile: 'Sonriente', serious: 'Serio', determined: 'Decidido',
};

export const DEFAULT_AVATAR: AvatarConfig = {
  bodyType: 'male',
  hairStyle: 'short',
  hairColor: '#2c1810',
  skinColor: '#c68642',
  shirtColor: '#4d96ff',
  pants: '#37474f',
  accessory: 'none',
  expression: 'normal',
  pet: null,
};

/** Completa una configuración parcial con valores por defecto coherentes con el cuerpo. */
export function withDefaults(c: Partial<AvatarConfig> | undefined, body: 'male' | 'female' = 'male'): AvatarConfig {
  const bodyType = c?.bodyType ?? body;
  return {
    ...DEFAULT_AVATAR,
    ...c,
    bodyType,
    hairStyle: (c?.hairStyle as HairStyle) ?? (bodyType === 'female' ? 'long' : 'short'),
    pet: c?.pet ?? null,
  };
}

/** Cambia el cuerpo conservando el peinado si existe para ese cuerpo. */
export function switchBody(c: AvatarConfig, bodyType: 'male' | 'female'): AvatarConfig {
  const styles = HAIR_STYLES[bodyType];
  return { ...c, bodyType, hairStyle: styles.includes(c.hairStyle) ? c.hairStyle : styles[0] };
}
