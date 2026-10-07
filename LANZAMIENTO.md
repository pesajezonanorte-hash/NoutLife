# 🚀 Noutlife — Fase Final de Lanzamiento

**Fecha:** 2026-05-17
**Versión:** 11.2.0 (Fase Final Multi-Usuario)

---

## ✅ Resumen de cambios en esta fase

### Bloque 1 — Multi-Usuario Sólido
- **Auditoría de aislamiento de datos** en los 35+ servicios del backend. Cada query Prisma sobre tablas de usuario filtra por `userId`. Cron jobs operan globalmente (intencional).
- **Fix CRÍTICO — OAuth state hijacking**: Los callbacks de Google / Spotify / Google Fit confiaban en el query param `state` sin firmar para identificar al usuario. Un atacante podía conectar **sus propias** credenciales OAuth a la cuenta de otro usuario alterando `state` en la URL.
  - Nuevo `lib/oauth-state.ts` — firma `state` como JWT (TTL 10m, provider lock).
  - Callbacks movidos antes de `router.use(requireAuth)` (el browser no envía Authorization en el redirect del proveedor).
  - Cada `/auth` endpoint firma; cada `/callback` verifica.
- **Hardcodes de "Miguel" eliminados** en IdentityStep, Onboarding y About (ahora usan `user.displayName`).
- **Registro y sesiones** verificados — bcrypt rounds=12, refresh token hasheado, email/username únicos.

### Bloque 2 — Seguridad
- **Rate limiting** in-memory (sin dependencias) — `lib/rate-limit.middleware.ts`:
  - **Global**: 200 req/min por usuario o IP.
  - **Login**: 8 intentos / 15 min por IP+email (anti brute force).
  - **Registro**: 5 registros / hora por IP.
  - **Sabio**: 20 consultas / min por usuario.
- **Error handler endurecido** — `error.middleware.ts`:
  - Lista blanca de códigos de error de negocio que sí se exponen al cliente.
  - `5xx` nunca filtra detalles internos en producción.
  - Stack traces solo a logs del servidor.

### Bloque 3 — Life Score con anillos completos
- Nuevo componente `components/ui/ProgressRings.tsx` — 3 anillos concéntricos **completos** (estilo Apple Watch), con tracks visibles, animación stroke-dasharray suave, centro con número + label.
- Integrado en:
  - `Dashboard > LifeScoreWidget` (150px, layout horizontal con leyenda).
  - `Life page > ScoreRing` (240px, leyenda de Misiones/Hábitos/Finanzas debajo).

