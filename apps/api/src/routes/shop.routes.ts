import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/shop.controller';

const router = Router();
router.use(requireAuth);

router.get('/items',            ctrl.listShopItems);
router.post('/purchase',        ctrl.purchaseItem);
router.get('/inventory',        ctrl.listInventory);
router.get('/owned',            ctrl.ownedItems);
router.post('/inventory/:id/equip', ctrl.equipItem);
router.post('/inventory/:id/use',   ctrl.useItem);

export default router;
