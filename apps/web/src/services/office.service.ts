// Oficina de la Libreta: documentos, hojas de cálculo y presentaciones, y su copiloto (IA, solo Pro).
import api from '../lib/api';
import type { Locale } from '../lib/i18n';

export type OfficeKind = 'doc' | 'sheet' | 'slides';
export type SlideLayout = 'title' | 'bullets' | 'quote' | 'number';
export type SlideTheme = 'jade' | 'ink' | 'paper';
export type ChartType = 'bar' | 'line' | 'pie';

export interface DocContent { html: string }
export interface SheetContent { rows: number; cols: number; cells: Record<string, string>; chart?: { type: ChartType; range: string } | null }
export interface Slide { id: string; layout: SlideLayout; title: string; body: string; notes?: string }
export interface SlidesContent { theme: SlideTheme; slides: Slide[] }
export type OfficeContent = DocContent | SheetContent | SlidesContent;

export interface OfficeMeta { id: string; kind: OfficeKind; title: string; createdAt: string; updatedAt: string }
export interface OfficeFile extends OfficeMeta { content: OfficeContent }

export type CopilotAction = 'write' | 'improve' | 'summarize' | 'analyze' | 'slides';
export interface CopilotResult { text?: string; slides?: Array<Pick<Slide, 'layout' | 'title' | 'body'>> }

export const listFiles = () => api.get<{ files: OfficeMeta[] }>('/office').then((r) => r.data.files);
export const createFile = (kind: OfficeKind, title: string, content?: OfficeContent) => api.post<{ file: OfficeFile }>('/office', { kind, title, content }).then((r) => r.data.file);
export const getFile = (id: string) => api.get<{ file: OfficeFile }>(`/office/${id}`).then((r) => r.data.file);
export const saveFile = (id: string, body: { title?: string; content?: OfficeContent }) => api.put<{ file: OfficeMeta }>(`/office/${id}`, body).then((r) => r.data.file);
export const deleteFile = (id: string) => api.delete(`/office/${id}`).then(() => undefined);

export const copilot = (body: { action: CopilotAction; prompt?: string; context?: string; locale: Locale }) =>
  api.post<CopilotResult>('/office/ai', body).then((r) => r.data);

export const officeMessage = (err: unknown, fallback: string): string =>
  (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
