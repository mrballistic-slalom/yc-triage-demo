<script setup lang="ts">
import { computed, ref } from 'vue';
import { useSprintStore } from '@/stores/sprints';
import { useBoardStore } from '@/stores/board';
import { STATUS_ORDER, type Ticket, type TicketStatus } from '@/types';
import KanbanColumn from '@/components/KanbanColumn.vue';
import TicketDrawer from '@/components/TicketDrawer.vue';

const sprints = useSprintStore();
const board = useBoardStore();

const dialog = ref(false);
const newName = ref('');
const newDuration = ref<1 | 2>(2);
const selected = ref<Ticket | null>(null);
const adding = ref(false);
const ticketSearch = ref('');

const active = computed(() => sprints.active);

const sprintTickets = computed(() => {
  if (!active.value) return [] as Ticket[];
  const ids = new Set(active.value.ticketIds);
  return board.tickets.filter((t) => ids.has(t.ticketId));
});

const ticketsByStatus = computed(() => {
  const groups: Record<TicketStatus, Ticket[]> = {
    backlog: [],
    in_progress: [],
    in_review: [],
    done: [],
  };
  for (const t of sprintTickets.value) groups[t.status].push(t);
  return groups;
});

const backlogPool = computed(() => {
  if (!active.value) return [] as Ticket[];
  const ids = new Set(active.value.ticketIds);
  const q = ticketSearch.value.trim().toLowerCase();
  return board.tickets
    .filter((t) => t.status === 'backlog' && !ids.has(t.ticketId))
    .filter((t) => !q || t.title.toLowerCase().includes(q));
});

const dateRange = computed(() => {
  if (!active.value) return '';
  const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
  const start = fmt.format(new Date(active.value.start_date));
  const end = fmt.format(new Date(active.value.end_date));
  return `${start} → ${end}`;
});

async function createSprint() {
  if (!newName.value.trim()) return;
  await sprints.create(newName.value.trim(), newDuration.value);
  newName.value = '';
  dialog.value = false;
}

async function complete() {
  if (!active.value) return;
  await sprints.complete(active.value.sprintId);
  await board.load();
}

async function addToSprint(t: Ticket) {
  if (!active.value) return;
  await sprints.update(active.value.sprintId, {
    ticketIds: [...active.value.ticketIds, t.ticketId],
  });
  await board.update(t.ticketId, { sprintId: active.value.sprintId });
}

async function removeFromSprint(t: Ticket) {
  if (!active.value) return;
  await sprints.update(active.value.sprintId, {
    ticketIds: active.value.ticketIds.filter((id) => id !== t.ticketId),
  });
  await board.update(t.ticketId, { sprintId: null });
}

function onColumnChange({ status, tickets }: { status: TicketStatus; tickets: Ticket[] }) {
  tickets.forEach((t, idx) => {
    if (t.status !== status || t.sort_order !== idx) {
      board.move(t.ticketId, status, idx);
    }
  });
}
</script>

