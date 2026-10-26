// Tienda (ShopDesktop): Gold animado, destacado, categorías (incluye Temas con
// vista previa), confirmar compra → el saldo baja animado, inventario / equipar.
// Lo que es para el personaje se ve puesto en TU personaje (sombreros,
// accesorios, ropa y peinados) y las auras y marcos alrededor de tu avatar. Al
// comprarlo te lo pones; luego te lo quitas o te lo vuelves a poner desde aquí
// o desde el estudio. Los exclusivos tienen unidades contadas para todos.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Crown, Frame, Gem, Glasses, Lock, Package, Palette, Scissors, ShieldCheck, Shirt, Sparkles, Ticket, Zap, type LucideIcon } from 'lucide-react';
import type { InventoryItem, ShopItem as Item, User } from '@noutlife/shared';
import { item as itemV, stagger } from '@/lib/motion';
import { ZoneShell } from '@/components/ambience';
import { CoinFlight } from '@/components/shop/CoinFlight';
import { Awning, GoldBalance, PendantLamps, ShopWindow, winVars } from '@/components/shop/Storefront';
import { AvatarDisplay } from '@/components/character/AvatarDisplay';
import { PixelAvatar } from '@/components/character/pixel/PixelAvatar';
import type { PixelLook } from '@/components/character/pixel/engine';
import { lookFrom, shopKey, toConfig, wearShopItem, wearsShopItem, type ShopSlot } from '@/components/character/pixel/look';
import { markOwned } from '@/components/character/ownedItems';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import * as shopService from '@/services/shop.service';
import { apiError } from '@/services/network.service';
import { THEME_PALETTES, themeIdOf } from '@/lib/shopThemes';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Badge, Button, Card, ChipGroup, EmptyState, ErrorState, GoldPrice, IconChip, PageLoader, PurchaseDialog,
  SegmentedControl, ShopItem, SpotCard, ThemePreviewDialog, type ChipOption, type Tone,
} from '@/components/ui/lq';
import { useText, type Copy } from '@/lib/i18n';

