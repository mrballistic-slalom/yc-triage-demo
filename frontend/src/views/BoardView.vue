<script setup lang="ts">
import { ref } from 'vue';
import { useBoardStore } from '@/stores/board';
import { STATUS_ORDER, type Ticket, type TicketStatus } from '@/types';
import Composer from '@/components/Composer.vue';
import KanbanColumn from '@/components/KanbanColumn.vue';
import TicketDrawer from '@/components/TicketDrawer.vue';
import GroomModal from '@/components/GroomModal.vue';
import DigestStrip from '@/components/DigestStrip.vue';

const board = useBoardStore();
const selected = ref<Ticket | null>(null);

async function onSubmit(input: string) {
  await board.createFromInput(input);
}

function onMove(payload: { ticketId: string; status: TicketStatus; index: number }) {
  board.move(payload.ticketId, payload.status, payload.index);
}
</script>

<template>
  <main class="page">
    <div class="page-eyebrow rise">/ board</div>
    <h1 class="page-title rise rise-1">
      Speak it. <em>It’s filed.</em>
    </h1>
    <p class="page-lede rise rise-2">
      Describe the work in plain language. Triage drafts the title, calibrates priority, picks
      labels, and suggests an assignee — so you can stop grooming and start shipping.
    </p>

    <div class="rise rise-3">
      <DigestStrip />
      <Composer :busy="board.creating" @submit="onSubmit" />
    </div>

    <div class="board-toolbar rise rise-3">
      <div class="board-stats">
        <span><strong>{{ board.tickets.length }}</strong> tickets</span>
        <span><strong>{{ board.backlogCount }}</strong> in backlog</span>
        <span><strong>{{ board.ticketsByStatus.in_progress.length }}</strong> in flight</span>
      </div>
      <button
        class="btn btn--accent"
        :disabled="board.backlogCount < 3 || board.grooming"
        @click="board.runGroom()"
      >
        <span v-if="board.grooming">Grooming…</span>
        <span v-else>↯ Groom backlog</span>
      </button>
    </div>

    <div v-if="board.tickets.length === 0 && !board.loading" class="empty rise rise-4">
      <div class="empty__title">A clean slate.</div>
      <div class="empty__hint">
        Describe your first piece of work above — Triage will structure it.
      </div>
    </div>

    <div v-else class="kanban rise rise-4">
      <KanbanColumn
        v-for="status in STATUS_ORDER"
        :key="status"
        :status="status"
        :tickets="board.ticketsByStatus[status]"
        @open="selected = $event"
        @move="onMove"
      />
    </div>

    <TicketDrawer :ticket="selected" @close="selected = null" />
    <GroomModal @close="board.clearGroom()" />
  </main>
</template>
