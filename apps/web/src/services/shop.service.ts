import api from '../lib/api';
import type { ShopItem, InventoryItem, User } from '@lifequest/shared';

/** Lo que cambia en la cuenta al comprar o ponerse algo (Gold, avatar, aura, marco, tema). */
export type ShopUser = Partial<Pick<User, 'gold' | 'level' | 'avatarConfig' | 'avatarUrl' | 'equippedHat' | 'equippedAura' | 'equippedFrame' | 'equippedTheme'>> & { id: string };

export async function fetchShopItems(): Promise<ShopItem[]> {
  const { data } = await api.get<{ items: ShopItem[] }>('/shop/items');
  return data.items;
}

export async function purchaseItem(shopItemId: string): Promise<{ inventoryItem: InventoryItem; user: ShopUser }> {
  const { data } = await api.post<{ inventoryItem: InventoryItem; user: ShopUser }>('/shop/purchase', { shopItemId });
  return data;
}

export async function fetchInventory(): Promise<InventoryItem[]> {
  const { data } = await api.get<{ items: InventoryItem[] }>('/shop/inventory');
  return data.items;
}

/** Pone o quita un artículo; devuelve cómo queda (y la cuenta, para ver el cambio en el avatar). */
export async function equipItem(inventoryItemId: string): Promise<InventoryItem & { user?: ShopUser }> {
  const { data } = await api.post<{ inventoryItem: InventoryItem & { user?: ShopUser } }>(`/shop/inventory/${inventoryItemId}/equip`);
  return data.inventoryItem;
}

export async function useItem(inventoryItemId: string): Promise<InventoryItem> {
  const { data } = await api.post<{ inventoryItem: InventoryItem }>(`/shop/inventory/${inventoryItemId}/use`);
  return data.inventoryItem;
}
