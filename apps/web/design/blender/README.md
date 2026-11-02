# Materia calma: fuentes 3D

El volumen de la interfaz de NoutLife: almohadilla de los hábitos, aro de enfoque, canto rodado del navbar, losa de las tarjetas y la escultura del splash. Todo sale de un script, así que nada se edita a mano en el `.glb`: se cambia [`scripts/blender/calm.py`](../../scripts/blender/calm.py) y se regenera.

```bash
# desde apps/web; necesita Blender 4.5 (la variable BLENDER cambia la ruta)
node scripts/build-calm.mjs                 # los cinco juegos
node scripts/build-calm.mjs pad focus       # solo algunos
node scripts/build-calm.mjs nav --render /tmp/qa --samples 32   # con láminas de control en Cycles
npm test                                    # tests/unit/calm3d.unit.ts revisa cada .glb
```

## Qué hay en cada juego

| Juego | `.glb` | Shape keys | Animaciones (pistas NLA) | Mapa de normales |
|---|---|---|---|---|
| Almohadilla | `src/assets/models/calm-pad.glb` (26 KB) | `press`, `release`, `fill` | `pad_press`, `pad_release`, `pad_fill` | 256², labio de la corona |
| Aro de enfoque | `src/assets/models/calm-focus.glb` (63 KB) | `inhale`, `exhale`, `flow_a`, `flow_b` | `focus_breath` (11 s), `focus_flow` (26 s) | 128², grano esmerilado que se repite |
| Canto rodado | `src/assets/models/calm-nav.glb` (22 KB) | `stretch_x`, `stretch_y`, `squash` | `nav_travel` | 128², labio del borde |
| Losa | `design/blender/calm-card.glb` (10 KB) | `lift`, `press` | `card_lift`, `card_settle` | no |
| Escultura del splash | `src/assets/models/calm-hero.glb` (87 KB) | `ridge_a`, `ridge_b`, `breath`, `mass`, `pebble` | `hero_birth`, `hero_breath` (4 s), `hero_roll` (9 s), `hero_outro` | 128², ondulación de la mano |

Cada `.blend` trae la malla baja, la malla alta con la que se horneó el mapa (oculta), los materiales, las acciones en pistas NLA y el mundo «estudio suave». El de la escultura cambia el estudio por tres luces con nombre (`Key`, `Fill`, `Rim`) sobre el color de fondo de la app (#f9f7f3) y añade su núcleo de arcilla (`hero_nucleo`), que sigue al vidrio con drivers.

## La escultura del splash

Una cinta gruesa de Möbius con tres medias vueltas: una sección de dos crestas que, al cerrar el aro, empalma cada lado con el otro. Se ven tres tramos y un agujero de tres lados (rutina, mente e ideas), pero es una sola cara y un solo canto. Por eso la malla base es el toro liso y las crestas son dos shape keys en cuadratura: con `ridge_a = cos φ` y `ridge_b = sin φ`, la cresta rueda por la superficie sin que el objeto se mueva. Las filas de la malla van a lo largo de la cresta; con 64 × 24 caras la silueta sale limpia a cualquier fase.

| Clip | Dura | Qué hace |
|---|---|---|
| `hero_birth` | 1,3 s | De la gota (`mass`) a la forma de reposo con un rebote blando; la cresta sube después, con su propio muelle |
| `hero_breath` | 4 s, en bucle | Se expande un 3 % y vuelve, despacio |
| `hero_roll` | 9 s, en bucle | Una vuelta de fase de la cresta |
| `hero_outro` | 0,95 s | Toma aire, suelta las crestas y se cierra en el canto rodado del navbar (`pebble`, el mismo contorno y perfil de `calm-nav`) |

En reposo el `.glb` trae `ridge_a = 1`. Fuera de la web, el núcleo no viaja en el archivo: es la misma malla sin toda la cresta y metida un 10 % hacia dentro (`HERO_CORE`).

## Materiales

Todos son Principled BSDF, porque es lo que el glTF puede llevar; los nodos procedurales no se exportan. El detalle fino se hornea a un mapa de normales.

- **Arcilla o silicona** (`pad_silicona`, `nav_arcilla`, `card_arcilla`): rugosidad 0,42–0,58, subsuperficie ligera en el `.blend` y una capa de brillo abierta (`KHR_materials_clearcoat`). El glTF no lleva subsuperficie.
- **Vidrio esmerilado** (`focus_vidrio`): `KHR_materials_transmission` 0,82, rugosidad 0,62, IOR 1,45.
- **Luz** (`pad_luz`): la palomita, con `KHR_materials_emissive_strength`. En el `.blend`, la emisión de la silicona sigue al peso de `fill` con un driver.

## Cómo se usan en la web

Los colores no salen del `.glb`: cada escena pinta con los tokens del tema (`--lq-*`), así el mismo archivo vale para Aurora, oscuro y los temas de la Tienda. La luz y la subsuperficie las aproxima [`three3d/calmMaterial.ts`](../../src/components/three3d/calmMaterial.ts) sin pasada de transmisión, para sostener 60 fps.

| Zona | Componente | Cómo se dibuja |
|---|---|---|
| Hábitos y rutinas | `ui/lq/SoftPad`, `CheckButton` | Un solo contexto WebGL (`three3d/softPadEngine`): en reposo es una imagen del modelo por tema; solo la que se toca se dibuja en vivo |
| Enfoque y Pomodoro | `focus/FocusRing` | Escena propia (`FocusRingScene`); el tiempo sigue en el DOM |
| Navbar | `layout/nav3d/NavPebble` | El viaje en X/Y va por CSS `transform` (compositor); la escena dibuja la forma y el ícono solo mientras algo cambia |
| Tarjetas | `.lq-card`, `.lq-lift`, `lib/motion/tilt` | DOM: bisel horneado de la losa (`src/assets/textures/card-bevel.webp`) e inclinación con muelle |
| Splash | `src/splash` (`boot`, `hero`, `hero.worker`) | WebGL 2 a pelo en un Worker con OffscreenCanvas: no se traba mientras React monta la app y no descarga three.js. El núcleo se dibuja aparte en un lienzo de 256² y el vidrio lo mira desenfocado desde sus mipmaps. El primer pintado es una gota en CSS (`index.html`); sin WebGL de verdad, con «Ahorro de datos», con 2G o con «Reducir movimiento», se queda ella |

Los íconos con volumen del navbar no son modelos: se generan al vuelo desde el mismo `<svg>` de lucide (`nav3d/iconTube.ts`), así funcionan con cualquier zona, también las que crea cada persona.

## Otros clientes (React Three Fiber, móvil)

Los `.glb` son glTF 2.0 estándar con cuantización y `EXT_meshopt_compression`, así que el cargador necesita el decodificador de meshopt:

```tsx
import { useEffect } from 'react';
import { useAnimations, useGLTF } from '@react-three/drei';

// useGLTF activa meshopt por defecto.
function Pad({ on }: { on: boolean }) {
  const { scene, animations } = useGLTF('/models/calm-pad.glb');
  const { actions } = useAnimations(animations, scene);
  useEffect(() => { if (on) actions.pad_fill?.reset().play(); }, [on, actions]);
  return <primitive object={scene} />;
}
```

Al apagar la almohadilla, `pad_fill` se reproduce al revés. Cada clip anima los pesos de todos los shape keys de su malla.
