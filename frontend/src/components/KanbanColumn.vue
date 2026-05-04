<script setup lang="ts">
import draggable from 'vuedraggable';
import { STATUS_LABELS, type Ticket, type TicketStatus } from '@/types';
import TicketCard from './TicketCard.vue';

const props = defineProps<{
  status: TicketStatus;
  tickets: Ticket[];
}>();

const emit = defineEmits<{
  (e: 'open', ticket: Ticket): void;
  (e: 'change', payload: { status: TicketStatus; tickets: Ticket[] }): void;
}>();

function onChange(value: Ticket[]) {
  emit('change', { status: props.status, tickets: value });
}
</script>

<template>
  <section class="column">
    <header class="column__header">
      <span class="column__title">{{ STATUS_LABELS[status] }}</span>
      <span class="column__count serif">{{ tickets.length }}</span>
    </header>
    <draggable
      :model-value="tickets"
      :group="{ name: 'tickets', pull: true, put: true }"
      item-key="ticketId"
      ghost-class="is-dragging"
      :animation="180"
      @update:model-value="onChange"
    >
      <template #item="{ element }">
        <TicketCard :ticket="element" @open="emit('open', element)" />
      </template>
    </draggable>
    <div v-if="tickets.length === 0" class="empty" style="padding: 24px 8px">
      <div class="empty__hint mono" style="font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;">
        nothing here yet
      </div>
    </div>
  </section>
</template>
