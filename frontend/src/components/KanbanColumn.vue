<script setup lang="ts">
import draggable from 'vuedraggable';
import { ref, watch } from 'vue';
import { STATUS_LABELS, type Ticket, type TicketStatus } from '@/types';
import TicketCard from './TicketCard.vue';

const props = defineProps<{
  status: TicketStatus;
  tickets: Ticket[];
}>();

const emit = defineEmits<{
  (e: 'open', ticket: Ticket): void;
  (
    e: 'move',
    payload: { ticketId: string; status: TicketStatus; index: number },
  ): void;
}>();

const localTickets = ref<Ticket[]>([...props.tickets]);

watch(
  () => props.tickets,
  (val) => {
    localTickets.value = [...val];
  },
  { deep: false },
);

interface SortableChange {
  added?: { element: Ticket; newIndex: number };
  moved?: { element: Ticket; newIndex: number };
  removed?: { element: Ticket; oldIndex: number };
}

function onChange(evt: SortableChange) {
  const change = evt.added ?? evt.moved;
  if (!change) return;
  emit('move', {
    ticketId: change.element.ticketId,
    status: props.status,
    index: change.newIndex,
  });
}
</script>

<template>
  <section class="column">
    <header class="column__header">
      <span class="column__title">{{ STATUS_LABELS[status] }}</span>
      <span class="column__count serif">{{ localTickets.length }}</span>
    </header>
    <draggable
      v-model="localTickets"
      :group="{ name: 'tickets', pull: true, put: true }"
      item-key="ticketId"
      ghost-class="is-dragging"
      :animation="180"
      @change="onChange"
    >
      <template #item="{ element }">
        <TicketCard :ticket="element" @open="emit('open', element)" />
      </template>
    </draggable>
    <div v-if="localTickets.length === 0" class="empty" style="padding: 24px 8px">
      <div class="empty__hint mono" style="font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;">
        nothing here yet
      </div>
    </div>
  </section>
</template>
