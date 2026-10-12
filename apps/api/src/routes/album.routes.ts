import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

const router = Router();
router.use(requireAuth);

const ZONES = ['gym', 'armario', 'espejo', 'cartas'] as const;
type AlbumZone = (typeof ZONES)[number];

interface AlbumItem {
  id: string;
  source: 'progress' | 'clothing' | 'outfit' | 'dm' | 'guild';
  zone: AlbumZone;
  at: string;
  title: string;
  photoUrl: string | null;
  thumb: string | null;
}

const thumbOf = (meta: unknown) => {
  const t = meta && typeof meta === 'object' ? (meta as { thumb?: unknown }).thumb : null;
  return typeof t === 'string' ? t : null;
};

router.get('/', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const requestedZone = req.query.zone === 'espejo' ? 'espejo' : req.query.zone === 'armario' ? 'espejo' : req.query.zone;
    const zone = ZONES.find((z) => z === requestedZone);
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 60);
    const beforeRaw = typeof req.query.before === 'string' ? new Date(req.query.before) : null;
    const before = beforeRaw && !Number.isNaN(beforeRaw.getTime()) ? beforeRaw : null;
    const take = limit + 1;
    const want = (z: AlbumZone) => !zone || zone === z || (zone === 'espejo' && z === 'armario');
    const tasks: Array<Promise<AlbumItem[]>> = [];

    if (want('gym')) {
      tasks.push(prisma.progressPhoto.findMany({
        where: { userId, ...(before && { date: { lt: before } }) },
        select: { id: true, date: true, notes: true },
        orderBy: { date: 'desc' }, take,
      }).then((rows) => rows.map((r): AlbumItem => ({
        id: r.id, source: 'progress', zone: 'gym', at: r.date.toISOString(), title: r.notes || 'Foto de progreso', photoUrl: null, thumb: null,
      }))));
    }

    if (want('armario') || want('espejo')) {
      tasks.push(prisma.clothingItem.findMany({
        where: { userId, photoUrl: { not: null }, ...(before && { createdAt: { lt: before } }) },
        select: { id: true, createdAt: true, name: true },
        orderBy: { createdAt: 'desc' }, take,
      }).then((rows) => rows.map((r): AlbumItem => ({
        id: r.id, source: 'clothing', zone: 'espejo', at: r.createdAt.toISOString(), title: r.name, photoUrl: null, thumb: null,
      }))));
      tasks.push(prisma.outfit.findMany({
        where: { userId, photoUrl: { not: null }, ...(before && { createdAt: { lt: before } }) },
        select: { id: true, createdAt: true, name: true },
        orderBy: { createdAt: 'desc' }, take,
      }).then((rows) => rows.map((r): AlbumItem => ({
        id: r.id, source: 'outfit', zone: 'espejo', at: r.createdAt.toISOString(), title: r.name || 'Conjunto', photoUrl: null, thumb: null,
      }))));
    }

    if (want('cartas')) {
      tasks.push(prisma.directMessage.findMany({
        where: { senderId: userId, photoUrl: { not: null }, deletedAt: null, ...(before && { createdAt: { lt: before } }) },
        select: { id: true, createdAt: true, content: true, meta: true },
        orderBy: { createdAt: 'desc' }, take,
      }).then((rows) => rows.map((r): AlbumItem => ({
        id: r.id, source: 'dm', zone: 'cartas', at: r.createdAt.toISOString(), title: r.content || 'Foto de una carta', photoUrl: null, thumb: thumbOf(r.meta),
      }))));
      tasks.push(prisma.guildMessage.findMany({
        where: { userId, photoUrl: { not: null }, deletedAt: null, ...(before && { createdAt: { lt: before } }) },
        select: { id: true, createdAt: true, content: true, meta: true },
        orderBy: { createdAt: 'desc' }, take,
      }).then((rows) => rows.map((r): AlbumItem => ({
        id: r.id, source: 'guild', zone: 'cartas', at: r.createdAt.toISOString(), title: r.content || 'Foto en un gremio', photoUrl: null, thumb: thumbOf(r.meta),
      }))));
    }

    const all = (await Promise.all(tasks)).flat().sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    const items = all.slice(0, limit);
    const next = all.length > limit ? items[items.length - 1].at : null;
    res.json({ items, next });
  } catch (err) { next(err); }
});

router.get('/photo/:source/:id', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const { source, id } = req.params;
    let photoUrl: string | null | undefined;
    if (source === 'dm') photoUrl = (await prisma.directMessage.findFirst({ where: { id, senderId: userId, deletedAt: null }, select: { photoUrl: true } }))?.photoUrl;
    else if (source === 'guild') photoUrl = (await prisma.guildMessage.findFirst({ where: { id, userId, deletedAt: null }, select: { photoUrl: true } }))?.photoUrl;
    else if (source === 'progress') photoUrl = (await prisma.progressPhoto.findFirst({ where: { id, userId }, select: { photoData: true } }))?.photoData;
    else if (source === 'clothing') photoUrl = (await prisma.clothingItem.findFirst({ where: { id, userId }, select: { photoUrl: true } }))?.photoUrl;
    else if (source === 'outfit') photoUrl = (await prisma.outfit.findFirst({ where: { id, userId }, select: { photoUrl: true } }))?.photoUrl;
    if (!photoUrl) return res.status(404).json({ error: 'not found' });
    res.set('Cache-Control', 'private, max-age=300');
    res.json({ photoUrl });
  } catch (err) { next(err); }
});

export default router;
