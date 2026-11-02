// Para el 3D que compila sombreadores: el hilo del GPU es uno solo y un compilado traba la secuencia
// del splash en pleno viaje. Sin three.js: lo usan piezas que aún no lo han descargado.
let gone: Promise<void> | null = null;

/** Se resuelve cuando el splash ya no está (o enseguida, si nunca estuvo). */
export function afterSplash(): Promise<void> {
  if (!gone) {
    gone = new Promise((resolve) => {
      const check = () => {
        if (document.getElementById('lq-boot')) return false;
        resolve();
        return true;
      };
      if (check()) return;
      const mo = new MutationObserver(() => { if (check()) mo.disconnect(); });
      mo.observe(document.body, { childList: true });
    });
  }
  return gone;
}
