# Auditoría de estadísticas — 2026-09-26

## Alcance

Se revisó el flujo de datos desde los registros de Noutlife hasta las métricas y su presentación:

- resumen de estadísticas, historial de XP, radar, heatmap, sueño, progresión de gimnasio, flujo financiero y predicciones;
- Life Score estático/dinámico, zonas personalizadas, correlaciones y revisión anual;
- historial diario de XP, oro, misiones y hábitos;
- integridad de recompensas de hábitos y entrenamientos;
- filtros temporales para evitar que registros futuros se presenten como actividad o dinero realizado;
- contratos de `apps/web/src/services/stats.service.ts` y consumo de los ocho endpoints en la página de Estadísticas.

## Correcciones aplicadas

1. **Rangos temporales coherentes.** Los agregados de `/stats` usan intervalos acotados por el instante actual. Los datos futuros ya no inflan XP, quests, transacciones, sueño, gimnasio, Life Score, correlaciones, reportes o proyecciones realizadas.
2. **Entrenamientos finalizados.** Los agregados de gym/Life Score consideran solo sesiones con `xpEarned > 0`, el marcador actual de finalización. Las sesiones borrador no suman actividad.
3. **Rachas y recompensas.** Repetir un hábito ya completado no vuelve a sumar XP, oro, racha, recuperación ni logros. Reintentar finalizar un entrenamiento ya premiado devuelve conflicto y no premia de nuevo.
4. **Sueño.** Una edición parcial recalcula duración y puntuación; la tendencia semanal se forma por fechas reales y no por posición de las filas.
5. **Finanzas.** El resumen, dashboard, presupuestos, reporte y proyección excluyen movimientos fechados en el futuro al calcular dinero realizado.
6. **Life Score.** Las zonas personalizadas solo contabilizan XP cuyo origen sea una misión o hábito vinculado a esa zona; ya no duplican el XP total del usuario. La revisión anual identifica libros con el enum `BOOK` y acota el año actual a hoy.
7. **Conexión frontend.** La página `/stats` ya carga y muestra las cuatro APIs que estaban sin presentar: tendencia financiera, descanso, progresión de fuerza y estimaciones. Incluye estados de carga, vacío y error recuperable, sin datos de demostración.
8. **Fallos de API.** Los ocho handlers de estadísticas devuelven un JSON de error estable si un agregado falla, sin dejar una promesa rechazada fuera de Express.

## Pruebas reproducibles

Ejecutar desde la raíz del monorepo:

```bash
npm ci
npm run test:analytics --workspace=apps/api
npm run build
git diff --check
```

`apps/api/tests/analytics.integration.test.ts` usa un Prisma controlado para probar las consultas, rangos y resultados sin una base persistente. Cubre:

- períodos y comparaciones anteriores;
- XP, quests, radar, hábitos, sueño, gym y finanzas;
- predicciones de nivel, metas y riesgo de hábitos;
- filtros de futuro para finanzas/gym;
- Life Score y zona personalizada;
- historial;
- respuesta de error de la API;
- idempotencia secuencial de hábitos y entrenamientos;
- recálculo de sueño.

## Resultado de validación

- `npm run test:analytics --workspace=apps/api`: aprobado.
- `npm run build`: aprobado para `packages/shared`, API y web.
- `git diff --check`: aprobado.

Vite conserva dos advertencias preexistentes: importación dinámica/estática mixta de `api.ts` y un bundle superior a 500 kB. No bloquean el build ni fueron introducidas por esta auditoría.

## Límite de la validación

No hay PostgreSQL local ni cuenta QA autenticada autorizada disponible. Por eso no se mutaron datos de producción y la cobertura de persistencia se ejecutó con un sustituto de Prisma controlado. Para una validación E2E contra datos persistidos aún se necesita una base temporal o una cuenta QA explícitamente autorizada.
