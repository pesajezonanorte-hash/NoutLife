# QA Report — LifeQuest (simulación de 30 días)

**Fecha:** 2026-10-02 · **Entorno:** producción (`lifequest2-web.vercel.app` + `lifequest2-api.vercel.app`) · **Cuenta:** ztafakss@gmail.com
**Método:** ~230 llamadas a la API simulando 30 días (fechas retroactivas 2026-09-03 → 2026-10-02) + recorrido con Chrome headless (Playwright) de 32 rutas en 3 combinaciones (escritorio 1280 oscuro, móvil 390 claro, escritorio 1280 claro), con captura de consola, red y pantallazos. Evidencias en `qa-screenshots/`.

---

## Resumen ejecutivo

**28 bugs encontrados:** 3 🔴 críticos, 7 🟠 altos, 10 🟡 medios y 8 🟢 bajos.

**Top 3 críticos**
1. **El esquema de la base de datos de producción sigue desactualizado** (Bug #1). El arreglo de `migrate-db.ts` (commit 3c4d493) se desplegó, pero nunca se ejecutó. Hábitos, Coliseo, plan del día, notificaciones y 2 métricas de Stats siguen devolviendo 500.
2. **/sleep se rompe por completo** cuando existe un registro con una calidad fuera de 1–5 (Bug #2). La API acepta esos datos sin validar.
3. **Los hábitos no se pueden crear ni registrar** (consecuencia de #1). Además, la UI muestra "Sin hábitos aún", así que parece que los datos se perdieron (Bug #4).

**Áreas con más fallos:** validación de entradas en la API (8 endpoints sin esquema), Hábitos/Coliseo (bloqueados por el esquema), consistencia de datos en Stats y Biblioteca, y layout del header de escritorio.

### Datos de uso simulados

| Dato | Cantidad | Nota |
|---|---|---|
| Hábitos creados | **0** (20 intentos) | Todos devolvieron 500 por el Bug #1 |
| Registros de hábito | **0** (~90 intentos) | Bloqueado por el Bug #1 |
| Transacciones | **50** | 6 de escenario + 44 de estrés |
| Comidas | **5** | + 1 comida guardada (favorita) |
| Noches de sueño | **7** | 6h, 7.5h, 8h, 5.5h, 9h, 7h, 6.5h |
| Entrenamientos | **0** (5 intentos) | 500 por el Bug #1; el catálogo de ejercicios está vacío (#3) |
| Misiones | 5 creadas · **2 completadas** · 2 fallidas · 1 archivada | |
| Otros | 2 ítems de Biblioteca (1 completado), 1 entrada de Diario, 1 relación + 1 fecha especial, 1 presupuesto | |

> **Limpieza:** se eliminaron los registros inválidos que creó la prueba (sueño con calidad 99, entrada de diario vacía, comida con calorías negativas y fecha especial sin nombre), porque dejaban la app rota para esta cuenta. Los datos válidos de la simulación siguen en la cuenta, incluidas las 44 transacciones de estrés ("Stress 0…43").

### Estado tras la rama `fix/qa-bugs` (PR #3, mergeado y desplegado el 2026-10-02)

| Bug | Estado | Nota |
|---|---|---|
| #1 Esquema sin migrar | 🔧 Fix en PR | Script `vercel-build` (migrate-db + seed-production). Falta correr `migrate-db.ts` en producción |
| #2 /sleep se rompe | ✅ Fix en PR | API: calidad 1–5 y duración 0.5–12 h; UI: verificado con calidad 99 simulada |
| #3 Catálogo vacío / #20 Sabiduría | 🔧 Fix en PR | `seed-production.ts` (40 ejercicios + cartas de sabiduría). Se aplica en el próximo deploy |
| #4 Hábitos "Sin hábitos aún" | ✅ Fix en PR | Estado de error + Reintentar (verificado) |
| #5 Modal de hábito mudo | ✅ Fix en PR | Muestra el error de la API |
| #6 Stats "0 XP" | ✅ Fix en PR | Usa el total del historial; misiones "—" (verificado) |
| #7 Biblioteca vacía | ✅ Fix en PR | Filtro por defecto "Todos" + estados de error y de filtro vacío |
| #8 Fuga de errores Prisma | ✅ Fix en PR | `publicErrorMessage()` en 41 catch de rutas + sage/social |
| #9, #10 Notificaciones / asistencia | 🔧 Se resuelven con #1 | |
| #11, #13, #14 Validaciones | ✅ Fix en PR | Zod en sleep, meals, journal, workouts, learning |
| #15 "undefined" en Jardín | ✅ Fix en PR | API exige `label`; UI usa "tu fecha especial" |
| #16, #17 Header y breadcrumb | ✅ Fix en PR | Breadcrumb según la ruta, un solo `<h1>`, header en una línea a 1280px |
| #18 HP 120/120 | ✅ Fix en PR | Usa `user.hp` si falla /dashboard |
| #19 Nombre vacío | ✅ Fix en PR | |
| #21 Deadline inválido | ✅ Fix en PR | 400 en vez de 500 |
| #22 Peso sin fecha | ✅ Fix en PR | Usa hoy por defecto |
| #23 "1 días de racha" | ✅ Fix en PR | |
| #24 Odómetro y lector de pantalla | ❎ No es bug | El componente ya tiene `sr-only` + `aria-hidden`; `innerText` daba un falso positivo |
| #25 "Promedio total" | ✅ Fix en PR | Renombrado a "Promedio 14 días" |
| #12, #26, #27, #28 | ⏸ Sin cambios | Requieren decisión de producto (un registro por noche, 409 vs 404, rediseño de accesos rápidos, cuándo pedir permiso de notificaciones) |

---

## 🔴 Críticos

## Bug #1: El esquema de producción no tiene la migración 20260930 — `migrate-db.ts` nunca corre en Vercel

**Pantalla:** / · /habits · /gym · /stats · /settings · /life (toda la app)
**Pasos para reproducir:**
1. Iniciar sesión y abrir `/habits` o el Castillo (`/`).
2. Llamar `GET /api/v1/dashboard/priorities` con el token.

**Comportamiento esperado:** Después del deploy de 3c4d493, la columna `habits.createsGymAttendance` y las tablas de gimnasio y notificaciones existen.

**Comportamiento real:** El deploy de `lifequest2-api` para 3c4d493 aparece como **"success"** (19:38 UTC), pero la columna sigue sin existir. Endpoints que devuelven 500:
`GET/POST /habits`, `GET /habits/:id`, `POST /habits/:id/log`, `GET /dashboard`, `/dashboard/today-plan`, `/dashboard/priorities`, `GET /notifications`, `/notifications/preferences`, `GET/POST /workouts`, `/workouts/attendance` (GET y POST), `/workouts/routines/list`, `/stats/summary`, `/stats/predictions`, `/life/score`, `/life/year-review`, `/sage/proactive-note`.

**Error en consola / API:**
```
500 GET /dashboard/priorities
Invalid `prisma.habit.findMany()` invocation:
The column `habits.createsGymAttendance` does not exist in the current database.
```

**Causa probable:** `apps/api/vercel.json` usa la clave legacy `"builds"` (`@vercel/node`). Con `builds`, Vercel ignora `buildCommand`, así que `npx tsx src/migrate-db.ts` nunca se ejecuta. Si se hubiera ejecutado y fallado, el build habría fallado; si se hubiera ejecutado bien, la columna existiría.
**Arreglo sugerido:** (a) ejecutar `npx tsx apps/api/src/migrate-db.ts` una vez con el `DATABASE_URL` de producción para desbloquear ya; (b) mover la migración a un paso que sí corra en Vercel (por ejemplo, un script `vercel-build` o pasar de `builds`/`routes` a la configuración moderna) para que no vuelva a pasar.

**Captura:** `qa-screenshots/03-dashboard-plan-error-mobile.png`, `02-habits-500-empty-state-mobile.png`
**Severidad:** 🔴 Crítico
**Estado:** Open

---

## Bug #2: /sleep se rompe ("El héroe tropezó") si un registro tiene una calidad fuera de 1–5

**Pantalla:** /sleep
**Pasos para reproducir:**
1. `POST /api/v1/sleep` con `{ bedtime, wakeTime, quality: 99 }`. La API responde **201**.
2. Abrir `/sleep`.

**Comportamiento esperado:** La API rechaza la calidad con 400. Si aun así llega un dato raro, la página muestra "Sin valorar".

**Comportamiento real:** La página entera cae en el ErrorBoundary y se queda rota para ese usuario hasta borrar el registro.

**Error en consola:**
```
TypeError: Cannot read properties of undefined (reading 'trim')
ErrorBoundary caught: TypeError: Cannot read properties of undefined (reading 'trim')
```
Origen: `apps/web/src/pages/Sleep/index.tsx:439`, en `QUALITY_LABELS[lastLog.quality].trim()`. Además, `POST /sleep` no tiene esquema zod (ver #11).

**Captura:** `qa-screenshots/01-sleep-crash-mobile.png` (después de la limpieza: `10-sleep-after-cleanup.png`)
**Severidad:** 🔴 Crítico
**Estado:** Open (dato de prueba borrado; el bug de código sigue)

---

## Bug #3: El catálogo de ejercicios está vacío en producción

**Pantalla:** /gym
**Pasos para reproducir:**
1. `GET /api/v1/workouts/exercises/catalog`.

**Comportamiento esperado:** Una lista de ejercicios (sentadilla, press, etc.) para registrar series y repeticiones.

**Comportamiento real:** `{"exercises":[]}`. No se pueden añadir ejercicios a un entrenamiento, así que no hay series/reps, ni progresión de fuerza, ni 1RM. Los datos solo existen en `apps/api/prisma/seed.ts`, que no se ejecuta en producción. Lo mismo pasa con Sabiduría: `GET /wisdom` devuelve `{"available":[],"locked":[]}` (ver #20).

**Severidad:** 🔴 Crítico (el Coliseo queda inutilizable aunque se arregle #1)
**Estado:** Open

---

## 🟠 Altos

## Bug #4: Si /habits falla, la UI muestra "Sin hábitos aún"

**Pantalla:** /habits
**Pasos para reproducir:**
1. Abrir `/habits` mientras `GET /habits` devuelve 500 (estado actual).

**Comportamiento esperado:** Un estado de error con un botón "Reintentar", sin afirmar que no hay hábitos.

**Comportamiento real:** Aparecen a la vez el toast "Error cargando hábitos", el estado vacío "SIN HÁBITOS AÚN · Crea tu primer hábito · + PRIMER HÁBITO" y "0/0 completados". El usuario cree que perdió sus hábitos, y el botón lleva a un formulario que también falla. En escritorio, en cambio, los skeletons se quedan cargando indefinidamente.

**Captura:** `qa-screenshots/02-habits-500-empty-state-mobile.png`
**Severidad:** 🟠 Alta
**Estado:** Open

## Bug #5: El modal "Nuevo hábito" falla en silencio al guardar

**Pantalla:** /habits → + NUEVO HÁBITO
**Pasos para reproducir:**
1. Abrir el modal, escribir "Hábito UI QA" y pulsar Guardar.

**Comportamiento esperado:** El hábito se crea, o el modal muestra el error.

**Comportamiento real:** El modal sigue abierto y no muestra ningún mensaje (el `POST /habits` devolvió 500). Además, el botón Guardar queda con el relleno dorado desplazado y las flechas de FlowButton fuera de sitio (ver la captura). La validación sí funciona: Guardar está deshabilitado mientras el nombre está vacío ✅.

**Captura:** `qa-screenshots/11-habit-modal-save-no-feedback.png`
**Severidad:** 🟠 Alta
**Estado:** Open

## Bug #6: Stats muestra "Progreso registrado 0 XP" y a la vez "Promedio 213 XP/día"

**Pantalla:** /stats (periodo Mes)
**Pasos para reproducir:**
1. Tener XP en el mes y abrir `/stats`.

**Comportamiento esperado:** El total de XP del periodo (350 XP según `/stats/xp-history`).

**Comportamiento real:** El titular dice **0 XP**, mientras la gráfica sube, el texto dice "Promedio del periodo: 213 XP/día" y hay "+405 XP vs. periodo anterior". El 0 viene de `/stats/summary`, que devuelve 500: el fallo se pinta como un cero en lugar de un estado de error.

**Captura:** `qa-screenshots/07-stats-0xp-vs-213xp-day-mobile.png`
**Severidad:** 🟠 Alta
**Estado:** Open

## Bug #7: Biblioteca dice "Tu biblioteca está lista / Agrega un libro" teniendo ítems

**Pantalla:** /learning
**Pasos para reproducir:**
1. Crear un libro y completarlo; crear un curso sin empezar.
2. Abrir `/learning`.

**Comportamiento esperado:** Ver los 2 ítems, o al menos "No hay ítems en progreso" con un enlace a "Todos".

**Comportamiento real:** El filtro por defecto es "En progreso" (`useState('IN_PROGRESS')`, `Learning/index.tsx:222`), así que la lista queda vacía y aparece el estado de primer uso, que contradice las tarjetas de arriba (1 completado, 320 páginas).

**Captura:** `qa-screenshots/06-learning-stats-vs-empty-list-mobile.png`
**Severidad:** 🟠 Alta
**Estado:** Open

## Bug #8: La API devuelve mensajes internos de Prisma al cliente

**Pantalla:** API (`/dashboard/priorities`, `/life/score`, `/gym/body-weight`)

**Comportamiento esperado:** Un mensaje genérico; el detalle va solo a los logs.

**Comportamiento real:** El JSON de error incluye la invocación de Prisma completa, con nombres de tablas y columnas y el `userId` interno. Por ejemplo: `Invalid prisma.bodyWeight.create() invocation: { data: { userId: "cmuaho5…", weight: 72.5, date: new Date("Invalid Date") …`
**Severidad:** 🟠 Alta (fuga de información)
**Estado:** Open

## Bug #9: Las notificaciones de Ajustes no cargan

**Pantalla:** /settings y /shop (hacen la llamada)

**Comportamiento real:** `GET /notifications/preferences` devuelve 500 ("Error al obtener preferencias.") y `GET /notifications` también. No se pueden activar ni desactivar notificaciones por categoría. Depende del Bug #1 (falta la tabla `notification_category_preferences`).
**Severidad:** 🟠 Alta
**Estado:** Open (se resuelve con #1)

## Bug #10: Registrar asistencia al gimnasio falla

**Pantalla:** /gym → "Registrar asistencia"
**Comportamiento real:** `POST /workouts/attendance` devuelve 500 ("Error al registrar asistencia de gimnasio.") y `GET /workouts/attendance` también. Depende del Bug #1 (falta la tabla `gym_attendances`).
**Severidad:** 🟠 Alta
**Estado:** Open (se resuelve con #1)

---

## 🟡 Medios

## Bug #11: Sueño: 0 horas de sueño dan sleepScore 100; fechas inválidas dan 500

**Pantalla:** API `/sleep`
**Pasos:** `POST /sleep` con `bedtime == wakeTime` y `quality: 99` devuelve 201 con `duration: 0` y **`sleepScore: 100`**. Ese registro rebaja el promedio (6.22h en lugar de 7.07h) y aparece en el gráfico de Stats. `bedtime: "garbage"` o un body vacío devuelven **500** en lugar de 400.
**Esperado:** Esquema zod con quality entre 1 y 5, fechas válidas y duración mayor que 0.
**Severidad:** 🟡 Media · **Estado:** Open

## Bug #12: Sueño: se permiten varios registros para la misma noche

**Pantalla:** /sleep
**Pasos:** Registrar dos veces el 2026-09-30. Ambos registros cuentan en los promedios.
**Esperado:** Un registro por noche, o editar el existente.
**Severidad:** 🟡 Media · **Estado:** Open

## Bug #13: Comidas, entrenamientos y biblioteca devuelven 500 ante datos incompletos y aceptan negativos

**Pantalla:** API `/meals`, `/workouts`, `/learning`
**Pasos:** `POST /meals {mealType:'lunch'}` (sin nombre), `POST /workouts {}` y `POST /learning {}` devuelven **500**. `POST /meals` con `calories: -300` devuelve **201**.
**Esperado:** 400 con un mensaje por campo, como ya hacen Finanzas y Misiones.
**Severidad:** 🟡 Media · **Estado:** Open

## Bug #14: Diario acepta entradas vacías

**Pantalla:** /journal
**Pasos:** `POST /journal {content:''}` devuelve 201. La entrada aparece como "Sin título" sin contenido y cuenta para la racha.
**Severidad:** 🟡 Media · **Estado:** Open

## Bug #15: Jardín muestra "43 días para undefined"

**Pantalla:** /love
**Pasos:** Añadir una fecha especial sin `label` (`POST /relationships/:id/important-dates` lo acepta) y abrir `/love`.
**Real:** La tarjeta dice "43 días para **undefined**". Ni la API exige `label` ni la UI usa un valor por defecto.
**Severidad:** 🟡 Media · **Estado:** Open

## Bug #16: El header de escritorio se aplasta a 1280px con la barra lateral expandida

**Pantalla:** todas (`components/layout/GameLayout.tsx:593-608`)
**Pasos:** Abrir cualquier página a 1280×800 con la barra lateral expandida.
**Real:** "Bienvenido, Miguel" se parte en dos líneas, y "Nivel 3 aventurero · 1 días de racha" queda en una columna de una palabra por línea ("Nivel / 3 / aventurero / · / 1 / días…"). El breadcrumb también se parte. El buscador y los controles de la derecha no ceden espacio.
**Captura:** `qa-screenshots/04-header-squeezed-1280-dark.png`, `05-alert-modal-header-squeezed-light.png`
**Severidad:** 🟡 Media · **Estado:** Open

## Bug #17: El breadcrumb y el H1 del header son fijos en todas las páginas

**Pantalla:** todas
**Real:** En /gym, /stats, /food, etc. el header dice "El Castillo › Día a día / Bienvenido, Miguel". El texto está fijo en `GameLayout.tsx:598-603` y no refleja la ruta. Además, hay 2 `<h1>` por página.
**Severidad:** 🟡 Media · **Estado:** Open

## Bug #18: El Castillo muestra HP 120/120 cuando el HP real es 100/120

**Pantalla:** /
**Real:** La tarjeta del personaje dice HP 120/120, mientras el header dice HP 83% (la API tiene `hp:100, maxHp:120`). En `Dashboard/index.tsx:688`, `visualState?.hpPercent ?? 100` asume HP lleno cuando `/dashboard` falla, en vez de usar `user.hp`.
**Severidad:** 🟡 Media · **Estado:** Open

## Bug #19: Se puede guardar un nombre vacío en el perfil

**Pantalla:** /settings → Perfil
**Pasos:** `PATCH /users/me/profile {displayName:''}` devuelve 200 y guarda `""`.
**Real:** El header queda como "Bienvenido, " y la barra lateral sin nombre. El endpoint no tiene validación.
**Severidad:** 🟡 Media · **Estado:** Open

## Bug #20: Sabiduría está vacía ("0 disponibles")

**Pantalla:** /wisdom
**Real:** `GET /wisdom` devuelve `{"available":[],"locked":[],"userLevel":3}`. No hay principios, ni bloqueados ni desbloqueados, igual que pasa con el catálogo de ejercicios (#3).
**Severidad:** 🟡 Media · **Estado:** Open

---

## 🟢 Bajos

## Bug #21: Una fecha de misión inválida devuelve 500
`POST /quests` con `deadline: "mañana"` devuelve 500 ("Error al crear la misión."). Lo correcto sería 400. · **Severidad:** 🟢 Baja · **Estado:** Open

## Bug #22: Peso corporal sin fecha da error de Prisma
`POST /gym/body-weight {weight:72.5}` falla con `date: new Date("Invalid Date")`. Si no se envía fecha, debería usarse hoy. · **Severidad:** 🟢 Baja · **Estado:** Open

## Bug #23: Pluralización "1 días de racha"
Aparece en el header, la barra lateral, el Castillo y el Diario (`GameLayout.tsx:538,606`, `Dashboard/index.tsx:921`). · **Severidad:** 🟢 Baja · **Estado:** Open

## Bug #24: El contador animado de la Bóveda expone dígitos basura al lector de pantalla
`innerText` de /finances: "$ 121.708 0 1 2 3 4 5 6 7 8 9 0 0 1 2 3…". Las columnas del odómetro no tienen `aria-hidden`, así que un lector de pantalla lee todos los dígitos. · **Severidad:** 🟢 Baja (accesibilidad) · **Estado:** Open

## Bug #25: Sueño: "Promedio total" son en realidad solo los últimos 14 días
`getSleepStats` filtra `date >= now - 14d`, pero la tarjeta dice "Promedio total". · **Severidad:** 🟢 Baja · **Estado:** Open

## Bug #26: Completar una misión ya completada devuelve 404
Devuelve "Misión no encontrada o ya completada". 409 distinguiría mejor el caso. · **Severidad:** 🟢 Baja · **Estado:** Open

## Bug #27: Accesos rápidos del Castillo desalineados en móvil
A 390px, "Nueva Quest" se parte en dos líneas con el icono desplazado, y "Briefing del día" queda sola en otra fila. · **Captura:** `03-dashboard-plan-error-mobile.png` · **Severidad:** 🟢 Baja · **Estado:** Open

## Bug #28: El modal "¿Quieres recibir alertas?" tapa la app nada más iniciar sesión
Aparece en cada sesión nueva antes de que el usuario vea el contenido, y bloquea los clics hasta cerrarlo. "Ahora no" sí se recuerda tras recargar ✅. · **Captura:** `05-alert-modal-header-squeezed-light.png` · **Severidad:** 🟢 Baja · **Estado:** Open

---

## Lo que funciona bien ✅

- **Login:** con contraseña incorrecta muestra "…incorrectos." y con la correcta redirige bien.
- **Finanzas:** el balance es correcto. Con 6 transacciones: +100.000 − 23.000. Tras las 50: 121.708, verificado a mano. El balance **no se resetea al cambiar de mes** (el bug conocido está arreglado). Los informes por mes, el resumen por categoría, la edición de categoría y el presupuesto funcionan. Los importes de 0, negativos y texto se rechazan con 400.
- **Misiones:** crear, editar, marcar subobjetivos, completar (+100 XP y +20 oro, sube a nivel 2), fallar y archivar funcionan. Las vacías se rechazan.
- **Logros:** "Primera Sangre" se desbloquea al completar la primera misión (1/30); se ven el progreso y los filtros.
- **Sueño** (con datos válidos): el promedio semanal es 7.1h, coherente con las 7 noches de la ventana; la tendencia es "Mejorando".
- **Posada:** ANALIZAR con IA funciona (`aiSucceeded: true`, 550 kcal). Se guardan comidas y favoritas; el resumen de macros e hidratación es correcto.
- **Biblioteca:** crear, completar (+XP) y añadir notas funcionan; las estadísticas son correctas.
- **Rendimiento:** 50 transacciones se registran y listan en unos 6.4 s en total (unos 130 ms por llamada); ningún endpoint pasó de 1.5 s.
- **Navegación rápida:** 54 navegaciones en 30 s entre 10 rutas sin cuelgues; la última página (/finances) cargó completa.
- **Sesión inactiva:** tras 5 min sin actividad (19:59–20:05 UTC) la sesión sigue activa; navegar a /finances no redirige a /login.
- **Tema claro/oscuro:** 6 cambios seguidos aplican bien la clase y `localStorage['theme']`, y el tema persiste tras recargar.
- **Modal de alertas:** "Ahora no" persiste; no reaparece al recargar ni al navegar.
- **Layout móvil:** **ninguna ruta tiene scroll horizontal** a 390px ni a 1280px.
- **404:** la página "Zona inexplorada" funciona.

## No probado / bloqueado

- ~~**Hábitos** y **Coliseo**: bloqueados por #1 y #3.~~ Probados en la segunda ronda (ver abajo).
- **Duelos/Retos:** no hay retos activos ni otros usuarios, así que no se pudo probar ganar o perder ni el efecto en HP. Observación: fallar una misión **no** baja HP (¿intencional?).
- **Temporada:** no hay temporada activa ("No hay temporada activa en este momento").
- **Gremio:** solo se vio el estado vacío; no se creó ningún gremio.
- **Cambio de avatar:** no se probó.

---

# Segunda ronda — Hábitos y Coliseo (tras el PR #3)

**Fecha:** 2026-10-02, 20:48–20:56 UTC · **Entorno:** producción ya desplegada con el PR #3 · **Método:** 83 llamadas a la API con fechas retroactivas (2026-09-03 → 2026-10-02) + recorrido con Playwright a 1280px y 390px, incluido completar un hábito desde la UI.

## Resumen

- **Ningún 500 en la UI** y ningún error de JavaScript en /habits, /gym, /, /stats ni /achievements, en escritorio y móvil.
- **9 bugs nuevos:** 0 🔴 críticos, 0 🟠 altos, 4 🟡 medios y 5 🟢 bajos.
- **Los dos bugs más relevantes:**
  1. Los entrenamientos con fecha registran la asistencia **un día antes** (#29). El calendario de asistencia muestra 6 de 7 días cuando se entrenó 3.
  2. Registrar días pasados de un hábito **no recalcula la racha** (#30). "Meditar" tiene 30 días completados en el heatmap, pero la racha es 1.

**Estado:** los 9 (#29–#37) están ✅ arreglados y verificados en producción (PR #4, merge `44b4fb9`, 2026-10-02). Resultados:
- 7 días registrados con fecha pasada dan racha 7/7.
- Un entrenamiento del 2026-09-12 registra la asistencia el 2026-09-12.
- Fecha futura, rutina inválida y 1RM inválido dan 400.
- Los mensajes de validación salen en español.
- El catálogo tiene 33 logros: se desbloquearon "Bautizo de Hierro" y "Gladiador", y la pestaña Coliseo aparece.
- Stats muestra "> +999%" y los botones de cada hábito tienen `aria-label`.

### Datos simulados

| Dato | Cantidad | Resultado |
|---|---|---|
| Hábitos creados | 5 (+15 de estrés) | Todos 201; icono, color, frecuencia y "cuenta como asistencia" se guardan bien |
| Registros de hábito | 108 completados + 1 fallido + 1 omitido | Patrones: todos los días · falla 1 día · L/X/V · últimos 7 días · mixto |
| Hábito completado desde la UI | 1 | 200, el contador pasa de 4/6 a 5/6 |
| Rutina | 1 (Push/Pull/Legs, 4 días con descanso) | 201 |
| Entrenamientos | **12** (L/X/V durante 4 semanas) | Todos 200, entre 122 y 127 XP y entre 36 y 38 de oro cada uno |
| Series | 4 ejercicios con sobrecarga progresiva | Banca 60 → 67,5 kg, sentadilla 80 → 95 kg, peso muerto 100 → 115 kg |
| Asistencias | 25 registros (12 de hábito, 13 "manuales") | Deberían ser unos 14 días únicos; ver #29 |
| Peso corporal | 5 registros (78,4 → 77,0 kg) | 201; sin fecha usa hoy ✅ y negativo da 400 ✅ |
| Progresión del personaje | Nivel 3 → **7**, XP total del mes 4.389, oro 85 → 1.061 | |
| Logros | +2 ("Primer Hábito", "Hombre de Costumbres") y "Aventurero" por nivel 5 | Ninguno por entrenar (ver #36) |

## 🟡 Medios

## Bug #29: Los entrenamientos con fecha registran la asistencia un día antes

**Pantalla:** /gym → "Asistencia al Coliseo" · API `POST /workouts` + `/finish`
**Pasos para reproducir:**
1. `POST /workouts { title: "Push", date: "2026-09-07" }` (lunes).
2. `POST /workouts/:id/finish`.
3. `GET /workouts/attendance`.

**Comportamiento esperado:** Una asistencia el 2026-09-07. Si ese día ya existe la del hábito "Ir al gym", no se duplica.
**Comportamiento real:** La asistencia queda el **2026-09-06** (domingo). El problema se repite en los 12 entrenamientos (09-06, 09-08, 09-10…). En lugar de reutilizar la asistencia del hábito del mismo día, crea una nueva en el día anterior. El calendario semanal muestra **6 de 7 días** asistidos cuando hubo 3 entrenamientos. La tarjeta "Último entrenamiento" también dice "jueves, 1 de octubre" para el de hoy (viernes 2).
**Causa probable:** la fecha se guarda como `2026-09-07T00:00Z` y `recordWorkoutGymAttendance` / la UI la convierten a la hora de Bogotá (UTC−5), lo que da el día anterior. La UI crea entrenamientos sin `date` (usa la hora actual), así que en el uso normal el desfase no ocurre. Afecta a los entrenamientos con fecha (API, importaciones, rutinas futuras).
**Error en consola:** ninguno.
**Captura:** `qa-screenshots/12-gym-attendance-shifted-6of7.png`
**Severidad:** 🟡 Media · **Estado:** Open

## Bug #30: Registrar días pasados de un hábito no recalcula la racha

**Pantalla:** /habits · API `POST /habits/:id/log { date }`
**Pasos para reproducir:**
1. Crear un hábito diario.
2. Registrar `completed` del 2026-09-03 al 2026-10-02 (30 días, el último es hoy).
3. `GET /habits`.

**Comportamiento esperado:** Racha actual 30 y mejor racha 30.
**Comportamiento real:** **Racha 1/1** en los 5 hábitos, aunque el heatmap muestra los 30 días completados. Lo mismo pasa al completar desde la UI "Sin redes": con 24 días seguidos registrados, queda en racha 1. La racha es un contador que solo suma +1 cuando el registro es de **hoy** (`habit.service.ts:399`); los registros de fechas pasadas guardan el log y dan XP, pero nunca recalculan `currentStreak` ni `longestStreak`. La global del usuario también queda en 1, así que los logros "Semana de Fuego" y "Mes Estelar" no se pueden obtener así.
**Nota:** la UI solo registra el día de hoy, así que con uso diario real la racha sí crece. El problema aparece al recuperar días con la API (que el esquema permite a propósito) y hace que el heatmap y la racha se contradigan.
**Sugerencia:** calcular la racha recorriendo los logs hacia atrás por los días obligatorios, en vez de mantener un contador.
**Error en consola:** ninguno.
**Captura:** `qa-screenshots/13-habits-streak-1-after-30-days.png`
**Severidad:** 🟡 Media · **Estado:** Open

## Bug #31: Finalizar un entrenamiento con fecha futura devuelve 500

**Pantalla:** API `POST /workouts/:id/finish`
**Pasos:** `POST /workouts { title, date: "2026-12-25" }` → **201** (se acepta la fecha futura). Después, `POST /workouts/:id/finish` → **500** ("Error al finalizar entrenamiento.").
**Esperado:** Rechazar la fecha futura al crear (400), o devolver 400 al finalizar. El servicio ya lanza `ATTENDANCE_FUTURE_DATE`, pero el controlador lo convierte en 500.
**Severidad:** 🟡 Media · **Estado:** Open

## Bug #32: Crear una rutina con un día inválido devuelve 500

**Pantalla:** API `POST /workouts/routines`
**Pasos:** `{ name: "bad", days: [{ weekday: 9 }] }` → **500** ("Error al crear rutina."). El servicio lanza `INVALID_ROUTINE_WEEKDAY`, pero el controlador no lo traduce a 400.
**Severidad:** 🟡 Media · **Estado:** Open

## 🟢 Bajos (segunda ronda)

## Bug #33: Los botones de cada hábito no tienen nombre accesible
En /habits, el botón para completar muestra "?" y los de editar y archivar solo muestran un emoji (✏ y 🗑), sin `aria-label` (`HabitRow.tsx:80-90`). Un lector de pantalla los anuncia como "botón". Además, el botón de completar tiene una animación infinita (Playwright lo detecta como "not stable"). · **Captura:** `15-habit-completed-from-ui.png` · **Severidad:** 🟢 Baja · **Estado:** Open

## Bug #34: Mensajes de validación en inglés
Los esquemas zod sin mensaje propio devuelven el texto por defecto: "Required", "String must contain at least 1 character(s)", "Invalid enum value. Expected 'HEALTH' | …", "Number must be greater than or equal to 1". Pasa en hábitos, entrenamientos y misiones. También: "Las calorías no puede ser negativo" (concordancia). · **Severidad:** 🟢 Baja · **Estado:** Open

## Bug #35: Stats muestra variaciones absurdas ("+21845% vs. periodo anterior")
Cuando el periodo anterior tiene muy poca XP, el porcentaje no aporta nada. Sería mejor mostrar la diferencia absoluta ("+4.369 XP", que ya aparece en otra tarjeta) o limitarlo ("> +999%"). · **Severidad:** 🟢 Baja · **Estado:** Open

## Bug #36: No hay logros del Coliseo
Tras 12 entrenamientos, 25 asistencias y 4 semanas de progresión no se desbloquea nada: el catálogo de 30 logros no tiene ninguno de gimnasio o entrenamiento. Tampoco se desbloqueó "¡El Héroe Despierta!" (primer inicio de sesión), aunque la cuenta lleva 11 días activa. · **Severidad:** 🟢 Baja (sugerencia de producto) · **Estado:** Open

## Bug #37: La calculadora de 1RM devuelve 200 con datos inválidos
`POST /gym/1rm { weight: "abc", reps: 5 }` → 200 `{ "oneRepMax": null }`. Debería ser 400. (Con datos válidos funciona: 100 kg × 5 = 117 kg.) · **Severidad:** 🟢 Baja · **Estado:** Open

## Lo que funciona bien ✅ (segunda ronda)

- **Hábitos:**
  - Crear y editar funcionan.
  - Validaciones: título vacío o de más de 100 caracteres, categoría o color inválidos y XP 0 dan 400.
  - Registro idempotente: el mismo día dos veces no duplica XP. Fecha futura, fecha inexistente (30 de febrero) y estado inválido dan 400; un hábito inexistente da 404.
  - El heatmap muestra los 30 días.
  - Archivar funciona: de 21 hábitos se vuelve a 6. Listar 21 hábitos tarda 205 ms.
- **Hábito con "cuenta como asistencia":** cada registro crea la asistencia del día correcto (origen HABIT).
- **Coliseo:**
  - Catálogo de 40 ejercicios y rutina de 4 días.
  - Los 12 entrenamientos dan XP y oro coherentes con la duración y el volumen.
  - Finalizar dos veces da **409**, así que no se pueden farmear recompensas. Un entrenamiento inexistente da 404, uno sin título 400 y una fecha inválida 400.
  - Editar series en un borrador y borrar el borrador funcionan.
- **Progresión:**
  - `/workouts/exercises/:id/progress` refleja la sobrecarga semana a semana (máximo y volumen).
  - El volumen semanal por grupo muscular es correcto, y el historial por ejercicio y la calculadora de 1RM funcionan.
- **Asistencia manual:** hoy dos veces no duplica (upsert). Fecha futura y fecha basura dan 400.
- **Efectos:**
  - El nivel sube de 3 a 7.
  - Stats, plan del día y dashboard reflejan los entrenamientos y hábitos ("Entrenamiento hace 1 día", "Hábitos 4/6 hoy").
- **UI:** /habits, /gym, /, /stats y /achievements cargan sin 5xx ni errores de JS en 1280px y 390px.

## Datos que quedaron en la cuenta

5 hábitos "QA …" (activos), 12 entrenamientos "QA Push/Pull/Legs", la rutina "QA Push/Pull/Legs", 25 asistencias y 5 registros de peso. Los 15 hábitos de estrés se archivaron. El nivel 7 y el oro 1.061 vienen de esta simulación.