const COPY: Copy<{
  types: Record<string, { label: string; plural: string }>;
  shieldLabel: string; shieldPlural: string;
  exclusive: string; soldOut: string; left: (n: number, of: number) => string; exclusiveSeason: string; featured: string;
  wornBadge: string; unlockAt: (n: number) => string; yourCharacterWith: (n: string) => string; yourAvatarWith: (n: string) => string; themeColors: (n: string) => string;
  themeOn: string; themeOff: string; wearOn: string; wearOff: string; putOn: string; takeOff: string;
  equip: string; equipped: string; saved: (n: string) => string; equipped2: (n: string) => string; equipFailed: string;
  themeApplied: (n: string) => string; backAurora: string; putOnMsg: (n: string) => string; takeOffMsg: (n: string) => string; changeFailed: string;
  shieldBody: (n: number, plural: boolean) => string; shieldFrom: (cost: number) => string;
  streakCare: string; shieldDaysAll: (n: number) => string; viewShields: string; streakShield: (n: number) => string;
  buy: string; noGold: string; view: string; preview: string;
  nothingHere: string; nothingHereBody: string; inventoryEmpty: string; inventoryEmptyBody: string; goShop: string;
  used: string; readyToUse: string;
  viewLabel: string; shopTab: string; inventoryTab: string;
  market: string; shopTitle: string; shopDesc: string;
  purchaseFailed: string; done: string;
  cats: { all: string; exclusive: string; streak: string };
  themeDone: (n: string) => string;
  wearDone: (n: string) => string;
  shieldDone: (n: number, plural: boolean) => string;
  featuredLabel: string; exclusiveLabel: string; wearLabel: string;
  featuredAria: string; careAria: string; wearTag: string; shieldTag: (n: number, plural: boolean) => string;
  stockLeft: (n: number, of: number) => string; lockName: string;
  wornSr: string; buyNow: string;
  bought: string;
}> = {
  es: {
    types: {
      HAT: { label: 'Sombrero', plural: 'Sombreros' }, COSMETIC: { label: 'Accesorio', plural: 'Accesorios' }, OUTFIT: { label: 'Ropa', plural: 'Ropa' },
      HAIR: { label: 'Peinado', plural: 'Peinados' }, AURA: { label: 'Aura', plural: 'Auras' }, FRAME: { label: 'Marco', plural: 'Marcos' },
      THEME: { label: 'Tema', plural: 'Temas' }, POWERUP: { label: 'Power-up', plural: 'Power-ups' }, PASS: { label: 'Pase', plural: 'Pases' },
      DECORATION: { label: 'Decoración', plural: 'Decoraciones' },
    },
    shieldLabel: 'Protector de racha', shieldPlural: 'Racha',
    exclusive: 'Exclusivo', soldOut: 'Agotado', left: (n, of) => `Quedan ${n} de ${of}`, exclusiveSeason: 'Exclusivo de temporada', featured: 'Artículo destacado',
    wornBadge: 'Lo llevas puesto', unlockAt: (n) => `Se desbloquea en el nivel ${n}`,
    yourCharacterWith: (n) => `Tu personaje con ${n}`, yourAvatarWith: (n) => `Tu avatar con ${n}`, themeColors: (n) => `Colores del tema ${n}`,
    themeOn: 'Usar este tema', themeOff: 'Volver a Aurora', wearOn: 'Ponérmelo', wearOff: 'Quitármelo', putOn: 'Ponérmelo', takeOff: 'Quitármelo',
    equip: 'Equipar', equipped: 'Equipado', saved: (n) => `${n} guardado`, equipped2: (n) => `${n} equipado`, equipFailed: 'No se pudo equipar',
    themeApplied: (n) => `${n}: toda la app cambió`, backAurora: 'Volviste a Aurora, el tema de siempre', putOnMsg: (n) => `Te pusiste ${n}`, takeOffMsg: (n) => `Te quitaste ${n}`,
    changeFailed: 'No se pudo cambiar',
    shieldBody: (n, plural) => `Tu racha general tiene ahora ${n} ${plural ? 'días' : 'día'} de escudo. Si un día no registras actividad, se usa solo.`,
    shieldFrom: (cost) => `Desde ${cost} de oro, un día sin actividad ya no rompe tu racha general.`,
    streakCare: 'Cuida tu racha', shieldDaysAll: (n) => `Tu racha general tiene ${n} ${n === 1 ? 'día' : 'días'} de escudo: si un día no registras actividad, se usa solo.`,
    viewShields: 'Ver protectores', streakShield: (n) => `+${n} ${n === 1 ? 'día' : 'días'} de escudo`,
    buy: 'Comprar', noGold: 'Sin Gold', view: 'Ver', preview: 'Vista previa',
    nothingHere: 'Nada en esta categoría', nothingHereBody: 'Vuelve pronto: el mercado se renueva.',
    inventoryEmpty: 'Tu inventario está vacío', inventoryEmptyBody: 'Compra algo en la tienda y aparecerá aquí.', goShop: 'Ir a la tienda',
    used: 'Usado', readyToUse: 'Listo para usar',
    viewLabel: 'Vista', shopTab: 'Tienda', inventoryTab: 'Inventario',
    market: 'El mercado', shopTitle: 'Tienda', shopDesc: 'Sombreros, ropa, peinados, auras y marcos: cada cosa se ve puesta en tu personaje antes de comprarla.',
    purchaseFailed: 'No se pudo comprar', done: 'Listo',
    cats: { all: 'Todo', exclusive: 'Exclusivos', streak: 'Protectores de racha' },
    themeDone: (n) => `${n} ya está puesto en toda la app. Vuelves a Aurora cuando quieras desde la Tienda, el inventario o Ajustes.`,
    wearDone: (n) => `Ya llevas puesto ${n}. Te lo quitas cuando quieras desde el inventario o el estudio del personaje.`,
    shieldDone: (n, plural) => `Tu racha general tiene ahora ${n} ${plural ? 'días' : 'día'} de escudo. Si un día no registras actividad, se usa solo.`,
    featuredLabel: 'Artículo destacado', exclusiveLabel: 'Exclusivo de temporada', wearLabel: 'Ver protectores',
    featuredAria: 'Artículo destacado', careAria: 'Cuida tu racha', wearTag: 'Lo llevas puesto', shieldTag: (n, plural) => `+${n} ${plural ? 'días' : 'día'} de escudo`,
    stockLeft: (n, of) => `Quedan ${n} de ${of}`, lockName: 'Bloqueado', wornSr: 'Lo llevas puesto', buyNow: 'Comprar',
    bought: 'Comprado',
  },
  en: {
    types: {
      HAT: { label: 'Hat', plural: 'Hats' }, COSMETIC: { label: 'Accessory', plural: 'Accessories' }, OUTFIT: { label: 'Outfit', plural: 'Outfits' },
      HAIR: { label: 'Hairstyle', plural: 'Hairstyles' }, AURA: { label: 'Aura', plural: 'Auras' }, FRAME: { label: 'Frame', plural: 'Frames' },
      THEME: { label: 'Theme', plural: 'Themes' }, POWERUP: { label: 'Power-up', plural: 'Power-ups' }, PASS: { label: 'Pass', plural: 'Passes' },
      DECORATION: { label: 'Decor', plural: 'Decor' },
    },
    shieldLabel: 'Streak protector', shieldPlural: 'Streak',
    exclusive: 'Exclusive', soldOut: 'Sold out', left: (n, of) => `${n} of ${of} left`, exclusiveSeason: 'Seasonal exclusive', featured: 'Featured item',
    wornBadge: 'You are wearing it', unlockAt: (n) => `Unlocks at level ${n}`,
    yourCharacterWith: (n) => `Your character with ${n}`, yourAvatarWith: (n) => `Your avatar with ${n}`, themeColors: (n) => `Colors of the ${n} theme`,
    themeOn: 'Use this theme', themeOff: 'Back to Aurora', wearOn: 'Put it on', wearOff: 'Take it off', putOn: 'Put it on', takeOff: 'Take it off',
    equip: 'Equip', equipped: 'Equipped', saved: (n) => `${n} stored`, equipped2: (n) => `${n} equipped`, equipFailed: "We couldn't equip it",
    themeApplied: (n) => `${n}: the whole app changed`, backAurora: 'You went back to Aurora, the classic theme', putOnMsg: (n) => `You put on ${n}`, takeOffMsg: (n) => `You took off ${n}`,
    changeFailed: "We couldn't change it",
    shieldBody: (n, plural) => `Your overall streak now has ${n} ${plural ? 'days' : 'day'} of shield. If a day goes by with no activity, it is used automatically.`,
    shieldFrom: (cost) => `From ${cost} gold, a day with no activity no longer breaks your overall streak.`,
    streakCare: 'Protect your streak', shieldDaysAll: (n) => `Your overall streak has ${n} ${n === 1 ? 'day' : 'days'} of shield: if a day goes by with no activity, it is used automatically.`,
    viewShields: 'See protectors', streakShield: (n) => `+${n} ${n === 1 ? 'day' : 'days'} of shield`,
    buy: 'Buy', noGold: 'Not enough gold', view: 'View', preview: 'Preview',
    nothingHere: 'Nothing in this category', nothingHereBody: 'Check back soon: the market restocks.',
    inventoryEmpty: 'Your inventory is empty', inventoryEmptyBody: 'Buy something in the shop and it will show up here.', goShop: 'Go to the shop',
    used: 'Used', readyToUse: 'Ready to use',
    viewLabel: 'View', shopTab: 'Shop', inventoryTab: 'Inventory',
    market: 'The market', shopTitle: 'Shop', shopDesc: 'Hats, outfits, hairstyles, auras and frames: see each one on your character before you buy it.',
    purchaseFailed: "We couldn't complete the purchase", done: 'Done',
    cats: { all: 'All', exclusive: 'Exclusives', streak: 'Streak protectors' },
    themeDone: (n) => `${n} is now on across the whole app. Go back to Aurora anytime from the Shop, your inventory or Settings.`,
    wearDone: (n) => `You are wearing ${n}. Take it off anytime from your inventory or the character studio.`,
    shieldDone: (n, plural) => `Your overall streak now has ${n} ${plural ? 'days' : 'day'} of shield. If a day goes by with no activity, it is used automatically.`,
    featuredLabel: 'Featured item', exclusiveLabel: 'Seasonal exclusive', wearLabel: 'See protectors',
    featuredAria: 'Featured item', careAria: 'Protect your streak', wearTag: 'You are wearing it', shieldTag: (n, plural) => `+${n} ${plural ? 'days' : 'day'} of shield`,
    stockLeft: (n, of) => `${n} of ${of} left`, lockName: 'Locked', wornSr: 'You are wearing it', buyNow: 'Buy',
    bought: 'Bought',
  },
};

