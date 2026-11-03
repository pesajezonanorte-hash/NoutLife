# Materia calma: fuentes 3D

El volumen de la interfaz de NoutLife: almohadilla de los hábitos, aro de enfoque, losa de las tarjetas y la secuencia del splash. Todo sale de un script, así que nada se edita a mano en el `.glb`: se cambia [`scripts/blender/calm.py`](../../scripts/blender/calm.py) y se regenera.

```bash
# desde apps/web; necesita Blender 4.5 (la variable BLENDER cambia la ruta)
node scripts/build-calm.mjs                 # los cuatro juegos
node scripts/build-calm.mjs pad focus       # solo algunos
node scripts/build-calm.mjs hero --render /tmp/qa --samples 32   # con láminas de control
npm test                                    # tests/unit/calm3d.unit.ts revisa cada .glb
```

## Qué hay en cada juego

| Juego | `.glb` | Shape keys | Animaciones (pistas NLA) | Mapa de normales |
|---|---|---|---|---|
| Almohadilla | `src/assets/models/calm-pad.glb` (26 KB) | `press`, `release`, `fill` | `pad_press`, `pad_release`, `pad_fill` | 256², labio de la corona |
| Aro de enfoque | `src/assets/models/calm-focus.glb` (63 KB) | `inhale`, `exhale`, `flow_a`, `flow_b` | `focus_breath` (11 s), `focus_flow` (26 s) | 128², grano esmerilado que se repite |
| Losa | `design/blender/calm-card.glb` (10 KB) | `lift`, `press` | `card_lift`, `card_settle` | no |
| Secuencia del splash | `src/assets/models/calm-hero.glb` y `design/blender/calm-hero-secuencia.glb` | `puff`, `drop` (N); `solid`, `liquid`… en `hero_tiempo` | `hero_outro` (1,5 s); en el archivo de diseño, además, `hero_sequence` | no |

Cada `.blend` trae la malla baja, la malla alta con la que se horneó el mapa (oculta), los materiales, las acciones en pistas NLA y el mundo «estudio suave». El de la secuencia cambia el estudio por tres luces con nombre (`Key`, `Fill`, `Rim`) sobre el color de fondo de la app (#f9f7f3) y añade el líquido en metabolas (`hero_liquido`), que solo existe en el `.blend`.

## La secuencia del splash

La entrada la pone el CSS de `index.html`: las tres hojas del logo vuelan, giran y se asientan formando la N, y después aparece «noutlife» letra a letra. Cuando la app está lista y la entrada ha terminado, el 3D toma esa N en el mismo sitio y la funde en líquido; una corriente la lleva hasta el logo de la cabecera.

| Pieza | Qué es |
|---|---|
| `hero_n` | La N del logo, con el contorno exacto de sus trazados (`components/layout/Brand.tsx`). Tres almohadas, una por hoja del logo, cada una con su pared. Una primitiva por hoja, en el orden en que el SVG las pinta (c, a, b). `puff` la hincha; `drop` la recoge en una gota. |
| `hero_tiempo` | Una malla vacía que solo lleva curvas: `solid`, `puff`, `drop`, `liquid`, `pool`, `flow`, `reform` y `flat`. La web las lee del `.glb`, así los tiempos se ajustan en Blender. |
| `hero_liquido` | Solo en el `.blend`: las metabolas de la corriente. La web la dibuja con su propio campo de gotas. |

| Clip | Dura | Qué hace |
|---|---|---|
| `hero_outro` | 1,5 s | La N aparece sobre la de CSS (`solid`, 0,3 s), toma aire, se funde en una gota, la corriente sale hacia el logo y allí vuelve a ser la N, ya plana como el SVG |

Atributos propios, que el exportador deja en los ejes de Blender (x, y, z), sin pasarlos a glTF: `_OUT` (hacia dónde abre la web la pared, para tener una altura con signo alrededor del borde), `_LAG` (cuándo se funde cada punto) y `_SHADE` (la sombra que deja la pared de encima).

`calm-hero-secuencia.glb` lleva la misma historia de la N para otros visores; las metabolas no van en el glTF.

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
| Navbar | `layout/nav3d/NavPebble` | La pastilla es CSS (`.lq-nav-clay`) y viaja con `transform` en el compositor; la escena dibuja solo el ícono con volumen, mientras algo cambia |
| Tarjetas | `.lq-card`, `.lq-lift`, `lib/motion/tilt` | DOM: bisel horneado de la losa (`src/assets/textures/card-bevel.webp`) e inclinación con muelle |
| Splash | `src/splash` (`boot`, `hero`, `hero.worker`) | La entrada (hojas, palabra y barra) es CSS de `index.html`. Cuando la app está lista, el Worker toma la N de CSS y la funde: la N se dibuja a una textura (altura con signo, normal, color), las gotas a otra, y un paso final suma las dos. Sin WebGL de verdad, con «Ahorro de datos», con 2G o con «Reducir movimiento», la N de CSS vuela sola hasta el logo |

El ícono con volumen del navbar no es un modelo: se genera al vuelo desde el mismo `<svg>` de lucide (`nav3d/iconTube.ts`), así funciona con cualquier zona, también las que crea cada persona.

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
