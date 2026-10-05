# Resiliencia de cuota IA (2026-10-05)

Diagnóstico del "chat / El Sabio se cae" en producción y las protecciones aplicadas.

## Síntomas

- El Sabio (chat, análisis, pergaminos) devolvía errores `429` de Gemini de forma
  intermitente, a veces tras solo 3–5 mensajes de chat en el día.
- El endpoint `GET /sage/daily-tip` devolvía **500** riéndole en la cara al usuario.
- El plan gratuito parecía "agotarse" mucho antes de lo que promete la consola.

## Causas encontradas

1. **Modelo oculto asesino de cuota.** `generateText` usaba por defecto
   `llama-3.3-70b-versatile` en Groq, cuyo nivel gratuito da solo
   **1.000 req/día (100K tokens/día) por organización**. Con el scheduler
   generando pergaminos/consejos diarios por usuario quedaban pocas llamadas para
   el chat. `llama-3.1-8b-instant` da **14.400 req/día y 500K tokens/día** (14×),
   con calidad más que suficiente para respuestas de 1–3 párrafos del Sabio.
2. **Reintentos que quemaban cuota.** Ante un 429 de Gemini se reintentaba hasta
   3 veces con backoff y luego se saltaba al siguiente proveedor con la misma
   política: un solo mensaje podía costar 7–9 llamadas.
3. **Sin límite por usuario.** Un usuario activo podía consumir el cupo diario
   completo de la API key; el `rate limit` existente solo frenaba ráfagas (20/día)
   pero no repartía la cuota gratuita.
4. **`sageDailyTip` se llamaba varias veces por día** por usuario (scheduler +
   cada apertura de la app en el frontend) sin memoria del tip ya generado.
5. **Errores de cuota = 500 genéricos.** El panel mostraba el fallback
   "inténtalo de nuevo" indistinguible de un bug.

## Cambios aplicados

### `apps/api/src/lib/ai.ts`
- **Default `GROQ_MODEL=llama-3.1-8b-instant`** (14.400 req/día en el nivel
  gratuito, frente a 1.000 del 70b). Sobreescribible con `GROQ_MODEL` si algún
  día se paga la capa más alta.
- **Circuit breaker por proveedor** (`AIQuotaError`): al primer 429/insufficient
  quota de un proveedor se le marca "en espera" (10 min) y no se vuelve a
  consultar durante esa ventana. Cero reintentos a Gemini (su cuota es diaria y
  no se recupera en segundos).
- `isAIQuotaError(err)` exportado para distinguir "sin cuota en ningún lado" de
  errores puntuales.

### `apps/api/src/services/sage.service.ts`
- **`SAGE_DAILY_AI_LIMIT` (default 8)**: reparto por usuario de la cuota diaria
  gratuita. Usa el contador existente `user.sageCallsToday` (sin migración nueva).
  `consumeSageDailyAI(userId)` devuelve `null` al llegar al tope → cada función
  devuelve su respuesta fija/amable de siempre.
- **`SAGE_QUOTA_REPLY`**: cuando TODOS los proveedores están sin cuota
  (`AIQuotaError`), `callAI`/`callAIWithMemory` devuelven una respuesta del Sabio
  digna (HTTP 200), sin guardar memoria/insights basura.
- **`sageDailyTip` con cache diaria por usuario** (memoria de proceso, sin cambios
  de schema): la IA del tip se consulta como máximo una vez al día por usuario;
  el scheduler lo genera y el frontend lo relee gratis.
- `getSageRateInfo` ahora reporta el reparto real: `{ callsToday, limit, remaining, resetAt }`.

### `apps/api/src/jobs/scheduler.ts`
- Pausa de 250ms entre usuarios en los bucles de pergaminos diarios y resúmenes
  semanales → sin ráfagas de 429 contra el tope por minuto del proveedor.

### Web
- `components/sage/SagePanel.tsx` (adaptado al rediseño): contador
  "Consultas del Sabio hoy: X de Y · se renueva a las HH:MM", con estado
  agotado que deshabilita chat/acciones y lo explica. Los errores del API
  muestran su mensaje real en vez del fallback genérico.
- `services/sage.service.ts`: tipos `SageRateInfo` (con `resetAt`) y
  `raw?: string` en `sageSuggestQuests` para mostrar el texto del Sabio cuando
  no viene JSON de misiones.

### `.env.example`
- Se eliminó la **llave real de Google** que estaba comiteada (`GEMINI_API_KEY="AIza…"`).
  Añadidos avisos: jamás pegar llaves en el example; si una llega a un commit,
  rotarla de inmediato. Documentado el orden de proveedores y el porqué del
  modelo default.

## Qué NO se toca

- El resto de la app (hábitos, misiones, finanzas, gym) no consume IA y funciona
  igual aunque la cuota esté agotada.
- No hubo migración de Prisma: se reutilizó `user.sageCallsToday` / `sageCallsResetAt`.

## Acciones pendientes fuera del código (usuario)

1. **Rotar la API key de Gemini** que estaba expuesta en `.env.example` en la
   rama `main`: https://aistudio.google.com/app/apikey
2. **Rotar la API key de Groq** (apareció en capturas): https://console.groq.com/keys
3. En Vercel, re-guardar las variables que muestran el badge *Needs Attention*
   como tipo **Secret**, y redeploy el API tras el merge.
