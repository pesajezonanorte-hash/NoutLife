// Lo que la persona compró en la Tienda para su personaje («extra:capa»,
// «hair:rizos», «top:kimono»). El estudio solo deja elegir lo comprado; la
// Tienda lo apunta aquí al comprar para que aparezca sin recargar.
import { useEffect, useSyncExternalStore } from 'react';
import api from '@/lib/api';

let owned = new Set<string>();
let loaded = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function refresh() {
  try {
    const { data } = await api.get<{ items: string[] }>('/shop/owned');
    owned = new Set(data.items);
    loaded = Date.now();
    emit();
  } catch { /* sin conexión: se queda con lo que ya sabía */ }
}

/** Apunta una compra (la Tienda lo llama al comprar algo para el personaje). */
export function markOwned(key: string) {
  if (owned.has(key)) return;
  owned = new Set(owned).add(key);
  emit();
}

export function useOwnedItems() {
  useEffect(() => { if (Date.now() - loaded > 30_000) void refresh(); }, []);
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => owned,
  );
}
