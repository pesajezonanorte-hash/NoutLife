# BUGS_FIXED.md — Fase 11: Pulido de Cierre

## BLOQUE 1 — Bugs Encontrados y Corregidos

### 🔴 Bugs Críticos

1. **API sage.service.ts — console.log en producción**
   - Archivo: `apps/api/src/services/sage.service.ts`
   - Bug: 4 sentencias `console.log` de debug expuestas en producción (líneas 11, 18, 60, 67)
   - Fix: Eliminadas todas las sentencias `console.log` del servicio de IA

2. **Web — .catch(console.error) en páginas**
   - Archivos: `pages/Challenges/index.tsx:49`, `pages/Guild/index.tsx:53,61,63`, `pages/Leaderboard/index.tsx:40`
   - Bug: Errores de red se imprimían al console en producción con `.catch(console.error)`
   - Fix: Reemplazado con `.catch(() => null)` — errores silenciados apropiadamente

3. **Dashboard — Colores hardcodeados en LifeScoreWidget**
   - Archivo: `pages/Dashboard/index.tsx:76`
   - Bug: Colores hex `#22c55e`, `#fbbf24`, `#ef4444` hardcodeados, rompen con temas alternativos
   - Fix: Reemplazado con `var(--accent-green)`, `var(--accent-gold)`, `var(--accent-red)`

4. **Finances — Tooltip de Recharts con colores hardcodeados**
   - Archivo: `pages/Finances/index.tsx:307`
   - Bug: `contentStyle: { background: '#1a0d2e', border: '2px solid #3d2d5c' }` no respeta temas
   - Fix: Reemplazado con CSS variables del tema

### 🟡 Mejoras de Comportamiento

5. **Habits — confirm() del navegador reemplazado**
   - Archivo: `pages/Habits/index.tsx`
   - Bug: Usaba `window.confirm()` nativo (UX inconsistente, no respeta temas)
   - Fix: Nuevo `ConfirmDialog` component con diseño temático SNES

6. **Journal/Finances/Agenda — Sin Escape key en modales**
   - Archivos: `pages/Journal/index.tsx`, `pages/Finances/index.tsx`, `pages/Agenda/index.tsx`
   - Bug: Los modales no cerraban al presionar Escape
   - Fix: Hook `useEscapeKey` creado y aplicado a todos los modales

7. **Quests/Journal — Búsqueda sin debounce**
   - Archivos: `pages/Quests/index.tsx`, `pages/Journal/index.tsx`
   - Bug: Cada tecla disparaba un fetch al servidor
   - Fix: `useDebounce(300ms)` aplicado a inputs de búsqueda

---

## BLOQUE 2 — Pulido Visual

8. **HabitRow/QuestCard — React.memo faltante**
   - Archivos: `components/habits/HabitRow.tsx`, `components/quests/QuestCard.tsx`
   - Fix: Envueltos con `React.memo` para evitar re-renders innecesarios en listas

9. **Journal — Fechas en formato raw reemplazadas**
   - Archivo: `pages/Journal/index.tsx`
   - Fix: Fechas ahora muestran tiempo relativo ("hace 2 horas", "ayer")

---

## BLOQUE 3 — Performance

10. **Lazy loading** — Ya estaba implementado vía `React.lazy` en `App.tsx` (18+ rutas)
11. **Optimistic updates** — Ya estaban en Habits, Quests y Journal
12. **Debounce en búsquedas** — Agregado (300ms) en Quests y Journal
13. **React.memo** — Aplicado en HabitRow y QuestCard

---

## BLOQUE 4 — Calidad de Vida Agregados

14. **Reloj en header** — `LiveClock` component en `GameLayout.tsx` (visible en pantallas lg)
15. **Botón scroll-to-top** — `ScrollToTop` flotante, aparece al bajar más de 300px
16. **Indicador offline** — `OfflineIndicator` banner rojo cuando se pierde conexión
17. **Atajos rápidos en Dashboard** — 4 botones de acción rápida (Quest, Gasto, Hábito, Diario)
18. **Toggle sonidos en Settings** — Conectado a `audioEnabled` del `uiStore`
19. **Toggle animaciones en Settings** — Guardado en localStorage, aplica clase `reduce-motion`
20. **ConfirmDialog component** — Reemplaza todos los `window.confirm()` nativos
21. **Hook useEscapeKey** — Reutilizable en todos los modales
22. **Hook useDebounce** — Reutilizable para inputs de búsqueda
23. **Hook useOnlineStatus** — Detecta cambios de conectividad en tiempo real
24. **lib/time.ts** — `relativeTime()`, `formatNumber()`, `formatCOP()` centralizados
25. **Tiempo relativo en Journal** — "hace 2 horas" en vez de fechas crudas

---

## Estado TypeScript

- **API:** 0 errores ✅
- **Web:** 0 errores ✅

## Verificaciones de Sistema

- ✅ Gemini model: `gemini-2.5-flash-lite` (configurado correctamente en `ai.ts`)
- ✅ Avatar pantsColor: se pasa correctamente en Dashboard, Character y FinalCelebrationStep
- ✅ Splash screen: muestra "NOUTLIFE" completo letra por letra
- ✅ Sidebar: tiene `overflow-y-auto` independiente del contenido
- ✅ Token refresh: interceptor Axios funcionando correctamente
- ✅ Cron jobs: 7 jobs activos en scheduler.ts
