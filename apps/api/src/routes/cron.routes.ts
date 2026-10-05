import { Router, type Request, type Response } from 'express';
import { runReminderTick } from '../services/reminder.service';

// Disparador externo de los recordatorios (cron-job.org, GitHub Actions o Vercel
// Cron). Protegido con CRON_SECRET: «Authorization: Bearer <secreto>» (lo que
// envía Vercel Cron) o «?key=<secreto>» para servicios que solo dan una URL.
const router = Router();

async function tick(req: Request, res: Response) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const given = header || (typeof req.query.key === 'string' ? req.query.key : undefined);
  if (!secret || given !== secret) {
    res.status(401).json({ error: 'No autorizado.' });
    return;
  }
  const result = await runReminderTick();
  res.json({ ok: true, ...result });
}

router.get('/tick', tick);
router.post('/tick', tick);

export default router;
