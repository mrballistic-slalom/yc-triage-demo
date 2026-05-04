import { setActivePinia, createPinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBoardStore } from '@/stores/board';
import type { Ticket } from '@/types';

const ticket = (over: Partial<Ticket> = {}): Ticket => ({
  ticketId: over.ticketId ?? Math.random().toString(36).slice(2),
  title: 'Test',
  description: '',
  priority: 'medium',
  labels: [],
  assignee: null,
  type: 'task',
  status: 'backlog',
  sprintId: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  sort_order: 0,
  ...over,
});

vi.mock('@/api/client', () => ({
  api: {
    listTickets: vi.fn(async () => []),
    createTicket: vi.fn(async (input: string) =>
      ticket({ title: input, ticketId: 'new-1' }),
    ),
    updateTicket: vi.fn(async (id: string, patch: Partial<Ticket>) => ticket({ ticketId: id, ...patch })),
    deleteTicket: vi.fn(async () => undefined),
    groomBacklog: vi.fn(async () => ({ duplicates: [], priorityChanges: [], groups: [] })),
    mergeTickets: vi.fn(async (id: string) => ticket({ ticketId: id })),
  },
}));

describe('board store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('groups tickets by status and sorts backlog by priority', () => {
    const store = useBoardStore();
    store.tickets = [
      ticket({ priority: 'low', status: 'backlog', created_at: '2025-01-01' }),
      ticket({ priority: 'critical', status: 'backlog', created_at: '2025-01-02' }),
      ticket({ priority: 'medium', status: 'in_progress' }),
    ];
    expect(store.ticketsByStatus.backlog[0].priority).toBe('critical');
    expect(store.ticketsByStatus.in_progress).toHaveLength(1);
  });

  it('creates a ticket from input', async () => {
    const store = useBoardStore();
    const result = await store.createFromInput('  fix the thing  ');
    expect(result?.title).toBe('fix the thing');
    expect(store.tickets).toHaveLength(1);
  });

  it('ignores empty input', async () => {
    const store = useBoardStore();
    const result = await store.createFromInput('   ');
    expect(result).toBeNull();
    expect(store.creating).toBe(false);
  });

  it('rolls back optimistic update on failure', async () => {
    const { api } = await import('@/api/client');
    const store = useBoardStore();
    const t = ticket({ ticketId: 't1', priority: 'medium' });
    store.tickets = [t];
    (api.updateTicket as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
    await store.update('t1', { priority: 'critical' });
    expect(store.tickets[0].priority).toBe('medium');
    expect(store.lastError).toBe('boom');
  });
});
