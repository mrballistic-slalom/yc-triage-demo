<script setup lang="ts">
import { onMounted, ref } from 'vue';

const PASSWORD = 'slalom2026';
const STORAGE_KEY = 'triage:gate:v1';

const open = ref(true);
const value = ref('');
const error = ref(false);
const shake = ref(false);

onMounted(() => {
  if (typeof window === 'undefined') return;
  if (window.localStorage.getItem(STORAGE_KEY) === 'ok') open.value = false;
});

function submit() {
  if (value.value === PASSWORD) {
    window.localStorage.setItem(STORAGE_KEY, 'ok');
    open.value = false;
    return;
  }
  error.value = true;
  shake.value = true;
  window.setTimeout(() => (shake.value = false), 480);
}
</script>

<template>
  <Transition name="gate">
    <div v-if="open" class="gate" role="dialog" aria-modal="true" aria-label="Triage access">
      <div class="gate__bg"></div>
      <div class="gate__card" :class="{ 'gate__card--shake': shake }">
        <div class="gate__eyebrow mono">access · slalom 2026</div>
        <h1 class="gate__title">
          A quiet place<br />
          for <em>noisy work.</em>
        </h1>
        <p class="gate__lede">
          Triage is invite-only during the build. Drop the passphrase to step inside.
        </p>
        <form class="gate__form" @submit.prevent="submit">
          <input
            v-model="value"
            type="password"
            class="gate__input"
            placeholder="passphrase"
            autocomplete="off"
            autofocus
            @input="error = false"
          />
          <button type="submit" class="btn btn--primary gate__submit">Enter</button>
        </form>
        <Transition name="error">
          <div v-if="error" class="gate__error mono">incorrect passphrase</div>
        </Transition>
        <div class="gate__footer mono">
          <span>YC Demo · Triage</span>
          <span>Bedrock · Claude Sonnet 4.5</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style>
.gate {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.gate__bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 22% 18%, rgba(232, 74, 26, 0.16), transparent 38%),
    radial-gradient(circle at 80% 84%, rgba(40, 72, 255, 0.12), transparent 42%),
    var(--paper);
  z-index: -1;
}

.gate__bg::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to bottom, transparent 0, transparent calc(100% - 1px), rgba(20, 17, 15, 0.05) 100%),
    linear-gradient(to right, transparent 0, transparent calc(100% - 1px), rgba(20, 17, 15, 0.04) 100%);
  background-size: 56px 56px;
}

.gate__card {
  position: relative;
  width: min(520px, 100%);
  background: var(--paper);
  border: 1px solid var(--rule);
  border-radius: 22px;
  padding: 40px 44px 32px;
  box-shadow: var(--shadow-lift);
}

.gate__card--shake {
  animation: gate-shake 480ms cubic-bezier(0.36, 0.07, 0.19, 0.97);
}

@keyframes gate-shake {
  10%, 90% { transform: translate3d(-1px, 0, 0); }
  20%, 80% { transform: translate3d(2px, 0, 0); }
  30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
  40%, 60% { transform: translate3d(4px, 0, 0); }
}

.gate__eyebrow {
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-faint);
  margin-bottom: 20px;
}

.gate__title {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 400;
  font-size: 52px;
  line-height: 1;
  letter-spacing: -0.02em;
  margin: 0 0 18px;
}

.gate__title em {
  font-style: normal;
  color: var(--signal);
}

.gate__lede {
  font-size: 15px;
  color: var(--ink-soft);
  line-height: 1.5;
  margin: 0 0 28px;
  max-width: 38ch;
}

.gate__form {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}

.gate__input {
  flex: 1;
  border: 1px solid var(--rule);
  border-radius: 12px;
  background: var(--paper-warm);
  padding: 14px 16px;
  font-size: 16px;
  font-family: var(--font-mono);
  letter-spacing: 0.06em;
  color: var(--ink);
  outline: none;
  transition: border-color 160ms, background 160ms;
}

.gate__input:focus {
  border-color: var(--ink);
  background: var(--paper);
}

.gate__submit {
  padding: 14px 22px;
}

.gate__error {
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--signal-deep);
  margin-bottom: 14px;
}

.gate__footer {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ink-faint);
  padding-top: 22px;
  margin-top: 22px;
  border-top: 1px solid var(--rule);
}

.gate-enter-active,
.gate-leave-active {
  transition: opacity 240ms ease, transform 240ms ease;
}
.gate-enter-from,
.gate-leave-to {
  opacity: 0;
  transform: scale(0.985);
}

.error-enter-active,
.error-leave-active {
  transition: opacity 160ms;
}
.error-enter-from,
.error-leave-to {
  opacity: 0;
}
</style>
