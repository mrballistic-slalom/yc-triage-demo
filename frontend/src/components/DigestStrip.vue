<script setup lang="ts">
import { onMounted } from 'vue';
import { useAiStore } from '@/stores/ai';

const ai = useAiStore();

onMounted(() => {
  ai.loadDigest();
});
</script>

<template>
  <aside class="digest" :class="{ 'digest--loading': ai.digestLoading }">
    <span class="digest__eyebrow mono">today’s pulse</span>
    <span v-if="ai.digestLoading" class="digest__shimmer">
      <span class="thinking" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
      </span>
      <span class="digest__shimmer-text">reading the room…</span>
    </span>
    <span v-else-if="ai.digest" class="digest__body">{{ ai.digest }}</span>
    <span v-else class="digest__body digest__body--quiet">No digest available.</span>
    <button
      class="digest__refresh mono"
      :disabled="ai.digestLoading"
      :title="'Refresh digest'"
      @click="ai.loadDigest(true)"
    >
      ↻
    </button>
  </aside>
</template>

<style>
.digest {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  background: var(--paper);
  border: 1px solid var(--rule);
  border-radius: 12px;
  margin-bottom: 18px;
  position: relative;
  overflow: hidden;
}

.digest::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(circle at 12% 50%, rgba(232, 74, 26, 0.06), transparent 30%);
}

.digest__eyebrow {
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-faint);
  flex-shrink: 0;
}

.digest__body {
  flex: 1;
  font-size: 14px;
  color: var(--ink);
  line-height: 1.4;
}

.digest__body--quiet {
  color: var(--ink-faint);
  font-style: italic;
  font-family: var(--font-display);
}

.digest__shimmer {
  flex: 1;
  display: flex;
  gap: 10px;
  align-items: center;
  color: var(--ink-faint);
  font-size: 12px;
}

.digest__shimmer-text {
  font-family: var(--font-display);
  font-style: italic;
}

.digest__refresh {
  flex-shrink: 0;
  background: transparent;
  border: 1px solid var(--rule);
  border-radius: 999px;
  width: 28px;
  height: 28px;
  cursor: pointer;
  color: var(--ink-faint);
  font-size: 14px;
  transition: border-color 160ms, color 160ms, transform 200ms;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.digest__refresh:hover:not(:disabled) {
  border-color: var(--ink);
  color: var(--ink);
}

.digest--loading .digest__refresh { animation: spin 1.4s linear infinite; }

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
