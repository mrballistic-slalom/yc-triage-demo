<script setup lang="ts">
import { computed } from 'vue';
import { useBoardStore } from '@/stores/board';

const board = useBoardStore();
const emit = defineEmits<{ (e: 'close'): void }>();

const open = computed({
  get: () => board.groomResult !== null || board.grooming || board.groomError !== null,
  set: (v) => {
    if (!v) {
      board.clearGroom();
      emit('close');
    }
  },
});

function ticketTitle(id: string): string {
  return board.tickets.find((t) => t.ticketId === id)?.title ?? id;
}
</script>

<template>
  <v-dialog v-model="open" max-width="920" persistent>
    <div class="groom">
      <header class="groom__header">
        <div class="groom__eyebrow">AI grooming pass</div>
        <h2 class="groom__title">Backlog, reconsidered.</h2>
      </header>

      <div class="groom__body">
        <div v-if="board.grooming" style="padding: 40px 0; text-align: center;">
          <div class="thinking" style="height: 28px;">
            <span style="height: 28px;"></span>
            <span style="height: 28px;"></span>
            <span style="height: 28px;"></span>
            <span style="height: 28px;"></span>
          </div>
          <div class="page-eyebrow" style="margin-top: 14px;">analyzing backlog…</div>
        </div>

        <div v-else-if="board.groomError">
          <div class="empty">
            <div class="empty__title">Grooming failed</div>
            <div class="empty__hint">try again in a moment.</div>
            <button class="btn btn--primary" style="margin-top: 18px;" @click="board.runGroom()">
              Retry
            </button>
          </div>
        </div>

        <div v-else-if="board.groomResult">
        <section class="groom__section">
          <div class="groom__section-title">
            <span class="count">{{ board.groomResult.duplicates.length }}</span>
            <span>likely duplicates</span>
          </div>
          <div v-if="board.groomResult.duplicates.length === 0" class="page-lede">
            No duplicate pairs surfaced.
          </div>
          <div
            v-for="dup in board.groomResult.duplicates"
            :key="`${dup.keepId}-${dup.deleteId}`"
            class="groom__row"
          >
            <div class="groom__row-body">
              <div style="font-weight: 500; font-size: 14px;">
                Keep · {{ ticketTitle(dup.keepId) }}
              </div>
              <div style="font-size: 13px; color: var(--ink-faint); margin: 2px 0;">
                Merge & remove · {{ ticketTitle(dup.deleteId) }}
              </div>
              <div class="groom__row-rationale">{{ dup.rationale }}</div>
            </div>
            <div class="groom__row-actions">
              <button
                class="btn btn--ghost"
                @click="board.dismissDuplicate(dup.keepId, dup.deleteId)"
              >
                Dismiss
              </button>
              <button class="btn btn--primary" @click="board.applyMerge(dup.keepId, dup.deleteId)">
                Merge
              </button>
            </div>
          </div>
        </section>

        <section class="groom__section">
          <div class="groom__section-title">
            <span class="count">{{ board.groomResult.priorityChanges.length }}</span>
            <span>priority adjustments</span>
          </div>
          <div v-if="board.groomResult.priorityChanges.length === 0" class="page-lede">
            Priorities look right as filed.
          </div>
          <div
            v-for="change in board.groomResult.priorityChanges"
            :key="change.ticketId"
            class="groom__row"
          >
            <div class="groom__row-body">
              <div style="font-weight: 500; font-size: 14px;">
                {{ ticketTitle(change.ticketId) }}
              </div>
              <div style="font-size: 13px; margin: 2px 0;">
                <span class="mono" style="text-transform: uppercase; letter-spacing: 0.06em;">
                  → {{ change.newPriority }}
                </span>
              </div>
              <div class="groom__row-rationale">{{ change.rationale }}</div>
            </div>
            <div class="groom__row-actions">
              <button class="btn btn--ghost" @click="board.dismissPriority(change.ticketId)">
                Dismiss
              </button>
              <button
                class="btn btn--primary"
                @click="board.applyPriority(change.ticketId, change.newPriority)"
              >
                Accept
              </button>
            </div>
          </div>
        </section>

        <section class="groom__section">
          <div class="groom__section-title">
            <span class="count">{{ board.groomResult.groups.length }}</span>
            <span>suggested groups</span>
          </div>
          <div v-if="board.groomResult.groups.length === 0" class="page-lede">
            No clear epics emerged this pass.
          </div>
          <div v-for="group in board.groomResult.groups" :key="group.name" class="groom__row">
            <div class="groom__row-body">
              <div style="font-weight: 500; font-size: 14px;">{{ group.name }}</div>
              <div class="groom__row-rationale" style="font-style: normal; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.04em; color: var(--ink-faint);">
                {{ group.ticketIds.length }} tickets ·
                {{ group.ticketIds.map(ticketTitle).slice(0, 3).join(' · ') }}
              </div>
            </div>
          </div>
        </section>

        </div>
      </div>

      <footer v-if="board.groomResult" class="groom__footer">
        <button class="btn btn--primary" @click="open = false">Done</button>
      </footer>
    </div>
  </v-dialog>
</template>
