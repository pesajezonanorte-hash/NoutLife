import { FlowButton } from "@/components/ui/flow-button";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAuthStore } from "../../store/authStore";
import { useToast } from "../../hooks/useToast";
import { PixelPanel } from "../../components/ui/PixelPanel";
import { LifeQuestFlipCard } from "../../components/ui/lifequest-flip-card";
import { PixelButton } from "../../components/ui/PixelButton";
import type { ShopItem, InventoryItem } from "@lifequest/shared";
import * as shopService from "../../services/shop.service";
import { E } from "@/components/ui/glyphs";
import ModernLoader from "@/components/ui/modern-loader";
import { LoadingGate } from "@/components/ui/LoadingGate";
import { LOADING_COPY } from "@/lib/loadingCopy";

const THEME_PREVIEW_COLORS: Record<
  string,
  { bg: string; card: string; accent: string }
> = {
  aurora: { bg: "#131316", card: "#1a1a1e", accent: "#d9b44a" },
  cyber: { bg: "#050505", card: "#0d0d0d", accent: "#f5f5f5" },
  forest: { bg: "#151411", card: "#1c1a16", accent: "#c9a94e" },
  ocean: { bg: "#121316", card: "#181a1e", accent: "#cbb45c" },
  sunset: { bg: "#1a1a1a", card: "#212121", accent: "#d4b45e" },
  retro: { bg: "#141414", card: "#1c1c1c", accent: "#e0c040" },
};

const THEME_NAME_TO_ID: Record<string, string> = {
  Aurora: "aurora",
  Cyber: "cyber",
  Forest: "forest",
  Ocean: "ocean",
  Sunset: "sunset",
  "Retro SNES": "retro",
  Retro: "retro",
};

const TYPE_TABS = [
  { key: "", label: " Todo" },
  { key: "HAT", label: " Sombreros" },
  { key: "AURA", label: " Auras" },
  { key: "FRAME", label: " Marcos" },
  { key: "THEME", label: " Temas" },
  { key: "POWERUP", label: " Power-ups" },
  { key: "PASS", label: " Pases" },
  { key: "COSMETIC", label: " Cosméticos" },
] as const;

const TYPE_LABELS: Record<string, string> = {
  COSMETIC: "Cosmético",
  POWERUP: "Power-up",
  DECORATION: "Decoración",
  PASS: "Pase especial",
  HAT: "Sombrero",
  AURA: "Aura",
  FRAME: "Marco",
  THEME: "Tema de color",
};

const TYPE_GLYPHS: Record<string, string> = {
  COSMETIC: "✨",
  POWERUP: "⚡",
  DECORATION: "🏰",
  PASS: "🎫",
  HAT: "🎩",
  AURA: "🌟",
  FRAME: "🖼️",
  THEME: "🎨",
};

const EQUIPPABLE_TYPES = new Set(["COSMETIC", "HAT", "AURA", "FRAME", "THEME"]);

