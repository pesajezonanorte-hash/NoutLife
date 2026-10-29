import { createLucideIcon } from 'lucide-react';

/**
 * Icono propio del Espejo (armario y cuidado personal): un espejo de tocador con
 * su cuello, su base y un reflejo. No lleva destellos, que son del Sabio.
 * Mismo trazo que lucide (24 px, con el color del texto), para encajar en la navegación.
 */
export const MirrorIcon = createLucideIcon('Mirror', [
  ['ellipse', { cx: '12', cy: '9.5', rx: '5.5', ry: '7.5', key: 'glass' }],
  ['path', { d: 'M12 17v3', key: 'neck' }],
  ['path', { d: 'M8 21h8', key: 'base' }],
  ['path', { d: 'M8.9 7.4a3.5 3.5 0 0 1 1.7-2.1', key: 'glint' }],
]);
