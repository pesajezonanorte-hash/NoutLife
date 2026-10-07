import api from '../lib/api';
import type { Relationship, LoveDashboard } from '@noutlife/shared';

export async function fetchLoveDashboard(): Promise<LoveDashboard> {
  const { data } = await api.get<LoveDashboard>('/relationships/dashboard');
  return data;
}

export async function fetchRelationships(): Promise<Relationship[]> {
  const { data } = await api.get<{ relationships: Relationship[] }>('/relationships');
  return data.relationships;
}

export async function createRelationship(body: { name: string; type: string; isPartner?: boolean; notes?: string }): Promise<Relationship> {
  const { data } = await api.post<{ relationship: Relationship }>('/relationships', body);
  return data.relationship;
}

export async function updateRelationship(id: string, body: Record<string, unknown>): Promise<Relationship> {
  const { data } = await api.patch<{ relationship: Relationship }>(`/relationships/${id}`, body);
  return data.relationship;
}

export async function deleteRelationship(id: string): Promise<void> {
  await api.delete(`/relationships/${id}`);
}

export async function addImportantDate(relationshipId: string, body: { label: string; date: string; isRecurring?: boolean; emoji?: string }): Promise<Relationship> {
  const { data } = await api.post<{ relationship: Relationship }>(`/relationships/${relationshipId}/important-dates`, body);
  return data.relationship;
}

export async function deleteImportantDate(relationshipId: string, dateId: string): Promise<Relationship> {
  const { data } = await api.delete<{ relationship: Relationship }>(`/relationships/${relationshipId}/important-dates/${dateId}`);
  return data.relationship;
}
