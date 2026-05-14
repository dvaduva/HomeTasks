<script setup lang="ts">
import { useNotification } from '@/composables/useNotification';

const { state, dismiss, resolveConfirm } = useNotification();
</script>

<template>
  <div class="toast-host" aria-live="polite">
    <transition-group name="toast" tag="div" class="toast-stack">
      <div
        v-for="t in state.toasts"
        :key="t.id"
        class="toast"
        :class="`toast-${t.kind}`"
        @click="dismiss(t.id)"
      >
        {{ t.message }}
      </div>
    </transition-group>

    <div v-if="state.confirms.length" class="modal-overlay active confirm-overlay">
      <div
        v-for="c in state.confirms"
        :key="c.id"
        class="modal confirm-dialog"
        role="alertdialog"
      >
        <div class="modal-head">
          <h2>{{ c.confirmLabel ? '' : $t('btn_confirm') }}</h2>
        </div>
        <div class="tab-content active" style="display:flex;">
          <p class="confirm-message">{{ c.message }}</p>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" @click="resolveConfirm(c.id, false)">
            {{ c.cancelLabel || $t('btn_cancel') }}
          </button>
          <button type="button" class="btn btn-primary" autofocus @click="resolveConfirm(c.id, true)">
            {{ c.confirmLabel || $t('btn_confirm') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
}
.toast-stack {
  position: fixed;
  top: 14px;
  right: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: auto;
}
.toast {
  min-width: 220px;
  max-width: 360px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  background: #1e3a5f;
  color: #fff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.20);
  cursor: pointer;
}
.toast-success { background: #16a34a; }
.toast-error   { background: #dc2626; }
.toast-info    { background: #1d4ed8; }

.toast-enter-from { opacity: 0; transform: translateX(20px); }
.toast-enter-active, .toast-leave-active { transition: all 0.2s ease; }
.toast-leave-to { opacity: 0; transform: translateX(20px); }

/* .toast-host disables pointer-events so toasts don't block the page; the
   confirm dialog must re-enable them or its buttons are dead and the backdrop
   lets clicks fall through to the page behind (i.e. it isn't actually modal). */
.confirm-overlay { z-index: 2000; pointer-events: auto; }
.confirm-dialog { width: min(440px, calc(100% - 24px)); }
.confirm-message {
  font-size: 14px;
  white-space: pre-wrap;
  margin: 0;
  color: #334155;
}
</style>
