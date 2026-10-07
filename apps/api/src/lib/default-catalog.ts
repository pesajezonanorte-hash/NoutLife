import type { PrismaClient } from '@prisma/client';

/**
 * Global content that must exist independently of any one player account.
 *
 * It deliberately lives outside prisma/seed.ts so a fresh production database
 * can recover its player-facing catalog on the first API request. Account
 * resets only erase a player's inventory/unlocks; they never erase these rows.
 */
export const DEFAULT_ACHIEVEMENTS = [
  { key: 'first_login', title: '¡El Héroe Despierta!', description: 'Iniciaste sesión por primera vez', icon: '🌅', category: 'special', xpReward: 50, progressType: null, progressTarget: null },
  { key: 'first_quest', title: 'Primera Sangre', description: 'Completaste tu primera misión', icon: '🗡️', category: 'quest', xpReward: 50, progressType: 'quest_count', progressTarget: 1 },
  { key: 'quests_10', title: 'Guerrero Novato', description: 'Completaste 10 misiones', icon: '⚔️', category: 'quest', xpReward: 100, progressType: 'quest_count', progressTarget: 10 },
  { key: 'quests_50', title: 'Veterano del Campo', description: 'Completaste 50 misiones', icon: '🛡️', category: 'quest', xpReward: 300, progressType: 'quest_count', progressTarget: 50 },
  { key: 'quests_100', title: 'Maestro de Misiones', description: 'Completaste 100 misiones', icon: '🏆', category: 'quest', xpReward: 500, progressType: 'quest_count', progressTarget: 100 },
  { key: 'quests_500', title: 'Leyenda', description: 'Completaste 500 misiones', icon: '👑', category: 'quest', xpReward: 2000, progressType: 'quest_count', progressTarget: 500 },
  { key: 'streak_7', title: 'Semana de Fuego', description: '7 días seguidos completando un hábito', icon: '🔥', category: 'habit', xpReward: 100, progressType: 'habit_streak', progressTarget: 7 },
  { key: 'streak_30', title: 'Mes Estelar', description: '30 días seguidos en un hábito', icon: '🌟', category: 'habit', xpReward: 300, progressType: 'habit_streak', progressTarget: 30 },
  { key: 'streak_100', title: 'Diamante Inquebrantable', description: '100 días seguidos en un hábito', icon: '💎', category: 'habit', xpReward: 1000, progressType: 'habit_streak', progressTarget: 100 },
  { key: 'habits_5', title: 'Hombre de Costumbres', description: 'Creaste 5 hábitos activos', icon: '📋', category: 'habit', xpReward: 75, progressType: 'habit_count', progressTarget: 5 },
  { key: 'level_5', title: 'Aventurero', description: 'Alcanzaste el nivel 5', icon: '⭐', category: 'level', xpReward: 200, progressType: 'level', progressTarget: 5 },
  { key: 'level_10', title: 'Guerrero Templado', description: 'Alcanzaste el nivel 10', icon: '🌠', category: 'level', xpReward: 300, progressType: 'level', progressTarget: 10 },
  { key: 'level_25', title: 'Héroe Legendario', description: 'Alcanzaste el nivel 25', icon: '💫', category: 'level', xpReward: 750, progressType: 'level', progressTarget: 25 },
  { key: 'level_50', title: 'Semidiós', description: 'Alcanzaste el nivel 50', icon: '⚡', category: 'level', xpReward: 1500, progressType: 'level', progressTarget: 50 },
  { key: 'level_100', title: 'Ascendido', description: 'Alcanzaste el nivel 100', icon: '🌌', category: 'level', xpReward: 5000, progressType: 'level', progressTarget: 100 },
  { key: 'fitness_25', title: 'Brazos de Hierro', description: 'Completa 25 misiones de Fitness', icon: '💪', category: 'category', xpReward: 200, progressType: 'category_quest_count', progressTarget: 25 },
  { key: 'learning_10', title: 'Erudito', description: 'Completa 10 misiones de Aprendizaje', icon: '🧠', category: 'category', xpReward: 150, progressType: 'category_quest_count', progressTarget: 10 },
  { key: 'finance_goal', title: 'Millonario en Camino', description: 'Completa tu primera meta financiera', icon: '💰', category: 'category', xpReward: 300, progressType: null, progressTarget: null },
  { key: 'love_10', title: 'Romántico Empedernido', description: 'Completa 10 misiones de Amor', icon: '💖', category: 'category', xpReward: 150, progressType: 'category_quest_count', progressTarget: 10 },
  { key: 'health_20', title: 'Cuerpo Templo', description: 'Completa 20 misiones de Salud', icon: '🌿', category: 'category', xpReward: 200, progressType: 'category_quest_count', progressTarget: 20 },
  { key: 'early_bird', title: 'Madrugador', description: 'Completa una misión antes de las 7am', icon: '🌅', category: 'special', xpReward: 75, progressType: null, progressTarget: null },
  { key: 'night_owl', title: 'Búho Nocturno', description: 'Completa una misión después de las 11pm', icon: '🦉', category: 'special', xpReward: 75, progressType: null, progressTarget: null },
  { key: 'birthday', title: 'Cumpleaños en Noutlife', description: 'Completaste una misión en tu cumpleaños', icon: '🎂', category: 'special', xpReward: 200, progressType: null, progressTarget: null },
  { key: 'login_30', title: 'Centinela', description: 'Login 30 días seguidos', icon: '📅', category: 'special', xpReward: 300, progressType: 'login_streak', progressTarget: 30 },
  { key: 'first_habit', title: 'Primer Hábito', description: 'Creaste tu primer hábito', icon: '✨', category: 'habit', xpReward: 50, progressType: null, progressTarget: null },
  { key: 'perfect_week', title: 'Semana Perfecta', description: 'Completaste todos tus hábitos diarios en una semana', icon: '🌈', category: 'habit', xpReward: 250, progressType: null, progressTarget: null },
  { key: 'social_butterfly', title: 'Mariposa Social', description: 'Completa 10 misiones de tipo Social', icon: '🦋', category: 'category', xpReward: 150, progressType: 'category_quest_count', progressTarget: 10 },
  { key: 'creative_mind', title: 'Mente Creativa', description: 'Completa 10 misiones de tipo Creativo', icon: '🎨', category: 'category', xpReward: 150, progressType: 'category_quest_count', progressTarget: 10 },
  { key: 'epic_quest', title: 'Épico entre los Épicos', description: 'Completa tu primera misión ÉPICA', icon: '⚡', category: 'quest', xpReward: 500, progressType: null, progressTarget: null },
  { key: 'first_workout', title: 'Bautizo de Hierro', description: 'Completaste tu primer entrenamiento en el Coliseo', icon: '🏋️', category: 'gym', xpReward: 50, progressType: 'workout_count', progressTarget: 1 },
  { key: 'workouts_10', title: 'Gladiador', description: 'Completaste 10 entrenamientos', icon: '🛡️', category: 'gym', xpReward: 150, progressType: 'workout_count', progressTarget: 10 },
  { key: 'workouts_50', title: 'Campeón del Coliseo', description: 'Completaste 50 entrenamientos', icon: '🏆', category: 'gym', xpReward: 400, progressType: 'workout_count', progressTarget: 50 },
  { key: 'speed_run', title: 'Velocista', description: 'Completa 5 misiones en un solo día', icon: '💨', category: 'special', xpReward: 200, progressType: null, progressTarget: null },
] as const;