const TYPE_ICON_TONE: Record<string, { label: string; icon: LucideIcon; tone: Exclude<Tone, 'muted'> }> = {
  HAT: { label: 'Sombrero', icon: Crown, tone: 'warning' },
  COSMETIC: { label: 'Accesorio', icon: Glasses, tone: 'forest' },
  OUTFIT: { label: 'Ropa', icon: Shirt, tone: 'info' },
  HAIR: { label: 'Peinado', icon: Scissors, tone: 'secondary' },
  AURA: { label: 'Aura', icon: Sparkles, tone: 'success' },
  FRAME: { label: 'Marco', icon: Frame, tone: 'warning' },
  THEME: { label: 'Tema', icon: Palette, tone: 'forest' },
  POWERUP: { label: 'Power-up', icon: Zap, tone: 'primary' },
  PASS: { label: 'Pase', icon: Ticket, tone: 'info' },
  DECORATION: { label: 'Decoración', icon: Gem, tone: 'info' },
};
/** Orden de las categorías: primero lo que se pone el personaje. */
const ORDER = Object.keys(TYPE_ICON_TONE);
/** Protector de racha (Pase de Perdón, Escudo): se activa al comprarlo y se puede volver a comprar. */
const isShield = (it: Item) => Boolean(it.shieldDays);
const SHIELD_TONE = { icon: ShieldCheck, tone: 'warning' as const };
const EQUIPPABLE = new Set(['COSMETIC', 'HAT', 'AURA', 'FRAME', 'THEME', 'OUTFIT', 'HAIR']);
/** Partes del personaje (avatarConfig.pixel) frente a las que viven en la cuenta. */
const AVATAR_SLOTS = new Set(['extra', 'hair', 'top']);
/** Accesorios que se ven mejor de cerca (en la cabeza). */
const HEAD_EXTRAS = new Set(['sombrero_aventurero', 'sombrero_mago', 'birrete', 'casco_vikingo', 'bandana_ninja', 'corona_campeon', 'corona_cristal', 'antifaz', 'monoculo']);

