// Emblemas de los gremios (radiogroup al crear uno, cabecera, cartas y bandeja).
import { Crown, Flame, PawPrint, Shield, Star, Swords, type LucideIcon } from 'lucide-react';
import type { Tone } from '@/components/ui/lq';

export const EMBLEMS: Array<{ id: string; name: string; icon: LucideIcon; tone: Exclude<Tone, 'muted'> }> = [
  { id: 'shield', name: 'Escudo', icon: Shield, tone: 'warning' },
  { id: 'sword', name: 'Espadas', icon: Swords, tone: 'error' },
  { id: 'crown', name: 'Corona', icon: Crown, tone: 'primary' },
  { id: 'star', name: 'Estrella', icon: Star, tone: 'info' },
  { id: 'dragon', name: 'Llama', icon: Flame, tone: 'forest' },
  { id: 'wolf', name: 'Lobo', icon: PawPrint, tone: 'success' },
];

export const emblemOf = (id: string) => EMBLEMS.find((e) => e.id === id) ?? EMBLEMS[0];
