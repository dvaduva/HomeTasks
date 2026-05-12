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

    <div v-if="state.confirms.length" class="confirm-overlay">
      <div
        v-for="c in state.confirms"
        :key="c.id"
        class="confirm-dialog"
        role="alertdialog"
      >
        <p class="confirm-message">{{ c.message }}</p>
        <div class="confirm-actions">
          <button class="btn btn-secondary" @click="resolveConfirm(c.id, false)">
            {{ c.cancelLabel || $t('btn_cancel') }}
          </button>
          <button class="btn btn-primary" @click="resolveConfirm(c.id, true)" autofocus>
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
  top: 1rem;
  right: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  pointer-events: auto;
}
.toast {
  min-width: 220px;
  max-width: 360px;
  padding: 0.65rem 0.9rem;
  border-radius: 6px;
  background: #333;
  color: #fff;
  font-size: 0.9rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  cursor: pointer;
}
.toast-success { background: #2e7d32; }
.toast-error { background: #c62828; }
.toast-info { background: #1565c0; }

.toast-enter-from { opacity: 0; transform: translateX(20px); }
.toast-enter-active, .toast-leave-active { transition: all 0.2s ease; }
.toast-leave-to { opacity: 0; transform: translateX(20px); }

.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  z-index: 10000;
}
.confirm-dialog {
  background: #fff;
  border-radius: 8px;
  padding: 1.25rem 1.5rem;
  min-width: 280px;
  max-width: 460px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
}
.confirm-message {
  margin: 0 0 1rem;
  font-size: 1rem;
  white-space: pre-wrap;
}
.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
.btn {
  padding: 0.45rem 1rem;
  border-radius: 5px;
  border: 1px solid transparent;
  font-size: 0.9rem;
  cursor: pointer;
}
.btn-primary { background: #1976d2; color: #fff; }
.btn-primary:hover { background: #1565c0; }
.btn-secondary { background: #eee; color: #333; }
.btn-secondary:hover { background: #ddd; }
</style>
