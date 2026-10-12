import { Router, type Response } from 'express';
import { optionalAuth, requireAuth, type AuthRequest } from '../middleware/auth.middleware';
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
  if (code === 'SHARE_USER_NOT_FOUND' || code === 'SHARE_MEMBER_NOT_FOUND') {
    res.status(404).json({ error: code === 'SHARE_USER_NOT_FOUND' ? 'No encontramos a nadie con ese usuario o ID.' : 'Esa persona ya no tiene acceso.' });
    return;
  }
  if (code === 'SHARE_SELF') {
    res.status(400).json({ error: 'Ya eres el dueño de esta lista.' });
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

// Invitar por @usuario o ID, quitar invitados y ver lo que te compartieron.
router.get('/with-me', requireAuth, async (req, res) => {
  try { res.json(await shares.listSharedWithMe(userIdOf(req as AuthRequest))); }
  catch (err) { fail(res, err); }
});

router.post('/members', requireAuth, async (req, res) => {
  const { resourceType, resourceId, user, permission = 'VIEW' } = req.body ?? {};
  if (typeof resourceType !== 'string' || typeof resourceId !== 'string' || typeof user !== 'string' || !user.trim() || user.length > 80 ||
    !['CHECKLIST', 'GOAL'].includes(resourceType) || !['VIEW', 'EDIT'].includes(permission)) {
    res.status(400).json({ error: 'Indica la lista o meta, el usuario o ID y el permiso.' });
    return;
  }
  try { res.status(201).json(await shares.addShareMember(userIdOf(req as AuthRequest), resourceType, resourceId, user, permission)); }
  catch (err) { fail(res, err); }
});

router.delete('/members/:memberId', requireAuth, async (req, res) => {
  try { await shares.removeShareMember(userIdOf(req as AuthRequest), req.params.memberId); res.json({ success: true }); }
  catch (err) { fail(res, err); }
});

router.get('/:code', optionalAuth, async (req, res) => {
  try { res.json(await shares.resolveShare(req.params.code, (req as AuthRequest).userId)); }
  catch (err) { fail(res, err); }
});

router.patch('/:code', optionalAuth, async (req, res) => {
  try { res.json(await shares.updateSharedResource(req.params.code, (req as AuthRequest).userId, req.body ?? {})); }
  catch (err) { fail(res, err); }
});

export default router;
