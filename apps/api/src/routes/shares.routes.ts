import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import * as shares from '../services/shares.service';

const router = Router();
const userIdOf = (req: AuthRequest) => req.userId!;
const fail = (res: Response, err: unknown) => {
  const code = err instanceof Error ? err.message : '';
  if (code === 'SHARE_NOT_FOUND' || code === 'SHARE_RESOURCE_NOT_FOUND') {
    res.status(404).json({ error: 'El enlace no existe, fue desactivado o el recurso ya no está disponible.' });
    return;
  }
  if (code === 'INVALID_SHARE_OPTIONS' || code === 'INVALID_SHARED_CHANGE') {
    res.status(400).json({ error: 'La solicitud de compartir no es válida.' });
    return;
  }
  if (code === 'SHARE_READ_ONLY') {
    res.status(403).json({ error: 'Este enlace permite ver, pero no editar.' });
    return;
  }
  res.status(500).json({ error: 'No se pudo completar la acción de compartir.' });
};

// Ver y editar es público por enlace; gestionar los permisos del propietario requiere sesión.
router.get('/owner/:resourceType/:resourceId', requireAuth, async (req, res) => {
  try { res.json(await shares.getOwnerShare(userIdOf(req as AuthRequest), req.params.resourceType, req.params.resourceId)); }
  catch (err) { fail(res, err); }
});

router.post('/', requireAuth, async (req, res) => {
  const { resourceType, resourceId, permission = 'VIEW' } = req.body ?? {};
  if (typeof resourceType !== 'string' || typeof resourceId !== 'string' || !resourceId.trim() ||
    !['CHECKLIST', 'GOAL'].includes(resourceType) || !['VIEW', 'EDIT'].includes(permission)) {
    res.status(400).json({ error: 'Elige una lista o meta y permiso de ver o editar.' });
    return;
  }
  try { res.status(201).json(await shares.createShare(userIdOf(req as AuthRequest), resourceType, resourceId, permission)); }
  catch (err) { fail(res, err); }
});

router.delete('/owner/:resourceType/:resourceId', requireAuth, async (req, res) => {
  try { await shares.revokeShare(userIdOf(req as AuthRequest), req.params.resourceType, req.params.resourceId); res.json({ success: true }); }
  catch (err) { fail(res, err); }
});

router.get('/:code', async (req, res) => {
  try { res.json(await shares.resolveShare(req.params.code)); }
  catch (err) { fail(res, err); }
});

router.patch('/:code', async (req, res) => {
  try { res.json(await shares.updateSharedResource(req.params.code, (req as AuthRequest).userId, req.body ?? {})); }
  catch (err) { fail(res, err); }
});

export default router;
