import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/api/client';
import type { SprintRisk } from '@/types';

interface AskExchange {
  id: string;
  question: string;
  answer: string;
  pending: boolean;
  error?: string;
}

export const useAiStore = defineStore('ai', () => {
  const askOpen = ref(false);
  const exchanges = ref<AskExchange[]>([]);
  const asking = ref(false);

  const digest = ref<string | null>(null);
  const digestLoading = ref(false);

  const risk = ref<SprintRisk | null>(null);
  const riskLoading = ref(false);

  function openAsk() {
    askOpen.value = true;
  }
  function closeAsk() {
    askOpen.value = false;
  }

  async function ask(question: string) {
    const id = Math.random().toString(36).slice(2);
    const exchange: AskExchange = { id, question, answer: '', pending: true };
    exchanges.value.unshift(exchange);
    asking.value = true;
    try {
      const { answer } = await api.ask(question);
      const idx = exchanges.value.findIndex((e) => e.id === id);
      if (idx >= 0) exchanges.value[idx] = { ...exchange, answer, pending: false };
    } catch (err) {
      const idx = exchanges.value.findIndex((e) => e.id === id);
      if (idx >= 0)
        exchanges.value[idx] = {
          ...exchange,
          pending: false,
          error: (err as Error).message,
        };
    } finally {
      asking.value = false;
    }
  }

  async function loadDigest(force = false) {
    if (digestLoading.value) return;
    if (digest.value && !force) return;
    digestLoading.value = true;
    try {
      const { digest: result } = await api.digest();
      digest.value = result;
    } catch {
      digest.value = null;
    } finally {
      digestLoading.value = false;
    }
  }

  async function loadRisk(force = false) {
    if (riskLoading.value) return;
    if (risk.value && !force) return;
    riskLoading.value = true;
    try {
      risk.value = await api.risk();
    } catch {
      risk.value = null;
    } finally {
      riskLoading.value = false;
    }
  }

  function clearExchanges() {
    exchanges.value = [];
  }

  return {
    askOpen,
    exchanges,
    asking,
    digest,
    digestLoading,
    risk,
    riskLoading,
    openAsk,
    closeAsk,
    ask,
    loadDigest,
    loadRisk,
    clearExchanges,
  };
});
