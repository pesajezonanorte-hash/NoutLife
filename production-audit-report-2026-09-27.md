# Auditoría de producción — LifeQuest

**Fecha:** 27 de septiembre de 2026 (America/Bogota)
**Entorno:** `lifequest2-web.vercel.app` y `lifequest2-api.vercel.app/api/v1`
**Alcance autorizado:** cuenta real de producción, mutaciones persistentes, matriz histórica de 30 días y pruebas de interfaz.
**Seguridad de la prueba:** las credenciales, tokens y cookies se usaron sólo en memoria de procesos efímeros; no se guardaron en archivos ni se incluyen aquí.

---

## Resumen ejecutivo

La producción está **disponible y funcional en la mayor parte del recorrido**: autenticación, lectura de datos, rutas SPA, operaciones CRUD de los módulos principales, exportación e interfaz responsive fueron comprobadas en producción.

- **86/86 endpoints GET autenticados** del inventario inicial respondieron `200`.
- **278 respuestas API** fueron verificadas en la matriz posterior (creación, consulta, edición, completos/logs, duplicados, validación, límites, borrado, exportación y limpieza). Todos los códigos de respuesta recibidos coincidieron con lo esperado por cada caso, incluidos los `400` y `409` esperados para guards ya implementados.
- Se recorrieron **33 rutas web** autenticadas. Todas entregaron documento `200`; los redirects de Metas y Rituales funcionaron. Tras esperar la carga real de datos (~2.5–3 s después del splash), las pantallas objetivo terminaron de renderizar sin errores HTTP ni errores de JavaScript autenticados.
- En móvil de **390 px** se comprobaron 10 rutas principales. Se detectó un desbordamiento horizontal reproducible en **Posada / Comida**.
- Se encontraron **8 incidencias** relevantes: 3 altas, 4 medias y 1 baja.

La prioridad de corrección recomendada es:

1. Creación de rituales que termina creando hábitos normales.
2. Doble recompensa al completar un ritual dos veces.
3. Reinicio erróneo de una racha de hábito el mismo día.
4. Validación de importes financieros y duración de foco en backend.

---

## Matriz histórica creada y verificada

Se dejó una simulación intencionalmente persistente y etiquetada como `QA30D 2026-09`, para que pueda reconocerse y eliminarse o conservarse con facilidad.

| Dominio | Datos distribuidos | Resultado de integridad |
|---|---:|---|
| Finanzas | **30 transacciones**, una por día, del 29-ago al 27-sep | El filtro por etiqueta devolvió exactamente 30. El resumen y el export JSON los contienen correctamente. |
| Sueño | 15 registros alternos en el intervalo | 13 pertenecen a septiembre; duración y calidad calculadas correctamente. |
| Comidas | 15 registros alternos complementarios | Registrados y visibles en la Posada; el día actual muestra sus macros. |
| Diario | 10 entradas cada tres días | 9 corresponden a septiembre; filtros por mes, etiqueta y búsqueda correctos. |
| Gimnasio | 5 sesiones históricas + 2 completadas | Listado, edición, finalización y guard contra doble finalización comprobados. |
| Peso corporal | 4 mediciones retenidas durante el mes | Consulta de rango devuelve las 4 mediciones esperadas. |
| Presencia / Espejo | 4 check-ins semanales históricos | Tendencia y puntuación de presencia calculadas. |
| Check-in diario | 1 registro actual, luego editado | Upsert y estadísticas verificados. |

También se verificaron: presupuestos, metas financieras, recurrencias, deudas/pagos, metas maestras/hitos, aprendizaje/notas/vocabulario, relaciones/fechas/regalos, agenda, zonas personalizadas, nutrición, notificaciones, espejo/armario/outfits/lista de deseos, gremio temporal y exportación.

### Estado persistente intencional al cierre

La cuenta pasó de la línea base de nivel 1 / 20 XP / 5 gold a **nivel 2 / 114 XP / 46 gold**, consecuencia de las pruebas de recompensa autorizadas (misión, hábito, aprendizaje, ritual, check-in, rutina de cuidado y entrenamiento).

Se conservaron los datos históricos `QA30D` para cumplir la simulación mensual. Se limpiaron los artefactos breves de interfaz `QAUI`, las metas/presupuestos/recurrencias/deudas temporales, relaciones/regalos temporales, zona temporal, foto sintética, armario/outfit/lista temporal y gremio temporal.

---

## Cobertura lograda

### API y consistencia de datos

