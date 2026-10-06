// Tienda (ShopDesktop): Gold animado, destacado, categorías (incluye Temas con
// vista previa), confirmar compra → el saldo baja animado, inventario / equipar.
// Lo que es para el personaje se ve puesto en TU personaje (sombreros,
// accesorios, ropa y peinados) y las auras y marcos alrededor de tu avatar. Al
// comprarlo te lo pones; luego te lo quitas o te lo vuelves a poner desde aquí
// o desde el estudio. Los exclusivos tienen unidades contadas para todos.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Crown, Frame, Gem, Glasses, Lock, Package, Palette, Scissors, Shirt, Sparkles, Ticket, Zap, type LucideIcon } from 'lucide-react';
import type { InventoryItem, ShopItem as Item, User } from '@lifequest/shared';
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

const TYPES: Record<string, { label: string; plural: string; icon: LucideIcon; tone: Exclude<Tone, 'muted'> }> = {
  HAT: { label: 'Sombrero', plural: 'Sombreros', icon: Crown, tone: 'warning' },
  COSMETIC: { label: 'Accesorio', plural: 'Accesorios', icon: Glasses, tone: 'forest' },
  OUTFIT: { label: 'Ropa', plural: 'Ropa', icon: Shirt, tone: 'info' },
  HAIR: { label: 'Peinado', plural: 'Peinados', icon: Scissors, tone: 'secondary' },
  AURA: { label: 'Aura', plural: 'Auras', icon: Sparkles, tone: 'success' },
  FRAME: { label: 'Marco', plural: 'Marcos', icon: Frame, tone: 'warning' },
  THEME: { label: 'Tema', plural: 'Temas', icon: Palette, tone: 'forest' },
  POWERUP: { label: 'Power-up', plural: 'Power-ups', icon: Zap, tone: 'primary' },
  PASS: { label: 'Pase', plural: 'Pases', icon: Ticket, tone: 'info' },
  DECORATION: { label: 'Decoración', plural: 'Decoraciones', icon: Gem, tone: 'info' },
};
/** Orden de las categorías: primero lo que se pone el personaje. */
const ORDER = Object.keys(TYPES);
const typeOf = (t: string) => TYPES[t] ?? { label: t, plural: t, icon: Package, tone: 'primary' as const };
const EQUIPPABLE = new Set(['COSMETIC', 'HAT', 'AURA', 'FRAME', 'THEME', 'OUTFIT', 'HAIR']);
/** Partes del personaje (avatarConfig.pixel) frente a las que viven en la cuenta. */
const AVATAR_SLOTS = new Set(['extra', 'hair', 'top']);
/** Accesorios que se ven mejor de cerca (en la cabeza). */
const HEAD_EXTRAS = new Set(['sombrero_aventurero', 'sombrero_mago', 'birrete', 'casco_vikingo', 'bandana_ninja', 'corona_campeon', 'corona_cristal', 'antifaz', 'monoculo']);

const isAvatarItem = (it: Item): it is Item & { slot: ShopSlot; value: string } => Boolean(it.slot && it.value && AVATAR_SLOTS.has(it.slot));
const isExclusive = (it: Item) => it.stock !== null && it.stock !== undefined;
const soldOutOf = (it: Item) => isExclusive(it) && (it.remaining ?? 0) <= 0;

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
  return {};
}

