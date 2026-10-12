import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import { requireProZone } from '../middleware/plan.middleware';
import { prisma } from '../lib/prisma';
import * as wisdom from '../services/wisdom.service';

const router = Router();
router.use(requireAuth);
// Zona Pro: en NoutLife Lite toda la zona responde 402 (lo guardado se conserva).
router.use(requireProZone('wisdom'));

router.get('/daily', async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: (req as AuthRequest).userId! },
      select: { level: true },
    });
    const card = await wisdom.getDailyCard(user.level);
    res.json(card);
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: (req as AuthRequest).userId! },
      select: { level: true },
    });
    const [available, locked] = await Promise.all([
      wisdom.listAvailableCards(user.level),
      wisdom.listLockedCards(user.level),
    ]);
    res.json({ available, locked, userLevel: user.level });
  } catch (err) { next(err); }
});

export default router;