| Área | Operaciones comprobadas |
|---|---|
| Auth y usuario | Login, refresh implícito, `/auth/me`, protección de rutas. |
| Misiones | Validación Zod, creación, consulta, edición, subtareas, completar, fallo, archivo, duplicado y filtros. |
| Hábitos | Validación, creación, edición, frecuencia, recordatorio, completar, reintento, transición inválida, heatmap y archivo. |
| Bóveda / finanzas | Transacciones históricas, filtros, resumen, edición/borrado, presupuestos, metas y aportes, recurrentes, deudas, pagos y proyección. |
| Coliseo / gym | Entrenamientos, edición, finalización, guard de doble recompensa, guard de borrado, peso, foto de progreso, 1RM, volumen e historial. |
| Salud y contenido | Sueño, comidas, macros, nutrición, diario, aprendizaje, notas y vocabulario. |
| Relaciones y agenda | Relaciones, fechas especiales, regalos, agenda CRUD y rangos. |
| Fase LifeScore | Metas, hitos, rituales, check-in, foco, LifeScore, stats e historial. |
| Espejo y zonas | Rutinas de cuidado, armario, outfits, wishlist, presencia y zonas personalizadas. |
| Social local | Validación de amistades; crear/consultar/mensajear/salir de un gremio propio y su limpieza total. |
| Exportación | `/export/json` verificó que quests, hábitos, transacciones, diarios, workouts, sueño, comidas y metas se serializan sin error. |

### Interfaz web

- **Rutas revisadas:** inicio, personaje, misiones, hábitos, logros, historial, gimnasio, bóveda, sueño, comida, aprendizaje, diario, amor, mercado, ajustes, leaderboard, retos, gremio, estadísticas, campaña, agenda, Life Score, zonas, glow-up, sabiduría, about, FAQ y 404.
- **Redirects verificados:** `/goals` y `/metas` → `/quests?filter=meta`; `/rituals` y `/rituales` → `/habits?filter=ritual`.
- **Flujos interactivos realizados:** wizard de Misiones, modal de Hábitos/Rituales y modal de Transacción. Sus validaciones de campos vacíos/importe vacío bloquearon correctamente el submit; los submits válidos devolvieron `201` y se representaron en pantalla.
- **Móvil 390 px:** Misiones, Hábitos, Bóveda, Gimnasio, Comida, Sueño, Diario, Agenda, Espejo y Ajustes. Sólo Comida presentó overflow horizontal.
- **Consola/red autenticada:** sin errores de JavaScript ni HTTP >=400 durante el recorrido autenticado.

> Nota sobre tiempos: el splash y bootstrap retrasan la primera carga de datos unos 2.5–3 s. Las pantallas que inicialmente parecían “Cargando…” terminaron correctamente al esperar la carga real; no se clasifican como fallos.

---

## Fallos reproducibles

| Sev. | Incidencia | Reproducción confirmada | Impacto / rutas afectadas |
|---|---|---|---|
| **Alta** | **Crear un ritual crea un hábito normal** | En `/rituals`, se abrió `+ NUEVO RITUAL`, se creó un registro válido; `POST /habits` respondió `201` con `isRitual: false`. La vista de rituales quedó en `HOY 0/0` y no mostró el nuevo registro. La prueba API con `isRitual: true` también devolvió y conservó `false`. | El flujo visible de Ritual no funciona: el usuario crea algo que desaparece de la vista de rituales. Afecta `/rituals`, `/habits?filter=ritual`, `POST/PATCH /api/v1/habits`. |
| **Alta** | **Completar el mismo ritual duplica XP, gold y logs** | Se creó un ritual temporal y se llamó dos veces `POST /rituals/:id/complete`. Ambas devolvieron `200`, `+30 XP`; `/stats` devolvió `totalLogs: 2`. | Permite farmear recompensas con doble tap/retry y corrompe las métricas. Afecta `POST /api/v1/rituals/:id/complete`. |
| **Alta** | **Una racha de hábito puede resetearse el mismo día** | Tras `POST /habits/:id/log { completed }`, la respuesta dio `currentStreak: 1`. Un reintento inmediato del mismo endpoint devolvió `200` sin XP duplicado, pero con `currentStreak: 0`. | Una lectura/reintento posterior a completar el primer día puede borrar visualmente y en datos la racha actual. Afecta completar/listar hábitos y la reconciliación de rachas. |
| **Media** | **API financiera acepta importes negativos** | `POST /finances/transactions` con gasto `amount: -5` devolvió `201`; el registro fue eliminado inmediatamente después. El modal web sí bloquea importe vacío/no positivo, pero el backend no. | Un cliente directo puede distorsionar balances, presupuestos, alertas y proyecciones. Afecta `POST /api/v1/finances/transactions`. |
| **Media** | **API de foco acepta duración negativa** | `POST /focus/complete { durationMin: -10 }` devolvió `200`, `xpEarned: -20`, y el mensaje `+-20 XP`. Se compensó con una sesión positiva equivalente para dejar los totales netos en cero. | Inserta sesiones inválidas y puede degradar XP, gold y total de minutos. Afecta `POST /api/v1/focus/complete`. |
| **Media** | **No hay registro histórico de hábitos; la fecha enviada se ignora silenciosamente** | Se envió `date: 2026-09-01` a `POST /habits/:id/log`. Respondió `200`, pero el log guardado quedó fechado el día actual (`2026-09-27`). | No se puede corregir/backfillear un hábito desde API; la simulación mensual no puede contener 30 logs reales de hábito. Afecta historial, heatmap y auditoría de hábitos. |
| **Media** | **Overflow horizontal en móvil en el registro rápido de IA** | En `/food` a 390 px, `main.scrollWidth` fue **450 px** vs viewport 390. El botón `→ ANALIZAR` se dibujó desde x=289 hasta x=450 y queda recortado. No se invocó IA. | El botón de análisis y parte de la fila son difíciles/imposibles de usar en móvil estrecho. Afecta `/food`, tarjeta “REGISTRO RÁPIDO CON IA”. |
| **Baja** | **401 ruidosos antes de autenticar** | En la pantalla de login se observaron dos `401` de `/auth/refresh`; el login posterior funciona y no hubo errores autenticados. | Ruido de consola/monitorización, sin bloqueo para la persona usuaria. |

