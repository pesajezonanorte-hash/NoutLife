// Puente entre avatarConfig y el personaje pixel (ver pixel/look.ts).
import type { AvatarConfig } from '@lifequest/shared';
import { lookFrom, switchBody, toConfig } from './pixel/look';

/** Configuración completa (con el aspecto pixel) a partir de una parcial o antigua. */
export function withDefaults(c: Partial<AvatarConfig> | undefined, body: 'male' | 'female' = 'male'): AvatarConfig {
  return toConfig(lookFrom(c, body), c);
}

/** Cambia el tipo de cuerpo conservando el resto del personaje. */
export function withBody(c: Partial<AvatarConfig> | undefined, body: 'male' | 'female'): AvatarConfig {
  return toConfig(switchBody(lookFrom(c, body), body), c);
}