/** Cómo se ve el artículo: tu personaje con él puesto, tu avatar con el aura o el marco, o la paleta del tema. */
function ItemVisual({ it, user, look, size = 120, live = false }: { it: Item; user: User; look: PixelLook; size?: number; live?: boolean }) {
  if (isAvatarItem(it)) {
    const head = it.slot === 'hair' || HEAD_EXTRAS.has(it.value);
    return (
      <span role="img" aria-label={`Tu personaje con ${it.name}`} className="block">
        <PixelAvatar look={wearShopItem(look, it.slot, it.value, true)} size={head ? size : Math.round(size * 0.8)} crop={head ? 'head' : 'full'} animate={live ? 'idle' : 'none'} />
      </span>
    );
  }
  if ((it.slot === 'aura' || it.slot === 'frame') && it.value) {
    return (
      <span role="img" aria-label={`Tu avatar con ${it.name}`} className="block p-[14%]">
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
      <span role="img" aria-label={`Colores del tema ${it.name}`} className="grid aspect-[16/10] w-36 grid-cols-4 overflow-hidden rounded-2xl shadow-lg">
        {[palette.soft, palette.accent, palette.surface, palette.background].map((c, i) => <span key={i} style={{ background: c }} />)}
      </span>
    );
  }
  return null;
}

/** Exclusivo: cuántas unidades quedan para toda la comunidad. */
function StockBadges({ it }: { it: Item }) {
  if (!isExclusive(it)) return null;
  return (
    <>
      <Badge variant="warning" icon={Gem}>Exclusivo</Badge>
      <Badge variant={soldOutOf(it) ? 'error' : 'neutral'}>{soldOutOf(it) ? 'Agotado' : `Quedan ${it.remaining} de ${it.stock}`}</Badge>
    </>
  );
}

