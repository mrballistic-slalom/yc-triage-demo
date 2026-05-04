import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/api/client';
import type { Settings } from '@/types';

const DEFAULT_SETTINGS: Settings = {
  projectName: 'Triage',
  teamMembers: [],
  labels: [],
};

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>({ ...DEFAULT_SETTINGS });
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      settings.value = await api.getSettings();
    } catch (err) {
      error.value = (err as Error).message;
    } finally {
      loading.value = false;
    }
  }

  async function save(patch: Partial<Settings>) {
    settings.value = { ...settings.value, ...patch };
    try {
      settings.value = await api.updateSettings(patch);
    } catch (err) {
      error.value = (err as Error).message;
    }
  }

  return { settings, loading, error, load, save };
});
