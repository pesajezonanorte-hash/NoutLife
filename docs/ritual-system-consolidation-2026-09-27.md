# Consolidación de rituales — 27 de septiembre de 2026

## Decisión de producto

Se conserva únicamente el **Sistema B dedicado**: `Ritual`, `RitualStep` y `RitualLog`, con presets, modo de ejecución, rachas e idempotencia diaria. El antiguo marcador `Habit.isRitual` (Sistema A) deja de ser parte del producto y de los contratos web/API.

## Inventario autorizado antes de la migración

Se consultó el export JSON de la cuenta de producción autorizada, que incluye hábitos activos y archivados.

| Control | Resultado |
| --- | --- |
| Hábitos marcados con `isRitual=true` activos | 0 |
| Marcadores heredados inactivos | 2 |
| Acción sobre los 2 registros inactivos de QA | Se retiró únicamente el marcador heredado; se conservaron las filas de hábito y su estado archivado. |
| Marcadores heredados restantes en la cuenta autorizada | 0 |
| Rituals dedicados antes de la verificación | 0 |
| Rituals de QA restantes después de la verificación | 0 |

La API de exportación es por usuario, no una consulta administrativa global. Por eso la migración incorpora un bloqueo a nivel de base de datos: **si cualquier cuenta conserva un `Habit.isRitual=true`, la columna no se elimina y el despliegue falla antes de perder ese dato**.

## Cambio implementado

- `/rituals` monta `RitualsPage`.
- `/rituales` redirige de forma canónica a `/rituals`.
- `CommandPalette → Rituales` llega a la página dedicada.
- `/habits` vuelve a mostrar exclusivamente hábitos regulares. La query histórica `?filter=ritual` ya no activa ninguna vista ni modalidad de ritual.
- Se retiró `isRitual` del modelo Prisma, inputs, schemas, servicio de hábitos, payload web y modal de hábitos.
- Los clientes antiguos que aún envíen esa clave durante un rollout no la persisten: el schema de Zod la descarta.
- La migración `20260927200000_remove_legacy_habit_ritual_flag` borra la columna sólo cuando el conteo global de marcadores es cero. Es idempotente si la columna ya no existe.
- `src/migrate-db.ts` usa el mismo guard porque el build de Vercel aplica las actualizaciones runtime en vez de `prisma migrate deploy`.

## Verificaciones realizadas

1. **Prisma/API/Web:** cliente Prisma regenerado; `npm run test:fixes --workspace=@lifequest/api`; builds TypeScript de API y web correctos.
2. **Guard de migración en una base PostgreSQL efímera:**
   - inventario limpio → elimina la columna;
   - un marcador heredado → rechaza la migración y conserva columna/dato;
   - una segunda ejecución sin columna → no falla.
3. **UI local construida contra la API desplegada:** Playwright pasó el flujo `CommandPalette → Rituales`, el alias `/rituales`, y la neutralización de `/habits?filter=ritual`.
4. **ExecutionMode contra la API desplegada, con mutaciones autorizadas:** se hicieron dos corridas controladas en una cuenta autorizada sin rituales. En cada una se sembraron presets, se completó uno dos veces desde la interfaz y se verificó la primera respuesta `{ alreadyDone: false, xpEarned: 30, goldEarned: 5 }` y la segunda `{ alreadyDone: true, xpEarned: 0, goldEarned: 0 }`. Los presets de verificación se eliminaron posteriormente; los dos eventos de recompensa inicial (total `+60 XP` y `+10 gold`) se conservaron conforme a la autorización de auditoría.

## Despliegue directo autorizado y verificación posterior

No había un entorno de staging remoto aislado configurado. Tras señalar explícitamente que `main` dispara los despliegues de Vercel y que la migración elimina una columna, la persona responsable autorizó de forma expresa el despliegue directo a producción. El commit de consolidación quedó desplegado correctamente en los proyectos web y API de Vercel.

La protección no se omitió en el código: el build sólo podía continuar si el conteo global de `Habit.isRitual=true` era cero. Después del despliegue se verificó en producción que `/api/v1/habits` y el export ya no exponen el campo legado, que los hábitos regulares siguen disponibles y que `/api/v1/rituals` responde correctamente. Los E2E de routing y de `ExecutionMode` también pasaron contra las URLs de producción; los presets usados por la prueba se limpiaron al final.

## Puerta requerida para futuras migraciones destructivas

La autorización directa de esta entrega no sustituye un staging. Antes de enviar otra migración destructiva a una base compartida o de producción:

1. Crear snapshot/backup de la base de staging.
2. Ejecutar `prisma migrate deploy` (o el build `migrate-db.ts` usado por el entorno).
3. Confirmar que la migración pasa; si falla con `Refusing to remove legacy Habit.isRitual`, inventariar/migrar esos hábitos antes de reintentar.
4. Confirmar en `information_schema.columns` que `habits.isRitual` ya no existe y que los conteos de `habits`, `habit_logs`, `rituals`, `ritual_steps` y `ritual_logs` permanecen intactos.
5. Ejecutar el E2E de routing y, en una cuenta de QA vacía, el de `ExecutionMode` con `LIFEQUEST_E2E_RITUAL_MUTATIONS=1`.
6. Sólo después de esa evidencia, aplicar el mismo release a producción.
