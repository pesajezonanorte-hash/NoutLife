import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../hooks/useToast';
import { PixelPanel } from '../../components/ui/PixelPanel';
import { PixelButton } from '../../components/ui/PixelButton';
import type { ShopItem, InventoryItem } from '@lifequest/shared';
import * as shopService from '../../services/shop.service';
import { E } from '@/components/ui/glyphs';
import ModernLoader from '@/components/ui/modern-loader-adapted';
import { LoadingGate } from '@/components/ui/LoadingGate';
import { LOADING_COPY } from '@/lib/loadingCopy';

const THEME_PREVIEW_COLORS: Record<string, { bg: string; card: string; accent: string }> = {
  aurora:  { bg: '#131316', card: '#1a1a1e', accent: '#d9b44a' },
  cyber:   { bg: '#050505', card: '#0d0d0d', accent: '#f5f5f5' },
  forest:  { bg: '#151411', card: '#1c1a16', accent: '#c9a94e' },
  ocean:   { bg: '#121316', card: '#181a1e', accent: '#cbb45c' },
  sunset:  { bg: '#1a1a1a', card: '#212121', accent: '#d4b45e' },
  retro:   { bg: '#141414', card: '#1c1c1c', accent: '#e0c040' },
};

const THEME_NAME_TO_ID: Record<string, string> = {
  'Aurora': 'aurora',
  'Cyber': 'cyber',
  'Forest': 'forest',
  'Ocean': 'ocean',
  'Sunset': 'sunset',
  'Retro SNES': 'retro',
  'Retro': 'retro',
};

const TYPE_TABS = [
  { key: '', label: ' Todo' },
  { key: 'HAT', label: ' Sombreros' },
  { key: 'AURA', label: ' Auras' },
  { key: 'FRAME', label: ' Marcos' },
  { key: 'THEME', label: ' Temas' },
  { key: 'POWERUP', label: ' Power-ups' },
  { key: 'PASS', label: ' Pases' },
  { key: 'COSMETIC', label: ' Cosméticos' },
] as const;

const TYPE_LABELS: Record<string, string> = {
  COSMETIC: 'Cosmético', POWERUP: 'Power-up', DECORATION: 'Decoración',
  PASS: 'Pase especial', HAT: 'Sombrero', AURA: 'Aura', FRAME: 'Marco', THEME: 'Tema de color',
};

const EQUIPPABLE_TYPES = new Set(['COSMETIC', 'HAT', 'AURA', 'FRAME', 'THEME']);

