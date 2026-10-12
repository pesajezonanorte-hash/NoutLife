import api from '@/lib/api';

export interface ChecklistItem { id: string; checklistId: string; title: string; isDone: boolean; order: number; createdAt: string; updatedAt: string }
export interface Checklist { id: string; userId: string; title: string; description: string | null; category: string; isTemplate: boolean; items: ChecklistItem[]; createdAt: string; updatedAt: string }

export async function listChecklists() {
  const { data } = await api.get<Checklist[]>('/checklists');
  return data;
}
export async function createChecklist(payload: { title: string; description?: string; category: string; isTemplate?: boolean; items?: Array<{ title: string }> }) {
  const { data } = await api.post<Checklist>('/checklists', payload);
  return data;
}
export async function updateChecklist(id: string, payload: Partial<Pick<Checklist, 'title' | 'description' | 'category' | 'isTemplate'>>) {
  const { data } = await api.patch<Checklist>(`/checklists/${id}`, payload);
  return data;
}
export async function deleteChecklist(id: string) { await api.delete(`/checklists/${id}`); }
export async function duplicateChecklist(id: string) {
  const { data } = await api.post<Checklist>(`/checklists/${id}/duplicate`);
  return data;
}
export async function addItem(id: string, title: string) {
  const { data } = await api.post<ChecklistItem>(`/checklists/${id}/items`, { title });
  return data;
}
export async function updateItem(id: string, payload: Partial<Pick<ChecklistItem, 'title' | 'isDone' | 'order'>>) {
  const { data } = await api.patch<ChecklistItem>(`/checklists/items/${id}`, payload);
  return data;
}
export async function deleteItem(id: string) { await api.delete(`/checklists/items/${id}`); }
