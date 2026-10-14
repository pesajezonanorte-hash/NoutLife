// glyphs.tsx — Sistema de iconos minimalistas (lucide) con mapeo desde emojis legados.
// Los emojis que ya viven en datos (hábitos guardados, preferencias) se conservan
// como CLAVES internas y se resuelven a lucide al renderizar con <E e="clave" />.
import { isValidElement } from 'react';
import type React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlarmClock,
  Annoyed,
  ArrowLeft,
  ArrowUp,
  Backpack,
  Banknote,
  Bed,
  Bell,
  Bike,
  Book,
  BookMarked,
  BookOpen,
  Bot,
  Brain,
  Briefcase,
  Brush,
  Bug,
  Bus,
  Calendar,
  CalendarDays,
  Camera,
  Check,
  Clapperboard,
  CheckCircle2,
  Cherry,
  Circle,
  ClipboardList,
  Coffee,
  Coins,
  Compass,
  Copy,
  CreditCard,
  Crown,
  Database,
  Download,
  Drumstick,
  Droplet,
  Dumbbell,
  Eye,
  FileText,
  Flag,
  Flame,
  Footprints,
  Frown,
  Gamepad2,
  Gem,
  Gift,
  Globe,
  GraduationCap,
  Handshake,
  HardHat,
  Heart,
  HeartHandshake,
  HeartPulse,
  HelpCircle,
  Home,
  Hourglass,
  Image,
  KeyRound,
  Landmark,
  Laptop,
  Laugh,
  Layers,
  Leaf,
  Library,
  Link,
  Lock,
  Map,
  Medal,
  Megaphone,
  Meh,
  MessageCircle,
  Mic,
  Minus,
  Moon,
  Music,
  Package,
  Palette,
  PartyPopper,
  PawPrint,
  PenLine,
  Pencil,
  PersonStanding,
  Pill,
  Pizza,
  Plus,
  PowerOff,
  RefreshCw,
  Rocket,
  Salad,
  Sandwich,
  Save,
  Scale,
  ScrollText,
  Search,
  Send,
  Shield,
  ShieldAlert,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Skull,
  Smartphone,
  Smile,
  Soup,
  Sparkles,
  Square,
  Star,
  StickyNote,
  Sun,
  Swords,
  Target,
  ThumbsUp,
  Ticket,
  Timer,
  Trash2,
  TrendingDown,
  TrendingUp,
  TreePine,
  Trophy,
  User,
  UserRound,
  Users,
  Utensils,
  Video,
  Wand2,
  Waves,
  Wind,
  X,
  Zap,
} from 'lucide-react';

