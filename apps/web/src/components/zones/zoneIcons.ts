import { BookOpen, Brain, Code2, Dumbbell, Heart, Leaf, Moon, Music, NotebookPen, Star, Target, Wallet, type LucideIcon } from 'lucide-react';

/** Íconos de las zonas personalizadas (la clave se guarda en la API). */
export const ZONE_ICONS: Record<string, LucideIcon> = {
  target: Target, book: BookOpen, brain: Brain, money: Wallet, heart: Heart, leaf: Leaf,
  music: Music, star: Star, gym: Dumbbell, notes: NotebookPen, code: Code2, moon: Moon,
};
export const zoneIconOf = (key: string) => ZONE_ICONS[key] ?? Target;
