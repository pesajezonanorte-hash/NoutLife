// Guion del anuncio en fotogramas, con tipos. Los números están en timeline.json porque
// también los leen Blender (blender/studio.py) y la música (scripts/build-music-studio.mjs).
//
// Hoja (segundo · fotograma · qué pasa · sonido). Todo el anuncio va sobre el crema #FAF6F0,
// sin viñetas ni cambios de fondo, y con una sola cámara (sin cortes).
//  0,0 s  f0     «¿Y si tu vida real» ya está entrando (empezó en f−10), luego          zumbido ambiental desde el
//                «tuviera un» (f12) y «modo Pro?» (f28), letra a letra desde una        primer fotograma; una nota
//                máscara, con el interletrado cerrándose; la cámara empuja de 1 a 1,05  de mazo por línea
//  1,6 s  f48    destello de oro champán sobre «Pro»                                   tres campanas de cristal
//  2,8 s  f84    el texto se apaga y emerge el teléfono de Blender, flotando con su   aire; al frenar, un golpe
//                sombra de contacto y girando de −12° a 0° en Y; frena con un rebote   sub muy suave
//                mínimo y un cabeceo de inercia
//  4,4 s  f132   Coliseo y Recreación salen de su baldosa como cristal líquido         dos toques de cristal
//  5,9 s  f176   la cámara se acerca a las zonas (las tarjetas se apartan): se abre   pestillos finísimos y
//                el candado del Coliseo (f194) y el de Recreación (f204); el resto,    campanitas jade; clics
//                en cadena; la cámara vuelve (f238)                                     mínimos en cadena
//  7,8 s  f234   las tarjetas vuelven y pasan a «DESBLOQUEADA», en jade               dos notas
//  8,7 s  f260   las tarjetas salen por los lados; el teléfono se eleva (f270)         aire
//  9,5 s  f284   entra la tarjeta de la oferta, entera, detrás del teléfono que sube   acorde punteado
//                y la destapa: «7 DÍAS DE PRO. GRATIS.», «Sin tarjeta de crédito.» y
//                la letra pequeña, sólidos desde su primer fotograma; a f306 brilla
//                el oro de «PRO.»                                                      brillo
// 11,3 s  f340   botón «Empieza ahora»; a f358 se pulsa                               clic; al pulsar, bajar y subir
// 12,4 s  f372   silencio total, todo quieto                                          nada (silencio digital)
// 13,0 s  f390   la tarjeta se va; a f400 queda el logo de NoutLife sobre el crema     acorde y campanas; fundido
//                                                                                     largo hasta el final
import T from './timeline.json';

export const FPS = T.fps;
export const WIDTH = T.width;
export const HEIGHT = T.height;
export const DURATION = T.duration;

export const HOOK = T.hook;
export const DEVICE = T.device;
export const OFFER = T.offer;
export const END = T.end;
export const SCREEN = T.screen;
export const PHONE = T.phone;

/** Tramos de las secuencias de la línea de tiempo del Studio. */
export const SEQUENCES = {
  hook: { from: 0, to: HOOK.exit[1] },
  device: { from: DEVICE.render[0], to: DEVICE.render[1] + 1 },
  offer: { from: OFFER.enter[0], to: END.cardOut[1] },
  end: { from: END.cardOut[0], to: DURATION },
} as const;
