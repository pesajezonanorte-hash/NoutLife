---
name: Noutlife project
description: Estado de Noutlife RPG en `LIFE GAME-handoff\lifequest\` — Fase 2 completa, sistemas de quest/XP/onboarding/personaje activos
type: project
---

Fase 1 completa (auth, DB, seed). Fase 2 completa.

**Stack:** React 18 + Vite + Tailwind (web) / Express + Prisma + Postgres Supabase (api) / monorepo npm workspaces

**Supabase:** `iimmhaxvhofplswcxlsh` pooler 6543 (queries) / 5432 (migrations)

**Seed usuario prueba:** miguel@lifequest.com / test1234 — Nivel 3, racha 7 días, onboardingCompleted: true

**Fase 2 — Lo que se construyó:**

Backend nuevo:
- `src/services/xp.service.ts` — awardXpAndGold con stat increases por categoría + XpEvent logging
- `src/services/quest.service.ts` — CRUD quests + completeQuest retorna rewards/leveledUp/statIncreases
- `src/services/user.service.ts` — character, avatar update, onboarding, equip
- `src/services/dashboard.service.ts` — getDashboard (todo en 1), getTodayQuests
- Rutas: /quests, /users/me/*, /dashboard, /dashboard/today-quests
- Schema: User +onboardingCompleted/birthDate/currentStreak/longestStreak/lastActivityDate + modelo XpEvent
- Migración: 20260511233445_fase_2_progression

Frontend nuevo:
- `src/lib/xp.ts` — fórmulas XP
- `src/services/quest.service.ts` + `user.service.ts`
- `src/store/uiStore.ts` — LevelUpData ahora incluye statIncreases
- `src/components/animations/LevelUpOverlay.tsx` — overlay épico multi-fase con partículas y stats
- `src/pages/Onboarding/index.tsx` — 5 pasos con progress, persist en localStorage
- `src/components/onboarding/` — WelcomeStep, IdentityStep, AvatarStep, GoalsStep, FirstQuestStep, FinalCelebrationStep, ColorPicker, OnboardingProgress
- `src/pages/Character/index.tsx` — ficha del héroe 3 columnas
- `src/components/character/StatBlock.tsx`, `AvatarCustomizer.tsx`
- `src/components/dashboard/` — GreetingHeader, TodayQuestsWidget (funcional con completeQuest), QuickStatsWidget, ZoneCard
- `src/pages/Dashboard/index.tsx` — enriquecido con fetchDashboard real
- `src/App.tsx` — rutas /onboarding y /character, lógica de redirect si onboarding incompleto

**Why:** Fase 2 del RPG real de Miguel Ángel Romero Torres
**How to apply:** Próxima fase es Fase 3 — zonas individuales (gym, finanzas, sueño, comida, etc.)
