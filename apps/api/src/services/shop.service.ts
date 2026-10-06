// La Tienda: comprar con Gold y llevarlo puesto. Lo que es para el personaje
// (sombreros, accesorios, ropa, peinados, auras y marcos) se pone en cuanto se
// compra y luego se quita o se vuelve a poner desde el inventario o el estudio.
// Los exclusivos tienen unidades limitadas para toda la comunidad.
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { applyAvatarItem, stripUnowned, wearing } from '../lib/avatar-items';

/** Partes del personaje que viven en avatarConfig.pixel. */
const AVATAR_SLOTS = new Set(['extra', 'hair', 'top']);
/** Partes que viven en un campo del usuario. */
const USER_FIELD: Record<string, 'equippedAura' | 'equippedFrame' | 'equippedTheme'> = { aura: 'equippedAura', frame: 'equippedFrame', theme: 'equippedTheme' };
const EQUIP_TYPES = new Set(['COSMETIC', 'HAT', 'AURA', 'FRAME', 'THEME', 'OUTFIT', 'HAIR']);

const PUBLIC_USER_FIELDS = {
  id: true, gold: true, level: true, avatarConfig: true, avatarUrl: true, equippedHat: true, equippedAura: true, equippedFrame: true, equippedTheme: true,
} as const;

type ItemRow = { type: string; slot: string | null; value: string | null; imageKey: string | null };
type UserRow = { avatarConfig: unknown; equippedAura: string | null; equippedFrame: string | null; equippedTheme: string | null };

/** ¿Lo lleva puesto ahora mismo? (para artículos del personaje se mira el avatar). */
function isWorn(item: ItemRow, user: UserRow) {
  if (item.slot && AVATAR_SLOTS.has(item.slot) && item.value) return wearing(user.avatarConfig, item.slot, item.value);
  const field = item.slot ? USER_FIELD[item.slot] : undefined;
  return field ? user[field] === (item.value ?? item.imageKey) : false;
}

export async function listShopItems(userId: string) {
  const [items, inventory, user] = await Promise.all([
    prisma.shopItem.findMany({ orderBy: [{ isLimited: 'desc' }, { cost: 'asc' }] }),
    prisma.inventoryItem.findMany({ where: { userId }, select: { shopItemId: true, isEquipped: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { level: true, avatarConfig: true, equippedAura: true, equippedFrame: true, equippedTheme: true } }),
  ]);
  return items.map((item) => {
    const owned = inventory.some((inv) => inv.shopItemId === item.id);
    return {
      ...item,
      createdAt: item.createdAt.toISOString(),
      owned,
      equipped: owned && isWorn(item, user),
      locked: item.levelRequired > user.level,
      remaining: item.stock === null ? null : Math.max(0, item.stock - item.sold),
    };
  });
}

/** Compra (y, si es para el personaje, se lo pone). Los exclusivos no pasan de su stock. */
export async function purchaseItem(userId: string, shopItemId: string) {
  const item = await prisma.shopItem.findUniqueOrThrow({ where: { id: shopItemId } });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { level: true } });
  if (user.level < item.levelRequired) throw new Error(`Se desbloquea en el nivel ${item.levelRequired}`);
  const existing = await prisma.inventoryItem.findFirst({ where: { userId, shopItemId } });
  if (existing) throw new Error('Ya tienes este artículo');

  const inventoryItem = await prisma.$transaction(async (tx) => {
    const paid = await tx.user.updateMany({ where: { id: userId, gold: { gte: item.cost } }, data: { gold: { decrement: item.cost } } });
    if (!paid.count) throw new Error('No te alcanza el Gold');
    if (item.stock !== null) {
      const took = await tx.shopItem.updateMany({ where: { id: item.id, sold: { lt: item.stock } }, data: { sold: { increment: 1 } } });
      if (!took.count) throw new Error('Se agotó: ya no quedan unidades');
    }
    return tx.inventoryItem.create({ data: { userId, shopItemId }, include: { shopItem: true } });
  });

  // Lo comprado para el personaje se lleva puesto desde ya.
  const wearable = EQUIP_TYPES.has(item.type) && item.type !== 'THEME' && (item.slot ? AVATAR_SLOTS.has(item.slot) || item.slot in USER_FIELD : false);
  const equipped = wearable ? await setEquipped(userId, inventoryItem.id, true) : inventoryItem;
  // Solo lo que cambia en la cuenta (nunca la fila entera: lleva el hash de la contraseña).
  const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: PUBLIC_USER_FIELDS });
  return { user: updatedUser, inventoryItem: equipped };
}

