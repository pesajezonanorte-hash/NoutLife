import api from '../lib/api';

export type ChecklistRole = 'OWNER' | 'EDIT' | 'VIEW';
export type SharePermission = 'VIEW' | 'EDIT';

export interface ChecklistPerson { id: string; username: string; displayName: string; avatarUrl: string | null }
export interface ChecklistItem { id: string; text: string; done: boolean; position: number }
export interface Checklist {
  id: string;
  name: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  role: ChecklistRole;
  owner: ChecklistPerson;
  memberCount: number;
  items: ChecklistItem[];
}
export interface ChecklistShares {
  links: { id: string; token: string; permission: SharePermission; createdAt: string }[];
  members: { id: string; permission: SharePermission; user: ChecklistPerson }[];
}
export interface ChecklistInvite {
  checklistId: string;
  name: string;
  category: string;
  owner: ChecklistPerson;
  itemCount: number;
  permission: SharePermission;
  alreadyMember: boolean;
}

export async function fetchChecklists(): Promise<Checklist[]> {
  const { data } = await api.get<{ checklists: Checklist[] }>('/checklists');
  return data.checklists;
}

export async function createChecklist(body: { name: string; category: string; items?: string[] }): Promise<Checklist> {
  const { data } = await api.post<{ checklist: Checklist }>('/checklists', body);
  return data.checklist;
}

export async function updateChecklist(id: string, body: { name?: string; category?: string }): Promise<Checklist> {
  const { data } = await api.patch<{ checklist: Checklist }>(`/checklists/${id}`, body);
  return data.checklist;
}

export async function deleteChecklist(id: string): Promise<void> {
  await api.delete(`/checklists/${id}`);
}

export async function leaveChecklist(id: string): Promise<void> {
  await api.post(`/checklists/${id}/leave`);
}

export async function addItem(id: string, text: string): Promise<Checklist> {
  const { data } = await api.post<{ checklist: Checklist }>(`/checklists/${id}/items`, { text });
  return data.checklist;
}

export async function updateItem(id: string, itemId: string, body: { text?: string; done?: boolean }): Promise<Checklist> {
  const { data } = await api.patch<{ checklist: Checklist }>(`/checklists/${id}/items/${itemId}`, body);
  return data.checklist;
}

export async function deleteItem(id: string, itemId: string): Promise<Checklist> {
  const { data } = await api.delete<{ checklist: Checklist }>(`/checklists/${id}/items/${itemId}`);
  return data.checklist;
}

export async function clearDone(id: string): Promise<Checklist> {
  const { data } = await api.post<{ checklist: Checklist }>(`/checklists/${id}/clear-done`);
  return data.checklist;
}

export async function fetchShares(id: string): Promise<ChecklistShares> {
  const { data } = await api.get<{ shares: ChecklistShares }>(`/checklists/${id}/shares`);
  return data.shares;
}

export async function createShareLink(id: string, permission: SharePermission): Promise<ChecklistShares> {
  const { data } = await api.post<{ shares: ChecklistShares }>(`/checklists/${id}/shares/link`, { permission });
  return data.shares;
}

export async function shareWithUser(id: string, user: string, permission: SharePermission): Promise<ChecklistShares> {
  const { data } = await api.post<{ shares: ChecklistShares }>(`/checklists/${id}/shares/user`, { user, permission });
  return data.shares;
}

export async function updateShare(id: string, shareId: string, permission: SharePermission): Promise<ChecklistShares> {
  const { data } = await api.patch<{ shares: ChecklistShares }>(`/checklists/${id}/shares/${shareId}`, { permission });
  return data.shares;
}

export async function revokeShare(id: string, shareId: string): Promise<ChecklistShares> {
  const { data } = await api.delete<{ shares: ChecklistShares }>(`/checklists/${id}/shares/${shareId}`);
  return data.shares;
}

export async function previewInvite(token: string): Promise<ChecklistInvite> {
  const { data } = await api.get<{ invite: ChecklistInvite }>(`/checklists/join/${encodeURIComponent(token)}`);
  return data.invite;
}

export async function joinChecklist(token: string): Promise<Checklist> {
  const { data } = await api.post<{ checklist: Checklist }>(`/checklists/join/${encodeURIComponent(token)}`);
  return data.checklist;
}

/** Mensaje de error de la API (o uno genérico). */
export function checklistError(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: string; details?: { message: string }[] } } }).response?.data;
  return data?.details?.[0]?.message ?? data?.error ?? fallback;
}
