// Canal entre la ventana proyectada y la de notas del expositor (misma máquina,
// mismo navegador). La proyección anuncia el paso actual; las notas mandan órdenes.
export type DeckMessage =
  | { type: 'step'; step: number }
  | { type: 'hello' }
  | { type: 'cmd'; cmd: 'next' | 'prev' | 'timer' };

export const openChannel = () => new BroadcastChannel('noutlife-presentacion');
