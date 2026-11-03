// Tiempos del splash que comparten el hilo principal (boot.ts) y el Worker (hero.ts). La entrada (hojas,
// palabra y barra) es CSS de index.html: boot.ts espera a que acabe y, un momento después, el líquido
// empieza. El fundido del fondo se programa desde el principal, sin esperar respuesta del Worker.

/** La N de CSS se queda a la vista este tiempo después de terminar la entrada, antes de fundirse. */
export const LEAVE_HOLD_MS = 350;
