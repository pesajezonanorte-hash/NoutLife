import { Router } from 'express';
import { inviterPreview } from '../services/referral.service';

// Pública: la portada /i/:username muestra quién invita antes de iniciar sesión.
const router = Router();

router.get('/inviter/:username', async (req, res, next) => {
  try {
    const inviter = await inviterPreview(String(req.params.username));
    if (!inviter) { res.status(404).json({ error: 'No encontramos esa invitación.' }); return; }
    res.json({ inviter });
  } catch (err) { next(err); }
});

export default router;
