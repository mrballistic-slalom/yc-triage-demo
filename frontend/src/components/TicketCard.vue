<script setup lang="ts">
import { computed } from 'vue';
import { TYPE_ICONS, type Ticket } from '@/types';

const props = defineProps<{ ticket: Ticket }>();
defineEmits<{ (e: 'open', ticket: Ticket): void }>();

const initials = computed(() => {
  const a = props.ticket.assignee;
  if (!a) return null;
  const parts = a.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join('');
});

const shortId = computed(() => props.ticket.ticketId.slice(0, 6).toUpperCase());
</script>

<template>
  <article
    class="card"
    :data-ticket-id="ticket.ticketId"
    @click="$emit('open', ticket)"
  >
    <div class="card__bar" :class="`is-${ticket.priority}`"></div>
    <div class="card__id mono">
      <v-icon :icon="TYPE_ICONS[ticket.type]" size="11" class="mr-1" />
      {{ shortId }}
    </div>
    <h3 class="card__title">{{ ticket.title }}</h3>
    <div class="card__footer">
      <div class="card__chips">
        <span v-for="label in ticket.labels.slice(0, 3)" :key="label" class="chip">
          {{ label }}
        </span>
      </div>
      <div class="avatar" :class="{ 'avatar--ghost': !initials }">
        {{ initials ?? '—' }}
      </div>
    </div>
    <div v-if="ticket.ai_failed" class="card__warning">
      ai structuring failed — click to edit
    </div>
  </article>
</template>
