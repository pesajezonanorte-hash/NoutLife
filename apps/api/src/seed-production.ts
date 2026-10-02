// Idempotent bootstrap of global catalogs (no player data) for production.
// Runs on every deploy via the `vercel-build` script; safe to re-run.
import { prisma } from './lib/prisma';
import { DEFAULT_ACHIEVEMENTS, DEFAULT_SHOP_ITEMS, ensureDefaultCatalog } from './lib/default-catalog';
import { EXERCISE_CATALOG, ensureExerciseCatalog } from './lib/exercise-catalog';
import { seedWisdomCards } from './services/wisdom.service';

async function seedProduction() {
  await ensureDefaultCatalog(prisma);
  console.log(`Catalog: ${DEFAULT_ACHIEVEMENTS.length} achievements, ${DEFAULT_SHOP_ITEMS.length} shop items ensured`);

  await ensureExerciseCatalog(prisma);
  console.log(`Catalog: ${EXERCISE_CATALOG.length} exercises ensured (total in DB: ${await prisma.exercise.count()})`);

  await seedWisdomCards();
  console.log(`Catalog: ${await prisma.wisdomCard.count()} wisdom cards in DB`);
}

seedProduction()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('Production seed failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
