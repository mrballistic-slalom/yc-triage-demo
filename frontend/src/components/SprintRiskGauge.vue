<script setup lang="ts">
import { onMounted } from 'vue';
import { useAiStore } from '@/stores/ai';

const ai = useAiStore();

onMounted(() => {
  ai.loadRisk();
});

const labelByLevel: Record<'low' | 'medium' | 'high', string> = {
  low: 'on track',
  medium: 'watch closely',
  high: 'at risk',
};
</script>

<template>
  <div class="risk-gauge">
    <div class="risk-gauge__label mono">sprint risk</div>
    <div v-if="ai.riskLoading" class="risk-gauge__pending">
      <span class="thinking" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
      </span>
    </div>
    <template v-else-if="ai.risk">
      <div class="risk-gauge__row">
        <span class="risk-gauge__dot" :class="`risk-gauge__dot--${ai.risk.level}`"></span>
        <span class="risk-gauge__level serif">{{ labelByLevel[ai.risk.level] }}</span>
      </div>
      <div class="risk-gauge__summary">{{ ai.risk.summary }}</div>
    </template>
    <button class="risk-gauge__refresh mono" :disabled="ai.riskLoading" @click="ai.loadRisk(true)">
      ↻
    </button>
  </div>
</template>

<style>
.risk-gauge {
  background: rgba(244, 241, 235, 0.06);
  border: 1px solid rgba(244, 241, 235, 0.15);
  border-radius: 12px;
  padding: 12px 16px 12px 14px;
  width: 320px;
  max-width: 100%;
  color: var(--paper);
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 12px;
  backdrop-filter: blur(6px);
}

.risk-gauge__label {
  grid-column: 1 / span 2;
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(244, 241, 235, 0.5);
}

.risk-gauge__row {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.risk-gauge__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.risk-gauge__dot--low { background: #65A765; box-shadow: 0 0 12px rgba(101, 167, 101, 0.6); }
.risk-gauge__dot--medium { background: #E8B41A; box-shadow: 0 0 12px rgba(232, 180, 26, 0.6); }
.risk-gauge__dot--high { background: var(--signal); box-shadow: 0 0 14px rgba(232, 74, 26, 0.7); }

.risk-gauge__level {
  font-size: 18px;
  line-height: 1;
  color: var(--paper);
}

.risk-gauge__summary {
  grid-column: 1;
  font-size: 12px;
  line-height: 1.4;
  color: rgba(244, 241, 235, 0.78);
  max-width: 38ch;
}

.risk-gauge__refresh {
  grid-column: 2;
  align-self: end;
  background: transparent;
  border: 1px solid rgba(244, 241, 235, 0.2);
  color: rgba(244, 241, 235, 0.7);
  border-radius: 999px;
  width: 24px;
  height: 24px;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 160ms, color 160ms;
}

.risk-gauge__refresh:hover:not(:disabled) {
  border-color: var(--paper);
  color: var(--paper);
}

.risk-gauge__pending {
  grid-column: 1;
  height: 32px;
  display: flex;
  align-items: center;
}
</style>