<template>
  <main class="page">
    <div class="page-eyebrow rise">/ sprints</div>
    <h1 class="page-title rise rise-1">
      A focused <em>fortnight.</em>
    </h1>
    <p class="page-lede rise rise-2">
      One sprint, one direction. Drag from the backlog, ship to done, complete. Triage estimates
      capacity from your team's recent velocity.
    </p>

    <div v-if="!active" class="empty rise rise-3">
      <div class="empty__title">No sprint in motion.</div>
      <div class="empty__hint">Start one to focus the team for a week or two.</div>
      <button class="btn btn--primary" style="margin-top: 18px;" @click="dialog = true">
        Begin a sprint
      </button>
    </div>

    <div v-else>
      <div class="sprint-hero rise rise-3">
        <div>
          <h2 class="sprint-hero__name">{{ active.name }}</h2>
          <div class="sprint-hero__meta">
            {{ active.duration }}-week sprint · {{ dateRange }} ·
            {{ sprintTickets.length }} tickets
          </div>
        </div>
        <div class="sprint-hero__capacity serif">
          <small>capacity</small>
          {{ Math.max(8, sprintTickets.length * 2) }}<span style="font-size: 24px;">pts</span>
        </div>
        <button class="btn btn--ghost" style="background: rgba(244,241,235,0.08); color: var(--paper); border-color: rgba(244,241,235,0.2);" @click="complete">
          Complete sprint
        </button>
      </div>

      <div class="kanban rise rise-4" style="grid-template-columns: 1fr 3fr; gap: 24px;">
        <aside class="column" style="max-height: calc(100vh - 280px);">
          <header class="column__header">
            <span class="column__title">Backlog · pull in</span>
            <span class="column__count serif">{{ backlogPool.length }}</span>
          </header>
          <input
            v-model="ticketSearch"
            class="input-line"
            placeholder="filter…"
            style="margin-bottom: 8px;"
          />
          <article
            v-for="t in backlogPool"
            :key="t.ticketId"
            class="card"
            @click="adding ? null : addToSprint(t)"
          >
            <div class="card__bar" :class="`is-${t.priority}`"></div>
            <div class="card__id mono">{{ t.priority.toUpperCase() }} · {{ t.type }}</div>
            <h3 class="card__title">{{ t.title }}</h3>
            <div class="card__footer">
              <div class="card__chips">
                <span v-for="l in t.labels.slice(0, 2)" :key="l" class="chip">{{ l }}</span>
              </div>
              <span class="mono" style="font-size: 10px; color: var(--ink-faint); letter-spacing: 0.06em;">
                + add
              </span>
            </div>
          </article>
          <div v-if="backlogPool.length === 0" class="empty" style="padding: 24px 8px;">
            <div class="empty__hint mono" style="font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;">
              backlog clear
            </div>
          </div>
        </aside>

        <div class="kanban" style="grid-template-columns: repeat(4, minmax(0, 1fr));">
          <KanbanColumn
            v-for="status in STATUS_ORDER"
            :key="status"
            :status="status"
            :tickets="ticketsByStatus[status]"
            @open="selected = $event"
            @change="onColumnChange"
          />
        </div>
      </div>

      <div style="margin-top: 18px;">
        <div class="page-eyebrow">In sprint · click to remove</div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
          <span
            v-for="t in sprintTickets"
            :key="t.ticketId"
            class="chip"
            style="cursor: pointer;"
            @click="removeFromSprint(t)"
          >
            {{ t.title.slice(0, 32) }}{{ t.title.length > 32 ? '…' : '' }} ✕
          </span>
        </div>
      </div>
    </div>

    <v-dialog v-model="dialog" max-width="520">
      <div class="groom" style="padding: 28px 32px;">
        <div class="groom__eyebrow">New sprint</div>
        <h2 class="groom__title" style="font-size: 32px;">Name the focus.</h2>
        <input
          v-model="newName"
          class="input-line"
          maxlength="40"
          placeholder="e.g. Mobile checkout polish"
          style="margin: 18px 0 22px; font-size: 18px;"
        />
        <div class="page-eyebrow">Duration</div>
        <div style="display: flex; gap: 10px; margin-bottom: 24px;">
          <button
            class="btn"
            :class="newDuration === 1 ? 'btn--primary' : 'btn--ghost'"
            @click="newDuration = 1"
          >
            1 week
          </button>
          <button
            class="btn"
            :class="newDuration === 2 ? 'btn--primary' : 'btn--ghost'"
            @click="newDuration = 2"
          >
            2 weeks
          </button>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <button class="btn btn--ghost" @click="dialog = false">Cancel</button>
          <button class="btn btn--primary" :disabled="!newName.trim()" @click="createSprint">
            Begin
          </button>
        </div>
      </div>
    </v-dialog>

    <TicketDrawer :ticket="selected" @close="selected = null" />
  </main>
</template>
