# Prompt para Claude Code (una sola fase · rebrand Noutlife)

1. Descomprime el zip y copia la carpeta `noutlife-redesign/` en el repo como `docs/redesign/`. Reemplaza la versión anterior si existe.
2. Abre Claude Code en la raíz de `lifequest2` y pega todo lo que está debajo de la línea.

---

Aplica el rediseño y el rebrand **Noutlife (paleta Jade)** en `apps/web` en **una sola fase continua**, de principio a fin, sin pedir aprobación ni detenerte entre pantallas. Solo detente si algo te bloquea de verdad: un dato que la API no tiene y no admite fallback, o un cambio que rompería otra parte de la app.

**Especificación (`docs/redesign/`)**
- `README.md`: empieza por la sección **"Rebrand Noutlife: qué cambia en toda la app"**. Después están el mapa de las 26 rutas, la navegación, los componentes, Motion v3 y las reglas. Léelo completo una vez al inicio.
- `design-system/`: la fuente de verdad de estilo y marca (README, `tokens.json`, `components/` y `logos/`). Si un prototipo usa otro valor, gana el design system.
- `tokens/`: `tokens.css` (canales `--lq-*` con los valores Jade), `tailwind.tokens.ts` (`noutlifeTheme`) y `motion.ts`.
- `design/*.dc.html` + `lq.css`: los 39 prototipos, ya con la piel Jade. Tradúcelos a JSX + Tailwind. Lee cada uno solo cuando vayas a implementar esa pantalla.

**Si el repo ya tiene trabajo de un handoff anterior** (rama `feat/redesign`), no rehagas nada: aplica el rebrand encima, añade lo que falte y corrige lo que no coincida con los prototipos.

**Reglas**
- **Tokens primero.** `src/styles/tokens.css` ya expone canales RGB `--lq-*`. Reemplaza sus valores por los de `tokens/tokens.css` sin cambiar los nombres, y añade los nuevos: `jade-50…900`, `forest`, `forest-text`, `success-strong`, `on-success`.
  - El objetivo es que la mayor parte del rebrand ocurra sin tocar componentes.
  - Después, busca en `apps/web/src` hex sueltos, clases de Tailwind de paleta (`indigo-*`, `violet-*`, `purple-*`, `gray-*`, `slate-*`, `amber-*`, etc.) y gradientes decorativos, y reemplázalos por tokens.
- **Gold solo para recompensas.** Cada uso de `secondary` debe ser una recompensa: XP, oro, premium, logro desbloqueado o recompensa del pase. Los usos de categoría pasan a `forest` y los de sueño a `info`.
- **Marca.**
  - Copia `design-system/logos/*.svg` a `public/brand/` y `src/assets/brand/`.
  - Crea `<BrandLockup>` (lockup horizontal) y `<BrandMark>` (solo el mark), con la variante `-on-dark` bajo `.dark`. Úsalos en la Sidebar, el Rail, el header móvil, el login/onboarding y el splash.
  - Actualiza `index.html` (`<title>`, meta, `theme-color`), el favicon, `manifest.json` y los íconos PWA.
  - Cambia el texto visible "LifeQuest" por "Noutlife" en todas partes. No renombres paquetes, carpetas, rutas, claves de localStorage ni identificadores.
- **Tipografía:** carga JetBrains Mono 400/500 junto a Montserrat y usa `font-mono tabular-nums` para XP, oro, dinero, timers, contadores, stats y códigos. Sigue la tabla de clases → Tailwind del README.
- **Formas y motion:** aplica los radios (6 / 10 / 16 / full), las sombras teñidas y los ajustes de interacción del README (botón y −1 px / press 0.97, card −4 px + `shadow-lg` + borde `primary/25`). Mantén las curvas y efectos de Motion v3.
- **Accesibilidad y motion:**
  - Respeta `MotionConfig reducedMotion="user"` y el ajuste in-app "Reducir movimiento".
  - Anima solo `transform` y `opacity`, salvo las dos excepciones documentadas (la blur de entrada y el acordeón).
  - Un estado siempre lleva ícono + texto.
- No toques `apps/api` ni los contratos de datos. Si falta un dato, deja `// TODO(api):` con un fallback.
- Los temas alternos de `globals.css` (cyber, forest, ocean, sunset, retro) dejan de ser el tema base. El tema por defecto es Jade (light y dark); los alternos quedan solo como temas comprables en la Tienda.
- Trabaja en la rama `feat/redesign`, con commits pequeños, sin esperar.

**Orden de trabajo (sin pausas)**
1. **Base y marca:** tokens, Tailwind, fuentes, logos, `index.html`/`manifest`/favicon, componentes UI y AppShell con `BrandLockup`.
2. **Barrido global** de hex, clases de paleta y "LifeQuest" en `apps/web/src`.
3. **Núcleo y bienestar:** Dashboard, Hábitos, Detalle de hábito, Misiones, Coliseo, Logros, Finanzas, Comida, Sueño y Perfil.
4. **Más zonas:** Gimnasio, Glow up, Aprendizaje, Relaciones, Diario, Agenda, Rituales, Sabiduría, Mis zonas, Tienda, Ranking y Ajustes.
5. **Comunidad, estadísticas y ayuda:** Estadísticas, Gremio, Campaña y Ayuda, con todos sus estados.

**Verificación (una sola pasada al final)**
- Ejecuta `lint`, `typecheck` y `build` de `apps/web`, sin errores.
- Comprueba que estas búsquedas no devuelvan nada en `apps/web/src`, salvo contenido como portadas, outfits o temas de la Tienda:
  - `grep -rE "#[0-9a-fA-F]{6}"`
  - `grep -rE "(indigo|violet|purple)-[0-9]"`
  - `grep -r "LifeQuest"` (sin contar identificadores)
- Saca capturas con Playwright de las 26 rutas a 375 y 1440 px en light, y de 6 rutas en dark.
- Revisa en las capturas:
  - que el fondo sea marfil y las cards blancas;
  - que el logo se vea bien en light y dark;
  - que el oro solo aparezca en recompensas;
  - que los números usen mono.
- Comprueba el contraste AA de textos y controles, el reduced motion, que no haya scroll horizontal a 375 px y que el foco sea visible.

**Al terminar**, dame un resumen corto con:
- qué se cambió;
- los mapeos de tokens y clases;
- los usos de `secondary` que reclasificaste;
- los `TODO(api)` pendientes;
- cualquier desviación del diseño y su motivo.
