# 🏆 Noutlife — Proyecto Completo

> RPG de Vida Real completamente funcional con IA, multijugador, estadísticas espectaculares, app móvil y deploy en producción.

---

## 📜 Resumen del Proyecto

Noutlife convierte tu vida en un RPG real. Cada hábito, misión, entrenamiento, decisión financiera y relación suma XP, sube tu nivel y forja a tu héroe. Construido en 10 fases durante 2025 para **Miguel Ángel Romero Torres**.

**URL de producción:** https://tourmaline-sherbet-90125b.netlify.app/

---

## 🗺️ Las 10 Fases

| Fase | Título | Features principales |
|------|--------|---------------------|
| 1 | Los Cimientos | Auth JWT, perfil de héroe, sistema XP/nivel/stats, onboarding RPG con animaciones |
| 2 | El Sistema de Misiones | CRUD quests (MAIN/SIDE/DAILY/WEEKLY), dificultad, sub-objetivos, XP/gold al completar |
| 3 | El Sistema de Hábitos | Hábitos con rachas, logs diarios, logros, sistema de XP acumulativo |
| 4 | La Economía del Héroe | Finanzas completas, ingresos/gastos, presupuestos, metas financieras, análisis |
| 5 | El Cuerpo del Héroe | Gimnasio v2, nutrición con IA, registro de sueño, peso corporal, fotos de progreso |
| 6 | La Mente del Héroe | Aprendizaje (libros/cursos), diario personal, relaciones, tienda de items, logros épicos |
| 7 | El Mundo Exterior | Social/amigos, gremio, retos PvP, temporadas, integraciones, agenda/calendario |
| 8 | La Inteligencia Artificial | El Sabio (chat con memoria), LifeScore 0-1000, morning briefing, análisis financiero IA |
| 9 | El Glow Up | Metas maestras con milestones, rituales diarios con timer, check-in estado de ánimo, biblioteca de sabiduría, modo enfoque Pomodoro |
| 10 | La Fase Final | Centro de notificaciones, búsqueda global Ctrl+K, exportación JSON/CSV, Error Boundary, página 404, página Acerca de |

---

## ✨ Features Implementadas

### 🎮 Sistema RPG
- Perfil de héroe con nivel, XP, HP/MP, stats (Fuerza, Inteligencia, Carisma, Vitalidad)
- Sistema de XP con level-up overlay animado y efectos de pantalla
- Gold como moneda del juego
- Rachas diarias con contadores
- 40+ logros desbloqueables

### 📜 Misiones & Hábitos
- Quests: MAIN, SIDE, DAILY, WEEKLY con sub-objetivos
- Wizard de creación de misiones en 5 pasos
- Hábitos con rachas, logs y análisis por IA
- Filtros, búsqueda y orden por XP/deadline/dificultad

### 💰 Finanzas
- Transacciones con categorías
- Presupuestos mensuales con alertas
- Metas financieras con progreso
- Dashboard con gráficos de ingresos/gastos
- Análisis financiero con IA del Sabio
- Exportación CSV de transacciones

### 💪 Cuerpo & Salud
- Registro de entrenamientos con ejercicios, series y reps
- Nutrición con parser de alimentos por IA (foto o texto)
- Registro de sueño con análisis de calidad
- Seguimiento de peso corporal y fotos de progreso
- Stats 2.0: rings estilo Apple Watch + heatmaps de actividad

### 🧠 Mente & Crecimiento
- Sistema de aprendizaje (libros, cursos, podcasts, videos)
- Diario personal con entradas y reflexiones
- Relaciones y fechas importantes
- Agenda/calendario con eventos
- Biblioteca de sabiduría desbloqueada por nivel

### 🤖 Inteligencia Artificial (Google Gemini 2.5 Flash Lite)
- El Sabio: chat con memoria de conversaciones e insights
- Análisis de hábitos, finanzas y estado físico
- Sugerencia de misiones personalizadas
- Parser de nutrición por descripción de alimentos
- Morning briefing automático
- Pergaminos del Sabio (notificaciones proactivas)

### 🌐 Social & Multijugador
- Sistema de amigos/gremio
- Retos PvP entre usuarios
- Leaderboard global
- Temporadas con eventos y recompensas

### 🔔 Notificaciones & Búsqueda
- Centro de notificaciones in-app con badge
- Marcar como leída/eliminar/marcar todas
- Búsqueda global con Ctrl+K: misiones, hábitos, finanzas, diario, gym, agenda
- Resultados agrupados por tipo con navegación directa

### 🎨 UI/UX
- 6 temas visuales (Aurora, Cyber, Forest, Ocean, Sunset, Retro SNES)
- Animaciones con Framer Motion (stagger, spring, hover lift)
- PWA instalable con service worker
- Skeleton loaders en todas las vistas
- Error Boundary con UI temática
- Página 404 con navegación de retorno
- Micro-interacciones (whileTap, whileHover)
- Modo Enfoque Pomodoro con sonidos ambientes

