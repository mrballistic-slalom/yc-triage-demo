import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '@/api/client';
import {
  PRIORITY_RANK,
  type Ticket,
  type TicketStatus,
  type GroomResult,
} from '@/types';

export const useBoardStore = defineStore('board', () => {
  const tickets = ref<Ticket[]>([]);
  const loading = ref(false);
  const creating = ref(false);
  const grooming = ref(false);
  const groomResult = ref<GroomResult | null>(null);
  const groomError = ref<string | null>(null);
  const lastError = ref<string | null>(null);

  const ticketsByStatus = computed(() => {
    const groups: Record<TicketStatus, Ticket[]> = {
      backlog: [],
      in_progress: [],
      in_review: [],
      done: [],
    };
    for (const t of tickets.value) groups[t.status].push(t);
    groups.backlog.sort((a, b) => {
      const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (pr !== 0) return pr;
      return b.created_at.localeCompare(a.created_at);
    });
    for (const status of ['in_progress', 'in_review', 'done'] as TicketStatus[]) {
      groups[status].sort((a, b) => a.sort_order - b.sort_order);
    }
    return groups;
  });

  const backlogCount = computed(() => ticketsByStatus.value.backlog.length);

  async function load() {
    loading.value = true;
    lastError.value = null;
    try {
      tickets.value = await api.listTickets();
    } catch (err) {
      lastError.value = (err as Error).message;
    } finally {
      loading.value = false;
    }
  }

  async function createFromInput(input: string): Promise<Ticket | null> {
    if (!input.trim()) return null;
    creating.value = true;
    lastError.value = null;
    const start = Date.now();
    try {
      const ticket = await api.createTicket(input.trim());
      const elapsed = Date.now() - start;
      if (elapsed < 500) await new Promise((r) => setTimeout(r, 500 - elapsed));
      tickets.value.push(ticket);
      return ticket;
    } catch (err) {
      lastError.value = (err as Error).message;
      return null;
    } finally {
      creating.value = false;
    }
  }

  async function update(id: string, patch: Partial<Ticket>) {
    const idx = tickets.value.findIndex((t) => t.ticketId === id);
    if (idx === -1) return;
    const prev = tickets.value[idx];
    tickets.value[idx] = { ...prev, ...patch };
    try {
      const updated = await api.updateTicket(id, patch);
      tickets.value[idx] = updated;
    } catch (err) {
      tickets.value[idx] = prev;
      lastError.value = (err as Error).message;
    }
  }

  async function remove(id: string) {
    const prev = tickets.value;
    tickets.value = tickets.value.filter((t) => t.ticketId !== id);
    try {
      await api.deleteTicket(id);
    } catch (err) {
      tickets.value = prev;
      lastError.value = (err as Error).message;
    }
  }

  async function move(id: string, newStatus: TicketStatus, newOrder: number) {
    await update(id, { status: newStatus, sort_order: newOrder });
  }

  async function runGroom() {
    grooming.value = true;
    groomError.value = null;
    groomResult.value = null;
    try {
      groomResult.value = await api.groomBacklog();
    } catch (err) {
      groomError.value = (err as Error).message;
    } finally {
      grooming.value = false;
    }
  }

  async function applyPriority(ticketId: string, newPriority: Ticket['priority']) {
    await update(ticketId, { priority: newPriority });
    dismissPriority(ticketId);
  }

  async function applyMerge(keepId: string, deleteId: string) {
    try {
      const merged = await api.mergeTickets(keepId, deleteId);
      tickets.value = tickets.value.flatMap((t) => {
        if (t.ticketId === deleteId) return [];
        if (t.ticketId === keepId) return [merged];
        return [t];
      });
      dismissDuplicate(keepId, deleteId);
    } catch (err) {
      lastError.value = (err as Error).message;
    }
  }

  function dismissPriority(ticketId: string) {
    if (!groomResult.value) return;
    groomResult.value.priorityChanges = groomResult.value.priorityChanges.filter(
      (p) => p.ticketId !== ticketId,
    );
  }

  function dismissDuplicate(keepId: string, deleteId: string) {
    if (!groomResult.value) return;
    groomResult.value.duplicates = groomResult.value.duplicates.filter(
      (d) => d.keepId !== keepId || d.deleteId !== deleteId,
    );
  }

  function clearGroom() {
    groomResult.value = null;
    groomError.value = null;
  }

  return {
    tickets,
    loading,
    creating,
    grooming,
    groomResult,
    groomError,
    lastError,
    ticketsByStatus,
    backlogCount,
    load,
    createFromInput,
    update,
    remove,
    move,
    runGroom,
    applyPriority,
    applyMerge,
    dismissPriority,
    dismissDuplicate,
    clearGroom,
  };
});
