# Prompt para Claude Code

Copia todo lo que está debajo de la línea y pégalo en Claude Code, abierto en la raíz del repo `lifequest2`, con esta carpeta copiada en `docs/redesign/`.

---

Vamos a implementar el rediseño de LifeQuest en `apps/web`. Toda la especificación está en `docs/redesign/`:

- `docs/redesign/README.md`: mapa de pantallas, componentes, reglas y desviaciones. **Léelo primero, completo.**
- `docs/redesign/tokens/`: `tokens.css`, `tailwind.tokens.ts`, `motion.ts` (listos para integrar).
- `docs/redesign/design/*.dc.html`: prototipos de cada pantalla (móvil `X.dc.html`, desktop `XDesktop.dc.html`) y `lq.css` con medidas/animaciones exactas. Son especificación, no código a copiar: usan una sintaxis de plantilla propia (`{{}}`, `<sc-for>`, `<sc-if>`, `DCLogic`). Tradúcelos a JSX + Tailwind con nuestros tokens.

Restricciones:
- No toques `apps/api`. No cambies contratos de datos: conecta la UI a los hooks/queries de React Query y stores de Zustand que ya existen; los datos de ejemplo de los prototipos son solo placeholders. Si una pantalla necesita un dato que la API no da, deja un `// TODO(api):` y un fallback, no inventes endpoints.
- Respeta la configuración existente (alias `@/*`, Montserrat ya mapeada, variables `var(--*)` actuales). Si ya hay variables con otros nombres, haz un mapeo y avísame antes de renombrar en masa.
- Nada de hex en componentes; solo clases de token. Mobile-first (375 → sm → md → lg).
- Trabaja en la rama `feat/redesign`. Un commit por fase, mensajes claros.

Plan por fases. Detente al final de cada fase, corre `lint`, `typecheck` y `build` de `apps/web`, y muéstrame un resumen + capturas con Playwright a 375, 834 y 1440 px (light y dark) de lo que cambió antes de seguir:

1. **Fundamentos:** inspecciona `tailwind.config.ts`, `src/index.css` y los componentes UI actuales; dime qué existe y cómo vas a mapearlo. Integra `tokens.css`, fusiona `tailwind.tokens.ts`, crea `src/lib/motion.ts`, envuelve la app en `<MotionConfig reducedMotion="user">` y asegura el toggle `.dark` en `<html>` (persistido en Zustand, opción Auto = `prefers-color-scheme`).
2. **Componentes UI** (`src/components/ui/`) según la lista del README, replicando estados de `Components.dc.html` y `lq.css` (hover/active/disabled/focus, light/dark). Si hay Storybook o una ruta de playground, agrégalos ahí.
3. **Layout:** `AppShell` con TabBar + FAB (móvil), Rail (tablet), Sidebar + Topbar con breadcrumb (desktop); transiciones de ruta con `AnimatePresence mode="wait"` y `page` de `motion.ts`.
4. **Pantallas semana 1:** Dashboard, Hábitos, Detalle de hábito, Misiones (con loading/error/empty y todas las animaciones descritas).
5. **Pantallas semana 2:** Coliseo, Logros, Finanzas.
6. **Pantallas semana 3:** Comida, Sueño, Perfil.
7. **QA final:** audita contraste AA, foco visible, orden de tabulación, Escape en modales, `aria-*` del README, `prefers-reduced-motion` (emúlalo en Playwright) y que no haya scroll horizontal a 375 px. Lista lo que quedó pendiente.

Empieza por la fase 1: lee el README y los archivos del repo indicados, y muéstrame tu plan de mapeo antes de escribir código.
