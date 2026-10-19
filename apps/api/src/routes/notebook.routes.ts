import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createNotebookSchema, notebookImageSchema, pageContentSchema, updateNotebookSchema } from '../schemas/notebook.schemas';
import * as ctrl from '../controllers/notebook.controller';

// Libreta: abierta en todos los planes.
const router = Router();
router.use(requireAuth);

router.get('/',                          ctrl.listNotebooks);
router.post('/',                         validate(createNotebookSchema), ctrl.createNotebook);
router.patch('/:id',                     validate(updateNotebookSchema), ctrl.updateNotebook);
router.delete('/:id',                    ctrl.deleteNotebook);
router.get('/:id/pages/:index',          ctrl.getPage);
router.put('/:id/pages/:index',          validate(pageContentSchema), ctrl.savePage);
router.post('/:id/images',               validate(notebookImageSchema), ctrl.addImage);
router.get('/:id/images/:imageId',       ctrl.getImage);
router.delete('/:id/images/:imageId',    ctrl.deleteImage);

export default router;
