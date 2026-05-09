<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useBoardStore } from '@/stores/board';
import { useSettingsStore } from '@/stores/settings';
import { api } from '@/api/client';
import {
  STATUS_LABELS,
  STATUS_ORDER,
  type Priority,
  type Ticket,
  type TicketStatus,
  type TicketType,
} from '@/types';

const props = defineProps<{ ticket: Ticket | null }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const board = useBoardStore();
const settings = useSettingsStore();

const local = ref<Ticket | null>(null);
const open = computed({
  get: () => props.ticket !== null,
  set: (v) => {
    if (!v) emit('close');
  },
});

const labelInput = ref('');
const confirmDelete = ref(false);
const aiInstruction = ref('');
const aiBusy = ref(false);
const aiPatch = ref<Partial<Ticket> | null>(null);
const aiError = ref<string | null>(null);

watch(
  () => props.ticket,
  (t) => {
    local.value = t ? { ...t } : null;
    confirmDelete.value = false;
    labelInput.value = '';
    aiInstruction.value = '';
    aiPatch.value = null;
    aiError.value = null;
  },
  { immediate: true },
);

async function applyAiEdit() {
  if (!local.value || !aiInstruction.value.trim() || aiBusy.value) return;
  aiBusy.value = true;
  aiError.value = null;
  aiPatch.value = null;
  try {
    const result = await api.aiEdit(local.value.ticketId, aiInstruction.value.trim());
    local.value = { ...local.value, ...result.ticket };
    aiPatch.value = result.patch;
    await board.load();
    aiInstruction.value = '';
  } catch (err) {
    aiError.value = (err as Error).message;
  } finally {
    aiBusy.value = false;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave(patch: Partial<Ticket>) {
  if (!local.value) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (local.value) board.update(local.value.ticketId, patch);
  }, 500);
}

function setField<K extends keyof Ticket>(key: K, value: Ticket[K]) {
  if (!local.value) return;
  local.value = { ...local.value, [key]: value };
  scheduleSave({ [key]: value } as Partial<Ticket>);
}

function addLabel() {
  if (!local.value || !labelInput.value.trim()) return;
  const next = [...local.value.labels, labelInput.value.trim()].slice(0, 6);
  setField('labels', next);
  labelInput.value = '';
}

function removeLabel(label: string) {
  if (!local.value) return;
  setField('labels', local.value.labels.filter((l) => l !== label));
}

function remove() {
  if (!local.value) return;
  if (!confirmDelete.value) {
    confirmDelete.value = true;
    return;
  }
  board.remove(local.value.ticketId);
  emit('close');
}

const priorities: Priority[] = ['critical', 'high', 'medium', 'low'];
const types: TicketType[] = ['bug', 'feature', 'task', 'chore'];
const statuses: TicketStatus[] = STATUS_ORDER;
</script>

<template>
  <v-navigation-drawer
    v-model="open"
    location="right"
    width="460"
    temporary
    class="drawer"
  >
    <button class="drawer__close mono" @click="emit('close')">CLOSE ✕</button>
    <div v-if="local">
      <div class="drawer__eyebrow">
        Ticket · <span class="mono">{{ local.ticketId.slice(0, 8).toUpperCase() }}</span>
      </div>
      <textarea
        class="drawer__title-input"
        rows="2"
        :value="local.title"
        @input="setField('title', ($event.target as HTMLTextAreaElement).value)"
      ></textarea>

      <div class="drawer__meta">
        <div class="drawer__meta-label">Status</div>
        <v-select
          :model-value="local.status"
          :items="statuses.map((s) => ({ title: STATUS_LABELS[s], value: s }))"
          variant="outlined"
          density="compact"
          hide-details
          @update:model-value="(v) => setField('status', v as TicketStatus)"
        />

        <div class="drawer__meta-label">Priority</div>
        <v-select
          :model-value="local.priority"
          :items="priorities.map((p) => ({ title: p, value: p }))"
          variant="outlined"
          density="compact"
          hide-details
          @update:model-value="(v) => setField('priority', v as Priority)"
        />

        <div class="drawer__meta-label">Type</div>
        <v-select
          :model-value="local.type"
          :items="types.map((t) => ({ title: t, value: t }))"
          variant="outlined"
          density="compact"
          hide-details
          @update:model-value="(v) => setField('type', v as TicketType)"
        />

        <div class="drawer__meta-label">Assignee</div>
        <v-select
          :model-value="local.assignee"
          :items="[
            { title: 'Unassigned', value: null },
            ...settings.settings.teamMembers.map((m) => ({ title: m.name, value: m.name })),
          ]"
          variant="outlined"
          density="compact"
          hide-details
          @update:model-value="(v) => setField('assignee', v as string | null)"
        />

        <div class="drawer__meta-label">Labels</div>
        <div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px;">
            <span v-for="label in local.labels" :key="label" class="chip">
              {{ label }}
              <button
                type="button"
                class="chip__close"
                :aria-label="`Remove label ${label}`"
                @click="removeLabel(label)"
              >×</button>
            </span>
          </div>
          <input
            v-model="labelInput"
            class="input-line"
            placeholder="add label + ⏎"
            @keydown.enter.prevent="addLabel"
          />
        </div>
      </div>

      <div class="drawer__eyebrow">Description</div>
      <textarea
        class="drawer__desc"
        :value="local.description"
        placeholder="Add detail…"
        @input="setField('description', ($event.target as HTMLTextAreaElement).value)"
      ></textarea>

      <div class="drawer__ai">
        <div class="drawer__eyebrow" style="margin-top: 22px;">Edit with AI</div>
        <form class="drawer__ai-form" @submit.prevent="applyAiEdit">
          <input
            v-model="aiInstruction"
            class="ask__input"
            placeholder="e.g. bump to high, assign Alex Park, label as auth"
            :disabled="aiBusy"
            style="font-size: 13px;"
          />
          <button
            type="submit"
            class="btn btn--primary"
            :disabled="aiBusy || !aiInstruction.trim()"
          >
            <span v-if="aiBusy" class="thinking" aria-hidden="true">
              <span></span><span></span><span></span><span></span>
            </span>
            <span v-else>Apply</span>
          </button>
        </form>
        <div v-if="aiPatch && Object.keys(aiPatch).length" class="drawer__ai-result mono">
          applied:
          <span v-for="(v, k) in aiPatch" :key="k" class="chip" style="margin-right: 4px;">
            {{ k }}: {{ Array.isArray(v) ? v.join(', ') : (v ?? '∅') }}
          </span>
        </div>
        <div v-else-if="aiPatch" class="drawer__ai-result mono">no change inferred.</div>
        <div v-if="aiError" class="drawer__ai-error mono">{{ aiError }}</div>
      </div>

      <div class="drawer__actions">
        <button class="btn btn--ghost" @click="emit('close')">Done</button>
        <button class="btn" :class="confirmDelete ? 'btn--accent' : 'btn--ghost'" @click="remove">
          {{ confirmDelete ? 'Confirm delete' : 'Delete ticket' }}
        </button>
      </div>
    </div>
  </v-navigation-drawer>
</template>