const isAvatarItem = (it: Item): it is Item & { slot: ShopSlot; value: string } => Boolean(it.slot && it.value && AVATAR_SLOTS.has(it.slot));
const isExclusive = (it: Item) => it.stock !== null && it.stock !== undefined;
const soldOutOf = (it: Item) => isExclusive(it) && (it.remaining ?? 0) <= 0;
const isTheme = (it: Item) => it.slot === 'theme' && Boolean(themeIdOf(it));

/** ¿Lo lleva puesto? Se lee del personaje y de la cuenta (así coincide con el estudio). */
function wornOf(it: Item, user: User | null, look: PixelLook) {
  if (!user || !it.value) return false;
  if (isAvatarItem(it)) return wearsShopItem(look, it.slot, it.value);
  if (it.slot === 'aura') return user.equippedAura === it.value;
  if (it.slot === 'frame') return user.equippedFrame === it.value;
  if (it.slot === 'theme') return user.equippedTheme === it.value;
  return false;
}

/** La cuenta con el artículo puesto o quitado (para verlo al instante, antes de que conteste la API). */
function wearLocally(user: User, it: Item, on: boolean): Partial<User> {
  if (!it.value) return {};
  if (isAvatarItem(it)) return { avatarConfig: toConfig(wearShopItem(lookFrom(user.avatarConfig), it.slot, it.value, on), user.avatarConfig) };
  if (it.slot === 'aura') return { equippedAura: on ? it.value : null };
  if (it.slot === 'frame') return { equippedFrame: on ? it.value : null };
  if (it.slot === 'theme') return { equippedTheme: on ? it.value : null };
  return {};
}

/** Cómo se ve el artículo: tu personaje con él puesto, tu avatar con el aura o el marco, o la paleta del tema. */
function ItemVisual({ it, user, look, size = 120, live = false, t }: { it: Item; user: User; look: PixelLook; size?: number; live?: boolean; t: { yourCharacterWith: (n: string) => string; yourAvatarWith: (n: string) => string; themeColors: (n: string) => string } }) {
  if (isAvatarItem(it)) {
    const head = it.slot === 'hair' || HEAD_EXTRAS.has(it.value);
    return (
      <span role="img" aria-label={t.yourCharacterWith(it.name)} className="block">
        <PixelAvatar look={wearShopItem(look, it.slot, it.value, true)} size={head ? size : Math.round(size * 0.8)} crop={head ? 'head' : 'full'} animate={live ? 'idle' : 'none'} />
      </span>
    );
  }
  if ((it.slot === 'aura' || it.slot === 'frame') && it.value) {
    return (
      <span role="img" aria-label={t.yourAvatarWith(it.name)} className="block p-[14%]">
        <AvatarDisplay
          avatarConfig={user.avatarConfig} avatarUrl={user.avatarUrl} size={Math.round(size * 0.62)} animate="none"
          equippedAura={it.slot === 'aura' ? it.value : null} equippedFrame={it.slot === 'frame' ? it.value : null}
        />
      </span>
    );
  }
  const palette = it.type === 'THEME' ? THEME_PALETTES[themeIdOf(it) ?? ''] : undefined;
  if (palette) {
    return (
      <span role="img" aria-label={t.themeColors(it.name)} className="grid aspect-[16/10] w-36 grid-cols-4 overflow-hidden rounded-2xl shadow-lg">
        {[palette.soft, palette.accent, palette.surface, palette.background].map((c, i) => <span key={i} style={{ background: c }} />)}
      </span>
    );
  }
  return null;
}

