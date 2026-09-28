# Evidencia de auditoría móvil — commit 5

Capturas comparativas tomadas a **390 × 844 px, modo claro**, con respuestas API simuladas y el mismo usuario de QA.

| Área | Antes (base `23c7d94`) | Después |
| --- | --- | --- |
| Castillo | `mobile-before-castle.png` | `mobile-after-castle.png` |
| Estadísticas | `mobile-before-stats.png` | `mobile-after-stats.png` |
| Menú Más | `mobile-before-more.png` | `mobile-after-more.png` |
| Misiones con FAB | `mobile-before-fab.png` | `mobile-after-fab.png` |

Evidencia complementaria de controles auditados:

- `mobile-after-gym-set-cards.png` — tarjetas de sets de Gimnasio en móvil.
- `mobile-after-avatar-customizer.png` — selector de apariencia y colores de 44 px.
- `mobile-after-class-selection.png` — selector de clase como sheet móvil alcanzable.
- `mobile-after-more-utilities.png` — accesos de audio, enfoque, El Sabio, tema y feedback dentro de Más.

## Verificaciones ejecutadas

- Matriz de rutas: 15 rutas × 360/390/430 px × claro/oscuro = **90 casos**, sin overflow documental, controles visibles fuera del viewport, targets pequeños detectados ni `pageerror`.
- Matriz al final de scroll: los mismos 90 casos, sin controles del contenido bloqueados por la tab bar o el FAB.
- Flujos poblados de Más/El Sabio, FAB de Misiones/Hábitos/Bóveda, sheets de Comida/Agenda y sets móviles de Gimnasio: aprobados a 360 claro, 390 claro/oscuro y 430 oscuro.
- `npm run build --workspace=apps/web`: aprobado.

---

# Evidencia de loaders terminales — commit 4

Capturas móviles a **390 × 844 px** para la identidad de carga compartida. Las rutas autenticadas usan un usuario y respuestas API simuladas; el splash usa su progreso real.

| Caso | Archivo | Qué verifica |
| --- | --- | --- |
| Splash de arranque | `loader-splash.png` | Variante `screen` con el progreso real de inicio (88 % en la captura). |
| Ruta lazy pública | `loader-page.png` | Variante `page` mientras un import de Login está retenido; el fallback ya pasó el umbral compartido. |
| Logros | `loader-compact-achievements.png` | Variante `compact`, tema claro, dentro de una pantalla autenticada. |
| Comida | `loader-compact-food-dark.png` | Segunda variante `compact`, tema oscuro, después de desplazar el contenido para que el bloque completo quede fuera de la tab bar. |
| Movimiento reducido | `loader-reduced-motion.png` | Variante `compact` estática con `prefers-reduced-motion: reduce`. |

## Validación de loaders

- Timing único: **200 ms** antes de mostrar un loader y **400 ms** de visibilidad mínima, contado sólo desde que el loader aparece.
- `LIFEQUEST_E2E_BASE_URL=http://127.0.0.1:5173 npm run test:e2e --workspace=apps/web -- --grep 'terminal loader variants'`: **4/4 aprobadas**. Cubre fallback `page`, tamaños/overflow de `compact` en 360/390/430 px, visibilidad mínima y reduced motion.
- Suite E2E completa con la misma URL: **5 aprobadas, 3 omitidas**. Las omitidas requieren credenciales reales o permitir una mutación de rituales, que no se configuraron para esta auditoría.
- Simulación de red lenta en build de producción: **400 ms de latencia, 50 KiB/s de descarga, 20 KiB/s de subida y CPU 4×**. El loader `compact` apareció a los **2735 ms** y el documento conservó 390 px de ancho en el viewport de 390 px.
- Resultado serializado: `loader-qa-results.json`.
