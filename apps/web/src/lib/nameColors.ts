// Color del nombre en las cartas y los gremios: cada persona elige el suyo y los
// demás lo ven. Cada color tiene su tono para el tema claro y el oscuro (clases
// lq-name-* en styles/social.css), así siempre se lee bien sobre el papel.
export const NAME_COLORS = [
  { key: 'jade', label: 'Jade' },
  { key: 'bosque', label: 'Bosque' },
  { key: 'oceano', label: 'Océano' },
  { key: 'cielo', label: 'Cielo' },
  { key: 'lavanda', label: 'Lavanda' },
  { key: 'uva', label: 'Uva' },
  { key: 'rosa', label: 'Rosa' },
  { key: 'coral', label: 'Coral' },
  { key: 'ambar', label: 'Ámbar' },
  { key: 'miel', label: 'Miel' },
  { key: 'tierra', label: 'Tierra' },
  { key: 'grafito', label: 'Grafito' },
] as const;
export type NameColor = (typeof NAME_COLORS)[number]['key'];

/** Clase del color del nombre (vacía si no eligió ninguno: color de texto normal). */
export function nameClass(key: string | null | undefined) {
  return key && NAME_COLORS.some((c) => c.key === key) ? `lq-name-${key}` : '';
}
