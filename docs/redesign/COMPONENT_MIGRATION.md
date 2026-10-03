# Migración de componentes heredados

Estado de los componentes de `apps/web/src/components/ui/` anteriores al rediseño.
Para código nuevo, usa siempre `@/components/ui/lq`.

| Componente | Estado | Usos | Acción |
|---|---|---|---|
| `ui/button.tsx` | Eliminado | 0 | Nadie lo importaba. |
| `ui/flow-button.tsx` (`FlowButton`) | Adaptador | 15 páginas, `EmptyState`, `PixelButton` | Mantiene su API, pero pinta con el `Button` de lq. Migrar los usos y borrarlo. |
| `ui/lifequest-flip-card.tsx` + `ui/perspective-flip-card.tsx` | Se mantiene | 6 páginas | Accesible. Revisar el color de acento por página. |
| `ui/PixelButton.tsx` | Pendiente | 9 páginas, 2 componentes | Migrar a `Button`. |
| `ui/PixelPanel.tsx` | Pendiente | 13 páginas, 2 componentes | Migrar a `Card`. |
| `ui/modern-loader.tsx` (`ModernLoader`) | Pendiente | 11 páginas, 1 componente | Migrar a `PageLoader` / `Skeleton`. |

## FlowButton

Desde la fase 7, `FlowButton` es un adaptador sobre `buttonClasses()` de lq:

| `tone` | Resultado |
|---|---|
| `primary` | `Button` primary |
| `secondary` | `Button` secondary |
| `danger` | `Button` danger |
| `ghost` | contorno neutro (`border-border`, `text-on-surface`) |
| `green` | tinte suave success (`text-success-text`) |
| `cyan` | tinte suave info (`text-info-text`) |

| `size` | Altura |
|---|---|
| `sm` | 44 px en táctil, 36 px en md+ |
| `md` | 44 px |
| `lg` | 48 px |

Todos los tamaños tienen además un ancho mínimo de 44 px.

Se quitaron el círculo de relleno animado y las flechas: eran decorativos y no tienen equivalente en el sistema. La prop `withArrows` se sigue aceptando pero ya no tiene efecto.

Para migrar un uso:

```tsx
// antes
<FlowButton tone="danger" size="sm" withArrows={false} onClick={…}>Eliminar</FlowButton>
// después
<Button variant="danger" size="sm" onClick={…}>Eliminar</Button>
```

**Ojo:** algunos usos pasan `className` con colores heredados, como `text-text-secondary` o `font-pixel`, o un `style={{ fontSize: 12 }}`. Quítalos al migrar, porque pisan los tokens.

Los botones que solo tienen un icono necesitan `aria-label`. En la fase 7 se añadió a los de Agenda, Diario y Gremio.

## Flip cards

`PerspectiveFlipCard` ya cumple lo que pide el brief:

- **Teclado:** la cara frontal es un `<button>` con `aria-expanded` y `aria-controls`, que se activa con Enter o Espacio. Escape vuelve a la cara frontal y le devuelve el foco.
- **Cara inactiva:** queda `inert` y con `aria-hidden`, así que no se puede tabular a ella.
- **Movimiento reducido:** sin giro 3D, solo un fundido. Desde la fase 7 también respeta el ajuste «Reducir movimiento» de la app, además del del sistema.

Cambios de la fase 7:

- Se quitó `aria-pressed`, que contradecía a `aria-expanded`.
- Se quitaron también los atributos ARIA del botón «Volver».

**Pendiente:** el acento (`--flip-accent`) llega como color libre desde cada página y pinta el *eyebrow* y el badge. Si una página pasa un color de poco contraste, el texto no llega a AA. Para resolverlo, la prop debería aceptar solo `Tone` y usar las clases `text-*-text`.

## Utilidades de color heredadas

`globals.css` redefine como **texto** tres utilidades heredadas cuyos valores fijos no llegan a 4.5:1. Fondos y bordes no cambian.

| Utilidad | Pasa a |
|---|---|
| `.text-accent-gold` (también `hover:` y `group-hover:`) | `--lq-warning-text` |
| `.text-accent-green` | `--lq-success-text` |
| `.text-accent-red` | `--lq-error-text` |

Al migrar cada página a lq, sustituye estas clases por `text-warning-text`, `text-success-text` y `text-error-text`.

## Fase 6 (Más zonas I)

Migradas a `ui/lq`: Gimnasio, Glow up, Aprendizaje, Relaciones (`/love`), Diario y Agenda, junto con `GymExtras`, `LearningExtras` y `SageContextButton`.

Componentes nuevos en `ui/lq/`: `ChipGroup`, `DayDot`, `StepItem`, `Timer`, `BookCover`, `MoodPicker` (`MoodFace`), `TimelineDay`, `MonthGrid`.

Notas:
- `globals.css`: `button { border: 0 }` pasó a `border-width: 0`. Con `border: 0` el botón quedaba con `border-style: none` y ninguna clase `border-*` dibujaba el borde.
- `tailwind.config.ts` registra `font-mono` (JetBrains Mono, ahora con peso 700 en la fuente).
- Datos que la API no da (marcados `TODO(api)`): pasos sueltos de rutinas (Glow up), outfits, conexión % y último contacto (Relaciones), minutos de enfoque diarios (Pomodoro), récords históricos (Gimnasio).
