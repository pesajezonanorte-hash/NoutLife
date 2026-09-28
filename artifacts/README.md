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
