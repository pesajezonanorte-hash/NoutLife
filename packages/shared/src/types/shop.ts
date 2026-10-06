export type ShopItemType = 'COSMETIC' | 'POWERUP' | 'DECORATION' | 'PASS' | 'HAT' | 'AURA' | 'FRAME' | 'THEME' | 'OUTFIT' | 'HAIR';

/** Parte del personaje (o del perfil) que cambia el artículo al ponérselo. */
export type ShopSlot = 'extra' | 'hair' | 'top' | 'aura' | 'frame' | 'theme';

export interface ShopItem {
  id: string;
  name: string;
  description?: string;
  type: ShopItemType;
  cost: number;
  imageKey?: string;
  levelRequired: number;
  isLimited: boolean;
  createdAt: string;
  owned?: boolean;
  equipped?: boolean;
  /** Qué cambia y con qué valor (p. ej. slot "extra" + value "capa"). */
  slot?: ShopSlot | null;
  value?: string | null;
  /** Exclusivos: unidades para toda la comunidad y cuántas quedan. */
  stock?: number | null;
  sold?: number;
  remaining?: number | null;
  /** Se desbloquea en un nivel más alto que el tuyo. */
  locked?: boolean;
}

export interface InventoryItem {
  id: string;
  userId: string;
  shopItemId: string;
  shopItem: ShopItem;
  isEquipped: boolean;
  purchasedAt: string;
  usedAt?: string;
  expiresAt?: string;
}
