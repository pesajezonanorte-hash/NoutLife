// Id estable del navegador/PWA. El servidor lo guarda con la prueba gratis para
// que un mismo dispositivo no reciba otra tras borrar la cuenta. Settings lo
// conserva al reiniciar o eliminar la cuenta (lista `keep` de clearLocalAccountState).
const KEY = 'lq_device_id';

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}
