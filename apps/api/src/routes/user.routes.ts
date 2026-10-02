import { publicErrorMessage } from '../middleware/error.middleware';
import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { avatarSchema, onboardingSchema } from '../schemas/quest.schemas';
import { updateProfileSchema } from '../schemas/activity.schemas';
import * as userController from '../controllers/user.controller';
import { chooseClass, setTheme, setBedtimeGoal } from '../services/user.service';

const router = Router();

router.use(requireAuth);

router.get('/me/character', userController.getCharacter);
router.put('/me/avatar', validate(avatarSchema), userController.updateAvatar);
router.put('/me/onboarding', validate(onboardingSchema), userController.completeOnboarding);
router.patch('/me/profile', validate(updateProfileSchema), userController.updateProfile);
router.post('/me/equip', userController.equipItem);
router.post('/me/guide/complete', userController.completeGuideDay);
router.post('/me/guide/dismiss', userController.dismissGuide);

router.post('/me/class', async (req: AuthRequest, res) => {
  try { res.json(await chooseClass(req.userId!, req.body.playerClass)); }
  catch (err: any) { res.status(400).json({ message: publicErrorMessage(err) }); }
});

router.patch('/me/theme', async (req: AuthRequest, res) => {
  try { res.json(await setTheme(req.userId!, req.body.theme)); }
  catch (err: any) { res.status(400).json({ message: publicErrorMessage(err) }); }
});

router.patch('/me/bedtime-goal', async (req: AuthRequest, res) => {
  try { res.json(await setBedtimeGoal(req.userId!, req.body.bedtimeGoal ?? null)); }
  catch (err: any) { res.status(400).json({ message: publicErrorMessage(err) }); }
});

export default router;
