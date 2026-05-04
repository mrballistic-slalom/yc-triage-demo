<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { useSettingsStore } from '@/stores/settings';
import { useBoardStore } from '@/stores/board';
import { useSprintStore } from '@/stores/sprints';

const settings = useSettingsStore();
const board = useBoardStore();
const sprints = useSprintStore();
const route = useRoute();

onMounted(async () => {
  await Promise.allSettled([settings.load(), board.load(), sprints.load()]);
});
</script>

<template>
  <v-app>
    <div class="shell">
      <header class="shell-header">
        <div class="brand">
          <div class="brand__mark">{{ settings.settings.projectName || 'Triage' }}</div>
          <div class="brand__sub">describe the work, not the ticket</div>
        </div>
        <nav class="nav">
          <RouterLink
            class="nav__link"
            :class="{ 'is-active': route.name === 'board' }"
            to="/board"
            >Board</RouterLink
          >
          <RouterLink
            class="nav__link"
            :class="{ 'is-active': route.name === 'sprints' }"
            to="/sprints"
            >Sprints</RouterLink
          >
          <RouterLink
            class="nav__link"
            :class="{ 'is-active': route.name === 'settings' }"
            to="/settings"
            >Settings</RouterLink
          >
        </nav>
      </header>

      <RouterView v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </RouterView>

      <Transition name="toast">
        <div v-if="board.lastError" class="toast">
          {{ board.lastError }}
        </div>
      </Transition>
    </div>
  </v-app>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 160ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 200ms, transform 200ms;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
