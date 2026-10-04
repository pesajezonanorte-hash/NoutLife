# Prompt para Claude Code (una sola fase)

1. Descomprime y copia la carpeta `lifequest-redesign/` en el repo como `docs/redesign/` (reemplaza la v2 si existe).
2. Abre Claude Code en la raíz de `lifequest2` y pega todo lo que está debajo de la línea.

---

Implementa el rediseño completo de LifeQuest en `apps/web` en **una sola fase continua**, de principio a fin, sin pedir aprobación ni detenerte entre pantallas. Solo para si algo te bloquea de verdad: un dato que la API no tiene y no admite fallback, o un cambio que rompería otra parte de la app.

**Especificación (`docs/redesign/`)**
- `README.md`: mapa de las **26 rutas**, navegación, componentes, **Motion v3**, reglas y prioridad de estilos. Léelo completo una vez al inicio.
- `design-system/`: fuente de verdad de estilo. Si un prototipo usa otro valor, gana el design system.
- `tokens/`: `tokens.css`, `tailwind.tokens.ts`, `motion.ts` (incluye los presets v3: `expo`, `springSoft`, `page3`, `item3`, `pop3`, `tap3`, `cardHover3`, `barFill3`, `draw3`, `tick`, `useSpotlight`).
- `design/*.dc.html` + `lq.css`: prototipos (móvil `X`, desktop `XDesktop`). Su sintaxis (`{{}}`, `<sc-for>`, `<sc-if>`, `DCLogic`) es de un editor de diseño: tradúcela a JSX + Tailwind. Lee cada prototipo solo cuando vayas a implementar esa pantalla. Los datos de ejemplo (Alex Rivera, cifras, otros jugadores) se reemplazan por los reales.

**Si ya existe trabajo de la v2 en el repo** (rama `feat/redesign`): no lo rehagas. Continúa sobre él, sube todas las animaciones al Motion v3 y añade lo que falte.

**Reglas**
- No toques `apps/api` ni los contratos de datos. Usa los hooks de React Query y stores de Zustand que ya existen. Si falta un dato, deja `// TODO(api):` con un fallback y no inventes endpoints.
- Reutiliza lo existente: alias `@/*`, `src/styles/tokens.css`, Montserrat. Si algo choca con los tokens nuevos, mapea en vez de renombrar en masa.
- Sin hex en los componentes. Mobile-first.
- Anima solo `transform` y `opacity`. Hay dos excepciones documentadas: la blur de entrada y el acordeón con `grid-template-rows`.
- Envuelve la app en `MotionConfig reducedMotion="user"`. El tilt 3D se desactiva con reduced motion y con `pointer: coarse`.
- Primero construye los componentes compartidos (los del README, incluidos `SpotCard`, `Accordion`, `OtpInput`, `Countdown`, `RadarChart`, `AreaChart`, `SeasonPassTrack`, `BossBar`, `ThemePreviewDialog` y `ZoneToggleList`) y reutilízalos en todas las pantallas. No dupliques markup.
- Trabaja en la rama `feat/redesign`. Haz commits pequeños a medida que avanzas, sin esperar a nadie entre ellos.

**Orden de trabajo (sin pausas)**
1. **Base:** tokens, Tailwind, JetBrains Mono, `motion.ts` v3 y el toggle `.dark` (Zustand, con opción Auto).
2. **Componentes y AppShell:** los componentes UI y el AppShell completo:
   - Sidebar agrupada con UserCard y Topbar en desktop.
   - Rail en tablet.
   - TabBar + FAB + menú "Más" en móvil.
   - Transiciones de ruta con `page3`.
   - La navegación respeta las zonas ocultas en Ajustes → Zonas.
3. **Núcleo y bienestar:** Dashboard, Hábitos, Detalle de hábito, Misiones, Coliseo, Logros, Finanzas, Comida, Sueño y Perfil.
4. **Más zonas:** Gimnasio, Glow up, Aprendizaje, Relaciones, Diario, Agenda, Rituales, Sabiduría, Mis zonas, Tienda (con temas y vista previa), Ranking y Ajustes (con la pestaña Zonas).
5. **Comunidad, estadísticas y ayuda:** Estadísticas, Gremio, Campaña y Ayuda, con todos sus estados del README:
   - Gremio: sin gremio y dentro de un gremio.
   - Campaña: temporada activa e inactiva.
   - Ayuda: búsqueda con resultados y sin resultados.

**Verificación (una sola pasada al final)**
- Mientras trabajas, corre `typecheck` solo al cerrar cada punto del orden; corrige y sigue.
- Al final, ejecuta `lint`, `typecheck` y `build` de `apps/web`, sin errores.
- Saca capturas con Playwright de las 26 rutas a 375 y 1440 px en light, y de 4 rutas representativas en dark.
- Comprueba que, con reduced motion emulado, no haya tilt, blur ni desplazamientos.
- Comprueba que no haya scroll horizontal a 375 px, que el foco sea visible y que Escape cierre los modales.
- Comprueba que el OTP del Gremio acepte pegar un código, avance solo y retroceda con backspace, y que los acordeones de Ayuda actualicen `aria-expanded`.

**Al terminar**, dame un resumen corto con:
- qué se implementó;
- los mapeos de tokens o clases que hiciste;
- los `TODO(api)` pendientes (Gremio, Campaña y zonas ocultas son los más probables);
- cualquier desviación del diseño y su motivo.