function ConfirmPurchaseModal({
  item,
  userGold,
  onConfirm,
  onClose,
}: {
  item: ShopItem;
  userGold: number;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const canAfford = userGold >= item.cost;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 p-0 md:items-center md:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 48, opacity: 0 }}
        transition={{ type: "spring", stiffness: 350, damping: 28 }}
        className="max-h-[86dvh] w-full max-w-sm space-y-4 overflow-y-auto rounded-t-2xl border-2 border-border-pixel bg-bg-panel p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:rounded-2xl md:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p
          className="font-pixel text-accent-gold text-center"
          style={{ fontSize: "12px" }}
        >
          CONFIRMAR COMPRA
        </p>
        <div className="text-center space-y-2">
          <p className="font-vt text-text-primary text-2xl">{item.name}</p>
          <p className="font-vt text-text-secondary text-base">
            {item.description}
          </p>
          <p
            className="font-pixel text-text-secondary"
            style={{ fontSize: "12px" }}
          >
            TIPO: <E e={TYPE_LABELS[item.type]} />
          </p>
        </div>
        <PixelPanel className="p-3 flex justify-between items-center">
          <p
            className="font-pixel text-text-secondary"
            style={{ fontSize: "12px" }}
          >
            TU GOLD
          </p>
          <p
            className={`font-pixel ${canAfford ? "text-accent-gold" : "text-accent-red"}`}
            style={{ fontSize: "12px" }}
          >
            <E e="🪙" /> {userGold}
          </p>
        </PixelPanel>
        <PixelPanel className="p-3 flex justify-between items-center">
          <p
            className="font-pixel text-text-secondary"
            style={{ fontSize: "12px" }}
          >
            PRECIO
          </p>
          <p
            className="font-pixel text-accent-gold"
            style={{ fontSize: "12px" }}
          >
            <E e="🪙" /> {item.cost}
          </p>
        </PixelPanel>
        {!canAfford && (
          <p
            className="font-pixel text-accent-red text-center"
            style={{ fontSize: "12px" }}
          >
            GOLD INSUFICIENTE
          </p>
        )}
        <div className="flex gap-2">
          <PixelButton variant="ghost" onClick={onClose} className="flex-1">
            Cancelar
          </PixelButton>
          <PixelButton
            variant="primary"
            onClick={onConfirm}
            disabled={!canAfford}
            className="flex-1"
          >
            ¡COMPRAR!
          </PixelButton>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function ShopPage() {
  const reduceMotion = useReducedMotion();
  const { user, updateUser } = useAuthStore();
  const toast = useToast();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<string>("");
  const [shopTab, setShopTab] = useState<"shop" | "inventory">("shop");
  const [confirmItem, setConfirmItem] = useState<ShopItem | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [previewTheme, setPreviewTheme] = useState<string | null>(null);
  const originalThemeRef = useRef<string>(
    document.documentElement.getAttribute("data-theme") ?? "aurora",
  );

  function applyThemePreview(themeId: string | null) {
    if (themeId) {
      document.documentElement.setAttribute("data-theme", themeId);
      setPreviewTheme(themeId);
    } else {
      document.documentElement.setAttribute(
        "data-theme",
        originalThemeRef.current,
      );
      setPreviewTheme(null);
    }
  }

  useEffect(() => {
    originalThemeRef.current =
      document.documentElement.getAttribute("data-theme") ?? "aurora";
    return () => {
      document.documentElement.setAttribute(
        "data-theme",
        originalThemeRef.current,
      );
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [shopItems, inv] = await Promise.all([
        shopService.fetchShopItems(),
        shopService.fetchInventory(),
      ]);
      setItems(shopItems);
      setInventory(inv);
    } catch {
      setLoadError(
        "No pudimos cargar el catálogo. Comprueba tu conexión e inténtalo de nuevo.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePurchase(item: ShopItem) {
    setPurchasing(item.id);
    setConfirmItem(null);
    // Optimistic: decrease gold
    if (user) updateUser({ ...user, gold: user.gold - item.cost });
    try {
      const result = await shopService.purchaseItem(item.id);
      updateUser(result.user as never);
      setInventory((prev) => [...prev, result.inventoryItem]);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, owned: true } : i)),
      );
      toast.success(`¡${item.name} comprado! `);
    } catch (err) {
      if (user) updateUser({ ...user, gold: user.gold + item.cost }); // rollback
      toast.error(err instanceof Error ? err.message : "Error al comprar");
    } finally {
      setPurchasing(null);
    }
  }

  async function handleEquip(invItem: InventoryItem) {
    const sameType = EQUIPPABLE_TYPES.has(invItem.shopItem.type);
    setInventory((prev) =>
      prev.map((i) => ({
        ...i,
        isEquipped:
          i.id === invItem.id
            ? !i.isEquipped
            : sameType && i.shopItem.type === invItem.shopItem.type
              ? false
              : i.isEquipped,
      })),
    );
    try {
      const updated = await shopService.equipItem(invItem.id);
      setInventory((prev) =>
        prev.map((i) => (i.id === updated.id ? updated : i)),
      );
      toast.info(
        updated.isEquipped
          ? `${invItem.shopItem.name} equipado`
          : `${invItem.shopItem.name} desequipado`,
      );
    } catch {
      load(); // rollback
      toast.error("Error al equipar");
    }
  }

  const filtered = tab ? items.filter((i) => i.type === tab) : items;
  // Keep the 3D treatment to one curated item; catalog grids can grow very large.
  const featuredItem =
    filtered.find(
      (item) => !(item as ShopItem & { locked?: boolean }).locked,
    ) ?? filtered[0];
  const catalogItems = featuredItem
    ? filtered.filter((item) => item.id !== featuredItem.id)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1
            className="font-pixel text-accent-gold"
            style={{ fontSize: "14px" }}
          >
            <E e="🛒" /> EL MERCADO
          </h1>
          <p className="font-vt text-text-secondary text-base">
            Gasta tu Gold sabiamente, héroe
          </p>
        </div>
        <div className="flex items-center gap-2 bg-bg-panel border-2 border-border-pixel px-3 py-2">
          <span
            className="font-pixel text-accent-gold"
            style={{ fontSize: "12px" }}
          >
            GOLD
          </span>
          <motion.span
            key={user?.gold}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            className="font-pixel text-accent-gold"
            style={{ fontSize: "14px" }}
          >
            <E e="🪙" /> {user?.gold ?? 0}
          </motion.span>
        </div>
      </div>

      {/* Shop / Inventory tabs */}
      <div className="flex gap-1">
        {[
          ["shop", " Tienda"],
          ["inventory", " Inventario"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setShopTab(key as "shop" | "inventory")}
            className={`min-h-11 px-4 py-2 border-2 font-pixel transition-all ${shopTab === key ? "border-accent-gold bg-accent-gold text-bg-deep" : "border-border-pixel text-text-secondary"}`}
            style={{ fontSize: "12px" }}
          >
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={shopTab}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -5 }}
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
      {shopTab === "shop" && (
        <>
          <div className="grid grid-cols-2 gap-1 sm:flex sm:flex-wrap">
            {TYPE_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`min-h-11 min-w-0 px-2 py-1.5 border-2 font-pixel transition-all sm:shrink-0 ${tab === t.key ? "border-accent-gold bg-accent-gold text-bg-deep" : "border-border-pixel text-text-secondary"}`}
                style={{ fontSize: "12px" }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <LoadingGate
            loading={loading}
            fallback={<ModernLoader words={[...LOADING_COPY.shop]} />}
          >
            {loading ? null : loadError ? (
              <PixelPanel className="mx-auto max-w-xl p-8 text-center">
                <p className="text-4xl">
                  <E e="⚠" />
                </p>
                <h2 className="mt-3 text-base font-semibold text-[var(--text-primary)]">
                  No pudimos abrir la tienda
                </h2>
                <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
                  {loadError}
                </p>
                <PixelButton
                  variant="secondary"
                  onClick={() => void load()}
                  className="mt-5"
                >
                  Reintentar
                </PixelButton>
              </PixelPanel>
            ) : filtered.length === 0 ? (
              <PixelPanel className="mx-auto max-w-xl p-8 text-center">
                <p className="text-4xl">
                  <E e={items.length === 0 ? "🛒" : "🔎"} />
                </p>
                <h2 className="mt-3 text-base font-semibold text-[var(--text-primary)]">
                  {items.length === 0
                    ? "El catálogo está preparando sus artículos"
                    : "No hay artículos en esta categoría"}
                </h2>
                <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
                  {items.length === 0
                    ? "Vuelve a intentarlo en unos segundos. Si el problema persiste, avísanos desde Feedback."
                    : "Prueba otra categoría para encontrar algo que encaje con tu aventura."}
                </p>
                {items.length === 0 ? (
                  <PixelButton
                    variant="secondary"
                    onClick={() => void load()}
                    className="mt-5"
                  >
                    Actualizar catálogo
                  </PixelButton>
                ) : (
                  <PixelButton
                    variant="ghost"
                    onClick={() => setTab("")}
                    className="mt-5"
                  >
                    Ver todo
                  </PixelButton>
                )}
              </PixelPanel>
            ) : (
              <div className="space-y-4">
                {featuredItem &&
                  (() => {
                    const isLocked = (
                      featuredItem as ShopItem & { locked?: boolean }
                    ).locked;
                    const isOwned = featuredItem.owned;
                    const isBuying = purchasing === featuredItem.id;
                    const themeId =
                      THEME_NAME_TO_ID[featuredItem.name] ??
                      featuredItem.name.toLowerCase();
                    const isPreviewing = previewTheme === themeId;
                    const actionLabel = isLocked
                      ? undefined
                      : isOwned
                        ? "Ver inventario"
                        : `Comprar por ${featuredItem.cost}`;
                    return (
                      <LifeQuestFlipCard
                        eyebrow="Artículo destacado"
                        title={featuredItem.name}
                        description={
                          TYPE_LABELS[featuredItem.type] ?? featuredItem.type
                        }
                        visual={
                          <span className="text-6xl" aria-hidden="true">
                            <E
                              e={TYPE_GLYPHS[featuredItem.type] ?? "🛒"}
                              s={64}
                            />
                          </span>
                        }
                        visualLabel={`Vista previa de ${featuredItem.name}`}
                        badge={
                          isLocked
                            ? `Nivel ${featuredItem.levelRequired}`
                            : isOwned
                              ? "En inventario"
                              : "Disponible"
                        }
                        frontFooter={
                          <p className="text-xs font-semibold [color:var(--flip-accent)]">
                            <E e="🪙" /> {featuredItem.cost} Gold
                          </p>
                        }
                        backDescription={
                          <p>
                            {featuredItem.description ||
                              "Un nuevo recurso para personalizar y fortalecer tu aventura."}
                          </p>
                        }
                        metrics={[
                          {
                            label: "Tipo",
                            value:
                              TYPE_LABELS[featuredItem.type] ??
                              featuredItem.type,
                          },
                          {
                            label: "Precio",
                            value: `${featuredItem.cost} Gold`,
                          },
                          {
                            label: "Estado",
                            value: isLocked
                              ? `Nivel ${featuredItem.levelRequired}`
                              : isOwned
                                ? "Tuyo"
                                : "Disponible",
                          },
                        ]}
                        backActions={
                          featuredItem.type === "THEME" && !isLocked ? (
                            <FlowButton
                              tone="ghost"
                              size="sm"
                              withArrows={false}
                              onClick={(event) => {
                                event.stopPropagation();
                                applyThemePreview(
                                  isPreviewing ? null : themeId,
                                );
                              }}
                              className="min-h-11 rounded-xl border border-border bg-muted px-3 text-sm font-semibold text-foreground transition-transform hover:scale-[1.015] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                              {isPreviewing ? "Restaurar tema" : "Vista previa"}
                            </FlowButton>
                          ) : undefined
                        }
                        actionLabel={actionLabel}
                        actionDisabled={isBuying}
                        onAction={() => {
                          if (isOwned) setShopTab("inventory");
                          else setConfirmItem(featuredItem);
                        }}
                        accent="var(--accent-gold)"
                      />
                    );
                  })()}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <AnimatePresence>
                    {catalogItems.map((item, i) => {
                      const isLocked = (item as ShopItem & { locked?: boolean })
                        .locked;
                      const isOwned = item.owned;
                      const isBuying = purchasing === item.id;
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.04 }}
                        >
                          <PixelPanel
                            className={`p-4 space-y-3 ${isLocked ? "opacity-50" : "hover:border-accent-gold/50"} transition-all`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                  {item.type === "THEME" &&
                                    (() => {
                                      const tid =
                                        THEME_NAME_TO_ID[item.name] ??
                                        item.name.toLowerCase();
                                      const colors = THEME_PREVIEW_COLORS[tid];
                                      return colors ? (
                                        <div
                                          className="flex gap-0.5 rounded overflow-hidden border border-[var(--border)]"
                                          title={item.name}
                                        >
                                          <div
                                            style={{
                                              width: 10,
                                              height: 16,
                                              background: colors.bg,
                                            }}
                                          />
                                          <div
                                            style={{
                                              width: 10,
                                              height: 16,
                                              background: colors.card,
                                            }}
                                          />
                                          <div
                                            style={{
                                              width: 10,
                                              height: 16,
                                              background: colors.accent,
                                            }}
                                          />
                                        </div>
                                      ) : null;
                                    })()}
                                  <p className="font-vt text-text-primary text-xl">
                                    {item.name}
                                  </p>
                                </div>
                                <p
                                  className="font-pixel text-text-secondary"
                                  style={{ fontSize: "12px" }}
                                >
                                  <E e={TYPE_LABELS[item.type]} />
                                </p>
                              </div>
                              {isLocked ? (
                                <div className="text-right">
                                  <p className="text-2xl">
                                    <E e="🔒" />
                                  </p>
                                  <p
                                    className="font-pixel text-text-secondary"
                                    style={{ fontSize: "12px" }}
                                  >
                                    Lv.{item.levelRequired}
                                  </p>
                                </div>
                              ) : isOwned ? (
                                <span
                                  className="font-pixel text-accent-green"
                                  style={{ fontSize: "12px" }}
                                >
                                  <E e="✓" /> OWNED
                                </span>
                              ) : null}
                            </div>
                            {item.description && (
                              <p className="font-vt text-text-secondary text-base">
                                {item.description}
                              </p>
                            )}
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <p
                                className="font-pixel text-accent-gold"
                                style={{ fontSize: "12px" }}
                              >
                                <E e="🪙" /> {item.cost}
                              </p>
                              <div className="flex gap-1">
                                {item.type === "THEME" &&
                                  !isLocked &&
                                  (() => {
                                    const tid =
                                      THEME_NAME_TO_ID[item.name] ??
                                      item.name.toLowerCase();
                                    const isPreviewing = previewTheme === tid;
                                    return (
                                      <FlowButton
                                        tone="ghost"
                                        size="sm"
                                        withArrows={false}
                                        onClick={() =>
                                          applyThemePreview(
                                            isPreviewing ? null : tid,
                                          )
                                        }
                                        className={
                                          isPreviewing
                                            ? "min-h-11 border-[var(--accent-green)] text-[var(--accent-green)]"
                                            : "min-h-11"
                                        }
                                      >
                                        {isPreviewing ? (
                                          <>
                                            <E e="↩" /> Restaurar
                                          </>
                                        ) : (
                                          <>
                                            <E e="👁" /> Preview
                                          </>
                                        )}
                                      </FlowButton>
                                    );
                                  })()}
                                {!isLocked && !isOwned && (
                                  <FlowButton
                                    tone="primary"
                                    size="sm"
                                    withArrows={false}
                                    disabled={isBuying}
                                    onClick={() => setConfirmItem(item)}
                                    className="min-h-11 font-pixel text-xs"
                                  >
                                    {isBuying ? "..." : "COMPRAR"}
                                  </FlowButton>
                                )}
                              </div>
                            </div>
                          </PixelPanel>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </LoadingGate>
        </>
      )}

      {shopTab === "inventory" && (
        <div className="space-y-3">
          {inventory.length === 0 ? (
            <PixelPanel className="p-8 text-center">
              <p className="text-4xl mb-2">
                <E e="🎒" />
              </p>
              <p
                className="font-pixel text-text-secondary"
                style={{ fontSize: "12px" }}
              >
                INVENTARIO VACÍO
              </p>
              <p className="font-vt text-text-secondary text-base mt-1">
                Ve a la tienda y consigue algo genial
              </p>
            </PixelPanel>
          ) : (
            <AnimatePresence>
              {inventory.map((inv, i) => (
                <motion.div
                  key={inv.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <PixelPanel className="p-3 flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-vt text-text-primary text-xl">
                        {inv.shopItem.name}
                      </p>
                      <p
                        className="font-pixel text-text-secondary"
                        style={{ fontSize: "12px" }}
                      >
                        <E e={TYPE_LABELS[inv.shopItem.type]} />
                      </p>
                      {inv.expiresAt && (
                        <p
                          className="font-pixel text-accent-gold"
                          style={{ fontSize: "12px" }}
                        >
                          Expira:{" "}
                          {new Date(inv.expiresAt).toLocaleString("es-CO")}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {EQUIPPABLE_TYPES.has(inv.shopItem.type) && (
                        <PixelButton
                          variant={inv.isEquipped ? "primary" : "secondary"}
                          onClick={() => handleEquip(inv)}
                        >
                          {inv.isEquipped ? "EQUIPADO" : "EQUIPAR"}
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

        </motion.div>
      </AnimatePresence>

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