function ConfirmPurchaseModal({ item, userGold, onConfirm, onClose }: { item: ShopItem; userGold: number; onConfirm: () => void; onClose: () => void }) {
  const canAfford = userGold >= item.cost;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 p-0 md:items-center md:p-4" onClick={onClose}>
      <motion.div initial={{ y: 48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 48, opacity: 0 }} transition={{ type: 'spring', stiffness: 350, damping: 28 }} className="max-h-[86dvh] w-full max-w-sm space-y-4 overflow-y-auto rounded-t-2xl border-2 border-border-pixel bg-bg-panel p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:rounded-2xl md:p-5" onClick={e => e.stopPropagation()}>
        <p className="font-pixel text-accent-gold text-center" style={{ fontSize: '10px' }}>CONFIRMAR COMPRA</p>
        <div className="text-center space-y-2">
          <p className="font-vt text-text-primary text-2xl">{item.name}</p>
          <p className="font-vt text-text-secondary text-base">{item.description}</p>
          <p className="font-pixel text-text-secondary" style={{ fontSize: '8px' }}>TIPO: <E e={TYPE_LABELS[item.type]} /></p>
        </div>
        <PixelPanel className="p-3 flex justify-between items-center">
          <p className="font-pixel text-text-secondary" style={{ fontSize: '8px' }}>TU GOLD</p>
          <p className={`font-pixel ${canAfford ? 'text-accent-gold' : 'text-accent-red'}`} style={{ fontSize: '12px' }}><E e="🪙" /> {userGold}</p>
        </PixelPanel>
        <PixelPanel className="p-3 flex justify-between items-center">
          <p className="font-pixel text-text-secondary" style={{ fontSize: '8px' }}>PRECIO</p>
          <p className="font-pixel text-accent-gold" style={{ fontSize: '12px' }}><E e="🪙" /> {item.cost}</p>
        </PixelPanel>
        {!canAfford && <p className="font-pixel text-accent-red text-center" style={{ fontSize: '8px' }}>GOLD INSUFICIENTE</p>}
        <div className="flex gap-2">
          <PixelButton variant="ghost" onClick={onClose} className="flex-1">Cancelar</PixelButton>
          <PixelButton variant="primary" onClick={onConfirm} disabled={!canAfford} className="flex-1">
            ¡COMPRAR!
          </PixelButton>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function ShopPage() {
  const { user, updateUser } = useAuthStore();
  const toast = useToast();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<string>('');
  const [shopTab, setShopTab] = useState<'shop' | 'inventory'>('shop');
  const [confirmItem, setConfirmItem] = useState<ShopItem | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [previewTheme, setPreviewTheme] = useState<string | null>(null);
  const originalThemeRef = useRef<string>(document.documentElement.getAttribute('data-theme') ?? 'aurora');

  function applyThemePreview(themeId: string | null) {
    if (themeId) {
      document.documentElement.setAttribute('data-theme', themeId);
      setPreviewTheme(themeId);
    } else {
      document.documentElement.setAttribute('data-theme', originalThemeRef.current);
      setPreviewTheme(null);
    }
  }

  useEffect(() => {
    originalThemeRef.current = document.documentElement.getAttribute('data-theme') ?? 'aurora';
    return () => {
      document.documentElement.setAttribute('data-theme', originalThemeRef.current);
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [shopItems, inv] = await Promise.all([shopService.fetchShopItems(), shopService.fetchInventory()]);
      setItems(shopItems);
      setInventory(inv);
    } catch {
      setLoadError('No pudimos cargar el catálogo. Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handlePurchase(item: ShopItem) {
    setPurchasing(item.id);
    setConfirmItem(null);
    // Optimistic: decrease gold
    if (user) updateUser({ ...user, gold: user.gold - item.cost });
    try {
      const result = await shopService.purchaseItem(item.id);
      updateUser(result.user as never);
      setInventory(prev => [...prev, result.inventoryItem]);
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, owned: true } : i));
      toast.success(`¡${item.name} comprado! `);
    } catch (err) {
      if (user) updateUser({ ...user, gold: user.gold + item.cost }); // rollback
      toast.error(err instanceof Error ? err.message : 'Error al comprar');
    } finally { setPurchasing(null); }
  }

  async function handleEquip(invItem: InventoryItem) {
    const sameType = EQUIPPABLE_TYPES.has(invItem.shopItem.type);
    setInventory(prev => prev.map(i => ({
      ...i,
      isEquipped: i.id === invItem.id ? !i.isEquipped : (sameType && i.shopItem.type === invItem.shopItem.type ? false : i.isEquipped),
    })));
    try {
      const updated = await shopService.equipItem(invItem.id);
      setInventory(prev => prev.map(i => i.id === updated.id ? updated : i));
      toast.info(updated.isEquipped ? `${invItem.shopItem.name} equipado` : `${invItem.shopItem.name} desequipado`);
    } catch {
      load(); // rollback
      toast.error('Error al equipar');
    }
  }

  const filtered = tab ? items.filter(i => i.type === tab) : items;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-pixel text-accent-gold" style={{ fontSize: '14px' }}><E e="🛒" /> EL MERCADO</h1>
          <p className="font-vt text-text-secondary text-base">Gasta tu Gold sabiamente, héroe</p>
        </div>
        <div className="flex items-center gap-2 bg-bg-panel border-2 border-border-pixel px-3 py-2">
          <span className="font-pixel text-accent-gold" style={{ fontSize: '8px' }}>GOLD</span>
          <motion.span
            key={user?.gold}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            className="font-pixel text-accent-gold"
            style={{ fontSize: '14px' }}
          >
            <E e="🪙" /> {user?.gold ?? 0}
          </motion.span>
        </div>
      </div>

      {/* Shop / Inventory tabs */}
      <div className="flex gap-1">
        {[['shop', ' Tienda'], ['inventory', ' Inventario']].map(([key, label]) => (
          <button key={key} onClick={() => setShopTab(key as 'shop' | 'inventory')} className={`min-h-11 px-4 py-2 border-2 font-pixel transition-all ${shopTab === key ? 'border-accent-gold bg-accent-gold text-bg-deep' : 'border-border-pixel text-text-secondary'}`} style={{ fontSize: '8px' }}>
            {label}
          </button>
        ))}
      </div>

      {shopTab === 'shop' && (
        <>
          <div className="grid grid-cols-2 gap-1 sm:flex sm:flex-wrap">
            {TYPE_TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} className={`min-h-11 min-w-0 px-2 py-1.5 border-2 font-pixel transition-all sm:shrink-0 ${tab === t.key ? 'border-accent-gold bg-accent-gold text-bg-deep' : 'border-border-pixel text-text-secondary'}`} style={{ fontSize: '8px' }}>
                {t.label}
              </button>
            ))}
          </div>

          <LoadingGate loading={loading} fallback={<ModernLoader variant="compact" words={LOADING_COPY.shop} />}>
            {loading ? null : loadError ? (
            <PixelPanel className="mx-auto max-w-xl p-8 text-center">
              <p className="text-4xl"><E e="⚠" /></p>
              <h2 className="mt-3 text-base font-semibold text-[var(--text-primary)]">No pudimos abrir la tienda</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">{loadError}</p>
              <PixelButton variant="secondary" onClick={() => void load()} className="mt-5">Reintentar</PixelButton>
            </PixelPanel>
          ) : filtered.length === 0 ? (
            <PixelPanel className="mx-auto max-w-xl p-8 text-center">
              <p className="text-4xl"><E e={items.length === 0 ? '🛒' : '🔎'} /></p>
              <h2 className="mt-3 text-base font-semibold text-[var(--text-primary)]">{items.length === 0 ? 'El catálogo está preparando sus artículos' : 'No hay artículos en esta categoría'}</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
                {items.length === 0
                  ? 'Vuelve a intentarlo en unos segundos. Si el problema persiste, avísanos desde Feedback.'
                  : 'Prueba otra categoría para encontrar algo que encaje con tu aventura.'}
              </p>
              {items.length === 0 ? (
                <PixelButton variant="secondary" onClick={() => void load()} className="mt-5">Actualizar catálogo</PixelButton>
              ) : (
                <PixelButton variant="ghost" onClick={() => setTab('')} className="mt-5">Ver todo</PixelButton>
              )}
            </PixelPanel>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <AnimatePresence>
                {filtered.map((item, i) => {
                  const isLocked = (item as ShopItem & { locked?: boolean }).locked;
                  const isOwned = item.owned;
                  const isBuying = purchasing === item.id;
                  return (
                    <motion.div key={item.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}>
                      <PixelPanel className={`p-4 space-y-3 ${isLocked ? 'opacity-50' : 'hover:border-accent-gold/50'} transition-all`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              {item.type === 'THEME' && (() => {
                                const tid = THEME_NAME_TO_ID[item.name] ?? item.name.toLowerCase();
                                const colors = THEME_PREVIEW_COLORS[tid];
                                return colors ? (
                                  <div className="flex gap-0.5 rounded overflow-hidden border border-[var(--border)]" title={item.name}>
                                    <div style={{ width: 10, height: 16, background: colors.bg }} />
                                    <div style={{ width: 10, height: 16, background: colors.card }} />
                                    <div style={{ width: 10, height: 16, background: colors.accent }} />
                                  </div>
                                ) : null;
                              })()}
                              <p className="font-vt text-text-primary text-xl">{item.name}</p>
                            </div>
                            <p className="font-pixel text-text-secondary" style={{ fontSize: '7px' }}><E e={TYPE_LABELS[item.type]} /></p>
                          </div>
                          {isLocked ? (
                            <div className="text-right">
                              <p className="text-2xl"><E e="🔒" /></p>
                              <p className="font-pixel text-text-secondary" style={{ fontSize: '6px' }}>Lv.{item.levelRequired}</p>
                            </div>
                          ) : isOwned ? (
                            <span className="font-pixel text-accent-green" style={{ fontSize: '8px' }}><E e="✓" /> OWNED</span>
                          ) : null}
                        </div>
                        {item.description && <p className="font-vt text-text-secondary text-base">{item.description}</p>}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="font-pixel text-accent-gold" style={{ fontSize: '12px' }}><E e="🪙" /> {item.cost}</p>
                          <div className="flex gap-1">
                            {item.type === 'THEME' && !isLocked && (() => {
                              const tid = THEME_NAME_TO_ID[item.name] ?? item.name.toLowerCase();
                              const isPreviewing = previewTheme === tid;
                              return (
                                <motion.button
                                  whileTap={{ scale: 0.92 }}
                                  onClick={() => applyThemePreview(isPreviewing ? null : tid)}
                                  className={`font-pixel border-2 px-2 py-1.5 transition-colors ${isPreviewing ? 'border-accent-green text-accent-green' : 'border-border-pixel text-text-secondary hover:border-text-secondary'}`}
                                  style={{ fontSize: '7px' }}
                                >
                                  {isPreviewing ? <><E e="↩" s={11} /> Restaurar</> : <><E e="👁" s={11} /> Preview</>}
                                </motion.button>
                              );
                            })()}
                            {!isLocked && !isOwned && (
                              <motion.button
                                whileTap={{ scale: 0.92 }}
                                disabled={isBuying}
                                onClick={() => setConfirmItem(item)}
                                className="font-pixel border-2 border-accent-gold text-accent-gold px-3 py-1.5 hover:bg-accent-gold hover:text-bg-deep transition-colors disabled:opacity-50"
                                style={{ fontSize: '8px' }}
                              >
                                {isBuying ? '...' : 'COMPRAR'}
                              </motion.button>
                            )}
                          </div>
                        </div>
                      </PixelPanel>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
            )}
          </LoadingGate>
        </>
      )}

      {shopTab === 'inventory' && (
        <div className="space-y-3">
          {inventory.length === 0 ? (
            <PixelPanel className="p-8 text-center">
              <p className="text-4xl mb-2"><E e="🎒" /></p>
              <p className="font-pixel text-text-secondary" style={{ fontSize: '9px' }}>INVENTARIO VACÍO</p>
              <p className="font-vt text-text-secondary text-base mt-1">Ve a la tienda y consigue algo genial</p>
            </PixelPanel>
          ) : (
            <AnimatePresence>
              {inventory.map((inv, i) => (
                <motion.div key={inv.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                  <PixelPanel className="p-3 flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-vt text-text-primary text-xl">{inv.shopItem.name}</p>
                      <p className="font-pixel text-text-secondary" style={{ fontSize: '7px' }}><E e={TYPE_LABELS[inv.shopItem.type]} /></p>
                      {inv.expiresAt && (
                        <p className="font-pixel text-accent-gold" style={{ fontSize: '7px' }}>
                          Expira: {new Date(inv.expiresAt).toLocaleString('es-CO')}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {EQUIPPABLE_TYPES.has(inv.shopItem.type) && (
                        <PixelButton variant={inv.isEquipped ? 'primary' : 'secondary'} onClick={() => handleEquip(inv)}>
                          {inv.isEquipped ? 'EQUIPADO' : 'EQUIPAR'}
                        </PixelButton>
                      )}
                    </div>
                  </PixelPanel>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}

      <AnimatePresence>
        {confirmItem && (
          <ConfirmPurchaseModal
            item={confirmItem}
            userGold={user?.gold ?? 0}
            onConfirm={() => handlePurchase(confirmItem)}
            onClose={() => setConfirmItem(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
