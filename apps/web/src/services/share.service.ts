import api from '@/lib/api';
import type { Checklist } from '@/services/checklist.service';
import type { MasterGoal } from '@/services/goals.service';

export type ShareResourceType = 'CHECKLIST' | 'GOAL';
export type SharePermission = 'VIEW' | 'EDIT';
export interface ResourceShare {
  id: string;
  resourceType: ShareResourceType;
  resourceId: string;
  code: string;
  permission: SharePermission;
  isActive: boolean;
  updatedAt: string;
}
export type SharedResource =
  | { resourceType: 'CHECKLIST'; permission: SharePermission; resource: Pick<Checklist, 'id' | 'title' | 'description' | 'category' | 'isTemplate' | 'items'> }
  | { resourceType: 'GOAL'; permission: SharePermission; resource: Pick<MasterGoal, 'id' | 'title' | 'description' | 'category' | 'icon' | 'targetDate' | 'why' | 'status' | 'progress' | 'milestones'> };

export async function getOwnerShare(type: ShareResourceType, id: string) {
  const { data } = await api.get<ResourceShare | null>(`/shares/owner/${type}/${id}`);
  return data;
}
export async function createShare(type: ShareResourceType, id: string, permission: SharePermission) {
  const { data } = await api.post<ResourceShare>('/shares', { resourceType: type, resourceId: id, permission });
  return data;
}
export async function revokeShare(type: ShareResourceType, id: string) {
  await api.delete(`/shares/owner/${type}/${id}`);
}
export async function resolveShare(code: string) {
  const { data } = await api.get<SharedResource>(`/shares/${encodeURIComponent(code)}`);
  return data;
}
export async function updateSharedResource(code: string, payload: Record<string, unknown>) {
  const { data } = await api.patch(`/shares/${encodeURIComponent(code)}`, payload);
  return data;
}
export const shareUrl = (code: string) => `${window.location.origin}/shared/${encodeURIComponent(code)}`;
