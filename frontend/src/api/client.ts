import type { Ticket, Sprint, Settings, GroomResult } from '@/types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  listTickets: (status?: string) =>
    request<Ticket[]>(`/api/tickets${status ? `?status=${status}` : ''}`),
  createTicket: (input: string) =>
    request<Ticket>('/api/tickets', {
      method: 'POST',
      body: JSON.stringify({ input }),
    }),
  updateTicket: (id: string, patch: Partial<Ticket>) =>
    request<Ticket>(`/api/tickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),
  deleteTicket: (id: string) =>
    request<void>(`/api/tickets/${id}`, { method: 'DELETE' }),
  groomBacklog: () =>
    request<GroomResult>('/api/tickets/groom', { method: 'POST' }),
  mergeTickets: (keepId: string, deleteId: string) =>
    request<Ticket>('/api/tickets/merge', {
      method: 'POST',
      body: JSON.stringify({ keepId, deleteId }),
    }),
  listSprints: () => request<Sprint[]>('/api/sprints'),
  createSprint: (name: string, duration: 1 | 2) =>
    request<Sprint>('/api/sprints', {
      method: 'POST',
      body: JSON.stringify({ name, duration }),
    }),
  updateSprint: (id: string, patch: Partial<Sprint>) =>
    request<Sprint>(`/api/sprints/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),
  completeSprint: (id: string) =>
    request<void>(`/api/sprints/${id}/complete`, { method: 'POST' }),
  getSettings: () => request<Settings>('/api/settings'),
  updateSettings: (patch: Partial<Settings>) =>
    request<Settings>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),
};
