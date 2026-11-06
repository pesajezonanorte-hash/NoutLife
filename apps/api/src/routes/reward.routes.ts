import { Router, type NextFunction, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { buildLimiter, clientIp } from '../middleware/rate-limit.middleware';
import { claimRewardSchema } from '../schemas/reward-link.schemas';
import { RewardLinkError, claimRewardLink, previewRewardLink } from '../services/reward-link.service';

// Enlaces de recompensa: /claim?token=… en la web. La portada es pública (antes de iniciar sesión);
// canjear exige sesión. Los tokens son imposibles de adivinar; el límite solo frena el ruido.
const router = Router();

const previewLimiter = buildLimiter({ windowMs: 60_000, max: 30, key: (r) => `reward:${clientIp(r)}` });
const claimLimiter = buildLimiter({ windowMs: 60_000, max: 10, key: (r) => `reward-claim:${(r as AuthRequest).userId ?? clientIp(r)}` });

const rewardError = (res: Response, next: NextFunction) => (err: unknown) => {
  if (err instanceof RewardLinkError) { res.status(err.status).json({ error: err.message, code: err.code }); return; }
  next(err);
};

router.post('/claim', requireAuth, claimLimiter, validate(claimRewardSchema), (req: AuthRequest, res, next) => {
  claimRewardLink(req.userId!, req.body.token).then((result) => res.json(result), rewardError(res, next));
});

router.get('/:token', previewLimiter, (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  previewRewardLink(String(req.params.token)).then((preview) => res.json(preview), next);
});

export default router;
