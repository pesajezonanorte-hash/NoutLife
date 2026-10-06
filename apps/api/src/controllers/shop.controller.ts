import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import * as svc from '../services/shop.service';

const serInv = (i: { purchasedAt: Date; usedAt?: Date | null; expiresAt?: Date | null; shopItem: { createdAt: Date; [k: string]: unknown }; [k: string]: unknown }) => ({
  ...i,
  purchasedAt: i.purchasedAt.toISOString(),
  usedAt: i.usedAt?.toISOString() ?? null,
  expiresAt: i.expiresAt?.toISOString() ?? null,
  shopItem: { ...i.shopItem, createdAt: i.shopItem.createdAt.toISOString() },
});

export async function listShopItems(req: AuthRequest, res: Response): Promise<void> {
  try {
    const items = await svc.listShopItems(req.userId!);
    res.json({ items });
  } catch { res.status(500).json({ error: 'Error al obtener tienda.' }); }
}

export async function purchaseItem(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await svc.purchaseItem(req.userId!, req.body.shopItemId);
    res.json({ inventoryItem: serInv(result.inventoryItem), user: result.user });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al comprar.';
    res.status(400).json({ error: msg });
  }
}

export async function listInventory(req: AuthRequest, res: Response): Promise<void> {
  try {
    const items = await svc.listInventory(req.userId!);
    res.json({ items: items.map(serInv) });
  } catch { res.status(500).json({ error: 'Error al obtener inventario.' }); }
}

export async function equipItem(req: AuthRequest, res: Response): Promise<void> {
  try {
    const item = await svc.equipItem(req.userId!, req.params.id);
    res.json({ inventoryItem: serInv(item) });
  } catch { res.status(500).json({ error: 'Error al equipar.' }); }
}

/** Lo de pago que el estudio del personaje puede dejar elegir ("extra:capa", "hair:rizos"…). */
export async function ownedItems(req: AuthRequest, res: Response): Promise<void> {
  try { res.json({ items: [...(await svc.ownedAvatarItems(req.userId!))] }); }
  catch { res.status(500).json({ error: 'Error al obtener tus artículos.' }); }
}

export async function useItem(req: AuthRequest, res: Response): Promise<void> {
  try {
    const item = await svc.useItem(req.userId!, req.params.id);
    res.json({ inventoryItem: serInv(item) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al usar ítem.';
    res.status(400).json({ error: msg });
  }
}
