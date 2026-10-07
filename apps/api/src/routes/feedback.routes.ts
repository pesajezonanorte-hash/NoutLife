import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

const router = Router();
router.use(requireAuth);

router.post('/', async (req, res) => {
  try {
    const { kind, message, url } = req.body as { kind?: string; message?: string; url?: string };
    if (!message || typeof message !== 'string' || message.trim().length < 3) {
      res.status(400).json({ error: 'Mensaje requerido (mínimo 3 caracteres).' });
      return;
    }

    // 'report': denuncia de una persona o un mensaje (moderación de contenido).
    const k = kind === 'bug' || kind === 'idea' || kind === 'report' ? kind : 'other';

    await prisma.feedback.create({
      data: {
        userId: (req as AuthRequest).userId!,
        email: (req as AuthRequest).userEmail,
        kind: k,
        message: message.trim().slice(0, 2000),
        url: typeof url === 'string' ? url.slice(0, 500) : undefined,
      },
    });

    res.json({ ok: true });
  } catch (e) {
    console.error('[feedback] save failed:', e);
    res.status(500).json({ error: 'No se pudo guardar el feedback.' });
  }
});

export default router;
