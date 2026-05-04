<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{ busy: boolean; placeholder?: string }>();
const emit = defineEmits<{ (e: 'submit', value: string): void }>();

const value = ref('');

function submit() {
  if (props.busy) return;
  const v = value.value.trim();
  if (!v) return;
  emit('submit', v);
  value.value = '';
}
</script>

<template>
  <div class="composer">
    <span class="composer__caret serif">/</span>
    <input
      v-model="value"
      class="composer__input"
      :placeholder="placeholder ?? 'describe a task, bug, or feature…'"
      :disabled="busy"
      @keydown.enter.prevent="submit"
    />
    <span v-if="busy" class="thinking" aria-label="AI thinking">
      <span></span><span></span><span></span><span></span>
    </span>
    <span v-else class="composer__hint mono">⏎ to file</span>
    <button class="btn btn--primary" :disabled="busy" @click="submit">
      <span v-if="busy">Filing</span>
      <span v-else>File ticket</span>
    </button>
  </div>
</template>