/** Mapa clave (emoji legado o id) → icono lucide. Cubre todos los glifos de la app. */
const GLYPHS: Record<string, LucideIcon> = {
  // relojes / estados
  '⏰': AlarmClock, '⏱': Timer, '⏳': Hourglass, '⏹': Square,
  // sol / luna / naturaleza
  '☀': Sun, '🌙': Moon, '😴': Moon, '🌿': Leaf, '🌱': TreePine, '🌲': TreePine,
  // marcas / signos
  '★': Star, '🌟': Star, '✦': Sparkles, '✨': Sparkles, '🤩': Sparkles,
  '☑': Check, '✅': CheckCircle2, '✓': Check,
  '❌': X, '✕': X, '✗': X, '🗑': Trash2,
  '❓': HelpCircle, '💬': MessageCircle,
  '⚠': ShieldAlert, '⚡': Zap,
  '🔒': Lock, '👁': Eye,
  '⬆': ArrowUp, '⬇': Download, '↩': ArrowLeft,
  // emociones / escala de ánimo
  '😢': Frown, '😭': Frown, '😔': Frown, '😕': Annoyed, '😐': Meh,
  '🙂': Smile, '😊': Smile, '😄': Laugh, '🙏': ThumbsUp,
  // juego / RPG
  '⚔': Swords, '🗡': Swords, '🛡': Shield, '💀': Skull, '🐉': Skull,
  '🏰': Home, '👑': Crown, '🏆': Trophy,
  '🥇': Crown, '🥈': Medal, '🥉': Medal,
  '💎': Gem, '🗝': KeyRound, '🔑': KeyRound, '🗺': Map, '📜': ScrollText,
  '🔮': Target, '🎭': Ticket, '🎪': Ticket, '🕹': Gamepad2,
  // stats
  '❤': Heart, '💙': Circle, '🔴': Circle, '🔵': Circle, '🟢': Circle,
  '💪': Dumbbell, '🧠': Brain,
  // personas / roles
  '👤': User, '👥': Users, '🤝': Handshake, '💑': Users,
  '🧙': Wand2, '🧝': User, '🧚': Sparkles,
  '♂': User, '♀': UserRound,
  // amor
  '💖': Heart, '💚': HeartPulse, '💝': Gift, '💕': Heart, '💞': Heart,
  // objetos / tienda
  '🎩': HardHat, '👔': Shirt, '👕': Shirt, '👗': Shirt, '🎒': Backpack,
  '🎁': Gift, '🎉': PartyPopper, '🪙': Coins, '💰': Coins, '💳': CreditCard,
  '💸': Banknote, '🛒': ShoppingCart, '🛍': ShoppingBag, '🏷': ShoppingBag,
  '📸': Camera, '📷': Camera, '🖼': Image, '🎨': Palette,
  '🎧': Music, '🎬': Video, '🎥': Video, '🎙': Mic, '🎵': Music, '🎶': Music,
  '💊': Pill, '🧴': Heart, '🧹': Brush, '📦': Package,
  '📱': Smartphone, '📲': Send,
  // navegación / UI
  '🏠': Home, '🔍': Search, '🔗': Link, '🔄': RefreshCw, '🔌': PowerOff,
  '🔋': Zap, '🌐': Globe, '📡': Globe,
  '📢': Megaphone, '📣': Megaphone, '🔔': Bell, '🔖': Ticket, '📎': Link,
  '📋': ClipboardList, '📁': Copy, '🗂': Copy,
  '📊': ClipboardList, '📈': TrendingUp, '📉': TrendingDown,
  '📄': FileText, '📑': Layers, '🗃': Layers,
  '✏': Pencil, '✒': PenLine, '✍': PenLine, '📝': StickyNote,
  '📚': Library, '📖': BookOpen, '📔': Book, '📕': Book, '📗': Book,
  '📘': Book, '📙': Book, '📓': Book, '📒': Book,
  '🧪': Brain,
  // tiempo / fechas
  '📅': Calendar, '📆': CalendarDays, '🗓': CalendarDays,
  // comida / salud
  '🍎': Cherry, '🥗': Salad, '🍕': Pizza, '🍔': Sandwich, '🍖': Drumstick,
  '🍲': Soup, '🍽': Utensils, '☕': Coffee, '🍵': Coffee,
  '💧': Droplet, '🩺': HeartPulse,
  // deporte / sueño
  '🏋': Dumbbell, '🏃': Activity, '🚴': Bike, '🚶': Footprints,
  '🤸': Sparkles, '🧘': PersonStanding, '🏄': Waves, '🏊': Waves, '🛏': Bed,
  // lugares / transporte
  '🏦': Landmark, '🏥': HeartPulse, '🏫': GraduationCap, '🏛': Landmark,
  '🚗': Briefcase, '🚌': Bus, '🚀': Rocket, '🏁': Flag,
  // varios
  '🌈': Sparkles, '💨': Wind, '🌪': Wind, '🔥': Flame, '🍀': Leaf,
  '🐛': Bug, '🐾': PawPrint, '🐺': PawPrint, '🐱': PawPrint, '🐶': PawPrint,
  '🧩': Layers, '🎓': GraduationCap, '💼': Briefcase,
  '🪴': Leaf, '💭': HelpCircle, '🗯': HelpCircle, '🗨': MessageCircle,
  '🗣': Mic, '🫶': HeartHandshake, '🫰': Heart,
  '▶': Activity, '⏸': Square,
  '💾': Save, '💽': Database, '🖥': Laptop, '⌨': Laptop, '🖱': Target,
  '📳': Smartphone, '📇': Copy,
  '✔': Check, '➕': Plus, '➖': Minus,
  '🧼': Brush, '🪣': Brush, '🚰': Droplet, '🪥': Brush,
  '🧭': Compass, '🪜': TrendingUp, '🎣': Target,
  '🍿': Pizza, '🥂': Coffee, '🍺': Coffee, '🍷': Coffee,
  '🧋': Coffee, '🥤': Coffee, '🍦': Salad,
  '🫀': HeartPulse, '🫁': Activity,
  '🧵': Layers, '🪡': PenLine, '🧶': Layers, '🪈': Music, '🥁': Music,
  '🎺': Music, '🎸': Music, '🎻': Music, '🎷': Music, '🎤': Mic,
  '🖌': Palette, '🖍': Palette, '📐': Layers, '📏': Layers,
  '🪄': Wand2, '🪞': Circle, '🕯': Flame, '🪵': TreePine,

  // ids nuevos para hábitos (sin emoji)
  droplet: Droplet, moon: Moon, yoga: PersonStanding, book: BookOpen,
  gym: Dumbbell, apple: Cherry, pill: Pill, walk: Footprints,
  clean: Brush, write: PenLine, music: Music, game: Gamepad2,
  leaf: Leaf, sun: Sun, run: Activity, bike: Bike,
  code: Laptop, notes: StickyNote, target: Target, star: Star,
  strong: Dumbbell, brain: Brain, money: Coins, art: Palette,
  dance: Sparkles, salad: Salad, sleep: Bed, read: BookMarked,
  sea: Waves, heart: Heart, gift: Gift, calendar: Calendar,
  quest: Swords, expense: Banknote, habit: Flame, journal: StickyNote,
  checkin: Zap, warrior: Swords, mage: Wand2, merchant: Coins, paladin: Shield,
  // Íconos de zona del Life Score.
  coliseo: Swords, recreation: Clapperboard,
};

