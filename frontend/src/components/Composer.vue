<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAiStore } from '@/stores/ai';
import { useBoardStore } from '@/stores/board';

interface SlashCommand {
  name: string;
  hint: string;
  takesArg?: boolean;
}

const COMMANDS: SlashCommand[] = [
  { name: 'ask', hint: 'ask Triage about the project', takesArg: true },
  { name: 'standup', hint: 'refresh today’s digest' },
  { name: 'risks', hint: 'open Ask · what is at risk?' },
  { name: 'groom', hint: 'run an AI grooming pass on the backlog' },
];

const props = defineProps<{ busy: boolean; placeholder?: string }>();
const emit = defineEmits<{ (e: 'submit', value: string): void }>();

const ai = useAiStore();
const board = useBoardStore();
const value = ref('');

const isSlash = computed(() => value.value.startsWith('/'));
const slashHead = computed(() => value.value.slice(1).split(' ')[0].toLowerCase());
const matches = computed(() =>
  isSlash.value
    ? COMMANDS.filter((c) => c.name.startsWith(slashHead.value))
    : [],
);

function complete(name: string) {
  value.value = `/${name} `;
}

function runSlashCommand(name: string, arg: string): boolean {
  switch (name) {
    case 'ask':
      ai.openAsk();
      if (arg) ai.ask(arg);
      return true;
    case 'standup':
      ai.loadDigest(true);
      return true;
    case 'risks':
      ai.openAsk();
      ai.ask('What is most at risk right now, and what should we do about it?');
      return true;
    case 'groom':
      board.runGroom();
      return true;
    default:
      return false;
  }
}

function submit() {
  if (props.busy || ai.asking) return;
  const v = value.value.trim();
  if (!v) return;

  if (v.startsWith('/')) {
    const [head, ...rest] = v.slice(1).split(' ');
    if (runSlashCommand(head.toLowerCase(), rest.join(' ').trim())) {
      value.value = '';
      return;
    }
  }

  emit('submit', v);
  value.value = '';
}
</script>

<template>
  <div class="composer-wrap">
    <div class="composer">
      <span class="composer__caret serif">{{ isSlash ? '⌘' : '/' }}</span>
      <input
        v-model="value"
        class="composer__input"
        :placeholder="placeholder ?? 'describe a task, bug, or feature… or type / for AI'"
        :disabled="busy"
        @keydown.enter.prevent="submit"
      />
      <span v-if="busy" class="thinking" aria-label="AI thinking">
        <span></span><span></span><span></span><span></span>
      </span>
      <span v-else class="composer__hint mono">⏎ to file · / for AI</span>
      <button class="btn btn--primary" :disabled="busy" @click="submit">
        <span v-if="busy">Filing</span>
        <span v-else-if="isSlash">Run</span>
        <span v-else>File ticket</span>
      </button>
    </div>

    <Transition name="palette">
      <div v-if="isSlash && matches.length" class="palette">
        <div
          v-for="cmd in matches"
          :key="cmd.name"
          class="palette__row"
          @click="complete(cmd.name)"
        >
          <span class="palette__name mono">/{{ cmd.name }}</span>
          <span class="palette__hint">{{ cmd.hint }}</span>
          <span v-if="cmd.takesArg" class="palette__arg mono">⟶ takes a question</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style>
.composer-wrap {
  position: relative;
  margin-bottom: 28px;
}

.composer-wrap > .composer {
  margin-bottom: 0;
}

.palette {
  margin-top: 6px;
  background: var(--paper);
  border: 1px solid var(--rule);
  border-radius: 12px;
  padding: 6px;
  box-shadow: var(--shadow-soft);
}

.palette__row {
  display: grid;
  grid-template-columns: 110px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 120ms;
}

.palette__row:hover {
  background: var(--paper-warm);
}

.palette__name {
  font-size: 13px;
  color: var(--ink);
  letter-spacing: 0.04em;
}

.palette__hint {
  font-size: 13px;
  color: var(--ink-soft);
}

.palette__arg {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-faint);
}

.palette-enter-active,
.palette-leave-active {
  transition: opacity 160ms, transform 160ms;
}
.palette-enter-from,
.palette-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
