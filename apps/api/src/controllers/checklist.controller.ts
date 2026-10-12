import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import * as svc from '../services/checklist.service';

const STATUS = { NOT_FOUND: 404, FORBIDDEN: 403, BAD_REQUEST: 400 } as const;

/** Envuelve cada acción: errores propios con su estado y mensaje; el resto, 500 genérico. */
function handle(run: (req: AuthRequest) => Promise<unknown>, fallback: string, created = false) {
  return async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const data = await run(req);
      res.status(created ? 201 : 200).json(data ?? { success: true });
    } catch (err) {
      if (err instanceof svc.ChecklistError) { res.status(STATUS[err.code]).json({ error: err.message }); return; }
      res.status(500).json({ error: fallback });
    }
  };
}

const me = (req: AuthRequest) => req.userId!;

export const list = handle(async (req) => ({ checklists: await svc.listChecklists(me(req)) }), 'Error al cargar las listas.');
export const get = handle(async (req) => ({ checklist: await svc.getChecklist(me(req), req.params.id) }), 'Error al cargar la lista.');
export const create = handle(async (req) => ({ checklist: await svc.createChecklist(me(req), req.body) }), 'Error al crear la lista.', true);
export const update = handle(async (req) => ({ checklist: await svc.updateChecklist(me(req), req.params.id, req.body) }), 'Error al guardar la lista.');
export const remove = handle(async (req) => { await svc.deleteChecklist(me(req), req.params.id); }, 'Error al eliminar la lista.');
export const leave = handle(async (req) => { await svc.leaveChecklist(me(req), req.params.id); }, 'Error al salir de la lista.');
export const addItem = handle(async (req) => ({ checklist: await svc.addItem(me(req), req.params.id, req.body.text) }), 'Error al añadir el elemento.', true);
export const updateItem = handle(async (req) => ({ checklist: await svc.updateItem(me(req), req.params.id, req.params.itemId, req.body) }), 'Error al guardar el elemento.');
export const deleteItem = handle(async (req) => ({ checklist: await svc.deleteItem(me(req), req.params.id, req.params.itemId) }), 'Error al borrar el elemento.');
export const reorder = handle(async (req) => ({ checklist: await svc.reorderItems(me(req), req.params.id, req.body.ids) }), 'Error al ordenar la lista.');
export const clearDone = handle(async (req) => ({ checklist: await svc.clearDone(me(req), req.params.id) }), 'Error al limpiar la lista.');
export const shares = handle(async (req) => ({ shares: await svc.listShares(me(req), req.params.id) }), 'Error al cargar los accesos.');
export const shareLink = handle(async (req) => ({ shares: await svc.createShareLink(me(req), req.params.id, req.body.permission) }), 'Error al crear el enlace.', true);
export const shareUser = handle(async (req) => ({ shares: await svc.shareWithUser(me(req), req.params.id, req.body) }), 'Error al compartir la lista.', true);
export const updateShare = handle(async (req) => ({ shares: await svc.updateShare(me(req), req.params.id, req.params.shareId, req.body.permission) }), 'Error al cambiar el permiso.');
export const revokeShare = handle(async (req) => ({ shares: await svc.revokeShare(me(req), req.params.id, req.params.shareId) }), 'Error al quitar el acceso.');
export const previewJoin = handle(async (req) => ({ invite: await svc.previewJoin(me(req), req.params.token) }), 'Error al abrir la invitación.');
export const join = handle(async (req) => ({ checklist: await svc.joinByToken(me(req), req.params.token) }), 'Error al unirte a la lista.');
