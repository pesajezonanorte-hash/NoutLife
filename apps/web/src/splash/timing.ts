// Tiempos del splash que comparten el hilo principal (boot.ts) y el Worker (hero.ts). La entrada (hojas,
// palabra y barra) es CSS de index.html: boot.ts espera a que acabe y, un momento después, el líquido
// empieza. El fundido del fondo se programa desde el principal, sin esperar respuesta del Worker.

/** La N de CSS se queda a la vista este tiempo después de terminar la entrada, antes de fundirse. */
export const LEAVE_HOLD_MS = 350;
/** Si la entrada no acaba (pocos fotogramas), la N sale igual. Cuenta desde que se abrió la página. */
export const INTRO_MAX_MS = 3500;
/** Si el líquido no llega al logo, la app no sigue tapada más que esto. */
export const LAND_MAX_MS = 3500;
/** Con menos fotogramas por segundo durante la entrada, el líquido se arrastraría: la N de CSS hace el camino. */
export const MIN_INTRO_FPS = 10;