export default function ShopPage() {
  const t = useText(COPY);
  const { user, updateUser } = useAuthStore();
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [view, setView] = useState<'shop' | 'inv'>('shop');
  const [cat, setCat] = useState<string>('all');
  const [pending, setPending] = useState<Item | null>(null);
  const [phase, setPhase] = useState<'ask' | 'done'>('ask');
  const [buying, setBuying] = useState(false);
  const [wearing, setWearing] = useState<string | null>(null);
  const [preview, setPreview] = useState<Item | null>(null);

  const typeOf = (ty: string) => {
    const meta = TYPE_ICON_TONE[ty];
    return meta ? { label: t.types[ty]?.label ?? meta.label, plural: t.types[ty]?.plural ?? meta.label, icon: meta.icon, tone: meta.tone }
      : { label: ty, plural: ty, icon: Package, tone: 'primary' as const };
  };
  const shieldMeta = { label: t.shieldLabel, plural: t.shieldPlural, ...SHIELD_TONE };
  const typeOfItem = (it: Item) => (isShield(it) ? shieldMeta : typeOf(it.type));

  const load = useCallback(async () => {
    setState('loading');
    try {
      const [s, inv] = await Promise.all([shopService.fetchShopItems(), shopService.fetchInventory()]);
      setItems(s); setInventory(inv); setState('ready');
    } catch { setState('error'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const gold = user?.gold ?? 0;
  const look = useMemo(() => lookFrom(user?.avatarConfig), [user?.avatarConfig]);
  const invByItem = useMemo(() => new Map(inventory.map((i) => [i.shopItemId, i])), [inventory]);
  const isOwned = (it: Item) => !isShield(it) && (Boolean(it.owned) || invByItem.has(it.id));
  const shieldDays = user?.streakShieldDays ?? 0;
  const usable = (it: Item) => !it.locked && (user?.level ?? 1) >= (it.levelRequired ?? 1);
  /** Se pone y se quita desde la Tienda: lo del personaje, auras, marcos y temas. */
  const wearable = (it: Item) => isAvatarItem(it) || it.slot === 'aura' || it.slot === 'frame' || isTheme(it);
  const themeWear = { on: t.themeOn, off: t.themeOff };

  /** Saldo al abrir el diálogo: la compra optimista no debe cambiar la cuenta que se muestra. */
  const [askBalance, setAskBalance] = useState(0);
  const open = (it: Item) => { setPending(it); setPhase('ask'); setAskBalance(user?.gold ?? 0); };
  /** Monedas que salen del saldo al comprar (una ráfaga por compra). */
  const balanceRef = useRef<HTMLSpanElement>(null);
  const [coins, setCoins] = useState(0);
  async function confirm() {
    if (!pending || !user) return;
    const it = pending;
    setBuying(true);
    updateUser({ gold: user.gold - it.cost }); // optimista: el saldo baja animado
    setCoins((n) => n + 1);
    try {
      const r = await shopService.purchaseItem(it.id);
      updateUser(r.user as Partial<User>);
      setInventory((p) => [r.inventoryItem, ...p]);
      setItems((p) => p.map((i) => (i.id === it.id ? { ...i, owned: !isShield(i), remaining: isExclusive(i) ? Math.max(0, (i.remaining ?? 1) - 1) : i.remaining } : i)));
      if (isAvatarItem(it)) markOwned(shopKey(it.slot, it.value));
      setPhase('done');
    } catch (e) {
      updateUser({ gold: user.gold });
      toast.error(apiError(e, t.purchaseFailed));
      setPending(null);
      if (isExclusive(it)) void shopService.fetchShopItems().then(setItems).catch(() => {});
    } finally { setBuying(false); }
  }

  /** Ponérselo o quitárselo: se ve al instante y la API lo confirma. */
  async function wear(it: Item) {
    const inv = invByItem.get(it.id);
    if (!inv || !user || wearing) return;
    const on = !wornOf(it, user, look);
    const before: Partial<User> = { avatarConfig: user.avatarConfig, equippedAura: user.equippedAura, equippedFrame: user.equippedFrame, equippedTheme: user.equippedTheme };
    updateUser(wearLocally(user, it, on));
    setWearing(it.id);
    try {
      const r = await shopService.equipItem(inv.id);
      if (r.user) updateUser(r.user as Partial<User>);
      setInventory((p) => p.map((i) => (i.id === r.id ? { ...i, isEquipped: r.isEquipped } : i)));
      if (isTheme(it)) toast.success(on && themeIdOf(it) !== 'aurora' ? t.themeApplied(it.name) : t.backAurora);
      else toast.info(on ? t.putOnMsg(it.name) : t.takeOffMsg(it.name));
    } catch (e) {
      updateUser(before);
      toast.error(apiError(e, t.changeFailed));
    } finally { setWearing(null); }
  }

  /** Temas y artículos antiguos: se equipan como antes (uno por tipo). */
  async function equip(inv: InventoryItem) {
    const same = EQUIPPABLE.has(inv.shopItem.type);
    setInventory((p) => p.map((i) => ({ ...i, isEquipped: i.id === inv.id ? !i.isEquipped : same && i.shopItem.type === inv.shopItem.type ? false : i.isEquipped })));
    try {
      const u = await shopService.equipItem(inv.id);
      if (u.user) updateUser(u.user as Partial<User>);
      setInventory((p) => p.map((i) => (i.id === u.id ? { ...i, isEquipped: u.isEquipped } : i)));
      toast.info(u.isEquipped ? t.equipped2(inv.shopItem.name) : t.saved(inv.shopItem.name));
    } catch { toast.error(t.equipFailed); void load(); }
  }

  if (state === 'loading') return <PageLoader />;
  if (state === 'error' || !user) return <ErrorState onRetry={() => void load()} />;

  const present = new Set(items.filter((i) => !isShield(i)).map((i) => i.type));
  const exclusives = items.filter(isExclusive);
  const shields = items.filter(isShield).sort((a, b) => a.cost - b.cost);
  const options: ChipOption<string>[] = [
    { value: 'all', label: t.cats.all },
    ...(exclusives.length ? [{ value: 'exclusive', label: t.cats.exclusive }] : []),
    ...(shields.length ? [{ value: 'streak', label: shieldMeta.plural }] : []),
    ...[...ORDER.filter((ty) => present.has(ty as Item['type'])), ...[...present].filter((ty) => !ORDER.includes(ty))].map((ty) => ({ value: ty, label: typeOf(ty).plural })),
  ];
  const filtered = cat === 'all' ? items : cat === 'exclusive' ? exclusives : cat === 'streak' ? shields : items.filter((i) => i.type === cat && !isShield(i));
  const featured = exclusives.find((i) => !isOwned(i) && !soldOutOf(i) && usable(i))
    ?? items.find((i) => isAvatarItem(i) && !isOwned(i) && usable(i))
    ?? items.find((i) => !isOwned(i) && usable(i))
    ?? null;
  const previewId = preview ? themeIdOf(preview) : null;
  const visualOf = (it: Item, size?: number, live?: boolean): ReactNode => <ItemVisual it={it} user={user} look={look} size={size} live={live} t={t} />;
  const hasVisual = (it: Item) => isAvatarItem(it) || it.slot === 'aura' || it.slot === 'frame' || (it.type === 'THEME' && Boolean(THEME_PALETTES[themeIdOf(it) ?? '']));
  /** Exclusivo: cuántas unidades quedan para toda la comunidad. */
  const stockBadges = (it: Item) => {
    if (!isExclusive(it)) return null;
    return (
      <>
        <Badge variant="warning" icon={Gem}>{t.exclusive}</Badge>
        <Badge variant={soldOutOf(it) ? 'error' : 'neutral'}>{soldOutOf(it) ? t.soldOut : t.left(it.remaining ?? 0, it.stock ?? 0)}</Badge>
      </>
    );
  };
  const plural = (n: number) => n !== 1;

  return (
    <ZoneShell
      zone="shop"
      contentClassName="gap-8 md:gap-12"
      ambience={(
        /* El pasaje: lámparas que cuelgan del techo y se encienden al abrir */
        <PendantLamps lamps={[
          { x: '58%', cord: 46, d: 8, className: 'hidden md:block' },
          { x: '74%', cord: 78, d: 9.5, className: 'hidden md:block' },
          { x: '64%', cord: 18, d: 9, className: 'md:hidden' },
          { x: '90%', cord: 34, d: 7.5 },
        ]} />
      )}
    >
      <PageHeader
        eyebrow={t.market}
        title={t.shopTitle}
        description={t.shopDesc}
        aside={<>
          <GoldBalance ref={balanceRef} value={gold} />
          <div className="w-full max-w-[300px] sm:w-[300px]">
            <SegmentedControl label={t.viewLabel} value={view} onChange={setView} options={[{ value: 'shop', label: t.shopTab }, { value: 'inv', label: t.inventoryTab }]} />
          </div>
        </>}
      />

      <AnimatePresence mode="wait">
        {view === 'shop' ? (
          <motion.div key="shop" variants={stagger} initial="initial" animate="animate" exit={{ opacity: 0, transition: { duration: 0.15 } }} className="flex flex-col gap-8">
            {featured && (
              <motion.div variants={itemV}>
                <SpotCard aria-label={t.featuredAria} padding="none" style={winVars(typeOfItem(featured).tone)} className="relative">
                  {/* La tienda principal del pasaje: toldo grande y escaparate con plataforma giratoria */}
                  <Awning size="lg" delay={0.3} className="relative z-10" />
                  <div className="flex flex-wrap items-center gap-8 px-6 pb-6 md:px-8 md:pb-8">
                    <ShopWindow delay={0.65} turn={false} className="-mt-[15px] aspect-[4/3] w-full flex-[0_1_340px] rounded-b-2xl">
                      <span className="lq-turntable block">
                        {hasVisual(featured) ? visualOf(featured, 144, true) : (
                          <IconChip icon={typeOfItem(featured).icon} tone={typeOfItem(featured).tone} size="lg" className="size-28 rounded-[32px] [&>svg]:size-14" />
                        )}
                      </span>
                    </ShopWindow>
                    <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-2.5 md:pt-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-label-lg text-primary-text">{isExclusive(featured) ? t.exclusiveLabel : t.featuredLabel}</span>
                        <Badge variant={typeOfItem(featured).tone}>{typeOfItem(featured).label}</Badge>
                      </div>
                      <h2 className="text-display-sm">{featured.name}</h2>
                      {featured.description && <p className="text-body-md text-on-surface-light">{featured.description}</p>}
                      {isExclusive(featured) && <div className="flex flex-wrap gap-1.5">{stockBadges(featured)}</div>}
                      <div className="mt-2 flex flex-wrap items-center gap-4">
                        <GoldPrice value={featured.cost} className="text-heading-md" />
                        {featured.type === 'THEME' && themeIdOf(featured) && <Button variant="secondary" onClick={() => setPreview(featured)}>{t.view}</Button>}
                        <Button disabled={featured.cost > gold} onClick={() => open(featured)}>{featured.cost > gold ? t.noGold : t.buy}</Button>
                      </div>
                    </div>
                  </div>
                </SpotCard>
              </motion.div>
            )}

            {shields.length > 0 && (
              <motion.aside variants={itemV} aria-label={t.careAria} className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-warning/30 bg-warning/[var(--lq-soft-alpha)] px-4 py-3 md:px-5">
                <ShieldCheck aria-hidden className="size-6 shrink-0 text-warning-text" strokeWidth={1.75} />
                <p className="min-w-0 flex-[1_1_260px] text-body-md text-on-surface">
                  <span className="font-semibold">{t.streakCare}</span>{' '}
                  {shieldDays > 0 ? t.shieldDaysAll(shieldDays) : t.shieldFrom(shields[0].cost)}
                </p>
                {cat !== 'streak' && <Button size="sm" variant="secondary" onClick={() => setCat('streak')}>{t.viewShields}</Button>}
              </motion.aside>
            )}

            <motion.div variants={itemV}><ChipGroup label={t.viewLabel} options={options} value={cat} onChange={setCat} /></motion.div>

            {filtered.length === 0 ? (
              <EmptyState icon={Package} title={t.nothingHere} description={t.nothingHereBody} />
            ) : (
              <motion.ul key={cat} variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-3">
                {filtered.map((it, idx) => {
                  const ty = typeOfItem(it);
                  const lockedByLevel = !usable(it);
                  const owned = isOwned(it);
                  const worn = owned && wornOf(it, user, look);
                  return (
                    <motion.li key={it.id} variants={itemV}>
                      <ShopItem
                        name={it.name}
                        description={lockedByLevel ? t.unlockAt(it.levelRequired ?? 1) : it.description}
                        price={it.cost} icon={lockedByLevel ? Lock : ty.icon} tone={lockedByLevel ? 'muted' : ty.tone} category={ty.label}
                        owned={owned} affordable={!lockedByLevel && it.cost <= gold} soldOut={!owned && soldOutOf(it)}
                        visual={hasVisual(it) ? visualOf(it) : undefined}
                        badges={isShield(it)
                          ? <Badge variant="warning" icon={ShieldCheck}>{t.streakShield(it.shieldDays ?? 0)}</Badge>
                          : isExclusive(it) || worn ? <>{worn && <Badge variant="success">{t.wornBadge}</Badge>}{stockBadges(it)}</> : undefined}
                        worn={worn} onWear={owned && wearable(it) ? () => void wear(it) : undefined} busy={wearing === it.id}
                        wearLabels={isTheme(it) ? { on: t.wearOn, off: t.wearOff } : undefined}
                        onBuy={() => open(it)}
                        onPreview={it.type === 'THEME' && themeIdOf(it) ? () => setPreview(it) : undefined}
                        locked={lockedByLevel} index={idx}
                      />
                    </motion.li>
                  );
                })}
              </motion.ul>
            )}
          </motion.div>
        ) : (
          <motion.div key="inv" variants={stagger} initial="initial" animate="animate" exit={{ opacity: 0, transition: { duration: 0.15 } }}>
            {inventory.length === 0 ? (
              <EmptyState icon={Package} title={t.inventoryEmpty} description={t.inventoryEmptyBody} action={<Button onClick={() => setView('shop')}>{t.goShop}</Button>} />
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-3">
                {inventory.map((inv, idx) => {
                  const it = inv.shopItem;
                  const ty = typeOfItem(it);
                  const worn = wornOf(it, user, look);
                  return (
                    <motion.li key={inv.id} variants={itemV}>
                      <Card interactive padding="lg" style={winVars(ty.tone)} className="group flex h-full flex-col gap-3.5">
                        {/* Tu propia vitrina: lo comprado, iluminado sobre su pedestal */}
                        <ShopWindow delay={0.25 + idx * 0.08} className={hasVisual(it) ? 'aspect-[16/10] rounded-xl' : 'aspect-[16/7] rounded-xl'}>
                          {hasVisual(it) ? visualOf(it, 104) : <IconChip icon={ty.icon} tone={ty.tone} className="size-14 rounded-2xl [&>svg]:size-8" />}
                        </ShopWindow>
                        <div><h3 className="text-heading-sm">{it.name}</h3><p className="text-body-sm text-on-surface-light">{it.description ?? ty.label}</p></div>
                        {wearable(it) ? (
                          <Button size="md" variant={worn ? 'secondary' : 'primary'} aria-pressed={worn} loading={wearing === it.id} onClick={() => void wear(it)} className="mt-auto">
                            {isTheme(it) ? (worn ? themeWear.off : themeWear.on) : worn ? t.takeOff : t.putOn}
                          </Button>
                        ) : EQUIPPABLE.has(it.type) ? (
                          <Button size="md" variant={inv.isEquipped ? 'secondary' : 'primary'} aria-pressed={inv.isEquipped} onClick={() => void equip(inv)} className="mt-auto">
                            {inv.isEquipped ? t.equipped : t.equip}
                          </Button>
                        ) : isShield(it)
                          ? <Badge variant="success" icon={ShieldCheck} className="mt-auto self-start">{t.streakShield(it.shieldDays ?? 0)}</Badge>
                          : <Badge className="mt-auto self-start">{inv.usedAt ? t.used : t.readyToUse}</Badge>}
                      </Card>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {preview && previewId && (
        <ThemePreviewDialog
          open name={preview.name} price={preview.cost} palette={THEME_PALETTES[previewId]} owned={isOwned(preview)}
          onClose={() => setPreview(null)} onBuy={() => { const p = preview; setPreview(null); open(p); }}
        />
      )}
      {coins > 0 && <CoinFlight key={coins} from={balanceRef} />}
      <PurchaseDialog
        open={Boolean(pending)} icon={pending ? typeOfItem(pending).icon : undefined} name={pending?.name ?? ''} price={pending?.cost ?? 0} balance={askBalance}
        phase={phase} busy={buying} onConfirm={confirm} onClose={() => setPending(null)}
        visual={pending && phase === 'done' && wearable(pending) ? visualOf(pending, 150, true) : undefined}
        doneText={pending && isTheme(pending)
          ? t.themeDone(pending.name)
          : pending && wearable(pending)
          ? t.wearDone(pending.name)
          : pending && isShield(pending)
            ? t.shieldDone(shieldDays, plural(shieldDays))
            : undefined}
      />
    </ZoneShell>
  );
}
