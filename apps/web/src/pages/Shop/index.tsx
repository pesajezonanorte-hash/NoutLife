// Tienda (ShopDesktop): Gold animado, destacado, categorías (incluye Temas con
// vista previa), confirmar compra → el saldo baja animado, inventario / equipar.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Coins, Crown, Frame, Gem, Lock, Package, Palette, Shirt, Sparkles, Ticket, Zap, type LucideIcon } from 'lucide-react';
import type { InventoryItem, ShopItem as Item } from '@lifequest/shared';
import { item as itemV, stagger } from '@/lib/motion';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import * as shopService from '@/services/shop.service';
import { THEME_PALETTES, themeIdOf } from '@/lib/shopThemes';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  AnimatedValue, Badge, Button, Card, ChipGroup, EmptyState, ErrorState, GoldPrice, IconChip, PageLoader, PurchaseDialog,
  SegmentedControl, ShopItem, SpotCard, ThemePreviewDialog, type ChipOption, type Tone,
} from '@/components/ui/lq';

type Type = Item['type'];
const TYPES: Record<string, { label: string; plural: string; icon: LucideIcon; tone: Exclude<Tone, 'muted'> }> = {
  THEME: { label: 'Tema', plural: 'Temas', icon: Palette, tone: 'forest' },
  HAT: { label: 'Sombrero', plural: 'Sombreros', icon: Crown, tone: 'warning' },
  AURA: { label: 'Aura', plural: 'Auras', icon: Sparkles, tone: 'success' },
  FRAME: { label: 'Marco', plural: 'Marcos', icon: Frame, tone: 'warning' },
  POWERUP: { label: 'Power-up', plural: 'Power-ups', icon: Zap, tone: 'primary' },
  PASS: { label: 'Pase', plural: 'Pases', icon: Ticket, tone: 'info' },
  COSMETIC: { label: 'Cosmético', plural: 'Cosméticos', icon: Shirt, tone: 'forest' },
  DECORATION: { label: 'Decoración', plural: 'Decoraciones', icon: Gem, tone: 'info' },
};
const typeOf = (t: string) => TYPES[t] ?? { label: t, plural: t, icon: Package, tone: 'primary' as const };
const EQUIPPABLE = new Set(['COSMETIC', 'HAT', 'AURA', 'FRAME', 'THEME']);
type Locked = Item & { locked?: boolean };

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
  const owned = useMemo(() => new Set(inventory.map((i) => i.shopItemId)), [inventory]);
  const isOwned = (it: Item) => Boolean(it.owned) || owned.has(it.id);
  const usable = (it: Item) => !(it as Locked).locked && (user?.level ?? 1) >= (it.levelRequired ?? 1);

  const open = (it: Item) => { setPending(it); setPhase('ask'); };
  async function confirm() {
    if (!pending || !user) return;
    setBuying(true);
    updateUser({ ...user, gold: user.gold - pending.cost }); // optimista: el saldo baja animado
    try {
      const r = await shopService.purchaseItem(pending.id);
      updateUser(r.user as never);
      setInventory((p) => [...p, r.inventoryItem]);
      setItems((p) => p.map((i) => (i.id === pending.id ? { ...i, owned: true } : i)));
      setPhase('done');
    } catch (e) {
      updateUser({ ...user, gold: user.gold });
      toast.error(e instanceof Error ? e.message : 'No se pudo comprar');
      setPending(null);
    } finally { setBuying(false); }
  }
  async function equip(inv: InventoryItem) {
    const same = EQUIPPABLE.has(inv.shopItem.type);
    setInventory((p) => p.map((i) => ({ ...i, isEquipped: i.id === inv.id ? !i.isEquipped : same && i.shopItem.type === inv.shopItem.type ? false : i.isEquipped })));
    try {
      const u = await shopService.equipItem(inv.id);
      setInventory((p) => p.map((i) => (i.id === u.id ? u : i)));
      toast.info(u.isEquipped ? `${inv.shopItem.name} equipado` : `${inv.shopItem.name} guardado`);
    } catch { toast.error('No se pudo equipar'); void load(); }
  }

  if (state === 'loading') return <PageLoader />;
  if (state === 'error') return <ErrorState onRetry={() => void load()} />;

  const present = [...new Set(items.map((i) => i.type))];
  const options: ChipOption<string>[] = [{ value: 'all', label: 'Todo' }, ...present.map((t) => ({ value: t, label: typeOf(t).plural }))];
  const filtered = cat === 'all' ? items : items.filter((i) => i.type === cat);
  const featured = items.find((i) => i.type === 'THEME' && !isOwned(i) && usable(i)) ?? items.find((i) => !isOwned(i) && usable(i)) ?? null;
  const featuredPalette = featured ? THEME_PALETTES[themeIdOf(featured) ?? ''] : undefined;
  const previewId = preview ? themeIdOf(preview) : null;

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-8 md:gap-12">
      <PageHeader
        eyebrow="El mercado"
        title="Tienda"
        description="Gasta tu Gold sabiamente, héroe."
        aside={<>
          <Badge variant="warning" size="lg" icon={Coins}>
            <span aria-live="polite" className="font-mono tabular-nums"><AnimatedValue value={gold} /></span> Gold
          </Badge>
          <div className="w-full max-w-[300px] sm:w-[300px]">
            <SegmentedControl label="Vista" value={view} onChange={setView} options={[{ value: 'shop', label: 'Tienda' }, { value: 'inv', label: 'Inventario' }]} />
          </div>
        </>}
      />

      <AnimatePresence mode="wait" initial={false}>
        {view === 'shop' ? (
          <motion.div key="shop" variants={stagger} initial="initial" animate="animate" exit={{ opacity: 0, transition: { duration: 0.15 } }} className="flex flex-col gap-8">
            {featured && (
              <motion.div variants={itemV}>
                <SpotCard aria-label="Artículo destacado" className="flex flex-wrap items-center gap-8">
                  {featuredPalette ? (
                    <div role="img" aria-label={`Vista previa del tema ${featured.name}`}
                      className="grid aspect-[16/10] flex-[0_1_320px] animate-float grid-cols-4 overflow-hidden rounded-[20px] shadow-lg [.reduce-motion_&]:animate-none">
                      {[featuredPalette.soft, featuredPalette.accent, featuredPalette.surface, featuredPalette.background].map((c, i) => <span key={i} style={{ background: c }} />)}
                    </div>
                  ) : (
                    <IconChip icon={typeOf(featured.type).icon} tone={typeOf(featured.type).tone} size="lg" className="size-28 animate-float rounded-[32px] [.reduce-motion_&]:animate-none [&>svg]:size-14" />
                  )}
                  <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-2.5">
                    <div className="flex flex-wrap items-center gap-2"><span className="text-label-lg text-primary-text">Artículo destacado</span><Badge variant={typeOf(featured.type).tone}>{typeOf(featured.type).label}</Badge></div>
                    <h2 className="text-display-sm">{featured.name}</h2>
                    {featured.description && <p className="text-body-md text-on-surface-light">{featured.description}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-4">
                      <GoldPrice value={featured.cost} className="text-heading-md" />
                      {featuredPalette && <Button variant="secondary" onClick={() => setPreview(featured)}>Ver</Button>}
                      <Button disabled={featured.cost > gold} onClick={() => open(featured)}>{featured.cost > gold ? 'Sin Gold' : 'Comprar'}</Button>
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
                {filtered.map((it) => {
                  const t = typeOf(it.type);
                  const lockedByLevel = !usable(it);
                  return (
                    <motion.li key={it.id} variants={itemV}>
                      <ShopItem
                        name={it.name}
                        description={lockedByLevel ? `Se desbloquea en el nivel ${it.levelRequired}` : it.description}
                        price={it.cost} icon={lockedByLevel ? Lock : t.icon} tone={lockedByLevel ? 'muted' : t.tone} category={t.label}
                        owned={isOwned(it)} affordable={!lockedByLevel && it.cost <= gold}
                        onBuy={() => open(it)}
                        onPreview={it.type === 'THEME' && themeIdOf(it) ? () => setPreview(it) : undefined}
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
                {inventory.map((inv) => {
                  const t = typeOf(inv.shopItem.type);
                  const equippable = EQUIPPABLE.has(inv.shopItem.type);
                  return (
                    <motion.li key={inv.id} variants={itemV}>
                      <Card interactive padding="lg" className="flex h-full flex-col gap-3.5">
                        <IconChip icon={t.icon} tone={t.tone} className="size-14 rounded-2xl [&>svg]:size-8" />
                        <div><h3 className="text-heading-sm">{inv.shopItem.name}</h3><p className="text-body-sm text-on-surface-light">{inv.shopItem.description ?? t.label}</p></div>
                        {equippable ? (
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
      <PurchaseDialog
        open={Boolean(pending)} name={pending?.name ?? ''} price={pending?.cost ?? 0} balance={phase === 'ask' ? gold : gold + (pending?.cost ?? 0)}
        phase={phase} busy={buying} onConfirm={confirm} onClose={() => setPending(null)}
      />
    </motion.div>
  );
}