### Fix — Parser de comida con IA
- Reescrito `parseMealWithAI()` en `nutrition2.service.ts`:
  - Extractor de JSON tolerante (`extractJsonObject`) — quita ```` ``` ```` fences, encuentra el primer objeto balanceado, no crashea si el modelo agrega prólogo.
  - Coerción robusta de números (`num()` — acepta strings, comas, fallback).
  - Devuelve flags `aiAvailable` / `aiSucceeded` para que el frontend muestre estado real.
  - Logs claros del error real para diagnóstico.
- Frontend `AIQuickLog`:
  - Permite **editar nombre y macros** antes de guardar (entrada manual completa siempre disponible).
  - Muestra mensaje cálido si la IA falló — nunca bloquea el registro.

### IA Omnipresente
- Botones contextuales del Sabio añadidos en **Food, Sleep, Learning, Love** (ya estaban en Quests, Gym, Finances, Journal y Dashboard).
- Cada botón abre el SagePanel pre-cargado con una pregunta relevante a la zona.
- Toda la IA usa `gemini-2.5-flash-lite` (configurable vía `GEMINI_MODEL`).

### Bloque 8 — Detalles finales
- **Página FAQ** `/faq` — 10 preguntas comunes con acordeón animado.
- **Botón Feedback flotante** (bottom-left, todas las páginas autenticadas) — modal con tipo (bug/idea/otro) + mensaje. Persiste en `apps/api/.feedback/entries.jsonl` (sin migración Prisma).
- **Meta tags** completos en `index.html` — Open Graph, Twitter Card, título descriptivo.
- **Endpoint `POST /api/v1/feedback`** con validación y rate limit global.

---

## 🔒 Checklist de Lanzamiento

### Cuenta y acceso
- [x] Registro con bcrypt rounds=12, email/username únicos, mensajes claros
- [x] Login con rate limit anti brute-force (8 intentos / 15min)
- [x] Refresh token httpOnly, rotado en login, hasheado en DB
- [x] Logout limpia refresh token hash
- [x] Onboarding completo para usuarios nuevos (sin defaults hardcodeados)

### Funcionalidad core
- [x] Quests CRUD, completar, sub-objectives
- [x] Hábitos con rachas, heatmap, daily reset (cron 4am por timezone)
- [x] Sabio (Gemini 2.5 flash-lite) con memoria y degradación graciosa
- [x] Finanzas — transacciones, deudas, recurrentes, proyección
- [x] Gym — workouts, body weight, fotos, 1RM, volumen semanal
- [x] Diario — prompts diarios, filtros por mood, búsqueda
- [x] Agenda — eventos, sync Google Calendar
- [x] Life Score con anillos completos (Misiones / Hábitos / Finanzas)
- [x] Spotify Premium reproductor (con auto-refresh de token)

### Social
- [x] Amigos, leaderboard (4 categorías), retos, gremios — implementados desde Fase 6
- [x] Perfiles públicos limitados a gamificación (nunca finanzas/diario)

### Seguridad
- [x] Helmet, CORS multi-origen, cookie parser
- [x] Rate limiting global + por endpoint sensible
- [x] OAuth state firmado contra hijacking
- [x] Error handler sin filtrar detalles internos
- [x] Aislamiento de datos verificado endpoint por endpoint

### Calidad
- [x] **TypeScript 0 errores** en API y Web
- [x] Dark mode + 6 temas en globals.css
- [x] Mobile-first (bottom nav, touch targets ≥44px)
- [x] PWA (manifest, service worker, install banner)
- [x] Skeletons en cargas, OfflineIndicator, ScrollToTop
- [x] FAQ page + Feedback button globales

### Multi-usuario (verificar en producción)
- [ ] Crear 2 cuentas distintas y verificar que no ven datos del otro
- [ ] Mantener 2 sesiones simultáneas en navegadores distintos
- [ ] Probar OAuth flow completo (Spotify/Google) — el state firmado
- [ ] Probar AI parser con varias entradas (`arroz con pollo`, `una manzana`, `hamburguesa y papas`)

---

## 🌐 URL pública
Web (Netlify/Vercel): _por confirmar_ — la URL configurada está en `CORS_ORIGIN` de Railway.
API: _por confirmar_ — health check disponible en `/health`.

---

## 📨 Nota de bienvenida para amigos (para copiar/pegar)

> Hola 👋
>
> Te invito a probar **Noutlife** — una app que convierte tu vida real en un RPG. Misiones, hábitos, gym, finanzas, sueño y diario, todo gamificado: ganas XP, subes de nivel, desbloqueas logros. Hay un Sabio con IA que te aconseja según lo que vas haciendo.
>
> 👉 Entrá a {URL_AQUÍ}
> Crea tu cuenta (te toma 1 minuto), pasa por el onboarding y empezás como Nivel 1.
>
> Si encontrás algo raro, hay un botón **💬 Feedback** en la esquina inferior izquierda — escribime por ahí. Si tenés dudas, hay un `/faq` con todo explicado.
>
> Que la cacería empiece. ⚔️

---

## ⚠️ Pendientes manuales (no automatizables desde código)

1. **Verificar en producción** los 4 ítems de "Multi-usuario" (requiere acceso a la URL pública con 2 cuentas).
2. **Aplicar el rate limiting** — el limiter es in-memory; si la API corre en múltiples instancias detrás de un load balancer cada instancia tiene su propio contador. Para tráfico bajo (amigos del autor) es suficiente. Migrar a Redis si se escala.
3. **Crear `/og-image.png`** en `apps/web/public/` (1200x630, branding Noutlife) — referenciada en index.html.
4. **Probar OAuth** con `JWT_SECRET` real en producción (el state usa la misma key — si rota durante un OAuth en curso, el callback falla con `?provider=error`).
5. **Backup del `.feedback/entries.jsonl`** — los feedbacks se guardan en disco; en Vercel el filesystem es efímero. Considerar migrar a una tabla Prisma `Feedback` antes de tráfico real.

---

🎉 **Noutlife está lista para sus primeros usuarios reales.**
