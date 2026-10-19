import api from '../lib/api';
import { Lru } from '../lib/lru';

export type NotebookCategory = 'personal' | 'trabajo' | 'ideas' | 'proyectos' | 'estudio';
export type NotebookColor = 'jade' | 'ambar' | 'oceano' | 'coral' | 'bosque' | 'oro';
export type NotebookPaper = 'ruled' | 'grid' | 'dots' | 'plain';

export interface Notebook {
  id: string;
  title: string;
  category: NotebookCategory;
  color: NotebookColor;
  paper: NotebookPaper;
  pageCount: number;
  /** Páginas con algo escrito, dibujado o pegado. */
  usedPages: number;
  createdAt: string;
  updatedAt: string;
}

/** Coordenadas en unidades de página: 1000 de ancho × 1414 de alto (A5). */
export interface Stroke { t: 'pen' | 'marker' | 'eraser'; c: string; w: number; p: number[] }
export type StickyColor = 'yellow' | 'pink' | 'blue' | 'green' | 'orange';
export interface Sticky { id: string; x: number; y: number; text: string; color: StickyColor; rot: number }
export interface PageImage { id: string; x: number; y: number; w: number; ratio: number }
export interface PageContent { html: string; strokes: Stroke[]; stickies: Sticky[]; images: PageImage[] }

export type NotebookInput = Pick<Notebook, 'title' | 'category' | 'color' | 'paper' | 'pageCount'>;

export async function listNotebooks(): Promise<Notebook[]> {
  const { data } = await api.get<{ notebooks: Notebook[] }>('/notebooks');
  return data.notebooks;
}

export async function createNotebook(body: NotebookInput): Promise<Notebook> {
  const { data } = await api.post<{ notebook: Notebook }>('/notebooks', body);
  return data.notebook;
}

export async function updateNotebook(id: string, body: Partial<NotebookInput>): Promise<Notebook> {
  const { data } = await api.patch<{ notebook: Notebook }>(`/notebooks/${id}`, body);
  return data.notebook;
}

export async function deleteNotebook(id: string): Promise<void> {
  await api.delete(`/notebooks/${id}`);
}

/** null: página en blanco. `updatedAt`: versión del servidor (para no pisar cambios de otro dispositivo). */
export async function fetchPage(id: string, index: number): Promise<{ content: PageContent; updatedAt: string } | null> {
  const { data } = await api.get<{ page: { content: PageContent; updatedAt: string } | null }>(`/notebooks/${id}/pages/${index}`);
  return data.page ?? null;
}

/** Devuelve la versión nueva del servidor (updatedAt), o null si la página quedó en blanco. */
export async function savePage(id: string, index: number, content: PageContent): Promise<string | null> {
  const { data } = await api.put<{ page: { updatedAt: string } | null }>(`/notebooks/${id}/pages/${index}`, content);
  return data.page?.updatedAt ?? null;
}

export async function uploadImage(id: string, body: { mime: string; data: string }): Promise<string> {
  const { data } = await api.post<{ image: { id: string } }>(`/notebooks/${id}/images`, body);
  return data.image.id;
}

// Una imagen pegada no cambia nunca: se pide una vez y queda en memoria (con tope).
const images = new Lru<string>(40);
const inflight = new Map<string, Promise<string>>();

export function imageUrl(id: string, imageId: string): Promise<string> {
  const hit = images.get(imageId);
  if (hit) return Promise.resolve(hit);
  let p = inflight.get(imageId);
  if (!p) {
    p = api.get<{ image: { mime: string; data: string } }>(`/notebooks/${id}/images/${imageId}`)
      .then(({ data }) => { const url = `data:${data.image.mime};base64,${data.image.data}`; images.set(imageId, url); return url; })
      .finally(() => inflight.delete(imageId));
    inflight.set(imageId, p);
  }
  return p;
}

/** Lo que se acaba de subir ya está en el dispositivo: no se vuelve a pedir. */
export function primeImage(imageId: string, url: string) { images.set(imageId, url); }

export async function deleteImage(id: string, imageId: string): Promise<void> {
  await api.delete(`/notebooks/${id}/images/${imageId}`);
}