export const DEFAULT_SHOP_ITEMS = [
  // Para el personaje: se ven tal como son y se ponen al comprarlos (slot + value).
  { name: 'Sombrero de Aventurero', description: 'Ala ancha y cinta de cuero: listo para la próxima expedición.', type: 'HAT', cost: 200, imageKey: 'hat_adventurer', levelRequired: 1, slot: 'extra', value: 'sombrero_aventurero' },
  { name: 'Capa del Guerrero', description: 'Una capa que ondea a tu espalda, con broche dorado.', type: 'COSMETIC', cost: 500, imageKey: 'cape_warrior', levelRequired: 5, slot: 'extra', value: 'capa' },
  { name: 'Mascota: Dragón Pixel', description: 'Un pequeño dragón que no se separa de ti.', type: 'COSMETIC', cost: 1000, imageKey: 'pet_dragon', levelRequired: 10, slot: 'extra', value: 'dragoncito' },
  { name: 'Escudo Dorado', description: 'Un escudo con filo de oro que llevas al costado.', type: 'COSMETIC', cost: 750, imageKey: 'shield_gold', levelRequired: 5, slot: 'extra', value: 'escudo' },
  { name: 'Multiplicador de XP x2', description: 'Duplica tu XP por 24 horas', type: 'POWERUP', cost: 300, imageKey: 'xp_booster', levelRequired: 1 },
  { name: 'Imán de Gold', description: '+50% gold por 24 horas', type: 'POWERUP', cost: 250, imageKey: 'gold_magnet', levelRequired: 3 },
  { name: 'Poción de Energía', description: 'Recupera 50 HP al instante', type: 'POWERUP', cost: 100, imageKey: 'potion_energy', levelRequired: 1 },
  { name: 'Escudo Anti-Racha', description: 'Protege tu racha 3 días seguidos', type: 'POWERUP', cost: 500, imageKey: 'streak_shield', levelRequired: 5 },
  { name: 'Pase de Perdón', description: 'No pierdes racha si fallas un día', type: 'PASS', cost: 150, imageKey: 'streak_pass', levelRequired: 1 },
  { name: 'Pase VIP (7 días)', description: 'Desbloquea funciones premium por 7 días', type: 'PASS', cost: 800, imageKey: 'vip_pass', levelRequired: 1 },
  { name: 'Gorra del Ninja', description: 'Una banda negra con las puntas al viento. Para los héroes discretos.', type: 'HAT', cost: 350, imageKey: 'hat_ninja', levelRequired: 1, slot: 'extra', value: 'bandana_ninja' },
  { name: 'Corona del Campeón', description: 'Oro, rubí y dos esmeraldas para quien llega lejos.', type: 'HAT', cost: 900, imageKey: 'hat_crown', levelRequired: 10, slot: 'extra', value: 'corona_campeon' },
  { name: 'Birrete del Sabio', description: 'La sabiduría tiene su recompensa (y su borla).', type: 'HAT', cost: 600, imageKey: 'hat_scholar', levelRequired: 7, slot: 'extra', value: 'birrete' },
  { name: 'Sombrero de Mago', description: 'Puntiagudo, con estrellas y todo lo bueno.', type: 'HAT', cost: 450, imageKey: 'hat_wizard', levelRequired: 4, slot: 'extra', value: 'sombrero_mago' },
  { name: 'Casco Vikingo', description: 'Hierro, cuernos y nada de miedo.', type: 'HAT', cost: 550, imageKey: 'hat_viking', levelRequired: 5, slot: 'extra', value: 'casco_vikingo' },
  { name: 'Antifaz del Bandido', description: 'Nadie sabrá quién completó todos esos hábitos.', type: 'COSMETIC', cost: 300, imageKey: 'mask_bandit', levelRequired: 2, slot: 'extra', value: 'antifaz' },
  { name: 'Monóculo Distinguido', description: 'Con su cadenita dorada. Muy de biblioteca.', type: 'COSMETIC', cost: 400, imageKey: 'monocle', levelRequired: 4, slot: 'extra', value: 'monoculo' },
  { name: 'Armadura de Caballero', description: 'Placas de acero y cinturón dorado.', type: 'OUTFIT', cost: 800, imageKey: 'outfit_armor', levelRequired: 6, slot: 'top', value: 'armadura' },
  { name: 'Kimono de Seda', description: 'Mangas amplias y un obi del color de tus accesorios.', type: 'OUTFIT', cost: 600, imageKey: 'outfit_kimono', levelRequired: 3, slot: 'top', value: 'kimono' },
  { name: 'Traje de Gala', description: 'Chaqueta, camisa blanca y corbata roja.', type: 'OUTFIT', cost: 650, imageKey: 'outfit_suit', levelRequired: 4, slot: 'top', value: 'traje' },
  { name: 'Peinado Samurái', description: 'Laterales rapados y el moño en lo alto.', type: 'HAIR', cost: 450, imageKey: 'hair_samurai', levelRequired: 3, slot: 'hair', value: 'samurai' },
  { name: 'Rizos Salvajes', description: 'Rizos con volumen que no se dejan peinar.', type: 'HAIR', cost: 400, imageKey: 'hair_curls', levelRequired: 2, slot: 'hair', value: 'rizos' },
  { name: 'Marco Dorado', description: 'Un marco épico color oro que brilla', type: 'FRAME', cost: 500, imageKey: 'frame_gold', levelRequired: 1, slot: 'frame', value: 'frame_gold' },
  { name: 'Marco de Diamante', description: 'Solo para leyendas', type: 'FRAME', cost: 1500, imageKey: 'frame_diamond', levelRequired: 20, slot: 'frame', value: 'frame_diamond' },
  { name: 'Marco de Fuego', description: 'Llamas que rodean tu avatar', type: 'FRAME', cost: 700, imageKey: 'frame_fire', levelRequired: 8, slot: 'frame', value: 'frame_fire' },
  { name: 'Marco Cósmico', description: 'El universo a tu alrededor', type: 'FRAME', cost: 1200, imageKey: 'frame_cosmic', levelRequired: 15, slot: 'frame', value: 'frame_cosmic' },
  { name: 'Aura de Fuego', description: 'Una llama que nunca se apaga', type: 'AURA', cost: 600, imageKey: 'aura_fire', levelRequired: 5, slot: 'aura', value: 'aura_fire' },
  { name: 'Aura de Hielo', description: 'Frío como el acero, duro como el diamante', type: 'AURA', cost: 600, imageKey: 'aura_ice', levelRequired: 5, slot: 'aura', value: 'aura_ice' },
  { name: 'Aura Dorada', description: 'El brillo del campeón', type: 'AURA', cost: 1000, imageKey: 'aura_gold', levelRequired: 10, slot: 'aura', value: 'aura_gold' },
  { name: 'Aura de Tormenta', description: 'El poder del rayo', type: 'AURA', cost: 800, imageKey: 'aura_storm', levelRequired: 8, slot: 'aura', value: 'aura_storm' },
  { name: 'Aura Arcoíris', description: 'Todos los colores, toda la vida', type: 'AURA', cost: 1200, imageKey: 'aura_rainbow', levelRequired: 12, slot: 'aura', value: 'aura_rainbow' },
  // Exclusivos: unidades limitadas para toda la comunidad.
  { name: 'Corona de Cristal', description: 'Tallada en cristal de cueva. Solo existen 25.', type: 'HAT', cost: 2500, imageKey: 'hat_crystal', levelRequired: 8, slot: 'extra', value: 'corona_cristal', isLimited: true, stock: 25 },
  { name: 'Alas de Hada', description: 'Translúcidas y brillantes. Solo existen 40.', type: 'COSMETIC', cost: 3000, imageKey: 'wings_fairy', levelRequired: 10, slot: 'extra', value: 'alas', isLimited: true, stock: 40 },
  { name: 'Aura de Cometa', description: 'Una estela que te sigue a todas partes. Solo existen 50.', type: 'AURA', cost: 2800, imageKey: 'aura_comet', levelRequired: 10, slot: 'aura', value: 'aura_comet', isLimited: true, stock: 50 },
  { name: 'Tema: Aurora Boreal', description: 'Verde y morado, el tema por defecto', type: 'THEME', cost: 0, imageKey: 'theme_aurora', levelRequired: 1, slot: 'theme', value: 'theme_aurora' },
  { name: 'Tema: Océano Profundo', description: 'Azules y cyan, calma del mar', type: 'THEME', cost: 400, imageKey: 'theme_ocean', levelRequired: 1, slot: 'theme', value: 'theme_ocean' },
  { name: 'Tema: Lava Volcánica', description: 'Rojos y naranja, puro fuego', type: 'THEME', cost: 500, imageKey: 'theme_lava', levelRequired: 3, slot: 'theme', value: 'theme_lava' },
  { name: 'Tema: Bosque Oscuro', description: 'Verdes oscuros, naturaleza salvaje', type: 'THEME', cost: 500, imageKey: 'theme_forest', levelRequired: 3, slot: 'theme', value: 'theme_forest' },
  { name: 'Tema: Ciudad Neón', description: 'Cyberpunk. Rosa y cyan brillante.', type: 'THEME', cost: 700, imageKey: 'theme_neon', levelRequired: 6, slot: 'theme', value: 'theme_neon' },
  { name: 'Tema: Galaxia', description: 'Morado cósmico, estrellas infinitas', type: 'THEME', cost: 800, imageKey: 'theme_galaxy', levelRequired: 8, slot: 'theme', value: 'theme_galaxy' },
] as const;

