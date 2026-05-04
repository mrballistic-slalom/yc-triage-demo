<script setup lang="ts">
import { computed, ref } from 'vue';
import { useSettingsStore } from '@/stores/settings';
import { useBoardStore } from '@/stores/board';

const settings = useSettingsStore();
const board = useBoardStore();

const newMember = ref({ name: '', role: '' });
const newLabel = ref('');
const projectName = ref(settings.settings.projectName);

const labelPalette = ['#E84A1A', '#C8A24B', '#2F4A2A', '#2848FF', '#A33C9F', '#0F766E'];

const usedLabels = computed(() => {
  const set = new Set<string>();
  for (const t of board.tickets) for (const l of t.labels) set.add(l);
  return Array.from(set);
});

async function addMember() {
  const { name, role } = newMember.value;
  if (!name.trim() || !role.trim()) return;
  await settings.save({
    teamMembers: [...settings.settings.teamMembers, { name: name.trim(), role: role.trim() }],
  });
  newMember.value = { name: '', role: '' };
}

async function removeMember(name: string) {
  await settings.save({
    teamMembers: settings.settings.teamMembers.filter((m) => m.name !== name),
  });
}

async function addLabel() {
  const name = newLabel.value.trim().toLowerCase();
  if (!name) return;
  if (settings.settings.labels.some((l) => l.name === name)) return;
  await settings.save({
    labels: [
      ...settings.settings.labels,
      { name, color: labelPalette[settings.settings.labels.length % labelPalette.length] },
    ],
  });
  newLabel.value = '';
}

async function removeLabel(name: string) {
  if (usedLabels.value.includes(name)) return;
  await settings.save({
    labels: settings.settings.labels.filter((l) => l.name !== name),
  });
}

let renameTimer: ReturnType<typeof setTimeout> | null = null;
function onRename() {
  if (renameTimer) clearTimeout(renameTimer);
  renameTimer = setTimeout(() => {
    settings.save({ projectName: projectName.value });
  }, 400);
}
</script>

<template>
  <main class="page">
    <div class="page-eyebrow rise">/ settings</div>
    <h1 class="page-title rise rise-1">
      The shape of <em>your team.</em>
    </h1>
    <p class="page-lede rise rise-2">
      Name the project, list the people, curate the labels. Triage uses these to suggest assignees
      and reuse existing taxonomy when filing tickets.
    </p>

    <div class="settings-grid rise rise-3">
      <section class="panel">
        <h2 class="panel__title">Project</h2>
        <p class="panel__sub">Shown in the header and on every ticket reference.</p>
        <input
          v-model="projectName"
          class="input-line"
          maxlength="80"
          placeholder="Project name"
          style="font-size: 22px; font-family: var(--font-display); font-style: italic;"
          @input="onRename"
        />
      </section>

      <section class="panel">
        <h2 class="panel__title">Labels</h2>
        <p class="panel__sub">
          Reusable tags. Triage will reach for these when filing new tickets.
        </p>
        <div style="margin-bottom: 14px;">
          <span
            v-for="l in settings.settings.labels"
            :key="l.name"
            class="label-pill"
            :style="{ borderColor: l.color + '66' }"
          >
            <span class="label-pill__dot" :style="{ background: l.color }"></span>
            {{ l.name }}
            <span
              style="margin-left: 4px; cursor: pointer; color: var(--ink-faint);"
              :title="usedLabels.includes(l.name) ? 'In use' : 'Remove'"
              @click="removeLabel(l.name)"
              >{{ usedLabels.includes(l.name) ? '·' : '×' }}</span
            >
          </span>
        </div>
        <div style="display: flex; gap: 8px;">
          <input
            v-model="newLabel"
            class="input-line"
            maxlength="30"
            placeholder="add label…"
            @keydown.enter.prevent="addLabel"
          />
          <button class="btn btn--ghost" @click="addLabel">Add</button>
        </div>
      </section>

      <section class="panel" style="grid-column: span 2;">
        <h2 class="panel__title">Team</h2>
        <p class="panel__sub">No login required — names and roles only.</p>

        <div v-if="settings.settings.teamMembers.length === 0" class="empty" style="padding: 32px 16px;">
          <div class="empty__hint">No teammates yet. Add the first below.</div>
        </div>

        <div v-else>
          <div
            v-for="m in settings.settings.teamMembers"
            :key="m.name"
            class="member-row"
          >
            <div>
              <div class="member-row__name">{{ m.name }}</div>
              <div class="member-row__role">{{ m.role }}</div>
            </div>
            <button class="member-row__delete" @click="removeMember(m.name)">remove</button>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 12px; margin-top: 18px;">
          <input
            v-model="newMember.name"
            class="input-line"
            maxlength="60"
            placeholder="Name"
          />
          <input
            v-model="newMember.role"
            class="input-line"
            maxlength="60"
            placeholder="Role · e.g. Frontend Engineer"
            @keydown.enter.prevent="addMember"
          />
          <button class="btn btn--primary" :disabled="!newMember.name.trim() || !newMember.role.trim()" @click="addMember">
            Add member
          </button>
        </div>
      </section>
    </div>
  </main>
</template>
