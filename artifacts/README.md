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

# Evidencia de loaders terminales — integración literal

Capturas móviles a **390 × 844 px** para el mismo loader terminal literal basado en `motion/react`. Las rutas autenticadas usan un usuario y respuestas API simuladas; el splash conserva el timing real del bootstrap.

| Caso | Archivo | Qué verifica |
| --- | --- | --- |
| Splash de arranque | `loader-splash.png` | El loader literal durante el bootstrap de Noutlife. |
| Zona autenticada | `loader-page.png` | El mismo loader durante la carga diferida de una zona, sin overflow a 390 px. |
| Primera sección: Logros | `loader-section-achievements.png` | El mismo loader al resolver por primera vez los datos de la sección. |
| Primera sección: Comida | `loader-section-food.png` | El mismo loader al resolver por primera vez las comidas de la sección. |

## Validación de loaders

- Timing compartido: **200 ms** antes de mostrar un loader y **400 ms** de visibilidad mínima, contado sólo desde que el loader aparece.
- El loader literal se aplica al splash, a las rutas/zonas y a todos los estados iniciales de carga de sección que antes usaban la variante compacta.
- `NOUTLIFE_E2E_BASE_URL=http://127.0.0.1:5173 npm run test:e2e --workspace=apps/web -- --grep 'literal terminal loader coverage'`: **4/4 aprobadas**. Cubre ruta lazy, primera carga de sección sin overflow en 360/390/430 px, ventana mínima visible y reduced motion habilitado.
- Suite E2E completa: **5 aprobadas, 3 omitidas** porque requieren credenciales reales o permitir mutaciones de rituales.