export async function listInventory(userId: string) {
  const [items, user] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { userId }, include: { shopItem: true }, orderBy: { purchasedAt: 'desc' } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { avatarConfig: true, equippedAura: true, equippedFrame: true, equippedTheme: true } }),
  ]);
  // Lo que se lleva puesto se lee del personaje (se puede quitar también desde el estudio).
  return items.map((inv) => ({ ...inv, isEquipped: inv.shopItem.slot ? isWorn(inv.shopItem, user) : inv.isEquipped }));
}

/** Pone o quita un artículo comprado. */
async function setEquipped(userId: string, inventoryItemId: string, on: boolean) {
  const inv = await prisma.inventoryItem.findFirst({ where: { id: inventoryItemId, userId }, include: { shopItem: true } });
  if (!inv) throw new Error('No encontrado');
  const { type, slot, value, imageKey } = inv.shopItem;
  if (!EQUIP_TYPES.has(type)) throw new Error('Este artículo no se puede equipar');

  if (slot && AVATAR_SLOTS.has(slot) && value) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { avatarConfig: true } });
    const avatarConfig = applyAvatarItem(user.avatarConfig, slot, value, on) as Prisma.InputJsonValue;
    await prisma.user.update({ where: { id: userId }, data: { avatarConfig } });
  } else {
    const field = (slot && USER_FIELD[slot]) || (type === 'AURA' ? 'equippedAura' : type === 'FRAME' ? 'equippedFrame' : type === 'THEME' ? 'equippedTheme' : null);
    if (field) await prisma.user.update({ where: { id: userId }, data: { [field]: on ? (value ?? imageKey ?? null) : null } });
    // Solo uno de cada tipo a la vez.
    if (on) await prisma.inventoryItem.updateMany({ where: { userId, id: { not: inventoryItemId }, shopItem: { type } }, data: { isEquipped: false } });
  }
  return prisma.inventoryItem.update({ where: { id: inventoryItemId }, data: { isEquipped: on }, include: { shopItem: true } });
}

/** Alterna puesto / guardado. */
export async function equipItem(userId: string, inventoryItemId: string) {
  const inv = await prisma.inventoryItem.findFirst({ where: { id: inventoryItemId, userId }, include: { shopItem: true } });
  if (!inv) throw new Error('No encontrado');
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { avatarConfig: true, equippedAura: true, equippedFrame: true, equippedTheme: true } });
  const on = inv.shopItem.slot ? !isWorn(inv.shopItem, user) : !inv.isEquipped;
  const item = await setEquipped(userId, inventoryItemId, on);
  const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: PUBLIC_USER_FIELDS });
  return { ...item, user: updatedUser };
}

/** Lo de pago que tiene comprado (para dejarlo elegir en el estudio). */
export async function ownedAvatarItems(userId: string): Promise<Set<string>> {
  const rows = await prisma.inventoryItem.findMany({ where: { userId, shopItem: { slot: { in: [...AVATAR_SLOTS] } } }, select: { shopItem: { select: { slot: true, value: true } } } });
  return new Set(rows.map((r) => `${r.shopItem.slot}:${r.shopItem.value}`));
}

/** Avatar que guarda el estudio: sin lo de pago que no compró. */
export async function sanitizeAvatar(userId: string, avatarConfig: unknown) {
  return stripUnowned(avatarConfig, await ownedAvatarItems(userId));
}

export async function useItem(userId: string, inventoryItemId: string) {
  const item = await prisma.inventoryItem.findFirst({
    where: { id: inventoryItemId, userId },
    include: { shopItem: true },
  });
  if (!item) throw new Error('No encontrado');
  if (item.shopItem.type !== 'POWERUP' && item.shopItem.type !== 'PASS') throw new Error('No es un consumible');

  return prisma.inventoryItem.update({
    where: { id: inventoryItemId },
    data: { usedAt: new Date(), expiresAt: new Date(Date.now() + 86400000) },
    include: { shopItem: true },
  });
}
