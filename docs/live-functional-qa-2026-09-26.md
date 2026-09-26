# QA funcional autenticado — 2026-09-26

## Entorno comprobado

- Web desplegada: `https://lifequest2-web.vercel.app`
- API desplegada: `https://lifequest2-api.vercel.app/api/v1`
- Método: sesión autenticada proporcionada por el titular de la cuenta. No se almacenaron credenciales, cookies ni tokens en el repositorio.

## Resultado

No se detectó ningún fallo HTTP ni de contrato en los flujos cubiertos.

| Bloque | Resultado |
| --- | --- |
| Inicio de sesión | HTTP 200, token y usuario recibidos |
| Renovación de sesión | HTTP 200, token y usuario renovados |
| Lecturas autenticadas | 80/80 endpoints HTTP 2xx |
| CRUD reversible en producción | 37/37 operaciones HTTP 2xx |
| Limpieza de registros temporales | 14/14 eliminaciones HTTP 2xx |
| Verificación posterior de marcadores QA | 0 registros temporales restantes |
| Estadísticas tras la limpieza | 12/12 endpoints HTTP 200 |
| Frontend desplegado | HTML HTTP 200 y bundle contiene las tarjetas de estadísticas nuevas |

## Cobertura de lectura autenticada

Se validaron respuestas y formas de contrato de dashboard, perfil/personaje, quests, hábitos, logros, historial, notificaciones, workouts, catálogo y rutinas; finanzas, presupuestos, metas, recurrentes, deudas y proyección; sueño, comidas y nutrición; aprendizaje y diario; relaciones; tienda; estadísticas; temporadas; agenda; gym; Life Score; objetivos y rituales; check-in, focus, scrolls, wisdom, búsqueda, espejo, zonas personalizadas y social.

## Flujos CRUD reversibles comprobados

Se crearon, actualizaron, consultaron cuando aplicaba y eliminaron registros temporales con una marca QA única:

- transacción, presupuesto, meta financiera, transacción recurrente y deuda;
- entrenamiento borrador, registro de sueño, comida, peso corporal y cálculo de 1RM;
- ítem de aprendizaje, cambio de progreso, nota enriquecida y tarjeta de vocabulario;
- entrada de diario;
- evento de agenda;
- meta maestra y milestone;
- ritual.

Al acabar, una verificación adicional de las colecciones confirmó que no quedó ningún marcador QA temporal ni se dejó información de prueba visible en la cuenta.

## Estadísticas verificadas después de la limpieza

Se volvieron a consultar correctamente:

- `/stats/summary` para semana y mes;
- historial de XP, radar, tendencia financiera, heatmap, sueño, gym y predicciones;
- Life Score clásico y dinámico;
- historial de actividad.

## Límites deliberados para proteger la cuenta y servicios externos

No se ejecutaron acciones que dejarían cambios irreversibles o que afectan servicios de terceros:

1. finalizar un entrenamiento, completar/fallar una quest, completar un hábito, pomodoro, ritual o check-in que otorgue XP/oro, porque no existe una reversión segura del ledger de recompensas;
2. sincronizar, conectar o desconectar Google Calendar, para no crear, editar ni borrar eventos externos;
3. compras de tienda, acciones de temporada y notificaciones push reales;
4. prompts IA de pago/generativos;
5. flujos sociales que requieren una segunda cuenta (amistades, retos, gremios).

Estas rutas quedaron cubiertas por las pruebas controladas incluidas en el commit anterior cuando correspondía a estadísticas e idempotencia, pero una prueba E2E de éxito en producción requeriría autorización explícita para modificar XP/oro, datos de terceros o una segunda cuenta QA aislada.

## Conclusión

La aplicación desplegada responde correctamente en toda la superficie autenticada de lectura y en los flujos CRUD reversibles probados. No hay hallazgos bloqueantes en esa cobertura. La certificación absoluta de cada acción irreversible o de integración externa requiere un entorno QA aislado o autorización específica para producir esos cambios permanentes.