export default function ShopPage() {
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
  const isOwned = (it: Item) => Boolean(it.owned) || invByItem.has(it.id);
  const usable = (it: Item) => !it.locked && (user?.level ?? 1) >= (it.levelRequired ?? 1);
  /** Se pone y se quita desde la Tienda: lo del personaje, auras y marcos. */
  const wearable = (it: Item) => isAvatarItem(it) || it.slot === 'aura' || it.slot === 'frame';

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
      setItems((p) => p.map((i) => (i.id === it.id ? { ...i, owned: true, remaining: isExclusive(i) ? Math.max(0, (i.remaining ?? 1) - 1) : i.remaining } : i)));
      if (isAvatarItem(it)) markOwned(shopKey(it.slot, it.value));
      setPhase('done');
    } catch (e) {
      updateUser({ gold: user.gold });
      toast.error(apiError(e, 'No se pudo comprar'));
      setPending(null);
      if (isExclusive(it)) void shopService.fetchShopItems().then(setItems).catch(() => {});
    } finally { setBuying(false); }
  }

  /** Ponérselo o quitárselo: se ve al instante y la API lo confirma. */
  async function wear(it: Item) {
    const inv = invByItem.get(it.id);
    if (!inv || !user || wearing) return;
    const on = !wornOf(it, user, look);
    const before: Partial<User> = { avatarConfig: user.avatarConfig, equippedAura: user.equippedAura, equippedFrame: user.equippedFrame };
    updateUser(wearLocally(user, it, on));
    setWearing(it.id);
    try {
      const r = await shopService.equipItem(inv.id);
      if (r.user) updateUser(r.user as Partial<User>);
      setInventory((p) => p.map((i) => (i.id === r.id ? { ...i, isEquipped: r.isEquipped } : i)));
      toast.info(on ? `Te pusiste ${it.name}` : `Te quitaste ${it.name}`);
    } catch (e) {
      updateUser(before);
      toast.error(apiError(e, 'No se pudo cambiar'));
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
      toast.info(u.isEquipped ? `${inv.shopItem.name} equipado` : `${inv.shopItem.name} guardado`);
    } catch { toast.error('No se pudo equipar'); void load(); }
  }

  if (state === 'loading') return <PageLoader />;
  if (state === 'error' || !user) return <ErrorState onRetry={() => void load()} />;

  const present = new Set(items.map((i) => i.type));
  const exclusives = items.filter(isExclusive);
  const options: ChipOption<string>[] = [
    { value: 'all', label: 'Todo' },
    ...(exclusives.length ? [{ value: 'exclusive', label: 'Exclusivos' }] : []),
    ...[...ORDER.filter((t) => present.has(t as Item['type'])), ...[...present].filter((t) => !ORDER.includes(t))].map((t) => ({ value: t, label: typeOf(t).plural })),
  ];
  const filtered = cat === 'all' ? items : cat === 'exclusive' ? exclusives : items.filter((i) => i.type === cat);
  const featured = exclusives.find((i) => !isOwned(i) && !soldOutOf(i) && usable(i))
    ?? items.find((i) => isAvatarItem(i) && !isOwned(i) && usable(i))
    ?? items.find((i) => !isOwned(i) && usable(i))
    ?? null;
  const previewId = preview ? themeIdOf(preview) : null;
  const visualOf = (it: Item, size?: number, live?: boolean): ReactNode => <ItemVisual it={it} user={user} look={look} size={size} live={live} />;
  const hasVisual = (it: Item) => isAvatarItem(it) || it.slot === 'aura' || it.slot === 'frame' || (it.type === 'THEME' && Boolean(THEME_PALETTES[themeIdOf(it) ?? '']));

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
        eyebrow="El mercado"
        title="Tienda"
        description="Sombreros, ropa, peinados, auras y marcos: cada cosa se ve puesta en tu personaje antes de comprarla."
        aside={<>
          <GoldBalance ref={balanceRef} value={gold} />
          <div className="w-full max-w-[300px] sm:w-[300px]">
            <SegmentedControl label="Vista" value={view} onChange={setView} options={[{ value: 'shop', label: 'Tienda' }, { value: 'inv', label: 'Inventario' }]} />
          </div>
        </>}
      />

      <AnimatePresence mode="wait">
        {view === 'shop' ? (
          <motion.div key="shop" variants={stagger} initial="initial" animate="animate" exit={{ opacity: 0, transition: { duration: 0.15 } }} className="flex flex-col gap-8">
            {featured && (
              <motion.div variants={itemV}>
                <SpotCard aria-label="Artículo destacado" padding="none" style={winVars(typeOf(featured.type).tone)} className="relative">
                  {/* La tienda principal del pasaje: toldo grande y escaparate con plataforma giratoria */}
                  <Awning size="lg" delay={0.3} className="relative z-10" />
                  <div className="flex flex-wrap items-center gap-8 px-6 pb-6 md:px-8 md:pb-8">
                    <ShopWindow delay={0.65} turn={false} className="-mt-[15px] aspect-[4/3] w-full flex-[0_1_340px] rounded-b-2xl">
                      <span className="lq-turntable block">
                        {hasVisual(featured) ? visualOf(featured, 144, true) : (
                          <IconChip icon={typeOf(featured.type).icon} tone={typeOf(featured.type).tone} size="lg" className="size-28 rounded-[32px] [&>svg]:size-14" />
                        )}
                      </span>
                    </ShopWindow>
                    <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-2.5 md:pt-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-label-lg text-primary-text">{isExclusive(featured) ? 'Exclusivo de temporada' : 'Artículo destacado'}</span>
                        <Badge variant={typeOf(featured.type).tone}>{typeOf(featured.type).label}</Badge>
                      </div>
                      <h2 className="text-display-sm">{featured.name}</h2>
                      {featured.description && <p className="text-body-md text-on-surface-light">{featured.description}</p>}
                      {isExclusive(featured) && <div className="flex flex-wrap gap-1.5"><StockBadges it={featured} /></div>}
                      <div className="mt-2 flex flex-wrap items-center gap-4">
                        <GoldPrice value={featured.cost} className="text-heading-md" />
                        {featured.type === 'THEME' && themeIdOf(featured) && <Button variant="secondary" onClick={() => setPreview(featured)}>Ver</Button>}
                        <Button disabled={featured.cost > gold} onClick={() => open(featured)}>{featured.cost > gold ? 'Sin Gold' : 'Comprar'}</Button>
                      </div>
                    </div>
                  </div>
                </SpotCard>
              </motion.div>
            )}

            <motion.div variants={itemV}><ChipGroup label="Categoría" options={options} value={cat} onChange={setCat} /></motion.div>

            {filtered.length === 0 ? (
              <EmptyState icon={Package} title="Nada en esta categoría" description="Vuelve pronto: el mercado se renueva." />
            ) : (
              <motion.ul key={cat} variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-3">
                {filtered.map((it, idx) => {
                  const t = typeOf(it.type);
                  const lockedByLevel = !usable(it);
                  const owned = isOwned(it);
                  const worn = owned && wornOf(it, user, look);
                  return (
                    <motion.li key={it.id} variants={itemV}>
                      <ShopItem
                        name={it.name}
                        description={lockedByLevel ? `Se desbloquea en el nivel ${it.levelRequired}` : it.description}
                        price={it.cost} icon={lockedByLevel ? Lock : t.icon} tone={lockedByLevel ? 'muted' : t.tone} category={t.label}
                        owned={owned} affordable={!lockedByLevel && it.cost <= gold} soldOut={!owned && soldOutOf(it)}
                        visual={hasVisual(it) ? visualOf(it) : undefined}
                        badges={isExclusive(it) || worn ? <>{worn && <Badge variant="success">Lo llevas puesto</Badge>}<StockBadges it={it} /></> : undefined}
                        worn={worn} onWear={owned && wearable(it) ? () => void wear(it) : undefined} busy={wearing === it.id}
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
              <EmptyState icon={Package} title="Tu inventario está vacío" description="Compra algo en la tienda y aparecerá aquí." action={<Button onClick={() => setView('shop')}>Ir a la tienda</Button>} />
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-3">
                {inventory.map((inv, idx) => {
                  const it = inv.shopItem;
                  const t = typeOf(it.type);
                  const worn = wornOf(it, user, look);
                  return (
                    <motion.li key={inv.id} variants={itemV}>
                      <Card interactive padding="lg" style={winVars(t.tone)} className="group flex h-full flex-col gap-3.5">
                        {/* Tu propia vitrina: lo comprado, iluminado sobre su pedestal */}
                        <ShopWindow delay={0.25 + idx * 0.08} className={hasVisual(it) ? 'aspect-[16/10] rounded-xl' : 'aspect-[16/7] rounded-xl'}>
                          {hasVisual(it) ? visualOf(it, 104) : <IconChip icon={t.icon} tone={t.tone} className="size-14 rounded-2xl [&>svg]:size-8" />}
                        </ShopWindow>
                        <div><h3 className="text-heading-sm">{it.name}</h3><p className="text-body-sm text-on-surface-light">{it.description ?? t.label}</p></div>
                        {wearable(it) ? (
                          <Button size="md" variant={worn ? 'secondary' : 'primary'} aria-pressed={worn} loading={wearing === it.id} onClick={() => void wear(it)} className="mt-auto">
                            {worn ? 'Quitármelo' : 'Ponérmelo'}
                          </Button>
                        ) : EQUIPPABLE.has(it.type) ? (
                          <Button size="md" variant={inv.isEquipped ? 'secondary' : 'primary'} aria-pressed={inv.isEquipped} onClick={() => void equip(inv)} className="mt-auto">
                            {inv.isEquipped ? 'Equipado' : 'Equipar'}
                          </Button>
                        ) : <Badge className="mt-auto self-start">{inv.usedAt ? 'Usado' : 'Listo para usar'}</Badge>}
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
        open={Boolean(pending)} icon={pending ? typeOf(pending.type).icon : undefined} name={pending?.name ?? ''} price={pending?.cost ?? 0} balance={askBalance}
        phase={phase} busy={buying} onConfirm={confirm} onClose={() => setPending(null)}
        visual={pending && phase === 'done' && wearable(pending) ? visualOf(pending, 150, true) : undefined}
        doneText={pending && wearable(pending) ? `Ya llevas puesto ${pending.name}. Te lo quitas cuando quieras desde el inventario o el estudio del personaje.` : undefined}
      />
    </ZoneShell>
  );
}