type CatalogClient = Pick<PrismaClient, 'achievement' | 'shopItem'>;

/** Idempotently restores missing global rows without touching player-owned data. */
export async function ensureDefaultCatalog(client: CatalogClient): Promise<void> {
  const existingShopItems = await client.shopItem.findMany({ select: { name: true } });
  const existingNames = new Set(existingShopItems.map((item) => item.name));

  await Promise.all(DEFAULT_ACHIEVEMENTS.map((achievement) => client.achievement.upsert({
    where: { key: achievement.key },
    update: {},
    create: achievement,
  })));

  const missingShopItems = DEFAULT_SHOP_ITEMS.filter((item) => !existingNames.has(item.name));
  if (missingShopItems.length > 0) {
    await Promise.all(missingShopItems.map((item) => client.shopItem.create({ data: item })));
  }

  // Los artículos que ya existían aprenden qué parte del personaje cambian (y su tipo,
  // descripción y unidades si son exclusivos). El precio y el nivel no se tocan.
  const known = await client.shopItem.findMany({ select: { id: true, name: true, slot: true, value: true, type: true, description: true, stock: true } });
  await Promise.all(DEFAULT_SHOP_ITEMS.map((item) => {
    const row = known.find((k) => k.name === item.name);
    const slot = 'slot' in item ? item.slot : null;
    const value = 'value' in item ? item.value : null;
    const stock = 'stock' in item ? item.stock : null;
    if (!row || (row.slot === slot && row.value === value && row.type === item.type && row.description === item.description && row.stock === stock)) return null;
    return client.shopItem.update({ where: { id: row.id }, data: { slot, value, type: item.type, description: item.description, stock, isLimited: stock !== null } });
  }));

}
