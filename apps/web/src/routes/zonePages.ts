// Zonas registradas por configuración: cada entrada da a la vez su ruta (App.tsx)
// y su sitio en la navegación (nav.ts), y entra en el orden de zonas del usuario.
// Para sumar una zona nueva basta con añadir aquí su entrada.
import type { ComponentType } from 'react';
import { ListChecks, type LucideIcon } from 'lucide-react';

export type ZoneSection = 'wellness' | 'zones' | 'community';

export interface ZonePage {
  path: string;
  label: string;
  icon: LucideIcon;
  section: ZoneSection;
  load: () => Promise<{ default: ComponentType<any> }>;
  /** Otras rutas que sirve la misma página (p. ej. una invitación con parámetro). */
  subPaths?: string[];
}

export const ZONE_PAGES: ZonePage[] = [
  {
    path: '/checklists',
    label: 'Listas',
    icon: ListChecks,
    section: 'zones',
    load: () => import('@/pages/Checklists'),
    subPaths: ['/checklists/join/:token'],
  },
];

/** Todas las rutas (con sus subrutas) que sirve cada zona registrada. */
export const zonePaths = (page: ZonePage) => [page.path, ...(page.subPaths ?? [])];
