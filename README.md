# 🌿 Noutlife — El RPG de tu vida real

Noutlife convierte tus metas, hábitos y rutinas diarias en misiones con XP, niveles y oro. Cada área de tu vida es una zona del juego, y El Sabio (un mentor de IA) te guía. Antes se llamaba LifeQuest.

Monorepo con npm workspaces: React + Vite (web), Node.js + Express + Prisma + PostgreSQL (API), Expo (móvil) y un paquete de tipos compartidos.

---

## ✨ Funcionalidades

**Juego y progreso**
- Misiones, hábitos y metas con XP, oro, niveles, rachas y logros. Estadísticas y temporada.
- Personaje con avatar editable (pixel art y skins) y objetos de la tienda que se ven en el personaje.
- Rituales, Glow Up, Sabiduría y zonas personalizadas creadas con IA.
- Tutorial de bienvenida para jugadores nuevos.

**Zonas de vida**: Gimnasio, Comida, Sueño, Finanzas, Aprendizaje, Diario, Amor y Agenda. Cada zona tiene su propia ambientación.

**El Sabio (IA)**: chat y briefings diarios. Prueba proveedores en cadena (Groq → Gemini → OpenRouter → OpenAI) con varias llaves y modelos. Solo el chat tiene tope diario, que se adapta a la cantidad de gente activa.

**Social**
- Cartas (chat) en vivo entre amigos y gremios: respuestas, reacciones, ediciones, stickers, juegos, fotos y videos de hasta 15 s.
- Directorio de gente, ranking por nivel, galería, gremios con rachas de fotos y jardín compartido.
- Bloqueos y gestión de chats.

**Plataforma**
- Inicio de sesión solo con Google. Eliminación de cuenta y reinicio completo desde Ajustes.
- Integración con Google Calendar (hábitos sincronizados como serie recurrente), Google Fit y Spotify.
- Recordatorios y avisos push (Web Push) con tarea programada para entornos serverless.
- PWA instalable, páginas legales (privacidad y términos), FAQ y Acerca de.

## 🆕 Cambios recientes

- **Chat más rápido al cambiar de conversación**: la suscripción en vivo se activa antes de pedir el historial, así los mensajes nuevos llegan sin esperar la carga (`useLetter.ts`).
- Se corrigió el bloqueo de la página al cerrar el visor de fotos, el zoom accidental y el cierre del cajón de stickers y juegos.
- Mejoras en la cámara y el grabador de video del chat.
- Los mensajes de voz se reemplazaron por videos de hasta 15 s.
- Se quitó el inicio de sesión con Apple; solo queda Google.
- Seguridad: se eliminó el `db push` público, los orígenes CORS son exactos y se añadieron cabeceras y reportes.
- Cuota de IA resiliente: breaker por proveedor, cupo diario y múltiples llaves.
- Rediseño **Noutlife** (paleta Jade, nuevo logo y splash animado). Ver [docs/redesign](docs/redesign/README.md).
- Limpieza del repositorio: nombre unificado a Noutlife (paquetes `@noutlife/*`, textos, prompts de IA y variables de pruebas `NOUTLIFE_E2E_*`) y se quitaron archivos sin uso.

> Se conservaron a propósito algunos identificadores internos que empiezan por `lifequest` (claves de `localStorage`, URLs de despliegue `lifequest2-*.vercel.app`, bundle id móvil, propiedades privadas de Google Calendar). Renombrarlos cerraría sesiones, rompería eventos ya sincronizados o cambiaría la identidad de la app.

---

## 🛠️ Requisitos previos

- Node.js 20+
- npm 9+
- PostgreSQL 15+

## 🚀 Setup inicial

```bash
git clone https://github.com/pesajezonanorte-hash/lifequest2.git
cd lifequest2
npm install
```

### Variables de entorno

```bash
cp .env.example apps/api/.env
```

Edita `apps/api/.env`. Lo mínimo: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` y `REFRESH_TOKEN_SECRET` (32+ caracteres). Para iniciar sesión necesitas `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`. Para la IA, al menos una llave (`GROQ_API_KEY` es la más generosa). `.env.example` documenta el resto (Web Push, Spotify, Google Calendar y Fit, `CRON_SECRET`).

Frontend, `apps/web/.env`:

```env
VITE_API_URL=http://localhost:3001/api/v1
VITE_APP_NAME=Noutlife
```

### Base de datos

```bash
createdb noutlife
npm run db:migrate
npm run db:seed        # crea la temporada inicial
```

## 🏃 Desarrollo

```bash
npm run dev            # API + web
```

- Web: http://localhost:5173
- API: http://localhost:3001/api/v1
- Prisma Studio: `npm run db:studio`

## 📦 Comandos

```bash
npm run dev            # API + web
npm run build          # shared + API + web
npm run db:migrate     # migraciones (dev)
npm run db:seed        # seed
npm run db:studio      # GUI de la base de datos
npm run test:fixes --workspace=@noutlife/api      # pruebas de auditoría (requiere DATABASE_URL)
npm run test:e2e --workspace=apps/web             # Playwright (requiere NOUTLIFE_E2E_BASE_URL)
```

## 📁 Estructura

```
noutlife/
├── apps/
│   ├── api/       # Express + Prisma (rutas, servicios, jobs, migraciones)
│   ├── web/       # React + Vite + Tailwind + Framer Motion
│   └── mobile/    # Expo / React Native
├── packages/
│   └── shared/    # Tipos TypeScript compartidos (@noutlife/shared)
├── docs/          # Auditorías, QA y diseño
└── package.json   # npm workspaces
```

## 🗺️ Zonas principales

| Ruta | Zona |
|------|------|
| `/` | Castillo (Dashboard) |
| `/quests`, `/habits`, `/goals` | Misiones, hábitos y metas |
| `/gym`, `/food`, `/sleep` | Gimnasio, Comida, Sueño |
| `/finances`, `/learning`, `/journal`, `/love` | Finanzas, Aprendizaje, Diario, Amor |
| `/agenda`, `/rituals`, `/glow-up`, `/wisdom` | Agenda, Rituales, Glow Up, Sabiduría |
| `/social`, `/gallery`, `/leaderboard` | Cartas, galería y ranking |
| `/shop`, `/achievements`, `/stats`, `/season` | Tienda, logros, estadísticas, temporada |
| `/profile`, `/settings`, `/custom-zones` | Perfil, ajustes y zonas propias |

## 🔑 API (v1)

Base: `/api/v1`. Rutas agrupadas por módulo: `auth`, `user`, `quest`, `habit`, `achievement`, `finance`, `workout`, `meal`, `sleep`, `learning`, `journal`, `love`, `agenda`, `sage`, `social`, `network`, `shop`, `stats`, `season`, `notification`, `cron`, `export`. Health check en `/health`.

## 🚢 Despliegue

Web y API en Vercel (`apps/web/vercel.json`, `apps/api/vercel.json`). También hay `render.yaml`, `nixpacks.toml` y `netlify.toml`. Los recordatorios los dispara `.github/workflows/reminders.yml` contra `/api/v1/cron/tick`.