---

## Recomendaciones de corrección

### 1) Reparar Ritual end-to-end — prioridad inmediata

- Persistir `isRitual` en `createHabit` y `updateHabit` del servicio de hábitos.
- Añadir `isRitual?: boolean` al payload web.
- Al crear desde `showRituals`, enviar explícitamente `isRitual: true`.
- Añadir una prueba E2E: crear desde `/rituals` → registro visible bajo `/habits?filter=ritual`.

### 2) Hacer la finalización de Ritual idempotente

- Añadir una restricción única por `ritualId + date` o usar `upsert`.
- Encapsular log, XP y gold en una transacción; premiar únicamente cuando el log fue creado por primera vez.
- Devolver `alreadyDone: true` para el segundo intento, siguiendo el patrón correcto ya observado en Rutinas de Cuidado.

### 3) Corregir reconciliación de rachas de Hábitos

- Antes de resetear una racha, considerar el log completado del día actual.
- No interpretar la falta de log de ayer como racha rota cuando el hábito acaba de iniciar hoy.
- Añadir pruebas de: primer día, retry inmediato, refresh/listado el mismo día, frecuencia semanal y huso `America/Bogota`.

### 4) Validar backend, no sólo UI

- Crear schemas Zod para transacciones y foco.
- Exigir `amount > 0`, categorías/tipos válidos y fechas válidas para finanzas.
- Exigir `durationMin` entero positivo dentro de un rango razonable para foco.
- Responder `400` detallado, no crear datos silenciosamente inválidos.

### 5) Diseñar explícitamente el backfill de hábitos

- Si el producto permite corrección histórica: aceptar una fecha de calendario validada y garantizar idempotencia por `habitId + date`.
- Si no lo permite: rechazar `date` como payload desconocido con `400`; no aceptarlo y luego descartarlo silenciosamente.

### 6) Arreglar Comida en móvil

En la fila de análisis rápido de `NutritionExtras`:

- usar `flex-col sm:flex-row`, o
- aplicar `min-w-0` al input y `w-full sm:w-auto`/`shrink-0` al botón.

Añadir una prueba visual/Playwright a 390 px que compruebe `scrollWidth <= innerWidth` y que el botón sea clicable.

### 7) Reducir 401 esperados de la pantalla pública

No intentar refresh si no existe una sesión/cookie de refresh conocida, o excluir el bootstrap refresh de la ruta de login. Esto elimina ruido sin cambiar la seguridad.

---

## No ejecutado / dependiente de terceros

| Área | Motivo |
|---|---|
| IA: Sabio, análisis AI de comida, sugerencia de zona y breakdown AI de metas | No se invocó para evitar consumo/coste de proveedores externos. |
| Google Calendar OAuth, callback, sync y disconnect | Sólo se consultó el estado; no se enlazó, sincronizó ni desconectó una cuenta externa. |
| Friend request a otra persona, aceptar solicitudes ajenas, retos multijugador y unirse a gremios ajenos | Requieren terceros o dejan objetos sociales sin endpoint de limpieza/cancelación. Las pantallas y GETs sí se comprobaron; un gremio propio temporal se creó, recibió mensaje y se eliminó al salir. |
| Mercado: compra/equipar/usar ítems | El catálogo de producción devolvió `items: []`; no había inventario comprable que ejercitar. |
| Push real | No se creó una suscripción ni se envió push de prueba a un dispositivo del usuario. |
| Borrado de workout recompensado | Fue comprobado como guard: devuelve `409` correctamente; no existe reversión de recompensa, por lo que el workout finalizado se retuvo como parte de la simulación. |

---

## Conclusión

La aplicación tiene una base sólida de disponibilidad: las rutas, lectura autenticada, flujos CRUD principales, exportación y visualización de datos históricos funcionaron en producción. Las incidencias encontradas se concentran en **idempotencia y validación de estados gamificados**, no en disponibilidad general.

Antes de promover más ampliamente las funciones de Rituales y Hábitos, se recomienda resolver las tres incidencias altas. Después, endurecer validaciones de backend y corregir el overflow móvil de Posada para asegurar que la experiencia sea coherente entre UI y API.
