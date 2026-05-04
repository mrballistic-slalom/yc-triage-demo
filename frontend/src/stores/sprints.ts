import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '@/api/client';
import type { Sprint } from '@/types';

export const useSprintStore = defineStore('sprints', () => {
  const sprints = ref<Sprint[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const active = computed(() => sprints.value.find((s) => s.status === 'active') ?? null);

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      sprints.value = await api.listSprints();
    } catch (err) {
      error.value = (err as Error).message;
    } finally {
      loading.value = false;
    }
  }

  async function create(name: string, duration: 1 | 2) {
    const sprint = await api.createSprint(name, duration);
    sprints.value.push(sprint);
    return sprint;
  }

  async function update(id: string, patch: Partial<Sprint>) {
    const updated = await api.updateSprint(id, patch);
    const idx = sprints.value.findIndex((s) => s.sprintId === id);
    if (idx >= 0) sprints.value[idx] = updated;
    return updated;
  }

  async function complete(id: string) {
    await api.completeSprint(id);
    const idx = sprints.value.findIndex((s) => s.sprintId === id);
    if (idx >= 0) sprints.value[idx] = { ...sprints.value[idx], status: 'completed' };
  }

  return { sprints, loading, error, active, load, create, update, complete };
});
