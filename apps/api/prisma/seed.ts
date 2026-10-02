import { PrismaClient } from '@prisma/client';
import { DEFAULT_ACHIEVEMENTS, DEFAULT_SHOP_ITEMS, ensureDefaultCatalog } from '../src/lib/default-catalog';
import { EXERCISE_CATALOG, ensureExerciseCatalog } from '../src/lib/exercise-catalog';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Inicializando base de datos limpia...');

  // ─── Catálogos globales ──────────────────────────────────────────────────────
  await ensureDefaultCatalog(prisma);
  console.log(`✅ ${DEFAULT_ACHIEVEMENTS.length} logros en catálogo (ninguno desbloqueado)`);
  console.log(`✅ ${DEFAULT_SHOP_ITEMS.length} ítems en la tienda`);

  // ─── Catálogo de ejercicios ──────────────────────────────────────────────────
  await ensureExerciseCatalog(prisma);
  console.log(`✅ ${EXERCISE_CATALOG.length} ejercicios en catálogo`);

  // ─── Temporada inicial ───────────────────────────────────────────────────────
  const now = new Date();
  const seasonEnd = new Date(now);
  seasonEnd.setMonth(seasonEnd.getMonth() + 1);

  await prisma.season.upsert({
    where: { id: 'season_iron' },
    update: { bossHp: 1_000_000, currentHp: 1_000_000 },
    create: {
      id: 'season_iron',
      name: 'La Temporada del Hierro',
      description: 'Primera temporada global. Todos contra un enemigo épico.',
      bossName: 'Rey del Hierro',
      bossHp: 1_000_000,
      currentHp: 1_000_000,
      startDate: now,
      endDate: seasonEnd,
    },
  });

  console.log('✅ Temporada "La Temporada del Hierro" lista (1M HP)');

  console.log('\n🎉 Base de datos limpia e inicializada correctamente!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('❌ Error en seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
