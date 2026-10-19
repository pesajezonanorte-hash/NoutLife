import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import { sendProLocked } from '../middleware/plan.middleware';
import { getPlan } from '../services/billing.service';
import * as svc from '../services/notebook.service';

const NOT_FOUND = 'No encontramos esa libreta.';

/** ¿Cuenta en NoutLife Lite? Lite tiene límites en la Libreta; Pro no. */
const liteOf = async (req: AuthRequest) => (await getPlan(req.userId!)) === 'lite';

function fail(res: Response, err: unknown, fallback: string): void {
  if (err instanceof svc.NotebookError) {
    if (err.lock) sendProLocked(res, err.lock);
    else res.status(err.status).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: fallback });
}

const pageIndex = (raw: string) => (/^\d{1,3}$/.test(raw) ? Number(raw) : -1);

export async function listNotebooks(req: AuthRequest, res: Response): Promise<void> {
  try { res.json({ notebooks: await svc.listNotebooks(req.userId!) }); }
  catch (err) { fail(res, err, 'No se pudieron cargar tus libretas.'); }
}

export async function createNotebook(req: AuthRequest, res: Response): Promise<void> {
  try { res.status(201).json({ notebook: await svc.createNotebook(req.userId!, req.body, await liteOf(req)) }); }
  catch (err) { fail(res, err, 'No se pudo crear la libreta.'); }
}

export async function updateNotebook(req: AuthRequest, res: Response): Promise<void> {
  try {
    const notebook = await svc.updateNotebook(req.userId!, req.params.id, req.body, await liteOf(req));
    if (!notebook) { res.status(404).json({ error: NOT_FOUND }); return; }
    res.json({ notebook });
  } catch (err) { fail(res, err, 'No se pudo guardar la libreta.'); }
}

export async function deleteNotebook(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!(await svc.deleteNotebook(req.userId!, req.params.id))) { res.status(404).json({ error: NOT_FOUND }); return; }
    res.json({ success: true });
  } catch (err) { fail(res, err, 'No se pudo borrar la libreta.'); }
}

export async function getPage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const page = await svc.getPage(req.userId!, req.params.id, pageIndex(req.params.index));
    if (page === undefined) { res.status(404).json({ error: NOT_FOUND }); return; }
    res.json({ page });
  } catch (err) { fail(res, err, 'No se pudo abrir la página.'); }
}

export async function savePage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const saved = await svc.savePage(req.userId!, req.params.id, pageIndex(req.params.index), req.body, await liteOf(req));
    if (!saved) { res.status(404).json({ error: NOT_FOUND }); return; }
    res.json(saved);
  } catch (err) { fail(res, err, 'No se pudo guardar la página.'); }
}

export async function addImage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const image = await svc.addImage(req.userId!, req.params.id, req.body, await liteOf(req));
    if (!image) { res.status(404).json({ error: NOT_FOUND }); return; }
    res.status(201).json({ image });
  } catch (err) { fail(res, err, 'No se pudo guardar la imagen.'); }
}

export async function getImage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const image = await svc.getImage(req.userId!, req.params.id, req.params.imageId);
    if (!image) { res.status(404).json({ error: 'No encontramos esa imagen.' }); return; }
    // Una imagen nunca cambia (se pega otra con otro id).
    res.set('Cache-Control', 'private, max-age=31536000, immutable');
    res.json({ image });
  } catch (err) { fail(res, err, 'No se pudo cargar la imagen.'); }
}

export async function deleteImage(req: AuthRequest, res: Response): Promise<void> {
  try {
    await svc.deleteImage(req.userId!, req.params.id, req.params.imageId);
    res.json({ success: true });
  } catch (err) { fail(res, err, 'No se pudo quitar la imagen.'); }
}