/** Resuelve una clave (emoji legado o id) a su icono lucide. */
export function resolveGlyph(key?: string | null): LucideIcon {
  if (!key) return Star;
  const clean = key.replace(/\uFE0F/g, '').replace(/[\u200D].*$/, '');
  return GLYPHS[key] ?? GLYPHS[clean] ?? GLYPHS[clean.toLowerCase()] ?? Star;
}

interface EProps {
  e?: string | LucideIcon | React.ReactNode | null;
  s?: number;
  className?: string;
  strokeWidth?: number;
}

/** Icono inline que sustituye a un emoji: <E e="🔥" /> o <E e={item.icon} s={18} /> */
export function E({ e, s = 15, className, strokeWidth = 2 }: EProps) {
  // React elements (por ejemplo <Swords />) ya vienen renderizados. Los iconos
  // de lucide creados con forwardRef son objetos, no funciones: se conservan como
  // componentes y se instancian abajo en vez de intentar pintarlos como un nodo.
  if (isValidElement(e)) return <>{e}</>;
  const Icon = typeof e === 'string' || !e
    ? resolveGlyph(typeof e === 'string' ? e : null)
    : e as LucideIcon;
  return <Icon size={s} strokeWidth={strokeWidth} className={className ?? 'inline-block shrink-0 align-middle'} />;
}

/** Icono de hábito guardado (acepta emoji legacy o id nuevo). */
export function HabitGlyph({ icon, size = 18, className }: { icon?: string | null; size?: number; className?: string }) {
  return <E e={icon} s={size} className={className ?? 'block'} strokeWidth={1.75} />;
}

/** 30 iconos minimalistas para el selector de hábitos. */
export const HABIT_ICON_OPTIONS: { id: string; Icon: LucideIcon }[] = [
  { id: 'droplet', Icon: Droplet }, { id: 'moon', Icon: Moon },
  { id: 'yoga', Icon: PersonStanding }, { id: 'book', Icon: BookOpen },
  { id: 'gym', Icon: Dumbbell }, { id: 'apple', Icon: Cherry },
  { id: 'pill', Icon: Pill }, { id: 'walk', Icon: Footprints },
  { id: 'clean', Icon: Brush }, { id: 'write', Icon: PenLine },
  { id: 'music', Icon: Music }, { id: 'game', Icon: Gamepad2 },
  { id: 'leaf', Icon: Leaf }, { id: 'sun', Icon: Sun },
  { id: 'run', Icon: Activity }, { id: 'bike', Icon: Bike },
  { id: 'code', Icon: Laptop }, { id: 'notes', Icon: StickyNote },
  { id: 'target', Icon: Target }, { id: 'star', Icon: Star },
  { id: 'strong', Icon: Dumbbell }, { id: 'brain', Icon: Brain },
  { id: 'money', Icon: Coins }, { id: 'art', Icon: Palette },
  { id: 'dance', Icon: Sparkles }, { id: 'salad', Icon: Salad },
  { id: 'sleep', Icon: Bed }, { id: 'read', Icon: BookMarked },
  { id: 'sea', Icon: Waves }, { id: 'heart', Icon: Heart },
];

/** Iconos por categoría (quests y hábitos). */
export const CATEGORY_GLYPHS: Record<string, LucideIcon> = {
  HEALTH: HeartPulse, FITNESS: Dumbbell, FINANCE: Coins, LEARNING: BookOpen,
  LOVE: Heart, SOCIAL: Users, PERSONAL: User, CREATIVE: Palette,
};

/** Escala de ánimo 1-5 (de peor a mejor). */
export const MOOD_GLYPHS: LucideIcon[] = [Frown, Annoyed, Meh, Smile, Laugh];
