import { settleLevel } from '../services/xp.service';
import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

const router = Router();
router.use(requireAuth);

// ─── Care Routines ─────────────────────────────────────────────────────────────

router.get('/routines', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const routines = await prisma.careRoutine.findMany({
      where: { userId, isActive: true },
      include: { steps: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(routines);
  } catch (err) { next(err); }
});

router.post('/routines', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const { name, timeOfDay, steps = [] } = req.body;
    if (!name || !timeOfDay) return res.status(400).json({ error: 'name and timeOfDay required' });
    const routine = await prisma.careRoutine.create({
      data: {
        userId, name, timeOfDay,
        steps: {
          create: steps.map((s: { name: string; product?: string }, i: number) => ({
            name: s.name, product: s.product, order: i,
          })),
        },
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    res.status(201).json(routine);
  } catch (err) { next(err); }
});

router.patch('/routines/:id', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const { name, timeOfDay, isActive, steps } = req.body;
    const routine = await prisma.careRoutine.update({
      where: { id: req.params.id, userId },
      data: {
        ...(name && { name }),
        ...(timeOfDay && { timeOfDay }),
        ...(isActive !== undefined && { isActive }),
        ...(steps && {
          steps: {
            deleteMany: {},
            create: steps.map((s: { name: string; product?: string }, i: number) => ({
              name: s.name, product: s.product, order: i,
            })),
          },
        }),
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    res.json(routine);
  } catch (err) { next(err); }
});

router.delete('/routines/:id', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId!;
    await prisma.careRoutine.update({ where: { id: req.params.id, userId }, data: { isActive: false } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/routines/:id/complete', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await prisma.careLog.findFirst({
      where: { routineId: req.params.id, userId, date: today },
    });
    if (existing) return res.json({ alreadyDone: true });

    const [, routine] = await prisma.$transaction([
      prisma.careLog.create({ data: { userId, routineId: req.params.id, date: today } }),
      prisma.careRoutine.update({
        where: { id: req.params.id },
        data: { lastDoneAt: new Date(), currentStreak: { increment: 1 } },
      }),
    ]);

    await prisma.xpEvent.create({
      data: {
        userId, xpAmount: 20, goldAmount: 5,
        source: 'care_routine', sourceId: req.params.id,
        description: `Rutina completada: ${routine.name}`,
      },
    });
    await prisma.user.update({ where: { id: userId }, data: { xp: { increment: 20 }, gold: { increment: 5 } } });
    await settleLevel(userId);

    res.json({ success: true, routine });
  } catch (err) { next(err); }
});

// ─── Style / Wardrobe ─────────────────────────────────────────────────────────

router.get('/wardrobe', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const items = await prisma.clothingItem.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    res.json(items);
  } catch (err) { next(err); }
});

router.post('/wardrobe', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const { name, category, color, brand, cost } = req.body;
    if (!name || !category) return res.status(400).json({ error: 'name and category required' });
    const item = await prisma.clothingItem.create({ data: { userId, name, category, color, brand, cost } });
    res.status(201).json(item);
  } catch (err) { next(err); }
});

router.patch('/wardrobe/:id', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const item = await prisma.clothingItem.update({
      where: { id: req.params.id, userId },
      data: req.body,
    });
    res.json(item);
  } catch (err) { next(err); }
});

router.delete('/wardrobe/:id', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId!;
    await prisma.clothingItem.delete({ where: { id: req.params.id, userId } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/wardrobe/:id/worn', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const item = await prisma.clothingItem.update({
      where: { id: req.params.id, userId },
      data: { timesWorn: { increment: 1 }, lastWornAt: new Date() },
    });
    res.json(item);
  } catch (err) { next(err); }
});

// ─── Style / Outfits ──────────────────────────────────────────────────────────

router.get('/outfits', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const outfits = await prisma.outfit.findMany({
      where: { userId },
      include: { items: { include: { clothingItem: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(outfits);
  } catch (err) { next(err); }
});

router.post('/outfits', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const { name, itemIds = [], occasion, rating } = req.body;
    const outfit = await prisma.outfit.create({
      data: {
        userId, name, occasion, rating,
        items: { create: (itemIds as string[]).map(id => ({ clothingItemId: id })) },
      },
      include: { items: { include: { clothingItem: true } } },
    });
    res.status(201).json(outfit);
  } catch (err) { next(err); }
});

router.delete('/outfits/:id', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId!;
    await prisma.outfit.delete({ where: { id: req.params.id, userId } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Style / Wishlist ─────────────────────────────────────────────────────────

router.get('/wishlist', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const items = await prisma.styleWishlist.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    res.json(items);
  } catch (err) { next(err); }
});

router.post('/wishlist', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const { name, category, estimatedCost, priority, url } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const item = await prisma.styleWishlist.create({ data: { userId, name, category, estimatedCost, priority, url } });
    res.status(201).json(item);
  } catch (err) { next(err); }
});

router.patch('/wishlist/:id', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const item = await prisma.styleWishlist.update({ where: { id: req.params.id, userId }, data: req.body });
    res.json(item);
  } catch (err) { next(err); }
});

router.delete('/wishlist/:id', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId!;
    await prisma.styleWishlist.delete({ where: { id: req.params.id, userId } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Presence ─────────────────────────────────────────────────────────────────

router.get('/checkins', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const checkins = await prisma.presenceCheckin.findMany({
      where: { userId },
      orderBy: { week: 'desc' },
      take: 12,
    });
    res.json(checkins);
  } catch (err) { next(err); }
});

router.post('/checkins', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const { week, posture, voice, confidence, communication, notes } = req.body;
    if (!week || posture == null || voice == null || confidence == null || communication == null) {
      return res.status(400).json({ error: 'All fields required' });
    }
    const checkin = await prisma.presenceCheckin.upsert({
      where: { userId_week: { userId, week: new Date(week) } },
      create: { userId, week: new Date(week), posture, voice, confidence, communication, notes },
      update: { posture, voice, confidence, communication, notes },
    });
    res.json(checkin);
  } catch (err) { next(err); }
});

router.get('/stats', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const checkins = await prisma.presenceCheckin.findMany({
      where: { userId },
      orderBy: { week: 'asc' },
      take: 12,
    });
    const latest = checkins[checkins.length - 1];
    const avg = latest
      ? Math.round((latest.posture + latest.voice + latest.confidence + latest.communication) / 4 * 20)
      : 0;
    res.json({ checkins, latestScore: avg });
  } catch (err) { next(err); }
});

export default router;
