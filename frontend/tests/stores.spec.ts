import { setActivePinia, createPinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/stores/settings';
import { useSprintStore } from '@/stores/sprints';
import { useBoardStore } from '@/stores/board';
import { useAiStore } from '@/stores/ai';
import type { Settings, Sprint, Ticket } from '@/types';

const ticket = (over: Partial<Ticket> = {}): Ticket => ({
  ticketId: over.ticketId ?? 't' + Math.random().toString(36).slice(2),
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

const fakeSettings: Settings = { projectName: 'Triage', teamMembers: [], labels: [] };

vi.mock('@/api/client', () => ({
  api: {
    listTickets: vi.fn(async () => [] as Ticket[]),
    createTicket: vi.fn(async (input: string) => ticket({ title: input })),
    updateTicket: vi.fn(async (id: string, patch: Partial<Ticket>) => ticket({ ticketId: id, ...patch })),
    deleteTicket: vi.fn(async () => undefined),
    groomBacklog: vi.fn(async () => ({ duplicates: [], priorityChanges: [], groups: [] })),
    mergeTickets: vi.fn(async (id: string) => ticket({ ticketId: id, title: 'merged' })),
    listSprints: vi.fn(async () => [] as Sprint[]),
    createSprint: vi.fn(async (name: string, duration: 1 | 2) => ({
      sprintId: 'sp1',
      name,
      duration,
      start_date: '2025-01-01',
      end_date: '2025-01-15',
      status: 'active',
      created_at: '2025-01-01',
      ticketIds: [],
    } as Sprint)),
    updateSprint: vi.fn(async (id: string, patch: Partial<Sprint>) => ({
      sprintId: id,
      name: 'Sprint',
      duration: 2,
      start_date: '2025-01-01',
      end_date: '2025-01-15',
      status: 'active',
      created_at: '2025-01-01',
      ticketIds: [],
      ...patch,
    } as Sprint)),
    completeSprint: vi.fn(async () => undefined),
    getSettings: vi.fn(async () => fakeSettings),
    updateSettings: vi.fn(async (patch: Partial<Settings>) => ({ ...fakeSettings, ...patch })),
    ask: vi.fn(async (q: string) => ({ answer: `answer to: ${q}` })),
    digest: vi.fn(async () => ({ digest: 'pulse' })),
    risk: vi.fn(async () => ({ level: 'medium' as const, summary: 'watch closely' })),
    aiEdit: vi.fn(async (id: string, instruction: string) => ({
      ticket: ticket({ ticketId: id }),
      patch: { priority: 'high' as const, instruction } as unknown as Partial<Ticket>,
    })),
  },
}));

describe('settings store', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('loads settings from the api', async () => {
    const store = useSettingsStore();
    await store.load();
    expect(store.settings.projectName).toBe('Triage');
  });

  it('saves a patch optimistically', async () => {
    const store = useSettingsStore();
    await store.save({ projectName: 'Atlas' });
    expect(store.settings.projectName).toBe('Atlas');
  });

  it('captures errors on load', async () => {
    const { api } = await import('@/api/client');
    (api.getSettings as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('nope'));
    const store = useSettingsStore();
    await store.load();
    expect(store.error).toBe('nope');
  });
});

describe('sprint store', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('creates and tracks an active sprint', async () => {
    const store = useSprintStore();
    await store.load();
    const created = await store.create('Focus', 2);
    expect(store.active?.sprintId).toBe(created.sprintId);
  });

  it('completes a sprint', async () => {
    const store = useSprintStore();
    await store.create('Focus', 1);
    const sprintId = store.sprints[0].sprintId;
    await store.complete(sprintId);
    expect(store.sprints[0].status).toBe('completed');
  });

  it('updates a sprint', async () => {
    const store = useSprintStore();
    const created = await store.create('Focus', 1);
    const updated = await store.update(created.sprintId, { ticketIds: ['t1'] });
    expect(updated.ticketIds).toEqual(['t1']);
  });
});

describe('board store edges', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('runs grooming and clears it', async () => {
    const store = useBoardStore();
    await store.runGroom();
    expect(store.groomResult).not.toBeNull();
    store.clearGroom();
    expect(store.groomResult).toBeNull();
  });

  it('dismisses a priority change', async () => {
    const store = useBoardStore();
    store.groomResult = {
      duplicates: [],
      priorityChanges: [{ ticketId: 't1', newPriority: 'high', rationale: 'x' }],
      groups: [],
    };
    store.dismissPriority('t1');
    expect(store.groomResult.priorityChanges).toHaveLength(0);
  });

  it('removes a ticket optimistically and rolls back on failure', async () => {
    const { api } = await import('@/api/client');
    const store = useBoardStore();
    store.tickets = [ticket({ ticketId: 't1' })];
    (api.deleteTicket as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
    await store.remove('t1');
    expect(store.tickets).toHaveLength(1);
  });

  it('moves a ticket between columns', async () => {
    const store = useBoardStore();
    store.tickets = [ticket({ ticketId: 't1', status: 'backlog', sort_order: 0 })];
    await store.move('t1', 'in_progress', 5);
    expect(store.tickets[0].status).toBe('in_progress');
    expect(store.tickets[0].sort_order).toBe(5);
  });

  it('applies a priority change', async () => {
    const store = useBoardStore();
    store.tickets = [ticket({ ticketId: 't1', priority: 'medium' })];
    store.groomResult = {
      duplicates: [],
      priorityChanges: [{ ticketId: 't1', newPriority: 'critical', rationale: 'x' }],
      groups: [],
    };
    await store.applyPriority('t1', 'critical');
    expect(store.tickets[0].priority).toBe('critical');
    expect(store.groomResult.priorityChanges).toHaveLength(0);
  });

  it('applies a merge', async () => {
    const store = useBoardStore();
    store.tickets = [ticket({ ticketId: 'keep' }), ticket({ ticketId: 'drop' })];
    store.groomResult = {
      duplicates: [{ keepId: 'keep', deleteId: 'drop', rationale: 'dup' }],
      priorityChanges: [],
      groups: [],
    };
    await store.applyMerge('keep', 'drop');
    expect(store.tickets.find((t) => t.ticketId === 'drop')).toBeUndefined();
    expect(store.groomResult.duplicates).toHaveLength(0);
  });

  it('dismisses a duplicate', () => {
    const store = useBoardStore();
    store.groomResult = {
      duplicates: [{ keepId: 'a', deleteId: 'b', rationale: 'x' }],
      priorityChanges: [],
      groups: [],
    };
    store.dismissDuplicate('a', 'b');
    expect(store.groomResult.duplicates).toHaveLength(0);
  });
});

describe('ai store', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('opens and closes the ask panel', () => {
    const store = useAiStore();
    store.openAsk();
    expect(store.askOpen).toBe(true);
    store.closeAsk();
    expect(store.askOpen).toBe(false);
  });

  it('records a successful exchange', async () => {
    const store = useAiStore();
    await store.ask('what is at risk?');
    expect(store.exchanges).toHaveLength(1);
    expect(store.exchanges[0].pending).toBe(false);
    expect(store.exchanges[0].answer).toContain('what is at risk');
  });

  it('records an error on failure', async () => {
    const { api } = await import('@/api/client');
    (api.ask as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
    const store = useAiStore();
    await store.ask('q');
    expect(store.exchanges[0].error).toBe('boom');
  });

  it('caches digest unless forced', async () => {
    const { api } = await import('@/api/client');
    const store = useAiStore();
    await store.loadDigest();
    expect(store.digest).toBe('pulse');
    const calls = (api.digest as ReturnType<typeof vi.fn>).mock.calls.length;
    await store.loadDigest();
    expect((api.digest as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls);
    await store.loadDigest(true);
    expect((api.digest as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls + 1);
  });

  it('loads risk and clears exchanges', async () => {
    const store = useAiStore();
    await store.loadRisk();
    expect(store.risk?.level).toBe('medium');
    await store.ask('x');
    store.clearExchanges();
    expect(store.exchanges).toHaveLength(0);
  });
});