---

## ⚙️ Stack Técnico

### Frontend
- **React 18** + TypeScript
- **Vite** (build tool, dev server)
- **Tailwind CSS** (utilidades + variables CSS custom)
- **Framer Motion** (animaciones)
- **Zustand** (estado global: auth, UI)
- **React Router v6** (navegación + lazy loading)
- **Axios** (HTTP client con interceptores JWT)
- **Lucide React** (iconos)

### Backend
- **Node.js** + **Express** + TypeScript
- **Prisma ORM** (schema + queries)
- **PostgreSQL** vía **Supabase** (cloud)
- **JWT** (auth, refresh tokens)
- **Google Gemini 2.5 Flash Lite** (IA)
- **Web Push** + VAPID (notificaciones push)
- **node-cron** (7 jobs automáticos: rachas, briefings, scrolls, XP)

### Infraestructura
- **pnpm workspaces** (monorepo: apps/api + apps/web + packages/shared)
- **Netlify** (deploy frontend)
- **Supabase** (PostgreSQL cloud)
- **Concurrently** (dev server paralelo)

### Base de Datos
- **40+ modelos Prisma** incluyendo: User, Quest, Habit, Transaction, Budget, Workout, Meal, SleepLog, JournalEntry, Achievement, MasterGoal, Ritual, DailyCheckin, WisdomCard, FocusSession, SageMemory, Notification y más.

---

## 🚀 Cómo Correr el Proyecto

### Requisitos
- Node.js 18+
- pnpm 8+
- Cuenta en Supabase (PostgreSQL)
- API Key de Google Gemini

### Variables de entorno

**`apps/api/.env`:**
```env
DATABASE_URL="postgresql://..."
JWT_SECRET="tu-secreto-jwt"
JWT_REFRESH_SECRET="tu-secreto-refresh"
GEMINI_API_KEY="tu-key-de-gemini"
VAPID_PUBLIC_KEY="..."   # opcional para push
VAPID_PRIVATE_KEY="..."  # opcional para push
```

**`apps/web/.env`:**
```env
VITE_API_URL="http://localhost:3001/api/v1"
VITE_VAPID_PUBLIC_KEY="..."  # opcional
```

### Instalación y arranque
```bash
# 1. Instalar dependencias
cd noutlife
pnpm install

# 2. Sincronizar base de datos
cd apps/api
npx prisma db push

# 3. Arrancar en desarrollo (API + Web en paralelo)
cd ../..
pnpm dev
```

- **Frontend:** http://localhost:5173
- **API:** http://localhost:3001/api/v1
- **Health check:** http://localhost:3001/api/v1/health

---

## 🌐 Cómo Desplegar

### Frontend (Netlify)
```bash
# En apps/web
pnpm build

# O configurar Netlify con:
# Build command: pnpm build
# Publish directory: apps/web/dist
# Variables de entorno: VITE_API_URL=https://tu-api.com/api/v1
```

### Backend
El backend puede desplegarse en **Railway**, **Render**, **Fly.io** o cualquier VPS:

```bash
# Variables de entorno necesarias en producción:
DATABASE_URL=...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
GEMINI_API_KEY=...
NODE_ENV=production
PORT=3001

# Comando de inicio:
npx tsx src/server.ts
# o compilar primero:
npx tsc && node dist/server.js
```

### Base de Datos
Supabase gestiona PostgreSQL. Para sincronizar schema:
```bash
cd apps/api
npx prisma db push
```

---

## 📁 Estructura del Proyecto

```
noutlife/
├── apps/
│   ├── api/                    # Backend Express + Prisma
│   │   ├── prisma/
│   │   │   └── schema.prisma   # 40+ modelos
│   │   └── src/
│   │       ├── services/       # Lógica de negocio
│   │       ├── controllers/    # Handlers HTTP
│   │       ├── routes/         # Endpoints REST
│   │       ├── middleware/     # Auth, validación, errores
│   │       ├── jobs/           # Cron jobs (7 activos)
│   │       └── lib/            # Prisma client, JWT, IA
│   └── web/                    # Frontend React
│       └── src/
│           ├── pages/          # 25+ páginas lazy-loaded
│           ├── components/     # UI, layout, animaciones
│           ├── services/       # HTTP calls a la API
│           ├── store/          # Zustand (auth, UI)
│           └── hooks/          # useAuth, useToast, etc.
└── packages/
    └── shared/                 # Tipos TypeScript compartidos
```

---

## 🎉 Cierre

**Noutlife está completo.** 10 fases, cientos de horas de trabajo, un sistema RPG de vida real que convierte cada día en una aventura.

> *"La aventura de Miguel Ángel Romero Torres ha comenzado — y nunca termina."*

**v10.0.0 · 2025** · TypeScript 0 errores · Gemini 2.5 Flash Lite · PostgreSQL Supabase
