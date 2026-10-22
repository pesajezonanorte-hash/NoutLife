import { Router, type Request, type Response } from 'express';
import { runReminderTick } from '../services/reminder.service';
import { runBillingTick } from '../services/billing.service';
import { checkCronSecret, givenCronSecret } from '../lib/cron-auth';

// Disparador externo de los recordatorios: GitHub Actions cada 15 min, cron-job.org o el
// cron diario de Vercel. Protegido con CRON_SECRET: «Authorization: Bearer <secreto>» (lo
// que envían GitHub Actions y Vercel Cron) o «?key=<secreto>» para servicios que solo dan
// una URL. Cada recordatorio tiene una ventana de 30 min y una clave por día, así que un
// disparo cada 5 a 15 min lo entrega una sola vez; el cron diario de Vercel solo sirve de red.
const router = Router();

if (!process.env.CRON_SECRET) {
  console.warn('[CRON] CRON_SECRET no está configurado: /api/v1/cron/tick responde 503 y los recordatorios no salen con la app cerrada.');
}

async function tick(req: Request, res: Response) {
  const auth = checkCronSecret(process.env.CRON_SECRET, givenCronSecret(req.headers.authorization, req.query.key));
  if (auth === 'missing-secret') {
    console.warn('[CRON] Disparo rechazado: falta CRON_SECRET en el servidor.');
    res.status(503).json({ error: 'CRON_SECRET no está configurado en el servidor.' });
    return;
  }
  if (auth === 'unauthorized') {
    res.status(401).json({ error: 'No autorizado.' });
    return;
  }
  try {
    const result = await runReminderTick();
    // Suscripciones: cobra o pasa a Lite las vencidas. Un fallo aquí no frena los recordatorios.
    const billing = await runBillingTick().catch((err) => {
      console.error('[CRON_BILLING_ERROR]', err);
      return { billingError: true };
    });
    res.json({ ok: true, ...result, ...billing });
  } catch (err) {
    console.error('[CRON_TICK_ERROR]', err);
    res.status(500).json({ ok: false, error: 'No se pudo completar la pasada de recordatorios.' });
  }
}

router.get('/tick', tick);
router.post('/tick', tick);

export default router;
