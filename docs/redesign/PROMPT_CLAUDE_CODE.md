# Prompt para Claude Code

Copia esta carpeta en el repo como `docs/redesign/` (reemplaza la versión anterior si existe). Abre Claude Code en la raíz de `lifequest2` y pega todo lo que está debajo de la línea.

---

Vamos a implementar el rediseño completo de LifeQuest en `apps/web`. La especificación está en `docs/redesign/`:

- `docs/redesign/README.md`: mapa de las 22 rutas, navegación, componentes, motion, reglas y la **prioridad de estilos**. Léelo primero, completo.
- `docs/redesign/design-system/`: el LifeQuest Design System (README + tokens.json). Es la fuente de verdad de estilo: si un prototipo usa otro valor (radio, color de texto, fuente de cifras), gana el design system.
- `docs/redesign/tokens/`: `tokens.css`, `tailwind.tokens.ts` y `motion.ts`, ya alineados con el design system.
- `docs/redesign/design/*.dc.html` + `lq.css`: prototipos de cada pantalla (móvil `X`, desktop `XDesktop`). Son especificación, no código: usan sintaxis de plantilla propia (`{{}}`, `<sc-for>`, `<sc-if>`, `DCLogic`). Tradúcelos a JSX + Tailwind con nuestros tokens. Los datos de ejemplo se reemplazan por los reales.

Restricciones:
- No toques `apps/api` ni contratos de datos. Conecta la UI a los hooks de React Query y stores de Zustand existentes. Si falta un dato, deja `// TODO(api):` con un fallback; no inventes endpoints.
- Respeta lo que ya existe: alias `@/*`, `src/styles/tokens.css`, Montserrat. Antes de renombrar variables o clases en masa, muéstrame el mapeo.
- Sin hex en componentes. Mobile-first. Solo `transform`/`opacity` en animaciones. `MotionConfig reducedMotion="user"`.
- Rama `feat/redesign`. Un commit por fase.

Fases. Al final de cada una corre lint, typecheck y build de `apps/web`, toma capturas con Playwright a 375, 834 y 1440 px (light y dark) de lo que cambió, y espera mi OK:

1. **Fundamentos:** compara `tokens/` y `design-system/` con lo actual; integra tokens, Tailwind, JetBrains Mono para cifras, `motion.ts`, toggle `.dark` (Zustand, opción Auto).
2. **Componentes UI:** los del design system + los nuevos del README (Chip, StepItem, DayDot, Timer, TimelineDay, MonthGrid, Podium, LeaderRow, BookCover, QuoteCard, ShopItem/PurchaseDialog, MoodPicker, SabioComposer, UserCard), con estados de `Components.dc.html`.
3. **Layout:** AppShell con Sidebar agrupada + UserCard + Topbar (desktop), Rail (tablet), TabBar + FAB + menú "Más" (móvil); transiciones de ruta.
4. **Núcleo:** Dashboard, Hábitos, Detalle, Misiones.
5. **Engagement:** Coliseo, Logros, Finanzas, Comida, Sueño, Perfil.
6. **Más zonas I:** Gimnasio, Glow up, Aprendizaje, Relaciones, Diario, Agenda.
7. **Más zonas II y comunidad:** Rituales, Sabiduría, Mis zonas, Tienda, Ranking, Ajustes.
8. **QA:** contraste AA, foco y orden de tabulación, Escape en modales, `aria-*` del README, reduced motion emulado en Playwright, sin scroll horizontal a 375 px, Estadísticas/Gremio/Campaña/Ayuda con los nuevos tokens. Lista lo pendiente.

Empieza por la fase 1: lee el README, el design system y los archivos del repo indicados, y muéstrame el plan de mapeo antes de escribir código.
