<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAiStore } from '@/stores/ai';
import { renderMarkdown } from '@/lib/markdown';

const ai = useAiStore();
const value = ref('');

const STARTERS = [
  'What is most at risk right now?',
  'Who is overloaded?',
  'What shipped this week?',
  'Summarize the backlog by theme.',
  'Which critical tickets have no assignee?',
];

const open = computed({
  get: () => ai.askOpen,
  set: (v) => {
    if (v) ai.openAsk();
    else ai.closeAsk();
  },
});

function submit() {
  const q = value.value.trim();
  if (!q || ai.asking) return;
  ai.ask(q);
  value.value = '';
}

function quickAsk(q: string) {
  if (ai.asking) return;
  ai.ask(q);
}
</script>

<template>
  <v-navigation-drawer
    v-model="open"
    location="right"
    width="520"
    temporary
    class="ask"
  >
    <button class="drawer__close mono" @click="ai.closeAsk()">CLOSE ✕</button>
    <div class="ask__inner">
      <div class="drawer__eyebrow">Ask Triage</div>
      <h2 class="ask__title">A second pair of eyes<br />on <em>everything.</em></h2>
      <p class="ask__lede">
        Triage knows the backlog, the team, and the active sprint. Ask anything you
        would ask a senior teammate.
      </p>

      <div class="ask__starters">
        <button
          v-for="s in STARTERS"
          :key="s"
          class="ask__starter"
          :disabled="ai.asking"
          @click="quickAsk(s)"
        >
          {{ s }}
        </button>
      </div>

      <form class="ask__form" @submit.prevent="submit">
        <input
          v-model="value"
          class="ask__input"
          placeholder="ask Triage anything…"
          :disabled="ai.asking"
        />
        <button type="submit" class="btn btn--primary" :disabled="ai.asking || !value.trim()">
          <span v-if="ai.asking" class="thinking" aria-hidden="true">
            <span></span><span></span><span></span><span></span>
          </span>
          <span v-else>Ask</span>
        </button>
      </form>

      <div v-if="ai.exchanges.length === 0" class="ask__empty">
        <span class="mono">no questions yet · pick a prompt above</span>
      </div>

      <div v-else class="ask__feed">
        <article v-for="ex in ai.exchanges" :key="ex.id" class="ask__exchange">
          <div class="ask__question">{{ ex.question }}</div>
          <div v-if="ex.pending" class="ask__pending mono">
            <span class="thinking">
              <span></span><span></span><span></span><span></span>
            </span>
            thinking…
          </div>
          <div v-else-if="ex.error" class="ask__error mono">
            {{ ex.error }}
          </div>
          <div
            v-else
            class="ask__answer markdown"
            v-html="renderMarkdown(ex.answer)"
          ></div>
        </article>
      </div>

      <div v-if="ai.exchanges.length > 0" class="ask__footer">
        <button class="btn btn--ghost" @click="ai.clearExchanges()">Clear</button>
      </div>
    </div>
  </v-navigation-drawer>
</template>

<style>
.ask {
  background: var(--paper) !important;
  border-left: 1px solid var(--rule) !important;
}

.ask__inner {
  padding: 28px 28px 32px;
}

.ask__title {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 400;
  font-size: 36px;
  line-height: 1;
  letter-spacing: -0.02em;
  margin: 6px 0 14px;
}

.ask__title em {
  font-style: normal;
  color: var(--signal);
}

.ask__lede {
  font-size: 14px;
  color: var(--ink-soft);
  line-height: 1.5;
  margin: 0 0 20px;
  max-width: 44ch;
}

.ask__starters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 18px;
}

.ask__starter {
  background: var(--paper-warm);
  border: 1px solid var(--rule-soft);
  border-radius: 999px;
  padding: 7px 12px;
  font-size: 12px;
  color: var(--ink-soft);
  font-family: var(--font-body);
  cursor: pointer;
  transition: border-color 160ms, color 160ms, background 160ms;
}

.ask__starter:hover:not(:disabled) {
  border-color: var(--ink);
  color: var(--ink);
}

.ask__starter:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ask__form {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.ask__input {
  flex: 1;
  border: 1px solid var(--rule);
  border-radius: 12px;
  background: var(--paper);
  padding: 12px 14px;
  font-family: var(--font-body);
  font-size: 14px;
  outline: none;
  transition: border-color 160ms;
}

.ask__input:focus {
  border-color: var(--ink);
}

.ask__empty {
  color: var(--ink-faint);
  text-align: center;
  padding: 28px 0;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.ask__feed {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.ask__exchange {
  border-top: 1px solid var(--rule-soft);
  padding-top: 16px;
}

.ask__question {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 400;
  font-size: 18px;
  line-height: 1.3;
  color: var(--ink);
  margin-bottom: 10px;
}

.ask__pending {
  color: var(--ink-faint);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  display: flex;
  gap: 8px;
  align-items: center;
}

.ask__error {
  color: var(--signal-deep);
  font-size: 11px;
  letter-spacing: 0.06em;
}

.ask__answer.markdown {
  font-size: 14px;
  line-height: 1.55;
  color: var(--ink);
}

.ask__answer.markdown p { margin: 0 0 10px; }
.ask__answer.markdown p:last-child { margin-bottom: 0; }
.ask__answer.markdown ul,
.ask__answer.markdown ol {
  margin: 8px 0 10px;
  padding-left: 22px;
}
.ask__answer.markdown li { margin-bottom: 4px; }
.ask__answer.markdown li:last-child { margin-bottom: 0; }
.ask__answer.markdown strong { color: var(--ink); }
.ask__answer.markdown em { font-style: italic; font-family: var(--font-display); }
.ask__answer.markdown code {
  font-family: var(--font-mono);
  font-size: 12px;
  background: var(--paper-warm);
  padding: 1px 6px;
  border-radius: 4px;
  letter-spacing: 0.02em;
}
.ask__answer.markdown a {
  color: var(--signal);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}

.ask__footer {
  margin-top: 20px;
  padding-top: 18px;
  border-top: 1px solid var(--rule);
  display: flex;
  justify-content: flex-end;
}
</style>
