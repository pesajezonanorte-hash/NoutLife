// Movimiento en fracciones de píxel para capas compuestas.
//
// Chrome compone aparte lo que tiene transformación 3D, backdrop-filter, filter u
// opacidad, y coloca esas capas en la rejilla de píxeles enteros: una tarjeta de cristal
// o el teléfono que se mueven 0,2 px por fotograma avanzan a saltos de 1 px (medido en
// el render: la tarjeta entera cambia de golpe un fotograma sí y otro no).
// Si el desplazamiento va dentro de la transformación y esta tiene un término de
// perspectiva despreciable, Chrome la trata como 3D y la remuestrea: en posiciones
// enteras el resultado es idéntico píxel a píxel y entre ellas se mueve de forma continua.
export const SUBPIXEL = 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -0.000001, 0, 0, 0, 1)';
