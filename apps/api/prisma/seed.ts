import { PrismaClient } from '@prisma/client';
import { DEFAULT_ACHIEVEMENTS, DEFAULT_SHOP_ITEMS, ensureDefaultCatalog } from '../src/lib/default-catalog';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Inicializando base de datos limpia...');

  // ─── Catálogos globales ──────────────────────────────────────────────────────
  await ensureDefaultCatalog(prisma);
  console.log(`✅ ${DEFAULT_ACHIEVEMENTS.length} logros en catálogo (ninguno desbloqueado)`);
  console.log(`✅ ${DEFAULT_SHOP_ITEMS.length} ítems en la tienda`);

  // ─── Catálogo de ejercicios ──────────────────────────────────────────────────
  const exerciseDefs = [
    { name: 'Press de Banca',                muscleGroup: 'Pecho',    equipment: 'Barra' },
    { name: 'Press Inclinado con Mancuernas',muscleGroup: 'Pecho',    equipment: 'Mancuernas' },
    { name: 'Press Declinado',               muscleGroup: 'Pecho',    equipment: 'Barra' },
    { name: 'Aperturas con Mancuernas',      muscleGroup: 'Pecho',    equipment: 'Mancuernas' },
    { name: 'Fondos en Paralelas',           muscleGroup: 'Pecho',    equipment: 'Peso Corporal' },
    { name: 'Flexiones',                     muscleGroup: 'Pecho',    equipment: 'Peso Corporal' },
    { name: 'Dominadas',                     muscleGroup: 'Espalda',  equipment: 'Peso Corporal' },
    { name: 'Remo con Barra',                muscleGroup: 'Espalda',  equipment: 'Barra' },
    { name: 'Remo con Mancuerna',            muscleGroup: 'Espalda',  equipment: 'Mancuernas' },
    { name: 'Jalón al Pecho',                muscleGroup: 'Espalda',  equipment: 'Máquina' },
    { name: 'Peso Muerto',                   muscleGroup: 'Espalda',  equipment: 'Barra' },
    { name: 'Hiperextensiones',              muscleGroup: 'Espalda',  equipment: 'Banco' },
    { name: 'Press Militar',                 muscleGroup: 'Hombros',  equipment: 'Barra' },
    { name: 'Press Arnold',                  muscleGroup: 'Hombros',  equipment: 'Mancuernas' },
    { name: 'Elevaciones Laterales',         muscleGroup: 'Hombros',  equipment: 'Mancuernas' },
    { name: 'Elevaciones Frontales',         muscleGroup: 'Hombros',  equipment: 'Mancuernas' },
    { name: 'Pájaros',                       muscleGroup: 'Hombros',  equipment: 'Mancuernas' },
    { name: 'Curl con Barra',                muscleGroup: 'Bíceps',   equipment: 'Barra' },
    { name: 'Curl con Mancuernas',           muscleGroup: 'Bíceps',   equipment: 'Mancuernas' },
    { name: 'Curl Martillo',                 muscleGroup: 'Bíceps',   equipment: 'Mancuernas' },
    { name: 'Extensión de Tríceps Polea',    muscleGroup: 'Tríceps',  equipment: 'Polea' },
    { name: 'Press Francés',                 muscleGroup: 'Tríceps',  equipment: 'Barra' },
    { name: 'Fondos en Banco',               muscleGroup: 'Tríceps',  equipment: 'Banco' },
    { name: 'Sentadilla',                    muscleGroup: 'Piernas',  equipment: 'Barra' },
    { name: 'Sentadilla Goblet',             muscleGroup: 'Piernas',  equipment: 'Mancuernas' },
    { name: 'Prensa de Piernas',             muscleGroup: 'Piernas',  equipment: 'Máquina' },
    { name: 'Zancadas',                      muscleGroup: 'Piernas',  equipment: 'Mancuernas' },
    { name: 'Extensión de Cuádriceps',       muscleGroup: 'Piernas',  equipment: 'Máquina' },
    { name: 'Curl de Isquiotibiales',        muscleGroup: 'Piernas',  equipment: 'Máquina' },
    { name: 'Peso Muerto Rumano',            muscleGroup: 'Piernas',  equipment: 'Barra' },
    { name: 'Elevación de Gemelos',          muscleGroup: 'Piernas',  equipment: 'Máquina' },
    { name: 'Plancha',                       muscleGroup: 'Core',     equipment: 'Peso Corporal' },
    { name: 'Crunches',                      muscleGroup: 'Core',     equipment: 'Peso Corporal' },
    { name: 'Elevación de Piernas',          muscleGroup: 'Core',     equipment: 'Peso Corporal' },
    { name: 'Russian Twists',                muscleGroup: 'Core',     equipment: 'Peso Corporal' },
    { name: 'Carrera en Cinta',              muscleGroup: 'Cardio',   equipment: 'Máquina' },
    { name: 'Bicicleta Estática',            muscleGroup: 'Cardio',   equipment: 'Máquina' },
    { name: 'Remo Ergómetro',                muscleGroup: 'Cardio',   equipment: 'Máquina' },
    { name: 'Saltar la Cuerda',              muscleGroup: 'Cardio',   equipment: 'Cuerda' },
    { name: 'Burpees',                       muscleGroup: 'Cardio',   equipment: 'Peso Corporal' },
  ];

  for (const ex of exerciseDefs) {
    await prisma.exercise.upsert({
      where: { name: ex.name },
      update: { muscleGroup: ex.muscleGroup, equipment: ex.equipment },
      create: ex,
    });
  }
  console.log(`✅ ${exerciseDefs.length} ejercicios en catálogo`);

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
